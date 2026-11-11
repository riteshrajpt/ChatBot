using System;
using System.Data.SqlClient;
using System.IO;
using System.Net;
using System.Net.Mail;
using System.Threading;
using System.Threading.Tasks;
using Dapper;
using Microsoft.Extensions.Configuration;
using Microsoft.Extensions.Hosting;
using Microsoft.Extensions.Logging;

namespace AChatBotApi.Services
{
    public static class EmailQueue
    {
        public const string Directors="compileon.directors@gmail.com";
        public static string SiteUrl(IConfiguration config)=>(config["Mail:PublicSiteUrl"]??"http://127.0.0.1:4200").TrimEnd('/');
        public static Task AddAsync(SqlConnection connection,SqlTransaction transaction,Guid entityId,string key,string recipient,string subject,string body)
        {
            return connection.ExecuteAsync(@"IF NOT EXISTS(SELECT 1 FROM dbo.EmailOutbox WITH(UPDLOCK,HOLDLOCK) WHERE DedupeKey=@key)
                INSERT dbo.EmailOutbox(Id,EntityId,DedupeKey,Recipient,Subject,Body) VALUES(NEWID(),@entityId,@key,@recipient,@subject,@body);",
                new{entityId,key,recipient,subject,body},transaction);
        }
    }
    public class EmailDeliveryWorker:BackgroundService
    {
        private readonly IConfiguration config;
        private readonly ILogger<EmailDeliveryWorker> logger;
        public EmailDeliveryWorker(IConfiguration config,ILogger<EmailDeliveryWorker> logger){this.config=config;this.logger=logger;}
        protected override async Task ExecuteAsync(CancellationToken stop)
        {
            while(!stop.IsCancellationRequested)
            {
                try
                {
                    var mode=config["Mail:Mode"]??"Disabled";
                    if(mode=="Smtp" || mode=="Pickup")
                    {
                        using var connection=new SqlConnection(config.GetConnectionString("Dbconnection"));
                        var row=await connection.QuerySingleOrDefaultAsync<EmailRow>(@";WITH candidate AS(
                            SELECT TOP(1)* FROM dbo.EmailOutbox WITH(UPDLOCK,READPAST,ROWLOCK)
                            WHERE ([Status]=N'Pending' AND NextAttemptAt<=SYSUTCDATETIME())
                            OR ([Status]=N'Sending' AND LeaseUntil<SYSUTCDATETIME()) ORDER BY CreatedAt)
                            UPDATE candidate SET [Status]=N'Sending',LeaseUntil=DATEADD(minute,2,SYSUTCDATETIME()),Attempts=Attempts+1 OUTPUT INSERTED.*;");
                        if(row!=null)
                        {
                            try
                            {
                                using var message=new MailMessage();
                                message.From=new MailAddress(config["Mail:FromAddress"],config["Mail:FromName"]??"Compileon Innovation");
                                message.To.Add(new MailAddress(row.Recipient));message.Subject=row.Subject;message.Body=row.Body;
                                message.IsBodyHtml=false;message.BodyEncoding=System.Text.Encoding.UTF8;message.SubjectEncoding=System.Text.Encoding.UTF8;
                                using var smtp=new SmtpClient();
                                if(mode=="Pickup")
                                {
                                    var directory=config["Mail:PickupDirectory"];
                                    if(string.IsNullOrWhiteSpace(directory))throw new InvalidOperationException("Email preview directory is not configured.");
                                    Directory.CreateDirectory(directory);smtp.DeliveryMethod=SmtpDeliveryMethod.SpecifiedPickupDirectory;smtp.PickupDirectoryLocation=directory;
                                }
                                else
                                {
                                    smtp.Host=config["Mail:Host"];smtp.Port=config.GetValue<int>("Mail:Port",587);
                                    smtp.EnableSsl=config.GetValue<bool>("Mail:EnableSsl",true);
                                    smtp.UseDefaultCredentials=false;smtp.Credentials=new NetworkCredential(config["Mail:Username"],config["Mail:Password"]);smtp.Timeout=30000;
                                }
                                await smtp.SendMailAsync(message);
                                await connection.ExecuteAsync("UPDATE dbo.EmailOutbox SET [Status]=@status,SentAt=SYSUTCDATETIME(),LeaseUntil=NULL,LastError=NULL WHERE Id=@Id;",
                                    new{row.Id,status=mode=="Pickup"?"Previewed":"Sent"});
                            }
                            catch(Exception ex)
                            {
                                var detail=ex is SmtpException smtpError?"SMTP delivery failed ("+smtpError.StatusCode+"). Check mailbox authentication and sender permissions.":"Email delivery failed. Check the configured mail transport.";
                                await connection.ExecuteAsync(@"UPDATE dbo.EmailOutbox SET [Status]=CASE WHEN Attempts>=5 THEN N'Failed' ELSE N'Pending' END,
                                    NextAttemptAt=DATEADD(minute,CASE WHEN Attempts<5 THEN Attempts*2 ELSE 30 END,SYSUTCDATETIME()),LeaseUntil=NULL,LastError=@detail WHERE Id=@Id;",new{row.Id,detail});
                                logger.LogWarning("An email remains queued after a delivery failure.");
                            }
                            continue;
                        }
                    }
                }
                catch(Exception){logger.LogWarning("Email queue is temporarily unavailable.");}
                try{await Task.Delay(3000,stop);}catch(OperationCanceledException){break;}
            }
        }
        private class EmailRow
        {
            public Guid Id{get;set;}
            public string Recipient{get;set;}
            public string Subject{get;set;}
            public string Body{get;set;}
        }
    }
}

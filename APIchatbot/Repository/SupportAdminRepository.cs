using System;
using System.Linq;
using System.Threading.Tasks;
using System.Data.SqlClient;
using AChatBotApi.Services;
using Dapper;
using Microsoft.AspNetCore.SignalR;

namespace AChatBotApi.Repository
{
    public class SupportOverview
    {public int Waiting{get;set;}public int Active{get;set;}public int NewInquiries{get;set;}public int EmailPending{get;set;}public int EmailFailed{get;set;}}
    public class InquiryRecord
    {
        public Guid Id{get;set;}public string FullName{get;set;}public string Email{get;set;}public string Service{get;set;}
        public string Brief{get;set;}public string Status{get;set;}public DateTimeOffset CreatedAt{get;set;}
    }
    public class InquiryReplyRequest{public Guid Id{get;set;}public string Body{get;set;}}
    public class InquiryResponseRecord{public Guid Id{get;set;}public string Body{get;set;}public DateTimeOffset CreatedAt{get;set;}public string DisplayName{get;set;}}
    public class EmailRecord
    {
        public Guid Id{get;set;}public Guid EntityId{get;set;}public string Recipient{get;set;}public string Subject{get;set;}
        public string Status{get;set;}public int Attempts{get;set;}public string LastError{get;set;}
        public DateTimeOffset CreatedAt{get;set;}public DateTimeOffset? SentAt{get;set;}
    }
    public partial class SupportRepository
    {
        public async Task<SupportOverview> OverviewAsync()
        {
            using var connection=new SqlConnection(connectionString);
            return await connection.QuerySingleAsync<SupportOverview>(@"SELECT
                (SELECT COUNT(*) FROM dbo.SupportTickets WHERE [Status]=N'Waiting') Waiting,
                (SELECT COUNT(*) FROM dbo.SupportTickets WHERE [Status]=N'Active') Active,
                (SELECT COUNT(*) FROM dbo.WebsiteInquiries WHERE [Status]=N'New') NewInquiries,
                (SELECT COUNT(*) FROM dbo.EmailOutbox WHERE [Status] IN(N'Pending',N'Sending')) EmailPending,
                (SELECT COUNT(*) FROM dbo.EmailOutbox WHERE [Status]=N'Failed') EmailFailed;");
        }
        public async Task<AdminSummary[]> AdminsAsync()
        {
            using var connection=new SqlConnection(connectionString);
            var rows=await connection.QueryAsync<AdminSummary>(@"SELECT Id,DisplayName,Email,IsAvailable,
                CONVERT(bit,CASE WHEN LastSeenAt>DATEADD(second,-65,SYSUTCDATETIME()) THEN 1 ELSE 0 END) IsOnline
                FROM dbo.SuperAdmins WHERE IsActive=1 AND IsAssignable=1 ORDER BY CreatedAt,Email;");
            return rows.ToArray();
        }
        public async Task PresenceAsync(Guid adminId,bool online)
        {
            using var connection=new SqlConnection(connectionString);
            await connection.ExecuteAsync("UPDATE dbo.SuperAdmins SET LastSeenAt=CASE WHEN @online=1 THEN SYSUTCDATETIME() ELSE NULL END WHERE Id=@adminId;",new{adminId,online});
        }
        public async Task<SupportTicket[]> AssignedOpenTicketsAsync(Guid adminId)
        {
            using var connection=new SqlConnection(connectionString);
            return (await connection.QueryAsync<SupportTicket>(TicketSelect+"WHERE t.AssignedAdminId=@adminId AND t.[Status]<>N'Closed';",new{adminId})).ToArray();
        }
        public async Task AvailabilityAsync(Guid adminId,bool available)
        {
            using var connection=new SqlConnection(connectionString);
            await connection.ExecuteAsync("UPDATE dbo.SuperAdmins SET IsAvailable=@available,LastSeenAt=SYSUTCDATETIME() WHERE Id=@adminId;",new{adminId,available});
        }
        public async Task<SupportTicket[]> TicketsAsync(string status,string search)
        {
            using var connection=new SqlConnection(connectionString);
            var rows=await connection.QueryAsync<SupportTicket>(TicketSelect+@"WHERE (@status=N'all' OR t.[Status]=@status)
                AND(@search=N'' OR t.CustomerName LIKE @pattern OR t.Subject LIKE @pattern OR t.CustomerEmail LIKE @pattern)
                ORDER BY CASE t.[Status] WHEN N'Waiting' THEN 0 WHEN N'Active' THEN 1 ELSE 2 END,t.UpdatedAt DESC OFFSET 0 ROWS FETCH NEXT 200 ROWS ONLY;",
                new{status,search,pattern="%"+search+"%"});
            return rows.ToArray();
        }
        public async Task<SupportTicket> ChangeTicketAsync(Guid id,Guid adminId,string action,Guid? assignedId)
        {
            using var connection=new SqlConnection(connectionString);await connection.OpenAsync();using var tx=connection.BeginTransaction();
            var ticket=await connection.QuerySingleOrDefaultAsync<SupportTicket>("SELECT * FROM dbo.SupportTickets WITH(UPDLOCK,HOLDLOCK) WHERE Id=@id;",new{id},tx);
            if(ticket==null)throw new HubException("Query not found.");
            if(ticket.Status=="Closed")throw new HubException("This query is already closed.");
            if(action=="claim")
                await connection.ExecuteAsync("UPDATE dbo.SupportTickets SET AssignedAdminId=@adminId,[Status]=N'Active',UpdatedAt=SYSUTCDATETIME() WHERE Id=@id;",new{id,adminId},tx);
            else if(action=="reassign" && assignedId.HasValue)
            {
                var valid=await connection.ExecuteScalarAsync<int>("SELECT COUNT(*) FROM dbo.SuperAdmins WHERE Id=@assignedId AND IsActive=1 AND IsAssignable=1;",new{assignedId},tx);
                if(valid!=1)throw new HubException("Choose an active super admin.");
                await connection.ExecuteAsync("UPDATE dbo.SupportTickets SET AssignedAdminId=@assignedId,[Status]=N'Waiting',UpdatedAt=SYSUTCDATETIME() WHERE Id=@id;",new{id,assignedId},tx);
            }
            else if(action=="close")
            {
                if(ticket.AssignedAdminId!=adminId)throw new HubException("Take ownership before closing this query.");
                await connection.ExecuteAsync(@"UPDATE dbo.SupportTickets SET [Status]=N'Closed',ClosedAt=SYSUTCDATETIME(),UpdatedAt=SYSUTCDATETIME() WHERE Id=@id;
                    UPDATE dbo.BotConversationMain SET [status]=N'Ticket is Closed' WHERE CONVERSATIONID=(SELECT ConversationId FROM dbo.WebsiteChatSessions WHERE SessionId=@sessionId);",
                    new{id,sessionId=ticket.SessionId},tx);
            }
            else throw new HubException("Unknown query action.");
            var result=await connection.QuerySingleAsync<SupportTicket>(TicketSelect+"WHERE t.Id=@id;",new{id},tx);
            tx.Commit();return result;
        }
        public async Task<InquiryRecord[]> InquiriesAsync()
        {
            using var connection=new SqlConnection(connectionString);
            return (await connection.QueryAsync<InquiryRecord>("SELECT TOP(200) Id,FullName,Email,Service,Brief,[Status],CreatedAt FROM dbo.WebsiteInquiries ORDER BY CreatedAt DESC;")).ToArray();
        }
        public async Task<object> InquiryAsync(Guid id)
        {
            using var connection=new SqlConnection(connectionString);
            var inquiry=await connection.QuerySingleOrDefaultAsync<InquiryRecord>("SELECT * FROM dbo.WebsiteInquiries WHERE Id=@id;",new{id});
            if(inquiry==null)return null;
            var replies=await connection.QueryAsync<InquiryResponseRecord>(@"SELECT r.Id,r.Body,r.CreatedAt,a.DisplayName FROM dbo.InquiryResponses r JOIN dbo.SuperAdmins a ON a.Id=r.AdminId WHERE r.InquiryId=@id ORDER BY r.CreatedAt;",new{id});
            return new{inquiry,replies};
        }
        public async Task ReplyToInquiryAsync(Guid inquiryId,Guid adminId,InquiryReplyRequest request)
        {
            using var connection=new SqlConnection(connectionString);await connection.OpenAsync();using var tx=connection.BeginTransaction();
            var inquiry=await connection.QuerySingleOrDefaultAsync<InquiryRecord>("SELECT * FROM dbo.WebsiteInquiries WITH(UPDLOCK,HOLDLOCK) WHERE Id=@inquiryId;",new{inquiryId},tx);
            if(inquiry==null)throw new HubException("Enquiry not found.");
            var existing=await connection.ExecuteScalarAsync<int>("SELECT COUNT(*) FROM dbo.InquiryResponses WHERE Id=@Id AND InquiryId=@inquiryId;",new{request.Id,inquiryId},tx);
            if(existing==0)
            {
                await connection.ExecuteAsync(@"INSERT dbo.InquiryResponses(Id,InquiryId,AdminId,Body) VALUES(@Id,@inquiryId,@adminId,@Body);
                    UPDATE dbo.WebsiteInquiries SET [Status]=N'Responded',UpdatedAt=SYSUTCDATETIME() WHERE Id=@inquiryId;",
                    new{request.Id,inquiryId,adminId,Body=request.Body.Trim()},tx);
                var reference=inquiryId.ToString("N").Substring(0,8).ToUpperInvariant();
                var body="Hello "+inquiry.FullName+",\n\n"+request.Body.Trim()+"\n\nProject reference: "+reference+"\n\nCompileon Innovation Private Limited";
                await EmailQueue.AddAsync(connection,tx,inquiryId,"response:"+request.Id+":customer",inquiry.Email,"Compileon: response to your project enquiry "+reference,body);
                await EmailQueue.AddAsync(connection,tx,inquiryId,"response:"+request.Id+":directors",EmailQueue.Directors,"[Compileon] Customer response "+reference,
                    "To: "+inquiry.Email+"\nService: "+inquiry.Service+"\n\n"+body);
            }
            tx.Commit();
        }
        public async Task ChangeInquiryStatusAsync(Guid id,string status)
        {
            using var connection=new SqlConnection(connectionString);
            await connection.ExecuteAsync("UPDATE dbo.WebsiteInquiries SET [Status]=@status,UpdatedAt=SYSUTCDATETIME() WHERE Id=@id;",new{id,status});
        }
        public async Task<EmailRecord[]> EmailsAsync()
        {
            using var connection=new SqlConnection(connectionString);
            return (await connection.QueryAsync<EmailRecord>("SELECT TOP(150) Id,EntityId,Recipient,Subject,[Status],Attempts,LastError,CreatedAt,SentAt FROM dbo.EmailOutbox ORDER BY CreatedAt DESC;")).ToArray();
        }
        public async Task RetryEmailAsync(Guid id)
        {
            using var connection=new SqlConnection(connectionString);
            await connection.ExecuteAsync("UPDATE dbo.EmailOutbox SET [Status]=N'Pending',Attempts=0,NextAttemptAt=SYSUTCDATETIME(),LastError=NULL WHERE Id=@id AND [Status]=N'Failed';",new{id});
        }
    }
}

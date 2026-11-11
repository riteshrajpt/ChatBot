using System;
using System.Data.SqlClient;
using System.Linq;
using System.Threading.Tasks;
using AChatBotApi.Hubs;
using AChatBotApi.Security;
using AChatBotApi.Services;
using Dapper;
using Microsoft.AspNetCore.SignalR;
using Microsoft.Extensions.Configuration;

namespace AChatBotApi.Repository
{
    public class SupportTicket
    {
        public Guid Id{get;set;} public Guid SessionId{get;set;} public Guid AssignedAdminId{get;set;}
        public string AssignedAdminName{get;set;} public bool AgentOnline{get;set;}
        public string CustomerName{get;set;} public string CustomerEmail{get;set;} public string Subject{get;set;}
        public string Status{get;set;} public DateTimeOffset CreatedAt{get;set;} public DateTimeOffset UpdatedAt{get;set;}
    }
    public class SupportMessage
    {
        public Guid Id{get;set;} public Guid TicketId{get;set;} public string SenderRole{get;set;}
        public string SenderName{get;set;} public string Text{get;set;} public DateTimeOffset SentAt{get;set;}
    }
    public class RequestAgent:WebsiteSession
    { public string CustomerName{get;set;} public string CustomerEmail{get;set;} public string Subject{get;set;} }
    public class AgentReply
    { public Guid TicketId{get;set;} public Guid MessageId{get;set;} public string Text{get;set;} }
    public class AdminSummary
    {
        public Guid Id{get;set;} public string DisplayName{get;set;} public string Email{get;set;}
        public bool IsAvailable{get;set;} public bool IsOnline{get;set;}
    }
    public partial class SupportRepository
    {
        private readonly string connectionString;
        private readonly IConfiguration config;
        public SupportRepository(IConfiguration config){this.config=config;connectionString=config.GetConnectionString("Dbconnection");}
        private const string TicketSelect=@"SELECT t.*,a.DisplayName AS AssignedAdminName,
            CONVERT(bit,CASE WHEN a.IsAvailable=1 AND a.LastSeenAt>DATEADD(second,-65,SYSUTCDATETIME()) THEN 1 ELSE 0 END) AS AgentOnline
            FROM dbo.SupportTickets t JOIN dbo.SuperAdmins a ON a.Id=t.AssignedAdminId ";
        private static async Task<int> SessionAsync(SqlConnection connection,SqlTransaction tx,Guid sessionId,string token,bool locking=false)
        {
            var id=await connection.QuerySingleOrDefaultAsync<int?>(
                "SELECT ConversationId FROM dbo.WebsiteChatSessions "+(locking?"WITH(UPDLOCK,HOLDLOCK) ":"")+"WHERE SessionId=@sessionId AND TokenHash=@hash;",
                new{sessionId,hash=AdminAuthService.HashToken(token)},tx);
            if(!id.HasValue)throw new HubException("Your chat session has expired. Start a new chat.");
            return id.Value;
        }
        public async Task<SupportTicket> RequestAgentAsync(RequestAgent request)
        {
            using var connection=new SqlConnection(connectionString);await connection.OpenAsync();using var tx=connection.BeginTransaction();
            var conversationId=await SessionAsync(connection,tx,request.SessionId,request.Token,true);
            var existing=await connection.QuerySingleOrDefaultAsync<SupportTicket>(TicketSelect+"WHERE t.SessionId=@SessionId AND t.[Status]<>N'Closed';",request,tx);
            if(existing!=null){tx.Commit();return existing;}
            var selected=await connection.QueryFirstOrDefaultAsync<AdminSummary>(@"SELECT TOP(1) Id,Email,DisplayName FROM dbo.SuperAdmins WHERE IsActive=1 AND IsAssignable=1
                ORDER BY CASE WHEN IsAvailable=1 AND LastSeenAt>DATEADD(second,-65,SYSUTCDATETIME()) THEN 0 ELSE 1 END,NEWID();",transaction:tx);
            if(selected==null)throw new HubException("No agent is currently available. Please use the project enquiry form.");
            var id=Guid.NewGuid();
            await connection.ExecuteAsync(@"INSERT dbo.SupportTickets(Id,SessionId,AssignedAdminId,CustomerName,CustomerEmail,Subject,[Status])
                VALUES(@id,@SessionId,@adminId,@name,@email,@subject,N'Waiting');
                UPDATE dbo.BotConversationMain SET [status]=N'Ticket is Open' WHERE CONVERSATIONID=@conversationId;",
                new{id,request.SessionId,adminId=selected.Id,name=request.CustomerName.Trim(),email=request.CustomerEmail?.Trim(),subject=request.Subject.Trim(),conversationId},tx);
            var admins=await connection.QueryAsync<AdminSummary>("SELECT Id,Email,DisplayName FROM dbo.SuperAdmins WHERE IsActive=1 AND IsAssignable=1;",transaction:tx);
            foreach(var admin in admins)
                await EmailQueue.AddAsync(connection,tx,id,"ticket:"+id+":"+admin.Id,admin.Email,"[Compileon] New customer query "+id.ToString("N").Substring(0,8).ToUpperInvariant(),
                    "A customer requested a human agent.\n\nAssigned to: "+selected.DisplayName+"\nCustomer: "+request.CustomerName.Trim()+"\nEmail: "+(request.CustomerEmail??"Not provided")+
                    "\nQuery: "+request.Subject.Trim()+"\n\nOpen the protected support panel: "+EmailQueue.SiteUrl(config)+"/admin?ticket="+id+"\n\nCompileon Innovation Private Limited");
            var ticket=await connection.QuerySingleAsync<SupportTicket>(TicketSelect+"WHERE t.Id=@id;",new{id},tx);
            tx.Commit();return ticket;
        }
        public async Task<SupportTicket> SessionTicketAsync(Guid sessionId,string token)
        {
            using var connection=new SqlConnection(connectionString);
            await SessionAsync(connection,null,sessionId,token);
            return await connection.QueryFirstOrDefaultAsync<SupportTicket>(TicketSelect+"WHERE t.SessionId=@sessionId ORDER BY t.CreatedAt DESC;",new{sessionId});
        }
        public async Task<SupportMessage[]> SessionMessagesAsync(Guid sessionId,string token)
        {
            using var connection=new SqlConnection(connectionString);await SessionAsync(connection,null,sessionId,token);
            var rows=await connection.QueryAsync<SupportMessage>(@"SELECT TOP(200)m.* FROM dbo.SupportMessages m JOIN dbo.SupportTickets t ON t.Id=m.TicketId
                WHERE t.SessionId=@sessionId ORDER BY m.SentAt DESC;",new{sessionId});
            return rows.Reverse().ToArray();
        }
        public async Task<SupportMessage> CustomerMessageAsync(WebsiteChatRequest request)
        {
            using var connection=new SqlConnection(connectionString);await connection.OpenAsync();using var tx=connection.BeginTransaction();
            var conversationId=await SessionAsync(connection,tx,request.SessionId,request.Token,true);
            var ticket=await connection.QuerySingleOrDefaultAsync<SupportTicket>("SELECT * FROM dbo.SupportTickets WHERE SessionId=@SessionId AND [Status]<>N'Closed';",request,tx);
            if(ticket==null){tx.Commit();return null;}
            var existing=await connection.QuerySingleOrDefaultAsync<SupportMessage>("SELECT * FROM dbo.SupportMessages WHERE Id=@MessageId AND TicketId=@Id AND SenderRole=N'customer';",new{request.MessageId,ticket.Id},tx);
            if(existing!=null){tx.Commit();return existing;}
            var message=new SupportMessage{Id=request.MessageId,TicketId=ticket.Id,SenderRole="customer",SenderName=ticket.CustomerName,Text=request.Text.Trim(),SentAt=DateTimeOffset.UtcNow};
            await connection.ExecuteAsync(@"INSERT dbo.SupportMessages(Id,TicketId,SenderRole,SenderName,[Text],SentAt) VALUES(@Id,@TicketId,@SenderRole,@SenderName,@Text,@SentAt);
                UPDATE dbo.SupportTickets SET UpdatedAt=@SentAt WHERE Id=@TicketId;
                INSERT dbo.botconversations(BOTID,CONVERSATIONID,USERQUERY,txtQuery,[TIMESTAMP]) VALUES(3,@conversationId,N'Live customer',@Text,@time);",
                new{message.Id,message.TicketId,message.SenderRole,message.SenderName,message.Text,message.SentAt,conversationId,time=message.SentAt.UtcDateTime},tx);
            tx.Commit();return message;
        }
        public async Task<SupportMessage> AgentMessageAsync(Guid adminId,AgentReply request)
        {
            using var connection=new SqlConnection(connectionString);await connection.OpenAsync();using var tx=connection.BeginTransaction();
            var ticket=await connection.QuerySingleOrDefaultAsync<SupportTicket>("SELECT * FROM dbo.SupportTickets WITH(UPDLOCK,HOLDLOCK) WHERE Id=@TicketId;",request,tx);
            if(ticket==null || ticket.Status!="Active" || ticket.AssignedAdminId!=adminId)throw new HubException("Take ownership of this open query before replying.");
            var existing=await connection.QuerySingleOrDefaultAsync<SupportMessage>("SELECT * FROM dbo.SupportMessages WHERE Id=@MessageId AND TicketId=@TicketId AND SenderRole=N'agent';",request,tx);
            if(existing!=null){tx.Commit();return existing;}
            var name=await connection.QuerySingleAsync<string>("SELECT DisplayName FROM dbo.SuperAdmins WHERE Id=@adminId AND IsActive=1;",new{adminId},tx);
            var message=new SupportMessage{Id=request.MessageId,TicketId=ticket.Id,SenderRole="agent",SenderName=name,Text=request.Text.Trim(),SentAt=DateTimeOffset.UtcNow};
            await connection.ExecuteAsync(@"INSERT dbo.SupportMessages(Id,TicketId,SenderRole,SenderName,AdminId,[Text],SentAt) VALUES(@Id,@TicketId,N'agent',@SenderName,@adminId,@Text,@SentAt);
                UPDATE dbo.SupportTickets SET UpdatedAt=@SentAt WHERE Id=@TicketId;
                INSERT dbo.botconversations(BOTID,CONVERSATIONID,USERQUERY,BOTRESPONSE,txtQuery,[TIMESTAMP])
                SELECT 3,ConversationId,N'Live agent',@Text,@Text,@time FROM dbo.WebsiteChatSessions WHERE SessionId=@sessionId;",
                new{message.Id,message.TicketId,message.SenderName,adminId,message.Text,message.SentAt,time=message.SentAt.UtcDateTime,sessionId=ticket.SessionId},tx);
            tx.Commit();return message;
        }
        public async Task<SupportTicket> CustomerCloseAsync(Guid sessionId,string token)
        {
            using var connection=new SqlConnection(connectionString);await connection.OpenAsync();using var tx=connection.BeginTransaction();
            var conversationId=await SessionAsync(connection,tx,sessionId,token,true);
            var ticket=await connection.QueryFirstOrDefaultAsync<SupportTicket>(TicketSelect+"WHERE t.SessionId=@sessionId ORDER BY t.CreatedAt DESC;",new{sessionId},tx);
            if(ticket==null)throw new HubException("No support conversation was found.");
            await connection.ExecuteAsync(@"UPDATE dbo.SupportTickets SET [Status]=N'Closed',ClosedAt=SYSUTCDATETIME(),UpdatedAt=SYSUTCDATETIME() WHERE Id=@Id AND [Status]<>N'Closed';
                UPDATE dbo.BotConversationMain SET [status]=N'Ticket is Closed' WHERE CONVERSATIONID=@conversationId;",new{ticket.Id,conversationId},tx);
            ticket.Status="Closed";tx.Commit();return ticket;
        }
        public async Task<SupportTicket> GetTicketAsync(Guid id)
        {using var connection=new SqlConnection(connectionString);return await connection.QuerySingleOrDefaultAsync<SupportTicket>(TicketSelect+"WHERE t.Id=@id;",new{id});}
        public async Task<object[]> TicketThreadAsync(Guid id)
        {
            using var connection=new SqlConnection(connectionString);
            var rows=await connection.QueryAsync<ThreadRow>(@"
              SELECT TOP(200)* FROM(
                SELECT 'u:'+CONVERT(varchar(36),m.MessageId) AS Id,N'customer' AS SenderRole,t.CustomerName AS SenderName,m.UserText AS [Text],m.SentAt,0 AS SortKey
                FROM dbo.WebsiteChatMessages m JOIN dbo.SupportTickets t ON t.SessionId=m.SessionId WHERE t.Id=@id
                UNION ALL SELECT 'b:'+CONVERT(varchar(36),m.MessageId),N'assistant',N'Compileon assistant',m.ReplyText,m.SentAt,1
                FROM dbo.WebsiteChatMessages m JOIN dbo.SupportTickets t ON t.SessionId=m.SessionId WHERE t.Id=@id
                UNION ALL SELECT CONVERT(varchar(36),m.Id),m.SenderRole,m.SenderName,m.[Text],m.SentAt,2 FROM dbo.SupportMessages m WHERE m.TicketId=@id
              ) thread ORDER BY SentAt DESC,SortKey DESC;",new{id});
            return rows.Reverse().Cast<object>().ToArray();
        }
        private class ThreadRow
        {public string Id{get;set;}public string SenderRole{get;set;}public string SenderName{get;set;}public string Text{get;set;}public DateTimeOffset SentAt{get;set;}}
    }
}

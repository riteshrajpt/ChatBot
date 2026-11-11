using System;
using System.Data.SqlClient;
using System.Linq;
using System.Security.Cryptography;
using System.Text;
using System.Text.RegularExpressions;
using System.Threading.Tasks;
using AChatBotApi.Hubs;
using AChatBotApi.Services;
using Dapper;
using Microsoft.AspNetCore.SignalR;
using Microsoft.Extensions.Configuration;

namespace AChatBotApi.Repository
{
    public class CompileonWebsiteRepository
    {
        private readonly string connectionString;
        private readonly IConfiguration config;
        public CompileonWebsiteRepository(IConfiguration configuration)
        { config=configuration; connectionString = configuration.GetConnectionString("Dbconnection"); }
        private static byte[] HashToken(string token)
        { using var hash = SHA256.Create(); return hash.ComputeHash(Encoding.UTF8.GetBytes(token)); }
        public async Task<string[]> GetSuggestionsAsync()
        {
            using var connection = new SqlConnection(connectionString);
            var rows = await connection.QueryAsync<string>("SELECT TOP (5) Qlist FROM dbo.Qlist WHERE Qlist NOT LIKE N'%(starter)' ORDER BY Qid;");
            return rows.ToArray();
        }
        public async Task<WebsiteSession> OpenSessionAsync()
        {
            var bytes = new byte[32];
            using (var random = RandomNumberGenerator.Create()) random.GetBytes(bytes);
            var session = new WebsiteSession { SessionId = Guid.NewGuid(), Token = Convert.ToBase64String(bytes) };
            using var connection = new SqlConnection(connectionString);
            await connection.OpenAsync();
            using var transaction = connection.BeginTransaction();
            var conversationId = await connection.ExecuteScalarAsync<int>(
                "INSERT dbo.WebsiteChatSessions(SessionId,TokenHash) OUTPUT INSERTED.ConversationId VALUES(@SessionId,@TokenHash);",
                new { session.SessionId, TokenHash = HashToken(session.Token) }, transaction);
            await connection.ExecuteAsync("INSERT dbo.BotConversationMain(CONVERSATIONID, [status]) VALUES(@conversationId,N'Ticket is Open');", new { conversationId }, transaction);
            transaction.Commit();
            return session;
        }
        public async Task<WebsiteChatReply[]> GetHistoryAsync(Guid sessionId, string token)
        {
            using var connection = new SqlConnection(connectionString);
            var valid = await connection.ExecuteScalarAsync<int>("SELECT COUNT(*) FROM dbo.WebsiteChatSessions WHERE SessionId=@sessionId AND TokenHash=@hash;", new { sessionId, hash = HashToken(token) });
            if (valid != 1) throw new HubException("Your chat session has expired. Start a new chat.");
            var rows = await connection.QueryAsync<WebsiteChatReply>(
                "SELECT TOP (40) MessageId, UserText, ReplyText AS [Text], SentAt FROM dbo.WebsiteChatMessages WHERE SessionId=@sessionId ORDER BY SentAt DESC;", new { sessionId });
            return rows.Reverse().ToArray();
        }
        public async Task<WebsiteChatReply> SendMessageAsync(WebsiteChatRequest request)
        {
            using var connection = new SqlConnection(connectionString);
            await connection.OpenAsync();
            using var transaction = connection.BeginTransaction();
            var conversationId = await connection.QuerySingleOrDefaultAsync<int?>(
                "SELECT ConversationId FROM dbo.WebsiteChatSessions WITH(UPDLOCK,HOLDLOCK) WHERE SessionId=@SessionId AND TokenHash=@hash;",
                new { request.SessionId, hash = HashToken(request.Token) }, transaction);
            if (!conversationId.HasValue) throw new HubException("Your chat session has expired. Start a new chat.");
            var existing = await connection.QuerySingleOrDefaultAsync<WebsiteChatReply>(
                "SELECT MessageId,UserText,ReplyText AS [Text],SentAt FROM dbo.WebsiteChatMessages WHERE MessageId=@MessageId AND SessionId=@SessionId;", request, transaction);
            if (existing != null) { transaction.Commit(); return existing; }
            var text = request.Text.Trim();
            var faqs = (await connection.QueryAsync<Faq>("SELECT Qlist, BOTRESPONSE FROM dbo.Qlist WHERE Qlist NOT LIKE N'%(starter)' ORDER BY Qid;", transaction: transaction)).ToArray();
            var exact = faqs.FirstOrDefault(f => string.Equals(f.Qlist, text, StringComparison.OrdinalIgnoreCase));
            string reply;
            if (exact != null) reply = exact.BOTRESPONSE;
            else
            {
                var topic = Regex.IsMatch(text, @"\b(ai|automation|automate|intelligence)\b", RegexOptions.IgnoreCase) ? "AI"
                    : Regex.IsMatch(text, @"\b(cloud|signalr|real.?time|devops|api)\b", RegexOptions.IgnoreCase) ? "cloud"
                    : Regex.IsMatch(text, @"\b(website|software|app|application|web)\b", RegexOptions.IgnoreCase) ? "website"
                    : Regex.IsMatch(text, @"\b(project|contact|email|phone|price|cost|quote|start)\b", RegexOptions.IgnoreCase) ? "start a project"
                    : "Compileon";
                reply = faqs.FirstOrDefault(f => f.Qlist.IndexOf(topic, StringComparison.OrdinalIgnoreCase) >= 0)?.BOTRESPONSE
                    ?? "I can help you explore software development, AI automation, cloud engineering and connected applications. Choose a suggested question, or use Start a project to share your requirements.";
            }
            var result = new WebsiteChatReply { MessageId = request.MessageId, UserText = text, Text = reply, SentAt = DateTimeOffset.UtcNow };
            await connection.ExecuteAsync(
                @"INSERT dbo.WebsiteChatMessages(MessageId,SessionId,UserText,ReplyText,SentAt) VALUES(@MessageId,@SessionId,@UserText,@Text,@SentAt);
                  INSERT dbo.botconversations(BOTID,CONVERSATIONID,USERQUERY,BOTRESPONSE,txtQuery,[TIMESTAMP]) VALUES(3,@conversationId,N'Website chat',@Text,@UserText,@timestamp);",
                new { result.MessageId, request.SessionId, result.UserText, result.Text, result.SentAt, conversationId, timestamp = result.SentAt.UtcDateTime }, transaction);
            transaction.Commit();
            return result;
        }
        public async Task SubmitInquiryAsync(WebsiteInquiry request)
        {
            using var connection=new SqlConnection(connectionString);await connection.OpenAsync();using var transaction=connection.BeginTransaction();
            var exists=await connection.ExecuteScalarAsync<int>("SELECT COUNT(*) FROM dbo.WebsiteInquiries WITH(UPDLOCK,HOLDLOCK) WHERE Id=@Id;",request,transaction);
            if(exists==0)
            {
                await connection.ExecuteAsync(@"INSERT dbo.WebsiteInquiries(Id,FullName,Email,Service,Brief,ConsentAt)
                    VALUES(@Id,@FullName,@Email,@Service,@Brief,@now);",
                    new{request.Id,FullName=request.FullName.Trim(),Email=request.Email.Trim(),request.Service,Brief=request.Brief.Trim(),now=DateTimeOffset.UtcNow},transaction);
                var reference=request.Id.ToString("N").Substring(0,8).ToUpperInvariant();
                await EmailQueue.AddAsync(connection,transaction,request.Id,"inquiry:"+request.Id+":customer",request.Email.Trim(),"We've received your Compileon project enquiry "+reference,
                    "Hello "+request.FullName.Trim()+",\n\nThank you for contacting Compileon Innovation Private Limited. Your enquiry has been saved for our team to review.\n\nReference: "+reference+
                    "\nArea of interest: "+request.Service+"\nYour brief:\n"+request.Brief.Trim()+"\n\nA team member can reply after reviewing your requirements. This confirmation does not confirm a price or delivery date.\n\nCompileon Innovation Private Limited");
                await EmailQueue.AddAsync(connection,transaction,request.Id,"inquiry:"+request.Id+":directors",EmailQueue.Directors,"[Compileon] New project enquiry "+reference,
                    "Name: "+request.FullName.Trim()+"\nEmail: "+request.Email.Trim()+"\nService: "+request.Service+"\nReference: "+reference+"\n\n"+request.Brief.Trim()+
                    "\n\nReview and respond in the protected panel: "+EmailQueue.SiteUrl(config)+"/admin?inquiry="+request.Id);
            }
            transaction.Commit();
        }
        private class Faq
        {
            public string Qlist { get; set; }
            public string BOTRESPONSE { get; set; }
        }
    }
}
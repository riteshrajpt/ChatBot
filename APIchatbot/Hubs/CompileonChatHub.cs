using System;
using System.Net.Mail;
using System.Threading.Tasks;
using AChatBotApi.Repository;
using AChatBotApi.Services;
using Microsoft.AspNetCore.SignalR;
using Microsoft.Extensions.Logging;

namespace AChatBotApi.Hubs
{
    public class CompileonChatHub : Hub
    {
        private readonly CompileonWebsiteRepository repository;
        private readonly ILogger<CompileonChatHub> logger;
        private readonly SupportRepository support;
        private readonly SupportEvents events;
        public CompileonChatHub(CompileonWebsiteRepository repository, ILogger<CompileonChatHub> logger, SupportRepository support, SupportEvents events)
        { this.repository = repository; this.logger = logger; this.support=support; this.events=events; }
        public Task<string[]> GetSuggestions() => repository.GetSuggestionsAsync();
        public Task<WebsiteSession> OpenSession() => repository.OpenSessionAsync();
        public async Task<WebsiteChatReply[]> GetHistory(Guid sessionId, string token)
        {
            ValidateSession(sessionId, token);
            return await repository.GetHistoryAsync(sessionId, token);
        }
        public async Task SendMessage(WebsiteChatRequest request)
        {
            if (request == null || request.MessageId == Guid.Empty || string.IsNullOrWhiteSpace(request.Text) || request.Text.Trim().Length > 2000)
                throw new HubException("Please send a message between 1 and 2,000 characters.");
            ValidateSession(request.SessionId, request.Token);
            try {
                var live=await support.CustomerMessageAsync(request);
                if(live!=null) {
                    await Groups.AddToGroupAsync(Context.ConnectionId,SupportEvents.CustomerGroup(request.SessionId));
                    await events.Message(live,request.SessionId);
                } else await Clients.Caller.SendAsync("ReceiveMessage", await repository.SendMessageAsync(request));
            }
            catch (HubException) { throw; }
            catch (Exception ex)
            {
                logger.LogError(ex, "Unable to process a website chat message.");
                throw new HubException("We couldn't send that message. Please try again.");
            }
        }
        public async Task<object> SubmitInquiry(WebsiteInquiry request)
        {
            if (request == null || request.Id == Guid.Empty || !request.Consent || !string.IsNullOrEmpty(request.Website)
                || string.IsNullOrWhiteSpace(request.FullName) || request.FullName.Trim().Length > 120
                || string.IsNullOrWhiteSpace(request.Email) || request.Email.Length > 320
                || string.IsNullOrWhiteSpace(request.Service) || request.Service.Length > 80
                || string.IsNullOrWhiteSpace(request.Brief) || request.Brief.Trim().Length < 20 || request.Brief.Length > 4000)
                throw new HubException("Complete your name, email, service and a project brief of at least 20 characters, and agree to be contacted.");
            try
            {
                var address = new MailAddress(request.Email.Trim());
                if (address.Address != request.Email.Trim() || !address.Host.Contains('.')) throw new FormatException();
            }
            catch (FormatException) { throw new HubException("Please enter a valid email address."); }
            try
            {
                await repository.SubmitInquiryAsync(request);
                return new { Reference = request.Id.ToString("N").Substring(0, 8).ToUpperInvariant() };
            }
            catch (Exception ex)
            {
                logger.LogError(ex, "Unable to save a website project enquiry.");
                throw new HubException("Your enquiry wasn't saved. Please try again.");
            }
        }
        public async Task<SupportTicket> JoinConversation(Guid sessionId,string token)
        {
            ValidateSession(sessionId,token);
            var ticket=await support.SessionTicketAsync(sessionId,token);
            await Groups.AddToGroupAsync(Context.ConnectionId,SupportEvents.CustomerGroup(sessionId));
            return ticket;
        }
        public async Task<SupportMessage[]> GetSupportHistory(Guid sessionId,string token)
        {
            ValidateSession(sessionId,token);
            return await support.SessionMessagesAsync(sessionId,token);
        }
        public async Task<SupportTicket> RequestHuman(RequestAgent request)
        {
            if(request==null || string.IsNullOrWhiteSpace(request.CustomerName) || request.CustomerName.Trim().Length>120 ||
                string.IsNullOrWhiteSpace(request.Subject) || request.Subject.Trim().Length>200 || request.CustomerEmail?.Length>320)
                throw new HubException("Share your name and a short description of your question.");
            ValidateSession(request.SessionId,request.Token);
            if(!string.IsNullOrWhiteSpace(request.CustomerEmail)) {
                try { var address=new MailAddress(request.CustomerEmail.Trim());if(address.Address!=request.CustomerEmail.Trim() || !address.Host.Contains('.'))throw new FormatException(); }
                catch(FormatException){throw new HubException("Please enter a valid email address, or leave it empty.");}
            } else request.CustomerEmail=null;
            var ticket=await support.RequestAgentAsync(request);
            await Groups.AddToGroupAsync(Context.ConnectionId,SupportEvents.CustomerGroup(request.SessionId));
            await events.TicketChanged(ticket);
            return ticket;
        }
        public async Task<SupportTicket> EndSupport(Guid sessionId,string token)
        {
            ValidateSession(sessionId,token);
            var ticket=await support.CustomerCloseAsync(sessionId,token);
            await events.TicketChanged(ticket);return ticket;
        }
        private static void ValidateSession(Guid id, string token)
        {
            if (id == Guid.Empty || string.IsNullOrWhiteSpace(token) || token.Length > 128)
                throw new HubException("Your chat session is unavailable. Start a new chat.");
        }
    }
    public class WebsiteSession
    {
        public Guid SessionId { get; set; }
        public string Token { get; set; }
    }
    public class WebsiteChatRequest : WebsiteSession
    {
        public Guid MessageId { get; set; }
        public string Text { get; set; }
    }
    public class WebsiteChatReply
    {
        public Guid MessageId { get; set; }
        public string UserText { get; set; }
        public string Text { get; set; }
        public DateTimeOffset SentAt { get; set; }
    }
    public class WebsiteInquiry
    {
        public Guid Id { get; set; }
        public string FullName { get; set; }
        public string Email { get; set; }
        public string Service { get; set; }
        public string Brief { get; set; }
        public bool Consent { get; set; }
        public string Website { get; set; }
    }
}

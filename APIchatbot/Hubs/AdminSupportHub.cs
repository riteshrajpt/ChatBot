using System;
using System.Security.Claims;
using System.Threading.Tasks;
using AChatBotApi.Repository;
using AChatBotApi.Security;
using AChatBotApi.Services;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.SignalR;

namespace AChatBotApi.Hubs
{
    [Authorize(Roles="SuperAdmin")]
    public class AdminSupportHub:Hub
    {
        private readonly AdminAuthService auth;
        private readonly SupportRepository repository;
        private readonly AgentPresence presence;
        private readonly SupportEvents events;
        public AdminSupportHub(AdminAuthService auth,SupportRepository repository,AgentPresence presence,SupportEvents events)
        {this.auth=auth;this.repository=repository;this.presence=presence;this.events=events;}
        private async Task<Guid> CurrentAdmin()
        {
            var user=await auth.ValidatePrincipalAsync(Context.User);
            if(user==null || user.MustChangePassword)throw new HubException("Your admin session expired. Sign in again.");
            return user.Id;
        }
        public override async Task OnConnectedAsync()
        {
            var id=await CurrentAdmin();presence.Add(Context.ConnectionId,id,Context.User.FindFirstValue("sessionHash"),Context.Abort);
            var context=Context;
            var expires=DateTimeOffset.Parse(Context.User.FindFirstValue("sessionExpires"));
            _=Task.Run(async()=>{try{var delay=expires-DateTimeOffset.UtcNow;await Task.Delay(delay>TimeSpan.Zero?delay:TimeSpan.Zero,context.ConnectionAborted);context.Abort();}catch(OperationCanceledException){}});
            await Groups.AddToGroupAsync(Context.ConnectionId,"admins");await repository.PresenceAsync(id,true);
            await NotifyAssigned(id);await base.OnConnectedAsync();
        }
        public override async Task OnDisconnectedAsync(Exception exception)
        {
            if(Guid.TryParse(Context.User.FindFirstValue(ClaimTypes.NameIdentifier),out var id))
            {var stillConnected=presence.Remove(Context.ConnectionId,id);await repository.PresenceAsync(id,stillConnected);await NotifyAssigned(id);}
            await base.OnDisconnectedAsync(exception);
        }
        public async Task Heartbeat(){await repository.PresenceAsync(await CurrentAdmin(),true);}
        private async Task NotifyAssigned(Guid id){foreach(var ticket in await repository.AssignedOpenTicketsAsync(id))await events.TicketChanged(ticket);await events.QueueChanged();}
        public async Task SetAvailability(bool available){var id=await CurrentAdmin();await repository.AvailabilityAsync(id,available);await NotifyAssigned(id);}
        public async Task WatchTicket(Guid ticketId)
        {
            await CurrentAdmin();
            if(await repository.GetTicketAsync(ticketId)==null)throw new HubException("Query not found.");
            await Groups.AddToGroupAsync(Context.ConnectionId,SupportEvents.TicketGroup(ticketId));
        }
        public async Task LeaveTicket(Guid ticketId){await CurrentAdmin();await Groups.RemoveFromGroupAsync(Context.ConnectionId,SupportEvents.TicketGroup(ticketId));}
        public async Task SendReply(AgentReply request)
        {
            var id=await CurrentAdmin();
            if(request==null || request.TicketId==Guid.Empty || request.MessageId==Guid.Empty || string.IsNullOrWhiteSpace(request.Text) || request.Text.Trim().Length>2000)
                throw new HubException("Write a reply between 1 and 2,000 characters.");
            var message=await repository.AgentMessageAsync(id,request);
            var ticket=await repository.GetTicketAsync(request.TicketId);
            await events.Message(message,ticket.SessionId);
        }
    }
}

using System;
using System.Collections.Concurrent;
using System.Linq;
using System.Threading.Tasks;
using AChatBotApi.Hubs;
using AChatBotApi.Repository;
using Microsoft.AspNetCore.SignalR;

namespace AChatBotApi.Services
{
    public class AgentPresence
    {
        private readonly ConcurrentDictionary<string,Connection> connections=new ConcurrentDictionary<string,Connection>();
        public void Add(string connectionId,Guid id,string sessionHash,Action abort)=>connections[connectionId]=new Connection{AdminId=id,SessionHash=sessionHash,Abort=abort};
        public bool Remove(string connectionId,Guid id){connections.TryRemove(connectionId,out _);return connections.Values.Any(value=>value.AdminId==id);}
        public void RevokeSession(string hash){foreach(var item in connections.Values.Where(value=>value.SessionHash==hash))item.Abort();}
        public void RevokeAdmin(Guid id){foreach(var item in connections.Values.Where(value=>value.AdminId==id))item.Abort();}
        private class Connection{public Guid AdminId;public string SessionHash;public Action Abort;}
    }
    public class SupportEvents
    {
        private readonly IHubContext<CompileonChatHub> customers;
        private readonly IHubContext<AdminSupportHub> admins;
        public SupportEvents(IHubContext<CompileonChatHub> customers,IHubContext<AdminSupportHub> admins){this.customers=customers;this.admins=admins;}
        public static string CustomerGroup(Guid id)=>"customer:"+id;
        public static string TicketGroup(Guid id)=>"ticket:"+id;
        public Task QueueChanged()=>admins.Clients.Group("admins").SendAsync("QueueChanged");
        public Task TicketChanged(SupportTicket ticket)=>Task.WhenAll(
            customers.Clients.Group(CustomerGroup(ticket.SessionId)).SendAsync("SupportTicketChanged",ticket),
            admins.Clients.Group(TicketGroup(ticket.Id)).SendAsync("TicketChanged",ticket),QueueChanged());
        public Task Message(SupportMessage message,Guid sessionId)=>Task.WhenAll(
            customers.Clients.Group(CustomerGroup(sessionId)).SendAsync("SupportMessage",message),
            admins.Clients.Group(TicketGroup(message.TicketId)).SendAsync("SupportMessage",message),QueueChanged());
    }
}

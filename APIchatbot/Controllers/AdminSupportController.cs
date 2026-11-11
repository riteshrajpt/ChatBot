using System;
using System.Security.Claims;
using System.Threading.Tasks;
using AChatBotApi.Repository;
using AChatBotApi.Services;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.AspNetCore.SignalR;
using Microsoft.Extensions.Configuration;

namespace AChatBotApi.Controllers
{
    [ApiController,Route("api/admin"),Authorize(Roles="SuperAdmin")]
    public class AdminSupportController:ControllerBase
    {
        private readonly SupportRepository repository;
        private readonly SupportEvents events;
        private readonly IConfiguration config;
        public AdminSupportController(SupportRepository repository,SupportEvents events,IConfiguration config){this.repository=repository;this.events=events;this.config=config;}
        private Guid AdminId=>Guid.Parse(User.FindFirstValue(ClaimTypes.NameIdentifier));
        [HttpGet("overview")] public async Task<IActionResult> Overview()=>Ok(await repository.OverviewAsync());
        [HttpGet("agents")] public async Task<IActionResult> Agents()=>Ok(await repository.AdminsAsync());
        [HttpGet("tickets")]
        public async Task<IActionResult> Tickets([FromQuery]string status="all",[FromQuery]string search="")
        {
            if(status!="all" && status!="Waiting" && status!="Active" && status!="Closed")return BadRequest();
            if(search?.Length>200)return BadRequest();return Ok(await repository.TicketsAsync(status,search??""));
        }
        [HttpGet("tickets/{id:guid}")]
        public async Task<IActionResult> Ticket(Guid id)
        {
            var ticket=await repository.GetTicketAsync(id);if(ticket==null)return NotFound();
            return Ok(new{ticket,messages=await repository.TicketThreadAsync(id)});
        }
        [HttpPost("tickets/{id:guid}/{operation}")]
        public async Task<IActionResult> ChangeTicket(Guid id,string operation,TicketAction request)
        {
            try{var ticket=await repository.ChangeTicketAsync(id,AdminId,operation,request?.AssignedAdminId);await events.TicketChanged(ticket);return Ok(ticket);}
            catch(HubException ex){return BadRequest(new{message=ex.Message});}
        }
        [HttpGet("inquiries")]public async Task<IActionResult> Inquiries()=>Ok(await repository.InquiriesAsync());
        [HttpGet("inquiries/{id:guid}")]
        public async Task<IActionResult> Inquiry(Guid id){var item=await repository.InquiryAsync(id);return item==null?NotFound():Ok(item);}
        [HttpPost("inquiries/{id:guid}/reply")]
        public async Task<IActionResult> Reply(Guid id,InquiryReplyRequest request)
        {
            if(request==null || request.Id==Guid.Empty || string.IsNullOrWhiteSpace(request.Body) || request.Body.Trim().Length<10 || request.Body.Length>4000)
                return BadRequest(new{message="Write a response between 10 and 4,000 characters."});
            try{await repository.ReplyToInquiryAsync(id,AdminId,request);await events.QueueChanged();return Ok(new{message="Response saved. Emails are queued for the customer and directors."});}
            catch(HubException ex){return BadRequest(new{message=ex.Message});}
        }
        [HttpPost("inquiries/{id:guid}/status")]
        public async Task<IActionResult> InquiryStatus(Guid id,InquiryStatusRequest request)
        {
            if(request?.Status!="New" && request?.Status!="In review" && request?.Status!="Closed")return BadRequest();
            await repository.ChangeInquiryStatusAsync(id,request.Status);await events.QueueChanged();return NoContent();
        }
        [HttpGet("emails")]public async Task<IActionResult> Emails()=>Ok(await repository.EmailsAsync());
        [HttpPost("emails/{id:guid}/retry")]public async Task<IActionResult> Retry(Guid id){await repository.RetryEmailAsync(id);return NoContent();}
        [HttpGet("mail-status")]
        public IActionResult MailStatus()=>Ok(new{mode=config["Mail:Mode"]??"Disabled",sender=config["Mail:FromAddress"],host=config["Mail:Host"],configured=!string.IsNullOrEmpty(config["Mail:Password"])});
    }
    public class TicketAction{public Guid? AssignedAdminId{get;set;}}
    public class InquiryStatusRequest{public string Status{get;set;}}
}

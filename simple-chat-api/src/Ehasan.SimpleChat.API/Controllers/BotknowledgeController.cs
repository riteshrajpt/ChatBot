using Ehasan.SimpleChat.API.Model;
using Ehasan.SimpleChat.API.Repository;
using Microsoft.AspNetCore.Http;
using Microsoft.AspNetCore.Mvc;
using System;
using System.Collections.Generic;
using System.Linq;
using System.Threading.Tasks;

namespace Ehasan.SimpleChat.API.Controllers
{
    [Route("api/[controller]")]
    [ApiController]
    public class BotknowledgeController : ControllerBase
    {
        private readonly BotknowledgeRepository botknowledgeRepository;
        public BotknowledgeController()
        {
            botknowledgeRepository = new BotknowledgeRepository();
        }

        [HttpGet]
        public IEnumerable<Botknowledge> Get()
        {
            return botknowledgeRepository.GetAll();
        }

       

        [HttpPost("GetQuestion")]
        public Botknowledge GetQuestion(convo QUESTION)
        {
            
            return botknowledgeRepository.GetQueryAns(QUESTION);
        }


        [HttpGet("Qulist")]
        public IEnumerable<Qulist> QGet()
        {
            return botknowledgeRepository.ListQ();
        }

        [HttpGet("GetChatConversationID")]
        public IEnumerable<ChatRptConversationId> GetChatConversationID()
        {
            return botknowledgeRepository.GetChatConversationID();
        }

        [HttpGet("GetChatReport")]
        public IEnumerable<ChatRpt> GetChatReport(string CONVERSATIONID)
        {
            return botknowledgeRepository.GetChatReport(CONVERSATIONID);
        }

        [HttpPost("UpdateChatTickets")]
        public IEnumerable<UpdateTicket> UpdateChatTickets(UpdateTicket data)
        {
            return botknowledgeRepository.UpdateChatTickets(data);
        }



        [HttpGet("queAnsList")]
        public IEnumerable<Qulist> queAnsList(string Qlist)
        {
            return botknowledgeRepository.queAnsList(Qlist);
        }

        [HttpPost("emailsend")]
        public  EmailSmtp emailsend(EmailSmtp data)
        {
            //var data = botknowledgeRepository.GetSmtpDetails();
            Task.Run(() => CommonMethods.SendEmailAysnc(data.host, data.smtpUsername, data.smtpPassword, data.port, data.enableSSL, data.emailFrom, data.emailTo, data.subject, data.body));
            return data;
        }

    }
}

using Microsoft.AspNetCore.Authorization;
using AChatBotApi.Model;
using AChatBotApi.Repository;
using Microsoft.AspNetCore.Http;
using Microsoft.AspNetCore.Mvc;
using System;
using System.Collections.Generic;
using System.Linq;
using System.Threading.Tasks;

namespace AChatBotApi.Controllers
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

        [Authorize(Roles="SuperAdmin")]
        [HttpGet("GetChatConversationID")]
        public IEnumerable<ChatRptConversationId> GetChatConversationID()
        {
            return botknowledgeRepository.GetChatConversationID();
        }

        [Authorize(Roles="SuperAdmin")]
        [HttpGet("GetChatReport")]
        public IEnumerable<ChatRpt> GetChatReport(string CONVERSATIONID)
        {
            return botknowledgeRepository.GetChatReport(CONVERSATIONID);
        }

        [Authorize(Roles="SuperAdmin")]
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

    }
}

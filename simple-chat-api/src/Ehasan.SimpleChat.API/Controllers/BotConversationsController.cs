using Ehasan.SimpleChat.API.Model;
using Ehasan.SimpleChat.API.Repository;
using Dapper;
using Microsoft.AspNetCore.Http;
using Microsoft.AspNetCore.Mvc;
using System;
using System.Collections.Generic;
using System.Data;
using System.Data.SqlClient;
using System.Linq;
using System.Threading.Tasks;

namespace Ehasan.SimpleChat.API.Controllers
{
    [Route("api/[controller]")]
    [ApiController]
    public class BotConversationsController : ControllerBase
    {


        private readonly BotConversationsRepostory botConversationsRepostory;
        public BotConversationsController()
        {
            botConversationsRepostory = new BotConversationsRepostory();
        }
        public IDbConnection Connection
        {
            get
            {
                return new SqlConnection(Global.ConnectionString);
            }
        }

        //MaxGetConversationID

        [HttpGet]
        public IEnumerable<BotConversations> Get()
        {
            return botConversationsRepostory.MaxGetConversationID();
        }

        //save 

        [Route("sentMsg")]
        [HttpPost]
        public void Post([FromBody] BotConversations BotConversation)
        {
            if (ModelState.IsValid)
                botConversationsRepostory.Add(BotConversation);
        }




        //[HttpPost("saveconv")]
        //public void Post([FromBody] BotConversations chatbot)
        //{
        //    if (ModelState.IsValid)
        //        botConversationsRepostory.Add(chatbot);
        //}
        //public void myfunction()
        //{
        //    //select USERQUERY ,BOTRESPONSE ,BOTRESPONSE from botconversations where CONVERSATIONID=1002
        //    using (IDbConnection dbConnection = Connection)
        //    {
        //        string SqlQuery = @"select USERQUERY ,BOTRESPONSE ,BOTRESPONSE from botconversations where CONVERSATIONID=1002";
        //        dbConnection.Open();
        //        dbConnection.Query<BotConversations>(SqlQuery);
        //    }
        //}

    }
}

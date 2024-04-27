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
    public class ChatBotController : ControllerBase
    {
        private readonly ChatBotRepository chatBotRepository;
        public ChatBotController()
        {
            chatBotRepository = new ChatBotRepository();
        }

        [HttpGet]
        public IEnumerable<chatbot> Get()
        {
            return chatBotRepository.GetAll();
        }

        //[HttpGet]
        //public object Get()
        //{
        //    return chatBotRepository.GetAll();
        //}


        [HttpGet("{ID}")]
        public chatbot Get(int ID)
        {
            return chatBotRepository.GetById(ID);
        }

        [HttpPost]
        public void Post([FromBody]chatbot chatbot)
        {
            if (ModelState.IsValid)
                chatBotRepository.Add(chatbot);
        }

        [HttpPut("{ID}")]
        public void Put(int ID,[FromBody] chatbot chatbot)
        {
            if (ModelState.IsValid)
                chatBotRepository.Update(chatbot);
        }

        [HttpDelete]
        public void Delete(int ID)
        {
            chatBotRepository.Delete(ID);
        }


    }
}

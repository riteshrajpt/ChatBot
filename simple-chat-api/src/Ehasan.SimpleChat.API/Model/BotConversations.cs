using System;
using System.Collections.Generic;
using System.Linq;
using System.Threading.Tasks;

namespace Ehasan.SimpleChat.API.Model
{
    public class BotConversations
    {
        public int BOTID { get; set; }
        public int CONVERSATIONID { get; set; }
        public string USERQUERY { get; set; }
        public string BOTRESPONSE { get; set; }
        public int BOTCONFIDENCE { get; set; }
        public string USERNAME { get; set; }
        public string TIMESTAMP { get; set; }
        public bool REVIEWED { get; set; }
        public string UserEmail { get; set; }
        public string UserContactNo { get; set; }
        public string txtQuery { get; set; }
         


    }
    //public class convo
    //{
    //    public string userQuery { get; set; }
    //    public string txtQuery { get; set; }
    //}
}

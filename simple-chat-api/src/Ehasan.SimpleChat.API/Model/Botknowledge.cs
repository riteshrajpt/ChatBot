using System;
using System.Collections.Generic;
using System.Linq;
using System.Threading.Tasks;

namespace Ehasan.SimpleChat.API.Model
{
    public class Botknowledge
    {

        public int ID { get; set; }
        public int BOTID { get; set; }
        public int Q { get; set; }
        public string QUESTION { get; set; }
        public string BOTRESPONSE { get; set; }


        

    }
    public class convo
    {
        public string userQuery { get; set; }
        public string txtQuery { get; set; }
        public int CONVERSATIONID { get; set; }
        public string BOTRESPONSE { get; set; }
        public string USERNAME { get; set; }
        public string UserEmail { get; set; }
        public string UserContactNo { get; set; }
        
    }


    public class Qulist
    {

        public int Qid { get; set; }
        public string Qlist { get; set; }
        public string QUESTION { get; set; }

        public string BOTRESPONSE { get; set; }
     




    }

    public class ChatRpt
    {
        public string CONVERSATIONID { get; set; }
        public string TIMESTAMP { get; set; }
        public string txtQuery { get; set; }

    }

    public class ChatRptConversationId
    {
        public string CONVERSATIONID { get; set; }
        public string TIMESTAMP { get; set; }
        public string status { get; set; }


    }

    public class UpdateTicket
    {
        public string CONVERSATIONID { get; set; }
        public string status { get; set; }

    }
}

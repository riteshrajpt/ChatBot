using System;
using System.Collections.Generic;
using System.ComponentModel.DataAnnotations;
using System.Linq;
using System.Threading.Tasks;

namespace Ehasan.SimpleChat.API.Model
{
    public class chatbot
    {   [Key]
        public int ID { get; set; }
        public string BOTNAME { get; set; }
        public string BOTAVATAR { get; set; }
        public int CLOSEMATCH { get; set; }
        public int EXACTMATCH { get; set; }
        public string CREATIONDATE { get; set; }
        public string CREATOR { get; set; }
        public string CREATORID { get; set; }
        public bool BOTSTATUS { get; set; }
        public string GREETING { get; set; }
    }
}

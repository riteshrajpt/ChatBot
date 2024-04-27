using System;
using System.Collections.Generic;
using System.Text;

namespace Ehasan.SimpleChat.API.Model
{
   public class EmailSmtp
    {
        public  string host { get; set; }
        public  string smtpUsername { get; set; }
        public  int port { get; set; }
        public  string smtpPassword { get; set; }
        public  bool enableSSL { get; set; }
        public  string emailFrom { get; set; }
        public  string subject { get; set; }
        public  string body { get; set; }
        public  bool isHtml { get; set; }
        public string emailTo { get; set; }
    }
}

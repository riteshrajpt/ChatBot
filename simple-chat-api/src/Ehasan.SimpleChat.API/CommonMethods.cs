using Dapper;

using Microsoft.AspNetCore.Hosting;
using Microsoft.AspNetCore.Http;
using Microsoft.Extensions.Configuration;

using System;
using System.Collections.Generic;
using System.Data;
using System.IO;
using System.Linq;
using System.Net;
using System.Net.Mail;
using System.Reflection;
using System.Security.Cryptography;
using System.Text;
using System.Threading.Tasks;

namespace Ehasan.SimpleChat.API
{
    public static class CommonMethods
    {
        public static IConfigurationRoot Configuration;
        public static string ConnectionString = GetConnectionString();
        public static string EncryptionKey = "holostik@123";

        public static string GetConnectionString()
        {
            var builder = new ConfigurationBuilder()
                   .SetBasePath(Directory.GetCurrentDirectory())
                   .AddJsonFile("appsettings.json");

            Configuration = builder.Build();
            var connectionString = Configuration["ConnectionStrings:SimpleChatConnectionString"];
            return connectionString;

        }

        internal static int GenerateRandomNo()
        {
            int _min = 100000;
            int _max = 999999;
            Random _rdm = new Random();
            return _rdm.Next(_min, _max);
        }



        //public static int HashStringHolostikDecode(string hash)
        //{
        //    try
        //    {
        //        var hashids = new Hashids("holostik@123", 10, "ABCDEFGHJKLMNPQRSTUVWXYZ23456789");
        //        var hash2 = hashids.Decode(hash);
        //        return hash2[0];

        //    }

        //    catch (Exception ex)
        //    {
        //        return 0;
        //    }
        //}

        //public static string GenerateQrCode(long num, string prefix)
        //{
        //    string passPhase = "holostik@123";
        //    string OriginalVal = prefix + num.ToString("0000000000");
        //    string encryptedStr = Models.NumberActivation.Encrypt.EncryptString(OriginalVal, passPhase);
        //    encryptedStr = encryptedStr.Substring(0, encryptedStr.Length - 2);
        //    encryptedStr = encryptedStr.Replace("/", "*").Replace("+", "-");
        //    return encryptedStr;
        //}

        public static Task<int> SendEmailAysnc(string host, string smtpUsername, string smtpPassword, int smtpPort, bool enableSSL, string emailFrom, string emailTo,
        string subject, string body)
        {
            try
            {

                ServicePointManager.SecurityProtocol = SecurityProtocolType.Tls12;
                MailMessage mail = new MailMessage();
                mail.To.Add(emailTo);
                mail.From = new MailAddress(emailFrom);
                mail.Subject = subject;
                mail.Body = body;
                //mail.IsBodyHtml = isHtml;
                mail.BodyEncoding = Encoding.UTF8;
                mail.SubjectEncoding = Encoding.Default;
                mail.BodyEncoding = Encoding.GetEncoding("utf-8");
                SmtpClient smtp = new SmtpClient();
                smtp.Host = host; //Or Your SMTP Server Address
                smtp.UseDefaultCredentials = false;
                smtp.Credentials = new NetworkCredential(smtpUsername, smtpPassword); // ***use valid credentials***
                smtp.Port = smtpPort;
                smtp.EnableSsl = enableSSL;
                smtp.Send(mail);
                return Task.FromResult(1);
            }
            catch (Exception ex)
            {
                
                return Task.FromResult(0);
            }
        }
        public static int SendEmailToUser(string ToEmail, string CompName, string Username, int flag, string Email, string Password)
        {
            try
            {
                string body = "";
                if (flag == 1)
                {
                    body = "Hi " + Username + ",\nPlease find login credentials of " + CompName + " created in SureAssure.\n\nURL: https://www.sureassure.com/login \nEmail: " + Email + " \nPassword: " + Password + " \n\nPassword can be changed after first login.\n\nSupport: Team SureAssure";
                }
                else if (flag == 2)
                {
                    body = "Hi " + Username + ",\nWe are glad to share that you have enrolled on our SureAssure portal, Please find login credentials of " + CompName + " created in SureAssure.\n\nURL: https://www.sureassure.com/login \nEmail: " + Email + " \nPassword: " + Password + " \n\nPassword can be chnaged after first login.\n\nSupport: Team SureAssure";
                }

                MailMessage mail = new MailMessage();


                mail.To.Add(new MailAddress(ToEmail));
                //mail.Bcc.Add("vineet.kumar@holostik.com");
                //mail.Bcc.Add("vineet.kumar@utopiadigitech.com");


                mail.From = new MailAddress("HolostikBi@holostik.com");

                mail.Subject = "Account Credentials!!";

                mail.Body = body;

                mail.IsBodyHtml = false;

                SmtpClient smtp = new SmtpClient();

                smtp.Host = "smtp.office365.com"; //Or Your SMTP Server Address

                smtp.Credentials = new System.Net.NetworkCredential("HolostikBi@holostik.com", "Baho9485"); // ***use valid credentials***

                smtp.Port = 587;

                smtp.EnableSsl = true;

                smtp.Send(mail);

                return 1;
            }
            catch (Exception ex)
            {
                return 0;
            }
        }

        public static string WriteToCsvFile(this DataTable dataTable, string filePath)
        {
            StringBuilder fileContent = new StringBuilder();

            foreach (var col in dataTable.Columns)
            {
                fileContent.Append(col.ToString() + ",");
            }

            fileContent.Replace(",", System.Environment.NewLine, fileContent.Length - 1, 1);

            foreach (DataRow dr in dataTable.Rows)
            {
                foreach (var column in dr.ItemArray)
                {
                    fileContent.Append("\"" + column.ToString() + "\",");
                }

                fileContent.Replace(",", System.Environment.NewLine, fileContent.Length - 1, 1);
            }

            System.IO.File.WriteAllText(filePath, fileContent.ToString());
            return filePath;
        }
        
        public static bool CheckImageType(string ext)
        {
            string[] validFileTypes = { "png", "PNG", "jpg", "JPG", "JPEG", "jpeg" };
            bool isValidFile = false;
            for (int i = 0; i < validFileTypes.Length; i++)
            {
                if (ext == "." + validFileTypes[i])
                {
                    isValidFile = true;
                    break;
                }
            }
            return isValidFile;

        }

        public static bool CheckAudioType(string ext)
        {
            string[] validFileTypes = { "MP3", "mp3", "m4a", "M4A", "aac", "AAC" };
            bool isValidFile = false;
            for (int i = 0; i < validFileTypes.Length; i++)
            {
                if (ext == "." + validFileTypes[i])
                {
                    isValidFile = true;
                    break;
                }
            }
            return isValidFile;
        }

        public static bool CheckDocType(string ext)
        {
            string[] validFileTypes = { "xlsx", "XLSX", "xls", "XLS", "doc", "DOC", "docx", "DOCX", "ppt", "PPT", "pptx", "PPTX", "txt", "TXT", "pdf", "PDF" };
            bool isValidFile = false;
            for (int i = 0; i < validFileTypes.Length; i++)
            {
                if (ext == "." + validFileTypes[i])
                {
                    isValidFile = true;
                    break;
                }
            }
            return isValidFile;
        }
      

        public static string LogPath(string _fileName, IHostingEnvironment env)
        {
            //string target = @"C:\inetpub\wwwroot\sureassure.com";
            //var _hostingEnvironment = (IHostingEnvironment)new HostingEnvironment();
            string folderName = "Log\\" + DateTime.Now.ToString("ddMMyyyy") + "_log";
            string webRootPath = env.WebRootPath;
            string folderPath = Path.Combine(webRootPath, folderName);
            string filepath = Path.Combine(folderPath, _fileName);
            if (!Directory.Exists(folderPath))
            {
                Directory.CreateDirectory(folderPath);
                if (!File.Exists(filepath))
                {
                    File.Create(filepath).Close();
                }
            }
            else
            {
                filepath = Path.Combine(folderPath, _fileName);
                if (!File.Exists(filepath))
                {
                    File.Create(filepath).Close();
                }
            }

            return filepath;
        }
    }
    public static class Extensions
    {
        /// <summary>
        /// This extension converts an enumerable set to a Dapper TVP
        /// </summary>
        /// <typeparam name="T">type of enumerbale</typeparam>
        /// <param name="enumerable">list of values</param>
        /// <param name="typeName">database type name</param>
        /// <param name="orderedColumnNames">if more than one column in a TVP, 
        /// columns order must mtach order of columns in TVP</param>
        /// <returns>a custom query parameter</returns>
        public static SqlMapper.ICustomQueryParameter AsTableValuedParameter<T>
            (this IEnumerable<T> enumerable,
            string typeName, IEnumerable<string> orderedColumnNames = null)
        {
            var dataTable = new DataTable();
            if (typeof(T).IsValueType || typeof(T).FullName.Equals("System.String"))
            {
                dataTable.Columns.Add(orderedColumnNames == null ?
                    "NONAME" : orderedColumnNames.First(), typeof(T));
                foreach (T obj in enumerable)
                {
                    dataTable.Rows.Add(obj);
                }
            }
            else
            {
                PropertyInfo[] properties = typeof(T).GetProperties
                    (BindingFlags.Public | BindingFlags.Instance);
                PropertyInfo[] readableProperties = properties.Where
                    (w => w.CanRead).ToArray();
                if (readableProperties.Length > 1 && orderedColumnNames == null)
                    throw new ArgumentException("Ordered list of column names must be provided when TVP contains more than one column");

                var columnNames = (orderedColumnNames ??
                    readableProperties.Select(s => s.Name)).ToArray();
                foreach (string name in columnNames)
                {
                    dataTable.Columns.Add(name, readableProperties.Single
                        (s => s.Name.Equals(name)).PropertyType);
                }

                foreach (T obj in enumerable)
                {
                    dataTable.Rows.Add(
                        columnNames.Select(s => readableProperties.Single
                            (s2 => s2.Name.Equals(s)).GetValue(obj))
                            .ToArray());
                }
            }
            return dataTable.AsTableValuedParameter(typeName);
        }

    }
}

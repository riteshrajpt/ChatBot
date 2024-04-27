using Ehasan.SimpleChat.API.Model;
using Dapper;
using System;
using System.Collections.Generic;
using System.Data;
using System.Data.SqlClient;
using System.Linq;
using System.Threading.Tasks;

namespace Ehasan.SimpleChat.API.Repository
{
    public class BotConversationsRepostory
    {

        public IDbConnection Connection
        {
            get
            {
                return new SqlConnection(Global.ConnectionString);
            }
        }


        public IEnumerable<BotConversations> MaxGetConversationID()
        {
            using (IDbConnection dbConnection = Connection)
            {
                string SqlQuery = @"select max(CONVERSATIONID+1) as CONVERSATIONID from botconversations ";
                dbConnection.Open();
                return dbConnection.Query<BotConversations>(SqlQuery);
            }

        }



        public void Add(BotConversations Conversations)
        {
            try
            {
                using (IDbConnection dbConnection = Connection)
                {
                    string SqlQuery = @"insert into botconversations (CONVERSATIONID,USERQUERY,BOTRESPONSE,TIMESTAMP,REVIEWED,textQuery)values(@CONVERSATIONID,@USERQUERY,@BOTRESPONSE,@USERNAME,getdate(),1,@UserEmail,@UserContactNo,@textQuery)";
                    dbConnection.Open();
                    dbConnection.Execute(SqlQuery, Conversations);
                    //this.myfunction();
                }
            }
            catch (Exception e)
            {
                Console.WriteLine("Attempted divide by zero. {0}", e.Message);
              
            }

           

        }




    }
}

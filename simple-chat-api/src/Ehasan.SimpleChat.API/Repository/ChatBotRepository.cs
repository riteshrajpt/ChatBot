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
    public class ChatBotRepository
    {
        public IDbConnection Connection
        {
            get
            {
                return new SqlConnection(Global.ConnectionString);
            }
        }

        public void Add(chatbot Chatbotlist)
        {
            using (IDbConnection dbConnection =Connection )
            {
                string SqlQuery = @"insert into Botlist(BOTNAME,	BOTAVATAR	,CLOSEMATCH,	EXACTMATCH,	CREATIONDATE,BOTSTATUS,	GREETING)values(@BOTNAME,	@BOTAVATAR	,@CLOSEMATCH,@EXACTMATCH,	getdate(),@BOTSTATUS,@GREETING) ";
                dbConnection.Open();
                dbConnection.Execute(SqlQuery, Chatbotlist);
            } 
                
        }
        public IEnumerable<chatbot>GetAll()
        {
            using (IDbConnection dbConnection = Connection)
            {
                string SqlQuery = @"select* from Botlist where ID=3 ";
                dbConnection.Open();
                return dbConnection.Query<chatbot>(SqlQuery);
            }

        }

        //public object GetAll()
        //{
        //    dynamic obj = new ExpandoObject();
        //    using (IDbConnection dbConnection = Connection)
        //    {
        //        dbConnection.Open();
        //        string SqlQuery = @"select* from Botlist where ID=3; select (CONVERSATIONID+1) as CONVERSATIONID from botconversations";
        //        using (var multi = dbConnection.QueryMultiple(SqlQuery, null))
        //        {
        //            obj.botlist = multi.Read<chatbot>();
        //            obj.botconversations = multi.Read<BotConversations>();
        //        }
        //        return obj;
        //        // return dbConnection.Query<chatbot>(SqlQuery);
        //    }

        //}


        public chatbot GetById(int ID)
        {
            using (IDbConnection dbConnection = Connection)
            {
                string SqlQuery = @"select* from Botlist where ID=@ID ";
                dbConnection.Open();
                return dbConnection.Query<chatbot>(SqlQuery,new {ID=ID}).FirstOrDefault();
            }

        }


        public void Delete(int ID )
        {
            using (IDbConnection dbConnection = Connection)
            {
                string SqlQuery = @"delete from Botlist where ID=@ID ";
                dbConnection.Open();
                dbConnection.Execute(SqlQuery, new { ID = ID });
            }

        }


        public void Update(chatbot botlist)
        {
            using (IDbConnection dbConnection = Connection)
            {
                string SqlQuery = @"update Botlist set BOTNAME=@BOTNAME where ID =@ID  ";
                dbConnection.Open();
                dbConnection.Query(SqlQuery, botlist);
            }

        }



    }
}

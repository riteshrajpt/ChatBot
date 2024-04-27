using Ehasan.SimpleChat.API.Model;
using Dapper;
using System;
using System.Collections.Generic;
using System.Data;
using System.Data.SqlClient;
using System.Dynamic;
using System.Linq;
using System.Threading.Tasks;

namespace Ehasan.SimpleChat.API.Repository
{
    public class BotknowledgeRepository
    {

        public IDbConnection Connection
        {
            get
            {
                return new SqlConnection(Global.ConnectionString);
            }
        }
        

        public IEnumerable<Botknowledge> GetAll()
        {
            using (IDbConnection dbConnection = Connection)
            {
                string SqlQuery = @"select* from Botknowledge ";
                dbConnection.Open();
                return dbConnection.Query<Botknowledge>(SqlQuery);
            }

        }



     



        public Botknowledge GetById(int ID)
        {
            using (IDbConnection dbConnection = Connection)
            {
                string SqlQuery = @"select* from Botknowledge where ID=@ID ";
                dbConnection.Open();
                return dbConnection.Query<Botknowledge>(SqlQuery, new { ID = ID }).FirstOrDefault();
            }

        }
        //
        public Botknowledge GetQueryAns(convo QUESTION )
        {
           

            using (IDbConnection dbConnection = Connection)
            {
                if (QUESTION.userQuery == "101")
                {
                    string SqlQuery0 = @"insert into BotConversationMain (CONVERSATIONID, TIMESTAMP, toggle, status)values(@CONVERSATIONID,getdate(),0,'Ticket is Open')";
                    dbConnection.Open();
                    dbConnection.Execute(SqlQuery0,QUESTION);
                    dbConnection.Close();
                }
                //string SqlQuery = @"select * from Botknowledge where QUESTION=@QUESTION ";
                //
                string SqlQuery = @"insert into botconversations (CONVERSATIONID,USERQUERY,BOTRESPONSE,TIMESTAMP,txtQuery)values(@CONVERSATIONID,@USERQUERY,@BOTRESPONSE,getdate(),@txtQuery)";
                dbConnection.Open();
                dbConnection.Execute(SqlQuery, QUESTION);

                string SqlQuery1 = @"select BOTRESPONSE,(QUESTION+1)as QUESTION  from Botknowledge where QUESTION=@QUESTION";
                
                return dbConnection.Query<Botknowledge>(SqlQuery1, new { QUESTION = QUESTION.userQuery }).FirstOrDefault();
            }
            
        }


        public IEnumerable<Qulist> ListQ()
        {
            using (IDbConnection dbConnection = Connection)
            {
                string SqlQuery = @"select* from Qlist ";
                dbConnection.Open();
                return dbConnection.Query<Qulist>(SqlQuery);
            }

        }

        public IEnumerable<ChatRptConversationId> GetChatConversationID()
        {
            using (IDbConnection dbConnection = Connection)
            {
                string SqlQuery = @"SELECT CONVERSATIONID,FORMAT(CONVERT( Datetime, TIMESTAMP ,105), 'yyyy-MM-dd hh:mm') as TIMESTAMP, status FROM BotConversationMain order by TIMESTAMP desc ";
                dbConnection.Open();
                return dbConnection.Query<ChatRptConversationId>(SqlQuery);
            }

        }

        public IEnumerable<ChatRpt> GetChatReport(string CONVERSATIONID)
        {
            using (IDbConnection dbConnection = Connection)
            {
                string SqlQuery = @"SELECT CONVERSATIONID, TIMESTAMP, txtQuery from botconversations where CONVERSATIONID=@CONVERSATIONID";
                dbConnection.Open();
                return dbConnection.Query<ChatRpt>(SqlQuery, new { CONVERSATIONID = CONVERSATIONID });
            }

        }

        public IEnumerable<UpdateTicket> UpdateChatTickets(UpdateTicket data)
        {
            using (IDbConnection dbConnection = Connection)
            {
                string SqlQuery = @"update BotConversationMain set status=@status where CONVERSATIONID=@CONVERSATIONID";
                dbConnection.Open();
                return dbConnection.Query<UpdateTicket>(SqlQuery, data);
            }

        }

        public IEnumerable<Qulist> queAnsList(string Qlist)
        {
            using (IDbConnection dbConnection = new SqlConnection(CommonMethods.ConnectionString))
            {
                dbConnection.Open();
                string Sql = "usp_GetQueAnsList";
                var affectedRows = dbConnection.Query<Qulist>(Sql, new
                {
                    Qlist = Qlist,
                },
                    commandType: CommandType.StoredProcedure);
                dbConnection.Close();
                return affectedRows;
            }

        }

        //public Task<EmailSmtp> GetSmtpDetails()
        //{

        //    using (IDbConnection dbConnection = new SqlConnection(CommonMethods.ConnectionString))
        //    {
        //        string SqlQuery = @"select * from Tbl_SmptMail";
        //        dbConnection.Open();
        //        var res = dbConnection.QueryFirstAsync<EmailSmtp>(SqlQuery);
        //        return res;
        //    }
        //}







    }
}

import { Injectable } from '@angular/core';
import{ HttpClient } from '@angular/common/http';
import{ Observable } from 'rxjs'
import { environment } from 'src/environments/environment';

@Injectable({
  providedIn: 'root'
})
export class ChatbotService {
  //url ='http://web..com/'
    readonly BaseURI = environment.chatbotURL;
    //url ='/api/api/'
    //url ='http://localhost:59825/api/'
    
    constructor(private http:HttpClient){}


    sendUserQuery(data:any){
      return this.http.post(this.BaseURI+'Botknowledge',data);
    }
    
    getBotinformation():Observable<any[]>{
      return this.http.get<any[]>(this.BaseURI+'ChatBot')
    }
    
    getBotknowledge():Observable<any[]>{
      return this.http.get<any[]>(this.BaseURI+'Botknowledge')
    }
    
    // getBotknowledgebyid(QUESTION:string){
    //   return this.http.get(`${this.url}Botknowledge/GetQuestion?QUESTION=${QUESTION}`);
    // }

    getBotknowledgebyid(data:any){debugger
      
      return this.http.post<any>(this.BaseURI+'Botknowledge/GetQuestion',data);
    }
 

    PostBotConversations(data:any){debugger
      console.log(data);
      return this.http.post(this.BaseURI+'BotConversations/SentMsg',data);
    }


    GetQUlist():Observable<any[]>{debugger
      return this.http.get<any[]>(this.BaseURI+'Botknowledge/Qulist')
    }

    GetChatRpt():Observable<any[]>{debugger
      return this.http.get<any[]>(this.BaseURI+'Botknowledge/GetChatConversationID')
    }

    QAnsList(data:any){debugger
      console.log(data)
     return this.http.get<any>(this.BaseURI+`Botknowledge/queAnsList?Qlist=${data}`)
    }

    ChatDetails(data:any){debugger
      console.log(data)
     return this.http.get<any>(this.BaseURI+`Botknowledge/GetChatReport?CONVERSATIONID=${data}`)
    }

    UpdateChatTickets(data:any){debugger
      console.log(data)
     return this.http.post(this.BaseURI+`Botknowledge/UpdateChatTickets`, data)
    }

    sendemail(data:any){debugger
      console.log(data)
     return this.http.post(this.BaseURI+`Botknowledge/emailsend`, data)
    }
  
  }
  
import { Injectable } from '@angular/core';
import{ HttpClient,HttpParams } from '@angular/common/http';
import{ Observable } from 'rxjs'
import{ChatBotModel} from './ChatBotModel';
@Injectable({
  providedIn: 'root'
})
export class ChatbotService {
  //url ='http://web..com/'

    url ='/api/api/'
    //url ='http://localhost:59825/api/'
    
    constructor(private http:HttpClient){}


    sendUserQuery(data:any){
      return this.http.post(this.url+'Botknowledge',data);
    }
    
    getBotinformation():Observable<any[]>{
      return this.http.get<any[]>(this.url+'ChatBot')
    }
    
    getBotknowledge():Observable<any[]>{
      return this.http.get<any[]>(this.url+'Botknowledge')
    }
    
    // getBotknowledgebyid(QUESTION:string){
    //   return this.http.get(`${this.url}Botknowledge/GetQuestion?QUESTION=${QUESTION}`);
    // }

    getBotknowledgebyid(data:any){debugger
      
      return this.http.post<any>(this.url+'Botknowledge/GetQuestion',data);
    }
 

    PostBotConversations(data:any){debugger
      console.log(data);
      return this.http.post(this.url+'BotConversations/SentMsg',data);
    }


    GetQUlist():Observable<any[]>{debugger
      return this.http.get<any[]>(this.url+'Botknowledge/Qulist')
    }

    GetChatRpt():Observable<any[]>{debugger
      return this.http.get<any[]>(this.url+'Botknowledge/GetChatConversationID')
    }

    QAnsList(data:any){debugger
      console.log(data)
     return this.http.get<any>(this.url+`Botknowledge/queAnsList?Qlist=${data}`)
    }

    ChatDetails(data:any){debugger
      console.log(data)
     return this.http.get<any>(this.url+`Botknowledge/GetChatReport?CONVERSATIONID=${data}`)
    }

    UpdateChatTickets(data:any){debugger
      console.log(data)
     return this.http.post(this.url+`Botknowledge/UpdateChatTickets`, data)
    }
  
  }
  
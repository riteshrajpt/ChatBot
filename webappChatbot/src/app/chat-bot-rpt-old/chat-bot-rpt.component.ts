import { Component, OnInit } from '@angular/core';
import { ChatbotService } from '../Shared/chatbot.service';

@Component({
  selector: 'app-chat-bot-rpt',
  templateUrl: './chat-bot-rpt.component.html',
  styleUrls: ['./chat-bot-rpt.component.css']
})
export class ChatBotRptComponent implements OnInit {
  searchText: any;
  toggle = true;
  //toggleButton = 'Ticket is Open';

  //text: any = 'Ticket is Open'
  ChatRpt: string | undefined;
  ChatRptConversationID: any[]= [];
  ChatRptDetails: any[]=[];
  constructor(private ChatData: ChatbotService) {
    
   }

  ngOnInit(): void {
    this.getChatRpt();
  }
  

  getChatRpt () {debugger
    this.ChatData.GetChatRpt().subscribe((resp) => {
      //var dataResponse = JSON.stringify(res)
      //this.ChatRpt = JSON.stringify(res);
      console.log(resp);
      this.ChatRptConversationID = resp;
    },
    (err)=>{
      console.log(err);
    }
    )
  }
  // changeText(data: any){debugger
  //   var conid = data;
  //   if(this.text === 'Ticket is Open' && conid.length>0) { 
  //     this.text = 'Ticket is Closed'
  //   } 
  //   else {
  //     this.text = 'Ticket is Open'
  //   }
  // }

  enableDisableRule(data:any) {debugger
    if(data.status == 'Ticket is Open'){
      data.status = 'Ticket is Closed';
      this.ChatData.UpdateChatTickets(data).subscribe((resp) => {
        //var dataResponse = JSON.stringify(res)
        //this.ChatRpt = JSON.stringify(res);
        console.log(resp);
        //this.ChatRptDetails = resp;
      },
      (err)=>{
        console.log(err);
      }
      )
    }
    else{
      data.status = 'Ticket is Open';
      this.ChatData.UpdateChatTickets(data).subscribe((resp) => {
        //var dataResponse = JSON.stringify(res)
        //this.ChatRpt = JSON.stringify(res);
        console.log(resp);
        //this.ChatRptDetails = resp;
      },
      (err)=>{
        console.log(err);
      }
      )
      
    }
    data.toggle = !data.toggle;
    data.status = data.toggle ? 'Ticket is Open' : 'Ticket is closed';
    
}


  ChatDetails (data:any) {debugger
    this.ChatData.ChatDetails(data).subscribe((resp) => {
      //var dataResponse = JSON.stringify(res)
      //this.ChatRpt = JSON.stringify(res);
      console.log(resp);
      this.ChatRptDetails = resp;
    },
    (err)=>{
      console.log(err);
    }
    )
  }
}

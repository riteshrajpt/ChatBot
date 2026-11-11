// import { Component, OnInit } from '@angular/core';
// import { ChatbotService } from '../Shared/chatbot.service';
// import { ChatBoxComponent } from '../chat-box/chat-box.component';
// import { FormGroup, FormControl } from '@angular/forms';
// @Component({
//   selector: 'app-qlist',
//   templateUrl: './qlist.component.html',
//   styleUrls: ['./qlist.component.css']
// })
// export class QlistComponent implements OnInit {
//   QlistData : any[]=[];
//   today = Date.now();
//   senddate = Date.now();
//   sentmsg: any[] = [];
//   sentmsgShow : any[]=[];
//   reciveMsg: any[] = [];
//   constructor(private ChatData: ChatbotService) { }

//   ngOnInit(): void {
//   this.GetQUlist();
//   //this.QShow();

//   }


//   GetQUlist() {debugger
    
//     this.ChatData.GetQUlist().subscribe(res => {   
//       this.QlistData = res;  
//       console.log(res);
//     })
//   }

//   // ChatbotForm = new FormGroup({

//   //   //userQuery: new FormControl(''),
//   //   txtQuery: new FormControl(''),
   
//   // })

//   QShow(data: any){debugger
    
//     // this.sentmsgShow = this.QlistData;
//     // this.sentmsg.push(data)

//     console.warn(this.QlistData);
//     this.ChatData.QAnsList(data).subscribe(res=>{
//       this.QlistData = res;  
//       console.log(res);
//     })
//   }


//   GetQAt(index: any){
    
 
//    const data = this.QlistData;
//    console.log(data);
   



//   }
// }

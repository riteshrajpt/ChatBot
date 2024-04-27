import { UserService } from '../service/user.service';
import { Component, OnInit, ViewChild, ElementRef, AfterViewChecked } from '@angular/core';
import { Router } from '@angular/router';
import { HubConnection, HubConnectionBuilder } from '@aspnet/signalr';
import { environment } from 'src/environments/environment';
import { MessageService } from '../service/message.service';
import { Guid } from 'guid-typescript';
import { DatePipe } from '@angular/common';
import * as XLSX from 'xlsx';
@Component({
  selector: 'app-home',
  templateUrl: './home.component.html',
  styleUrls: ['./home.component.css']
})
export class HomeComponent implements OnInit {
  @ViewChild('scrollMe', { static: true })
  private scrollContainer: ElementRef<HTMLElement>;
  private scrollToBottom() {
    this.scrollContainer.nativeElement.scrollTop = this.scrollContainer.nativeElement.scrollHeight;
  }
  loggedInUser = JSON.parse(localStorage.getItem("login-user"))
  columns: { field: string; header: string; }[] = [];
  users:any[] = [];
  searchTerm: string;
  filteredItems: any[] = [];
  chatUser:any;
  currentDateTime: string;
  messages: any[] = [];
  chatRpt: any[] = [];
  displayMessages: any[] = []
  message: string
  hubConnection: HubConnection;
  
 
  connectedUsers: any[] = []
  constructor(private router: Router, private service: UserService, private messageService: MessageService, private datePipe: DatePipe) {this.currentDateTime = this.datePipe.transform(new Date(), 'yyyy-MM-dd'); }

  ngOnInit() {
    this.columns = [
      { field: 'sender', header: 'Sender Id' },
      { field: 'receiver', header: 'Receiver Id' },
      { field: 'messageDate', header: 'Date & Time' },
      { field: 'content', header: 'Content' },
      { field: 'type', header: 'Received or Sent' },
    ];
     this.filter();
     this.messageService.getUserReceivedMessages(this.loggedInUser.id).subscribe((item:any)=>{
       if(item){
         this.messages=item;
         this.messages.forEach(x=>{
          x.type=x.receiver===this.loggedInUser.id?'recieved':'sent';
         })
         console.log("before Sorting",this.messages);
         this.messages = this.sortData(this.messages);
         console.log("After Sorting",this.messages);
       }
     })
    
    this.service.getAll().subscribe(
      (user:any[]) => {
        console.log("List of users: ",user);
        if(user){
        this.users=user.filter(x=>x.email!==this.loggedInUser.email);
        this.users.forEach(item=>{
          item['isActive']=false;
        })
        this.makeItOnline();
        this.sortItems(this.users);
        // console.log(" before Sorting Based On Online: ",this.users);
        // console.log("Sorting Based On Online: ",this.users);
        }
      },
      err => {
        console.log(err);
      },
    );




    this.message = ''
    this.hubConnection = new HubConnectionBuilder().withUrl(environment.chatHubUrl).build();
    const self = this
    this.hubConnection.start()
      .then(() => {
        console.log("LoggedIn User Name: ",this.loggedInUser.firstName);
        self.hubConnection.invoke("PublishUserOnConnect", this.loggedInUser.id, this.loggedInUser.firstName, this.loggedInUser.userName)
          .then(() => console.log('User Sent Successfully'))
          .catch(err => console.error(err));

        this.hubConnection.on("BroadcastUserOnConnect", Usrs => {
          this.connectedUsers = Usrs;
          this.makeItOnline();
        })
        this.hubConnection.on("BroadcastUserOnDisconnect", Usrs => {
          this.connectedUsers = Usrs;
          console.log("Connected Users: ",this.connectedUsers);
          this.users.forEach(item => {
            item.isOnline = false;
          });
          this.makeItOnline();
        })
      })
      .catch(err => console.log(err));

    // this.hubConnection.on("UserConnected", (connectionId) => this.UserConnectionID = connectionId);

    this.hubConnection.on('BroadCastDeleteMessage', (connectionId, message) => {
     let deletedMessage=this.messages.find(x=>x.id===message.id);
     if(deletedMessage){
       deletedMessage.isReceiverDeleted=message.isReceiverDeleted;
       deletedMessage.isSenderDeleted=message.isSenderDeleted;
       if(deletedMessage.isReceiverDeleted && deletedMessage.receiver===this.chatUser.id){
        this.displayMessages = this.messages.filter(x => (x.type === 'sent' && x.receiver === this.chatUser.id) || (x.type === 'recieved' && x.sender === this.chatUser.id));
       }
     }

    })

    this.hubConnection.on('ReceiveDM', (connectionId, message) => {debugger
      console.log("tum kesa msg ho?",message);
      message.type = 'recieved';
      this.messages.push(message);
      let curentUser = this.users.find(x => x.id === message.sender);
      console.log("what is this",curentUser)
      this.chatUser = curentUser;
      this.users.forEach(item => {
        item['isActive'] = false;
      });
      var user = this.users.find(x => x.id == this.chatUser.id);
      user['isActive'] = true;
      this.displayMessages = this.messages.filter(x => (x.type === 'sent' && x.receiver === this.chatUser.id) || (x.type === 'recieved' && x.sender === this.chatUser.id));
      
    })
  }

  ngAfterViewChecked() {
    this.scrollToBottom();
  }



  filter() {

    // if (this.searchTerm) {
    //   this.users = this.users.filter(x => {
    //     return x.firstName.toLowerCase().indexOf(this.searchTerm.toLowerCase()) !== -1;
    //   });
    // } else {
    //   this.users = this.users;
    // }
    this.users = this.users.filter(x => (x.firstName.includes(this.searchTerm)));
  }
  SendDirectMessage() {debugger
    if (this.message != '' && this.message.trim() != '') {
      let guid=Guid.create();
      console.log("chatuser ky h:",this.chatUser,this.loggedInUser)
      var msg = {
        id:guid.toString(),
        sender: this.loggedInUser.id,
        receiver: this.chatUser.id,
        messageDate: new Date(),
        type: 'sent',
        content: this.message
      };
      this.messages.push(msg);
      this.displayMessages = this.messages.filter(x => (x.type === 'sent' && x.receiver === this.chatUser.id) || (x.type === 'recieved' && x.sender === this.chatUser.id));
      this.hubConnection.invoke('SendMessageToUser', msg)
        .then(() => console.log('Message to user Sent Successfully'))
        .catch(err => console.error(err));
      this.message = '';
    }
  }

  openChat(user) {debugger
    this.users.forEach(item => {
      item['isActive'] = false;
    });
    user['isActive'] = true;
    this.chatUser = user;
    console.log("id",this.chatUser.id);
    this.displayMessages = this.messages.filter(x => (x.type === 'sent' && x.receiver === this.chatUser.id) || (x.type === 'recieved' && x.sender === this.chatUser.id));
  }

  makeItOnline() {debugger
    if (this.connectedUsers && this.users) {
      this.connectedUsers.forEach(item => {
        var u = this.users.find(x => x.userName == item.username);
        if (u) {
          u.isOnline = true;
        }
      })
    }
  }
  deleteMessage(message,deleteType,isSender){
    let deleteMessage={
      'deleteType':deleteType,
      'message':message,
      'deletedUserId':this.loggedInUser.id
    }
    this.hubConnection.invoke('DeleteMessage', deleteMessage)
        .then(() => console.log('publish delete request'))
        .catch(err => console.error(err));
    message.isSenderDeleted=isSender;
    message.isReceiverDeleted=!isSender;
  }

  onLogout() {
    this.hubConnection.invoke("RemoveOnlineUser", this.loggedInUser.id)
      .then(() => {
        this.messages.push('User Disconnected Successfully')
      })
      .catch(err => console.error(err));
    localStorage.removeItem('token');
    this.router.navigate(['/user/login']);
  }

  sortData(data) {
    return data.sort((a, b) => {
      return <any>new Date(a.messageDate) - <any>new Date(b.messageDate);
    })};

    sortItems(users) {
      this.users = users.sort((a, b) => {
        if (a.isOnline && !b.isOnline) {
          return -1; // a is available and b is not, so a comes first
        } else if (!a.isOnline && b.isOnline) {
          return 1; // b is available and a is not, so b comes first
        } else {
          return 0; // both have the same availability, so order doesn't matter
        }
      });
      console.log("sorting Based on Online: ",this.users)
    }

    GetReport(user){debugger
    this.chatUser = user;
    console.log("id",this.chatUser.id);
    this.displayMessages = this.messages.filter(x => (x.type === 'sent' && x.receiver === this.chatUser.id) || (x.type === 'recieved' && x.sender === this.chatUser.id));
    console.log("ChatData--", this.displayMessages);
      // this.messageService.getUserReceivedChat(userid).subscribe((item:any)=>{
      //   if(item){
      //     this.chatRpt=item;
      //     this.chatRpt.forEach(x=>{
      //      x.type=x.receiver===userid?'recieved':'sent';
      //     })
      //     console.log("chat rpt before Sorting",this.chatRpt);
      //     this.messages = this.sortData(this.chatRpt);
      //     console.log("chat rptAfter Sorting",this.chatRpt);
      //   }
      // })
      /* generate worksheet */
      const ws: XLSX.WorkSheet = XLSX.utils.aoa_to_sheet(this.prep(this.displayMessages));
      const wb: XLSX.WorkBook = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(wb, ws, 'Sheet1');
      XLSX.writeFile(wb, 'Chatting_details.xlsx');

    }

    prep(arr:any) {debugger    
      let out = [];
      const hdr = this.columns;
      const d = new Array();
      for (let i = 0; i < hdr.length; ++i) {
        Object.keys(hdr[i]).forEach(function (k, j) {
          if (k == 'header') {
            d[i] = hdr[i][k];
          }
        });
      }
      out[0] = d;
    
      const ignoreList = ['id','isNew','isReceiverDeleted','isSenderDeleted',]; // these columns are not required in excel
      let l = 1;
      for (let i = 0; i < arr.length; ++i) {      
        if (!arr[i]) { continue; }
        if (Array.isArray(arr[i])) { out[i] = arr[i]; continue; }
        const o = new Array();
        let m = 0;
        Object.keys(arr[i]).forEach((k, j) => {
          if (!ignoreList.includes(k)) {
            o[+m] = arr[i][k];
            m++;
          }
        });
        out[l] = o;
        l++;
      }
      return out;
    }

}

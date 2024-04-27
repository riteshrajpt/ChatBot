import { Component, OnInit, ViewChild, ElementRef, AfterViewChecked } from "@angular/core";
import { FormGroup, FormControl } from "@angular/forms";
import { ChatbotService } from "../service/chatbot.service";
import { ToastrService } from "ngx-toastr";
import { Observable } from "rxjs";
import { ChatBotModel } from "../service/ChatBotModel";
import { HubConnection, HubConnectionBuilder } from "@aspnet/signalr";
import { Guid } from "guid-typescript";
import { environment } from "src/environments/environment";
import { UserService } from "../service/user.service";
import { MessageService } from "../service/message.service";
import { DatePipe } from "@angular/common";
// import Mailjet from 'node-mailjet';
//import * as Mailjet from 'node-mailjet';
// import * as sgMail from '@sendgrid/mail';
@Component({
  selector: "app-chatbot",
  templateUrl: "./chatbot.component.html",
  styleUrls: ["./chatbot.component.css"],
})
export class ChatbotComponent implements OnInit {
  @ViewChild('scrollMe', { static: true })
  private scrollContainer: ElementRef<HTMLElement>;
  private scrollToBottom() {
    this.scrollContainer.nativeElement.scrollTop = this.scrollContainer.nativeElement.scrollHeight;
  }
  headUser = "i am Chat Bot";
  Botknowledgelist: any[] = [];
  BotknowledgeQ: any[] = [];
  QUESTION: string = "";
  Botinfo: any[] = [];
  MaxGetConversationID: any[] = [];
  today = Date.now();
  senddate = Date.now();
  reciveMsg: any[] = [];
  QlistData: any[] = [];
  sentmsg: any[] = [];
  Convid = Math.floor(Math.random() * 1000000000);
  sentmsgShow = "";
  show = false;
  emailPattern = "^[a-z0-9._%+-]+@[a-z0-9.-]+.[a-z]{2,4}$";
  mobilePattern = "^((\\+91-?)|0)?[0-9]{10}$";
  InvalidEmail = "Please Enter valid email id";
  InvalidMobile = "Please Enter valid Mobile no.";
  fixedTimezone = this.today;
  isButtonVisible = true;
  isMenuButtonVisible = true;
  displayList = true;
  MainBtnShow = false;

  loggedInUser: any;
  users: any;
  chatUser: any;
  currentDateTime: string;
  messages: any[] = [];
  displayMessages: any[] = [];
  message: string;
  hubConnection: HubConnection;
  connectedUsers: any[] = [];
  constructor(
    private ChatData: ChatbotService,
    private toastr: ToastrService,
    public service: UserService,
    private messageService: MessageService,
    private datePipe: DatePipe,
    // private mailjet: Mailjet,
  ) {
    this.currentDateTime = this.datePipe.transform(new Date(), 'yyyy-MM-dd HH:mm');
    this.toastr.toastrConfig.positionClass = 'toast-top-center';
    // sgMail.setApiKey('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');
  }

  ngOnInit(): void {
    this.setvalue();
    this.getBotinformation();
    this.DisplayList();
    this.GetQUlist();

    this.message = "";
    this.hubConnection = new HubConnectionBuilder()
      .withUrl(environment.chatHubUrl)
      .build();

    this.hubConnection.on("ReceiveDM", (connectionId, message) => {
      debugger;
      console.log("tum kesa msg ho?", message);
      message.type = "recieved";
      this.messages.push(message);
      let curentUser = this.users.find((x) => x.id === message.sender);
      console.log("what is this", curentUser);
      this.chatUser = curentUser;
      this.users.forEach((item) => {
        item["isActive"] = false;
      });
      var user = this.users.find((x) => x.id == this.chatUser.id); // pnt
      user["isActive"] = true;
      this.displayMessages = this.messages.filter(
        (x) =>
          (x.type === "sent" && x.receiver === this.chatUser.id) ||
          (x.type === "recieved" && x.sender === this.chatUser.id)
      );
    });
  }

  ngAfterViewChecked() {
    this.scrollToBottom();
  }
  ChatbotForm = new FormGroup({
    userQuery: new FormControl(""),
    txtQuery: new FormControl(""),
    CONVERSATIONID: new FormControl(""),
  });

  mainbtnHide() {
    this.MainBtnShow = true;
    debugger;
    this.displayList = false;
  }

  setvalue() {
    this.ChatbotForm.patchValue({
      userQuery: "101",
    });
  }

  DisplayList() {
    if (this.ChatbotForm.value.userQuery <= 103) {
      this.show = false;
    } else if (this.ChatbotForm.value.userQuery > 103) {
      this.show = true;
    }
  }

  setvaluecovid() {
    this.ChatbotForm.patchValue({
      CONVERSATIONID: this.Convid,
    });
  }

  getBotknowledge() {
    this.ChatData.getBotknowledge().subscribe((res) => {
      this.Botknowledgelist = res;
      console.log(res);
    });
  }

  getBotinformation() {
    this.ChatData.getBotinformation().subscribe((res) => {
      this.Botinfo = res;
      console.log(res);
    });
  }

  saveconv() {
    this.setvaluecovid();
    this.ChatData.PostBotConversations(this.ChatbotForm.value).subscribe(
      (res) => {
        console.log(res);

        this.ChatbotForm.reset();
      },
      (err) => {
        console.log(err);
      }
    );
  }

  QShow(data: any) {
    debugger;
    this.ChatbotForm.value.txtQuery = data;
    if (data == "Other") {
      debugger

      const emailData = {
        host: 'smtp.office365.com',
        smtpUsername: 'HolostikBi@holostik.com',
        port: 587,
        smtpPassword: 'Baho9485',
        enableSSL: true,
        emailFrom: 'HolostikBi@holostik.com',//'support@sureassure.com',
        subject: 'Need to resolve query through chatbot!',
        body: 'Dear Admin, The customer name ' + this.sentmsg[0] + ' with email ' + this.sentmsg[1] + ' is waiting for your responses, please login to chatbot admin panel to resolve the query!',
        //isHtml: true,
        emailTo: 'rsinghfsd@gmail.com'
      };

      this.ChatData.sendemail(emailData).subscribe(
        (res) => {

          //this.reciveMsg.push(res);
        },
        (err) => {
          console.log(err);
        }
      );

      this.onSubmit(this.sentmsg);
      this.service.login(this.sentmsg[1]).subscribe(
        (res: any) => {
          localStorage.setItem('token', res.token);
          localStorage.setItem('login-user', JSON.stringify(res.user));

        },
        err => {
          // if (err.status == 400)
          //   //this.toastr.error('Incorrect Email.', 'Authentication failed.');
          // else
          console.log(err);
        }
      );
    }
    this.sentmsgShow = this.ChatbotForm.value;
    this.sentmsg.push(this.ChatbotForm.value.txtQuery);
    console.log("All data conversation:", this.sentmsg);
    console.warn(this.ChatbotForm.value);
    this.setvaluecovid();
    this.ChatData.QAnsList(data).subscribe(
      (res) => {
        var dataResponse = JSON.stringify(res);
        console.log(dataResponse);
        this.reciveMsg.push(res[0]);
        // this.QlistData = res;
      },
      (err) => {
        console.log(err);
      }
    );

    this.ChatbotForm.value.txtQuery = data;
    console.log(this.ChatbotForm.value);
    this.ChatData.getBotknowledgebyid(this.ChatbotForm.value).subscribe(
      (res) => {
        debugger;
        this.ChatbotForm.reset();
        console.log(res);
        this.ChatbotForm.patchValue({
          userQuery: res.question,
        });
        //this.reciveMsg.push(res);
      },
      (err) => {
        console.log(err);
      }
    );

    this.mainbtnHide();
  }

  showListBlock() {
    debugger;
    this.displayList = !this.displayList;
    this.MainBtnShow = !this.MainBtnShow;
  }

  getBotknowledgebyQ() {
    debugger;

    var i = this.ChatbotForm.value.userQuery;
    if (i == 102) {
      if (this.ChatbotForm.value.txtQuery.match(this.emailPattern)) {
        this.sentmsgShow = this.ChatbotForm.value;
        this.sentmsg.push(this.ChatbotForm.value.txtQuery);
        localStorage.removeItem("login-user");
        this.service.registerthroughchatbot(this.sentmsg).subscribe(
          (res: any) => {
            if (res.succeeded) {
              let loginData = {
                Email: this.sentmsg[1],
              };
              //this.toastr.error('Username is already taken','Registration failed.');
              //const loginData = data[1];
              this.service.login(loginData).subscribe(
                (res: any) => {
                  localStorage.setItem("token", res.token);
                  localStorage.setItem(
                    "login-user",
                    JSON.stringify(res.user)
                  );
                  console.log("login-user", JSON.stringify(res.user));
                  this.loggedInUser = JSON.parse(
                    localStorage.getItem("login-user")
                  );
                  // this.messageService
                  //   .getUserReceivedMessages(this.loggedInUser.id)
                  //   .subscribe((item: any) => {
                  //     if (item) {
                  //       this.messages = item;
                  //       this.messages.forEach((x) => {
                  //         x.type =
                  //           x.receiver === this.loggedInUser.id
                  //             ? "recieved"
                  //             : "sent";
                  //       });
                  //       console.log("Yeh ky hain bhai?", this.messages);
                  //     }
                  //   });

                  this.service.getAll().subscribe(
                    (user: any[]) => {
                      console.log("hain ky yeh", user);
                      if (user) {
                        this.users = user.filter(
                          (x) => x.email !== this.loggedInUser.email
                        );
                        this.users.forEach((item) => {
                          item["isActive"] = false;
                        });
                        this.makeItOnline();
                      }
                    },
                    (err) => {
                      console.log(err);
                    }
                  );
                  const self = this;
                  this.hubConnection
                    .start()
                    .then(() => {
                      console.log(
                        "deku jara",
                        this.loggedInUser.firstName
                      );
                      self.hubConnection
                        .invoke(
                          "PublishUserOnConnect",
                          this.loggedInUser.id,
                          this.loggedInUser.firstName,
                          this.loggedInUser.userName
                        )
                        .then(() => console.log("User Sent Successfully"))
                        .catch((err) => console.error(err));

                      this.hubConnection.on(
                        "BroadcastUserOnConnect",
                        (Usrs) => {
                          this.connectedUsers = Usrs;
                          this.makeItOnline();
                        }
                      );
                      this.hubConnection.on(
                        "BroadcastUserOnDisconnect",
                        (Usrs) => {
                          this.connectedUsers = Usrs;
                          console.log("aaja bhai", this.connectedUsers);
                          this.users.forEach((item) => {
                            item.isOnline = false;
                          });
                          this.makeItOnline();
                        }
                      );
                    })
                    .catch((err) => console.log(err));
                },

                (err) => {
                  debugger;
                  // if (err.status == 400)
                  //   //this.toastr.error('Incorrect Email.', 'Authentication failed.');
                  // else
                  console.log(err);
                }
              );
              //this.service.formModel.reset();
              //this.toastr.success('New user created!', 'Registration successful.');
            } else {
              res.errors.forEach((element) => {
                debugger;
                switch (element.code) {
                  case "DuplicateUserName":
                    let loginData = {
                      Email: this.sentmsg[1],
                    };
                    //this.toastr.error('Username is already taken','Registration failed.');
                    //const loginData = data[1];
                    this.service.login(loginData).subscribe(
                      (res: any) => {
                        localStorage.setItem("token", res.token);
                        localStorage.setItem(
                          "login-user",
                          JSON.stringify(res.user)
                        );
                        console.log("login-user", JSON.stringify(res.user));
                        this.loggedInUser = JSON.parse(
                          localStorage.getItem("login-user")
                        );
                        // this.messageService
                        //   .getUserReceivedMessages(this.loggedInUser.id)
                        //   .subscribe((item: any) => {
                        //     if (item) {
                        //       this.messages = item;
                        //       this.messages.forEach((x) => {
                        //         x.type =
                        //           x.receiver === this.loggedInUser.id
                        //             ? "recieved"
                        //             : "sent";
                        //       });
                        //       console.log("Yeh ky hain bhai?", this.messages);
                        //     }
                        //   });

                        this.service.getAll().subscribe(
                          (user: any) => {
                            console.log("hain ky yeh", user);
                            if (user) {
                              this.users = user.filter(
                                (x) => x.email !== this.loggedInUser.email
                              );
                              this.users.forEach((item) => {
                                item["isActive"] = false;
                              });
                              this.makeItOnline();
                            }
                          },
                          (err) => {
                            console.log(err);
                          }
                        );
                        const self = this;
                        this.hubConnection
                          .start()
                          .then(() => {
                            console.log(
                              "deku jara",
                              this.loggedInUser.firstName
                            );
                            self.hubConnection
                              .invoke(
                                "PublishUserOnConnect",
                                this.loggedInUser.id,
                                this.loggedInUser.firstName,
                                this.loggedInUser.userName
                              )
                              .then(() => console.log("User Sent Successfully"))
                              .catch((err) => console.error(err));

                            this.hubConnection.on(
                              "BroadcastUserOnConnect",
                              (Usrs) => {
                                this.connectedUsers = Usrs;
                                this.makeItOnline();
                              }
                            );
                            this.hubConnection.on(
                              "BroadcastUserOnDisconnect",
                              (Usrs) => {
                                this.connectedUsers = Usrs;
                                console.log("aaja bhai", this.connectedUsers);
                                this.users.forEach((item) => {
                                  item.isOnline = false;
                                });
                                this.makeItOnline();
                              }
                            );
                          })
                          .catch((err) => console.log(err));
                      },

                      (err) => {
                        debugger;
                        // if (err.status == 400)
                        //   //this.toastr.error('Incorrect Email.', 'Authentication failed.');
                        // else
                        console.log(err);
                      }
                    );
                    break;

                  default:
                    //this.toastr.error(element.description,'Registration failed.');
                    break;
                }
              });
            }
          },
          (err) => {
            console.log(err);
          }
        );
        console.warn(this.ChatbotForm.value);

        this.setvaluecovid();
        this.ChatData.getBotknowledgebyid(this.ChatbotForm.value).subscribe(
          (res) => {
            this.ChatbotForm.reset();
            console.log(res);
            this.ChatbotForm.patchValue({
              userQuery: res.question,
            });
            this.reciveMsg.push(res);
          },
          (err) => {
            console.log(err);
          }
        );
      } else {
        this.toastr.error(this.InvalidEmail);
      }
    }
    if (i == 103) {
      if (this.ChatbotForm.value.txtQuery.match(this.mobilePattern)) {
        this.sentmsgShow = this.ChatbotForm.value;
        this.sentmsg.push(this.ChatbotForm.value.txtQuery);

        console.warn(this.ChatbotForm.value);

        this.setvaluecovid();
        this.ChatData.getBotknowledgebyid(this.ChatbotForm.value).subscribe(
          (res) => {
            this.ChatbotForm.reset();
            console.log(res);
            this.ChatbotForm.patchValue({
              userQuery: res.question,
            });
            this.reciveMsg.push(res);
          },
          (err) => {
            console.log(err);
          }
        );
      } else {
        this.toastr.error(this.InvalidMobile);
      }
    }
    if (i == 101 || i > 103) {
      debugger;
      this.sentmsgShow = this.ChatbotForm.value;
      this.sentmsg.push(this.ChatbotForm.value.txtQuery);

      console.warn(this.ChatbotForm.value);

      this.setvaluecovid();
      this.ChatData.getBotknowledgebyid(this.ChatbotForm.value).subscribe(
        (res) => {
          this.ChatbotForm.reset();
          console.log(res);
          this.ChatbotForm.patchValue({
            userQuery: res.question,
          });
          this.reciveMsg.push(res);
        },
        (err) => {
          console.log(err);
        }
      );
    }
  }

  SendDirectMessage() {
    debugger;
    if (this.message != "" && this.message.trim() != "") {
      let guid = Guid.create();
      console.log("chatUser ky h:", this.chatUser);
      var msg = {
        id: guid.toString(),
        sender: this.loggedInUser.id,
        receiver: "f9fb1e96-5c1b-427c-b82f-cdbe03452fd1",
        messageDate: new Date(),
        type: "sent",
        content: this.message,
      };
      console.log("Sender ID:", msg.sender);
      console.log("Receiver ID:", msg.receiver);
      this.messages.push(msg);
      let curentUser = this.users.find((x) => x.id === msg.receiver);
      this.openChat(curentUser);
      //console.log("what is this",curentUser)
      this.chatUser = curentUser;
      this.users.forEach((item) => {
        item["isActive"] = false;
      });
      var user = this.users.find((x) => x.id == this.chatUser.id); // pnt
      user["isActive"] = true;
      this.displayMessages = this.messages.filter(
        (x) =>
          (x.type === "sent" && x.receiver === this.chatUser.id) ||
          (x.type === "recieved" && x.sender === this.chatUser.id)
      );
      console.log("display->", this.displayMessages);
      this.hubConnection
        .invoke("SendMessageToUser", msg)
        .then(() => console.log("Message to user Sent Successfully"))
        .catch((err) => console.error(err));
      this.message = "";
    }
  }
  openChat(user) {
    debugger;
    this.users.forEach((item) => {
      item["isActive"] = false;
    });
    user["isActive"] = true;
    this.chatUser = user;
    this.displayMessages = this.messages.filter(
      (x) =>
        (x.type === "sent" && x.receiver === this.chatUser.id) ||
        (x.type === "recieved" && x.sender === this.chatUser.id)
    );
  }

  makeItOnline() {
    if (this.connectedUsers && this.users) {
      this.connectedUsers.forEach((item) => {
        var u = this.users.find((x) => x.userName == item.username);
        if (u) {
          u.isOnline = true;
        }
      });
    }
  }

  GetQUlist() {
    this.ChatData.GetQUlist().subscribe((res) => {
      this.QlistData = res;
      console.log(res);
    });
  }

  onSubmit(data) {
    debugger;
    this.service.registerthroughchatbot(data).subscribe(
      (res: any) => {
        if (res.succeeded) {
          //this.service.formModel.reset();
          //this.toastr.success('New user created!', 'Registration successful.');
        } else {
          res.errors.forEach((element) => {
            debugger;
            switch (element.code) {
              case "DuplicateUserName":
                let loginData = {
                  Email: data[1],
                };
                //this.toastr.error('Username is already taken','Registration failed.');
                //const loginData = data[1];
                this.service.login(loginData).subscribe(
                  (res: any) => {
                    localStorage.setItem("token", res.token);
                    localStorage.setItem(
                      "login-user",
                      JSON.stringify(res.user)
                    );
                  },
                  (err) => {
                    debugger;
                    // if (err.status == 400)
                    //   //this.toastr.error('Incorrect Email.', 'Authentication failed.');
                    // else
                    console.log(err);
                  }
                );
                break;

              default:
                //this.toastr.error(element.description,'Registration failed.');
                break;
            }
          });
        }
      },
      (err) => {
        console.log(err);
      }
    );
  }

  onLogout() {
    debugger
    this.hubConnection.invoke("RemoveOnlineUser", this.loggedInUser.id)
      .then(() => {
        this.messages.push('User Disconnected Successfully')
      })
      .catch(err => console.error(err));
    localStorage.removeItem('token');
    //this.router.navigate(['/user/login']);
  }
}

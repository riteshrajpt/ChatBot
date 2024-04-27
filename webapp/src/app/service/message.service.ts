import { HttpClient } from "@angular/common/http";
import { Injectable } from "@angular/core";
import { environment } from "src/environments/environment";

@Injectable({
    providedIn: 'root'
  })
  export class MessageService {
    readonly BaseURI = environment.apiBaseUrl;
    constructor(private http: HttpClient){

    }
    getUserReceivedMessages(userId:string) {
        return this.http.get(this.BaseURI + '/message');
      }
      getUserReceivedChat(userId:string) {
        return this.http.get(this.BaseURI + `/message/received-messages?userId=${userId}`);
      }
      deleteMessage(message) {
        return this.http.post(this.BaseURI + '/message',message);
      }
  }
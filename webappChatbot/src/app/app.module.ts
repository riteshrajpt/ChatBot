import { NgModule } from '@angular/core';
import { BrowserModule } from '@angular/platform-browser';
import { MessageService } from "primeng/api";
import { AppRoutingModule } from './app-routing.module';
import { AppComponent } from './app.component';
import { ChatBoxComponent } from './chat-box/chat-box.component';
import { FormsModule, ReactiveFormsModule } from '@angular/forms';
import { HttpClientModule, HTTP_INTERCEPTORS } from '@angular/common/http';
import { ToastModule } from 'primeng/toast';
import { BrowserAnimationsModule } from "@angular/platform-browser/animations";
import { ChatBotRptComponent } from './chat-bot-rpt/chat-bot-rpt.component';
//import { QlistComponent } from './qlist/qlist.component';
import { Ng2SearchPipeModule } from 'ng2-search-filter';
import { RealtimeChatComponent } from './realtime-chat/realtime-chat.component';
import { AdminTokenInterceptor } from './admin/admin-auth.service';
import { AdminComponent } from './admin/admin.component';

@NgModule({
  declarations: [
    AppComponent,
    ChatBoxComponent,
    ChatBotRptComponent,
    RealtimeChatComponent,
    AdminComponent,
    // QlistComponent
  ],
  imports: [
    BrowserModule,
    AppRoutingModule,
    FormsModule,
    ReactiveFormsModule,
    HttpClientModule,
    ToastModule,
    Ng2SearchPipeModule,
    BrowserAnimationsModule
  ],
  providers: [MessageService, { provide: HTTP_INTERCEPTORS, useClass: AdminTokenInterceptor, multi: true }],
  bootstrap: [AppComponent]
})
export class AppModule { }

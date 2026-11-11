import { ComponentFixture, TestBed } from '@angular/core/testing';
import { HttpClientTestingModule, HttpTestingController } from '@angular/common/http/testing';
import { AppModule } from '../app.module';

import { ChatBotRptComponent } from './chat-bot-rpt.component';

describe('ChatBotRptComponent', () => {
  let component: ChatBotRptComponent;
  let fixture: ComponentFixture<ChatBotRptComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [AppModule, HttpClientTestingModule]
    })
    .compileComponents();
  });

  beforeEach(() => {
    fixture = TestBed.createComponent(ChatBotRptComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
    const http = TestBed.inject(HttpTestingController);
    http.expectOne('/api/api/Botknowledge/GetChatConversationID').flush([]);
    http.verify();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});

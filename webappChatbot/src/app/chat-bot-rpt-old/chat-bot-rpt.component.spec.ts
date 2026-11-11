import { ComponentFixture, TestBed } from '@angular/core/testing';

import { ChatBotRptComponent } from './chat-bot-rpt.component';

describe('ChatBotRptComponent', () => {
  let component: ChatBotRptComponent;
  let fixture: ComponentFixture<ChatBotRptComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      declarations: [ ChatBotRptComponent ]
    })
    .compileComponents();
  });

  beforeEach(() => {
    fixture = TestBed.createComponent(ChatBotRptComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});

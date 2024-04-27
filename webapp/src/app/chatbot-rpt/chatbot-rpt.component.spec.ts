import { async, ComponentFixture, TestBed } from '@angular/core/testing';

import { ChatbotRptComponent } from './chatbot-rpt.component';

describe('ChatbotRptComponent', () => {
  let component: ChatbotRptComponent;
  let fixture: ComponentFixture<ChatbotRptComponent>;

  beforeEach(async(() => {
    TestBed.configureTestingModule({
      declarations: [ ChatbotRptComponent ]
    })
    .compileComponents();
  }));

  beforeEach(() => {
    fixture = TestBed.createComponent(ChatbotRptComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});

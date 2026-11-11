import { ComponentFixture, TestBed } from '@angular/core/testing';
import { HttpClientTestingModule } from '@angular/common/http/testing';
import { BehaviorSubject, Subject } from 'rxjs';
import { AppModule } from '../app.module';
import { RealtimeChatService } from '../Shared/realtime-chat.service';
import { ChatBoxComponent } from './chat-box.component';

describe('Compileon website', () => {
  let fixture: ComponentFixture<ChatBoxComponent>;
  let component: ChatBoxComponent;
  let realtime: any;

  beforeEach(async () => {
    realtime = {
      state$: new BehaviorSubject('online'), replies$: new Subject(),
      supportMessages$: new Subject(), ticket$: new BehaviorSubject(undefined),
      supportHistory: jasmine.createSpy().and.returnValue(Promise.resolve([])),
      requestAgent: jasmine.createSpy().and.returnValue(Promise.resolve({ id: 'test-ticket', status: 'Waiting', assignedAdminName: 'Super admin 1' })),
      endSupport: jasmine.createSpy().and.returnValue(Promise.resolve()),
      suggestions: jasmine.createSpy().and.returnValue(Promise.resolve(['What does Compileon do?'])),
      history: jasmine.createSpy().and.returnValue(Promise.resolve([])),
      send: jasmine.createSpy().and.returnValue(Promise.resolve()),
      resetSession: jasmine.createSpy(),
      submitInquiry: jasmine.createSpy().and.returnValue(Promise.resolve({ reference: 'TEST2026' }))
    };
    await TestBed.configureTestingModule({
      imports: [AppModule, HttpClientTestingModule],
      providers: [{ provide: RealtimeChatService, useValue: realtime }]
    }).compileComponents();
    fixture = TestBed.createComponent(ChatBoxComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  afterEach(() => fixture.destroy());

  it('renders the company identity and a complete company website', () => {
    const page = fixture.nativeElement as HTMLElement;
    expect(page.querySelector('h1')?.textContent).toContain('Ideas, compiled');
    ['services', 'possibilities', 'approach', 'about', 'contact'].forEach(id => expect(page.querySelector('#' + id)).not.toBeNull());
    expect(page.textContent).toContain('Compileon Innovation Private Limited');
    expect(page.textContent).not.toContain('Holostik');
  });

  it('updates service details and supports keyboard tab navigation', () => {
    const page = fixture.nativeElement as HTMLElement;
    const tabs = page.querySelectorAll<HTMLButtonElement>('.service-item');
    tabs[1].click(); fixture.detectChanges();
    expect(page.querySelector('.service-detail')?.textContent).toContain('Intelligence with a practical purpose.');
    tabs[1].dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowDown', bubbles: true }));
    fixture.detectChanges();
    expect(component.selectedService).toBe(2);
    expect(tabs[2].getAttribute('aria-selected')).toBe('true');
  });

  it('does not submit an incomplete enquiry or imply that it was saved', async () => {
    await component.submitInquiry(); fixture.detectChanges();
    expect(realtime.submitInquiry).not.toHaveBeenCalled();
    expect(component.inquiryReference).toBe('');
    expect(fixture.nativeElement.querySelectorAll('.field-error').length).toBeGreaterThan(0);
  });

  it('shows a saved reference only after a valid enquiry is acknowledged', async () => {
    component.contactForm.setValue({ fullName: 'Website test', email: 'test@example.com', service: 'AI & automation', brief: 'A synthetic test project brief for the enquiry form.', consent: true, website: '' });
    await component.submitInquiry(); fixture.detectChanges();
    expect(realtime.submitInquiry).toHaveBeenCalled();
    expect(fixture.nativeElement.querySelector('.inquiry-success').textContent).toContain('TEST2026');
  });

  it('keeps a failed enquiry intact for retry', async () => {
    realtime.submitInquiry.and.returnValue(Promise.reject(new Error('offline')));
    component.contactForm.setValue({ fullName: 'Website test', email: 'test@example.com', service: 'Product engineering', brief: 'A synthetic test project brief retained during connection failure.', consent: true, website: '' });
    await component.submitInquiry(); fixture.detectChanges();
    expect(component.contactForm.value.fullName).toBe('Website test');
    expect(component.inquiryReference).toBe('');
    expect(fixture.nativeElement.querySelector('[role="alert"]').textContent).toContain('couldn’t save');
  });

  it('keeps repeated real-time replies to a single visible message', async () => {
    const assistant = component.assistant!;
    await assistant.open();
    await assistant.send('Can you build a website?');
    const requestId = realtime.send.calls.mostRecent().args[1];
    const reply = { messageId: requestId, userText: 'Can you build a website?', text: 'We can help shape and build a company website.', sentAt: new Date().toISOString() };
    realtime.replies$.next(reply);
    realtime.replies$.next(reply);
    fixture.detectChanges();
    expect(assistant.messages.filter(message => message.id === requestId).length).toBe(1);
    expect(fixture.nativeElement.querySelector('.chat-panel').textContent).toContain(reply.text);
  });

  it('renders without clipped content at mobile, tablet and desktop widths', async () => {
    const frame = document.createElement('iframe');
    frame.style.cssText = 'position:absolute;left:-10000px;top:0;width:390px;height:844px;border:0';
    const styles = Array.from(document.querySelectorAll('style')).map(style => style.outerHTML).join('');
    const markup = fixture.nativeElement.outerHTML;
    const loaded = new Promise<void>(resolve => { frame.onload = () => resolve(); });
    frame.srcdoc = '<!doctype html><html><head><base href="' + location.origin + '/"><meta name="viewport" content="width=device-width,initial-scale=1">' + styles + '</head><body style="margin:0">' + markup + '</body></html>';
    document.body.appendChild(frame);
    try {
      await loaded;
      const doc = frame.contentDocument!;
      await (doc as any).fonts.ready;
      for (const width of [360, 390, 768, 1280]) {
        frame.style.width = width + 'px';
        await new Promise<void>(resolve => requestAnimationFrame(() => resolve()));
        expect(doc.documentElement.scrollWidth).withContext('page width ' + width).toBeLessThanOrEqual(width + 1);
        const headline = doc.querySelector<HTMLElement>('.hero h1')!;
        expect(headline.scrollWidth).withContext('headline width ' + width).toBeLessThanOrEqual(headline.clientWidth + 1);
        const art = doc.querySelector('.hero-art')!.getBoundingClientRect();
        expect(art.left).toBeGreaterThanOrEqual(0);
        expect(art.right).toBeLessThanOrEqual(width + 1);
        const form = doc.querySelector('.contact-form-wrap')!.getBoundingClientRect();
        expect(form.right).toBeLessThanOrEqual(width + 1);
      }
    } finally { frame.remove(); }
  });

  it('requests a human agent and shows private agent replies', async () => {
    const assistant = component.assistant!;
    await assistant.open(); assistant.beginHandoff();
    assistant.customerName = 'Customer test'; assistant.customerSubject = 'Help planning a web application';
    await assistant.requestAgent(); fixture.detectChanges();
    expect(realtime.requestAgent).toHaveBeenCalledWith('Customer test', '', 'Help planning a web application');
    expect(assistant.liveSupport).toBeTrue();
    expect(fixture.nativeElement.querySelector('.support-state').textContent).toContain('Super admin 1');
    realtime.supportMessages$.next({ id: 'private-reply', ticketId: 'test-ticket', senderRole: 'agent', senderName: 'Super admin 1', text: 'Hello, I can help you plan that application.', sentAt: new Date().toISOString() });
    fixture.detectChanges();
    expect(fixture.nativeElement.querySelector('.agent-message').textContent).toContain('Hello, I can help');
    assistant.newChat();
    expect(assistant.messages.some(message => message.id === 'private-reply')).toBeTrue();
  });
});


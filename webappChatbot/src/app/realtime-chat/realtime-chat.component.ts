import { Component, ElementRef, EventEmitter, HostListener, OnDestroy, OnInit, Output, ViewChild } from '@angular/core';
import { Subscription } from 'rxjs';
import { ChatReply, RealtimeChatService, newRequestId } from '../Shared/realtime-chat.service';
import { SupportMessage, SupportTicket } from '../admin/admin-support.service';

interface ChatMessage { id: string; role: 'assistant' | 'user' | 'agent' | 'system'; text: string; time: Date; failed?: boolean; requestId?: string; author?: string; }

@Component({
  selector: 'app-realtime-chat',
  templateUrl: './realtime-chat.component.html',
  styleUrls: ['./realtime-chat.component.css']
})
export class RealtimeChatComponent implements OnInit, OnDestroy {
  @Output() project = new EventEmitter<void>();
  @ViewChild('chatInput') chatInput?: ElementRef<HTMLInputElement>;
  @ViewChild('messageList') messageList?: ElementRef<HTMLElement>;
  opened = false;
  draft = '';
  pending = false;
  loading = false;
  connectionState = 'offline';
  error = '';
  ticket?: SupportTicket;
  showHandoff = false;
  handoffBusy = false;
  customerName = '';
  customerEmail = '';
  customerSubject = '';
  suggestions = ['What does Compileon do?', 'Can you build a website or application?', 'How can AI help my business?'];
  messages: ChatMessage[] = [this.welcome()];
  private subscriptions = new Subscription();
  private loadedHistory = false;
  private previousFocus?: HTMLElement;

  constructor(private realtime: RealtimeChatService) { }

  ngOnInit(): void {
    this.subscriptions.add(this.realtime.state$.subscribe(state => { this.connectionState = state; }));
    this.subscriptions.add(this.realtime.replies$.subscribe(reply => this.receive(reply)));
    this.subscriptions.add(this.realtime.supportMessages$.subscribe(message => this.receiveSupport(message)));
    this.subscriptions.add(this.realtime.ticket$.subscribe(ticket => { this.ticket = ticket; }));
  }

  private welcome(): ChatMessage {
    return { id: 'welcome', role: 'assistant', text: 'Hi, I’m Compileon’s assistant. From a first idea to your next digital product, let’s find a good place to start.', time: new Date() };
  }

  async open(): Promise<void> {
    this.previousFocus = document.activeElement as HTMLElement;
    this.opened = true;
    this.error = '';
    setTimeout(() => this.chatInput?.nativeElement.focus());
    if (this.loadedHistory) { return; }
    this.loading = true;
    try {
      const [suggestions, history, liveHistory] = await Promise.all([this.realtime.suggestions(), this.realtime.history(), this.realtime.supportHistory()]);
      if (suggestions.length) { this.suggestions = suggestions; }
      history.forEach(reply => {
        if (!this.messages.some(message => message.id === reply.messageId)) {
          this.messages.push({ id: 'user-' + reply.messageId, requestId: reply.messageId, role: 'user', text: reply.userText, time: new Date(reply.sentAt) });
          this.messages.push({ id: reply.messageId, role: 'assistant', text: reply.text, time: new Date(reply.sentAt) });
        }
      });
      liveHistory.forEach(message => this.receiveSupport(message));
      this.messages.sort((first, second) => first.time.getTime() - second.time.getTime());
      this.loadedHistory = true;
      this.scrollToEnd();
    } catch { this.error = 'We couldn’t connect just yet. Please try again.'; }
    finally { this.loading = false; }
  }

  close(): void {
    this.opened = false;
    this.previousFocus?.focus();
  }

  @HostListener('document:keydown.escape')
  onEscape(): void { if (this.opened) { this.close(); } }

  async retryConnection(): Promise<void> {
    this.loadedHistory = false;
    await this.open();
  }

  async send(text = this.draft, retry?: ChatMessage): Promise<void> {
    text = text.trim();
    if (!text || text.length > 2000 || this.pending || this.loading) { return; }
    const requestId = retry?.requestId || newRequestId();
    const userMessage: ChatMessage = retry || { id: 'user-' + requestId, requestId, role: 'user', text, time: new Date() };
    userMessage.failed = false;
    if (!retry) { this.messages.push(userMessage); this.draft = ''; }
    this.pending = true;
    this.error = '';
    this.scrollToEnd();
    try { await this.realtime.send(text, requestId); }
    catch {
      if (!this.messages.some(message => message.id === requestId)) {
        userMessage.failed = true;
        this.error = 'That message wasn’t delivered. You can retry it below.';
      }
    } finally { this.pending = false; this.scrollToEnd(); }
  }

  private receive(reply: ChatReply): void {
    if (!this.messages.some(message => message.id === reply.messageId)) {
      this.messages.push({ id: reply.messageId, role: 'assistant', text: reply.text, time: new Date(reply.sentAt) });
    }
    const user = this.messages.find(message => message.requestId === reply.messageId);
    if (user) { user.failed = false; }
    this.error = '';
    this.pending = false;
    this.scrollToEnd();
  }

  private receiveSupport(message: SupportMessage): void {
    const isCustomer = message.senderRole === 'customer';
    const id = isCustomer ? 'user-' + message.id : message.id;
    const existing = this.messages.find(row => row.id.toLowerCase() === id.toLowerCase());
    if (existing) { existing.failed = false; }
    else { this.messages.push({ id, requestId: isCustomer ? message.id : undefined, role: isCustomer ? 'user' : message.senderRole === 'agent' ? 'agent' : 'system', author: message.senderName, text: message.text, time: new Date(message.sentAt) }); }
    if (isCustomer) { this.pending = false; }
    this.scrollToEnd();
  }

  get liveSupport(): boolean { return !!this.ticket && this.ticket.status !== 'Closed'; }
  beginHandoff(): void {
    this.customerSubject = this.customerSubject || this.messages.filter(message => message.role === 'user').slice(-1)[0]?.text.slice(0, 200) || 'Help with a project';
    this.showHandoff = true; this.error = '';
  }
  async requestAgent(): Promise<void> {
    if (this.handoffBusy || this.customerName.trim().length < 2 || !this.customerSubject.trim()) { return; }
    this.handoffBusy = true; this.error = '';
    try {
      this.ticket = await this.realtime.requestAgent(this.customerName.trim(), this.customerEmail.trim(), this.customerSubject.trim());
      this.showHandoff = false;
    } catch { this.error = 'We couldn’t send your agent request. Check your details and try again.'; }
    finally { this.handoffBusy = false; }
  }
  async endSupport(): Promise<void> {
    if (this.pending || this.handoffBusy) { return; }
    this.handoffBusy = true;
    try { await this.realtime.endSupport(); }
    catch { this.error = 'We couldn’t end the conversation. Please try again.'; }
    finally { this.handoffBusy = false; }
  }

  newChat(): void {
    if (this.pending || this.liveSupport) { return; }
    this.realtime.resetSession();
    this.messages = [this.welcome()];
    this.error = '';
    this.customerName = ''; this.customerEmail = ''; this.customerSubject = ''; this.showHandoff = false;
  }

  startProject(): void { this.close(); this.project.emit(); }
  trackMessage(_index: number, message: ChatMessage): string { return message.id; }
  private scrollToEnd(): void {
    setTimeout(() => {
      const list = this.messageList?.nativeElement;
      if (list) { list.scrollTop = list.scrollHeight; }
    });
  }
  ngOnDestroy(): void { this.subscriptions.unsubscribe(); }
}

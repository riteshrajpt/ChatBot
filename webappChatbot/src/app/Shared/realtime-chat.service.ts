import { Injectable, NgZone } from '@angular/core';
import { HubConnection, HubConnectionBuilder, HubConnectionState, LogLevel } from '@microsoft/signalr';
import { BehaviorSubject, Subject } from 'rxjs';
import { environment } from '../../environments/environment';
import { SupportMessage, SupportTicket } from '../admin/admin-support.service';

export type ChatConnectionState = 'offline' | 'connecting' | 'online' | 'reconnecting';
export interface ChatReply { messageId: string; userText: string; text: string; sentAt: string; }
export interface ChatSession { sessionId: string; token: string; }
export interface ProjectInquiry {
  fullName: string; email: string; service: string; brief: string; consent: boolean; website: string;
}
export function newRequestId(): string {
  const bytes = new Uint8Array(16);
  window.crypto.getRandomValues(bytes);
  bytes[6] = (bytes[6] & 15) | 64;
  bytes[8] = (bytes[8] & 63) | 128;
  const hex = Array.from(bytes, b => b.toString(16).padStart(2, '0')).join('');
  return hex.slice(0, 8) + '-' + hex.slice(8, 12) + '-' + hex.slice(12, 16) + '-' + hex.slice(16, 20) + '-' + hex.slice(20);
}

@Injectable({ providedIn: 'root' })
export class RealtimeChatService {
  readonly state$ = new BehaviorSubject<ChatConnectionState>('offline');
  readonly replies$ = new Subject<ChatReply>();
  readonly supportMessages$ = new Subject<SupportMessage>();
  readonly ticket$ = new BehaviorSubject<SupportTicket | undefined>(undefined);
  private connection: HubConnection;
  private starting?: Promise<void>;
  private session?: ChatSession;
  private opening?: Promise<ChatSession>;
  private readonly sessionKey = 'compileon.chat.session.v1';

  constructor(private zone: NgZone) {
    this.connection = new HubConnectionBuilder()
      .withUrl(environment.chatHubUrl, { withCredentials: false })
      .withAutomaticReconnect([0, 2000, 5000, 10000])
      .configureLogging(LogLevel.Warning)
      .build();
    this.connection.on('ReceiveMessage', (reply: ChatReply) => this.zone.run(() => this.replies$.next(reply)));
    this.connection.on('SupportMessage', (message: SupportMessage) => this.zone.run(() => this.supportMessages$.next(message)));
    this.connection.on('SupportTicketChanged', (ticket: SupportTicket) => this.zone.run(() => this.ticket$.next(ticket)));
    this.connection.onreconnecting(() => this.setState('reconnecting'));
    this.connection.onreconnected(async () => {
      this.setState('online');
      try { const messages = await this.supportHistory(); messages.forEach(message => this.zone.run(() => this.supportMessages$.next(message))); } catch { }
    });
    this.connection.onclose(() => this.setState('offline'));
    try {
      const stored = sessionStorage.getItem(this.sessionKey);
      if (stored) {
        const value = JSON.parse(stored) as ChatSession;
        if (value.sessionId && value.token) { this.session = value; }
      }
    } catch { /* Storage may be unavailable in private browsing. */ }
  }

  private setState(state: ChatConnectionState): void { this.zone.run(() => this.state$.next(state)); }

  async connect(): Promise<void> {
    if (this.connection.state === HubConnectionState.Connected) { return; }
    if (this.starting) { return this.starting; }
    if (this.connection.state === HubConnectionState.Reconnecting) {
      throw new Error('We are reconnecting. Please try again in a moment.');
    }
    this.setState('connecting');
    this.starting = this.connection.start().then(() => this.setState('online')).catch(() => {
      this.setState('offline');
      throw new Error('We could not connect. Please check your connection and try again.');
    }).finally(() => { this.starting = undefined; });
    return this.starting;
  }

  async suggestions(): Promise<string[]> {
    await this.connect();
    return this.connection.invoke<string[]>('GetSuggestions');
  }

  async history(): Promise<ChatReply[]> {
    await this.connect();
    if (!this.session) { return []; }
    try {
      return await this.connection.invoke<ChatReply[]>('GetHistory', this.session.sessionId, this.session.token);
    } catch (error) {
      if (String(error).includes('chat session has expired')) {
        this.resetSession();
        return [];
      }
      throw error;
    }
  }

  private async ensureSession(): Promise<ChatSession> {
    if (this.session) { return this.session; }
    if (!this.opening) {
      this.opening = this.connection.invoke<ChatSession>('OpenSession').then(session => {
        this.session = session;
        try { sessionStorage.setItem(this.sessionKey, JSON.stringify(session)); } catch { }
        return session;
      }).finally(() => { this.opening = undefined; });
    }
    return this.opening;
  }

  async send(text: string, messageId: string): Promise<void> {
    await this.connect();
    const session = await this.ensureSession();
    await this.connection.invoke('SendMessage', { ...session, messageId, text });
  }

  resetSession(): void {
    this.session = undefined;
    this.ticket$.next(undefined);
    try { sessionStorage.removeItem(this.sessionKey); } catch { }
  }

  async supportHistory(): Promise<SupportMessage[]> {
    await this.connect();
    if (!this.session) { return []; }
    const ticket = await this.connection.invoke<SupportTicket | null>('JoinConversation', this.session.sessionId, this.session.token);
    this.zone.run(() => this.ticket$.next(ticket || undefined));
    return this.connection.invoke<SupportMessage[]>('GetSupportHistory', this.session.sessionId, this.session.token);
  }

  async requestAgent(customerName: string, customerEmail: string, subject: string): Promise<SupportTicket> {
    await this.connect();
    const session = await this.ensureSession();
    const ticket = await this.connection.invoke<SupportTicket>('RequestHuman', { ...session, customerName, customerEmail, subject });
    this.zone.run(() => this.ticket$.next(ticket));
    return ticket;
  }

  async endSupport(): Promise<void> {
    await this.connect();
    if (!this.session) { return; }
    const ticket = await this.connection.invoke<SupportTicket>('EndSupport', this.session.sessionId, this.session.token);
    this.zone.run(() => this.ticket$.next(ticket));
  }

  async submitInquiry(inquiry: ProjectInquiry, id: string): Promise<{ reference: string }> {
    await this.connect();
    return this.connection.invoke<{ reference: string }>('SubmitInquiry', { ...inquiry, id });
  }
}

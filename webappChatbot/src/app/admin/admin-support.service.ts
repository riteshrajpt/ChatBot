import { Injectable, NgZone } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { HubConnection, HubConnectionBuilder, HubConnectionState, LogLevel } from '@microsoft/signalr';
import { BehaviorSubject, Subject } from 'rxjs';
import { environment } from '../../environments/environment';
import { AdminAuthService } from './admin-auth.service';

export interface SupportTicket {
  id: string; sessionId: string; assignedAdminId: string; assignedAdminName: string; agentOnline: boolean;
  customerName: string; customerEmail?: string; subject: string; status: string; createdAt: string; updatedAt: string;
}
export interface SupportMessage { id: string; ticketId?: string; senderRole: string; senderName: string; text: string; sentAt: string; }
export interface Agent { id: string; displayName: string; email: string; isAvailable: boolean; isOnline: boolean; }
export interface ProjectEnquiry { id: string; fullName: string; email: string; service: string; brief: string; status: string; createdAt: string; }
@Injectable({ providedIn: 'root' })
export class AdminSupportService {
  readonly changes$ = new Subject<void>();
  readonly messages$ = new Subject<SupportMessage>();
  readonly ticketChanges$ = new Subject<SupportTicket>();
  readonly online$ = new BehaviorSubject(false);
  private connection: HubConnection;
  private heartbeat?: number;
  private watched?: string;
  private connecting?: Promise<void>;
  private root = '/api/api/admin';
  constructor(private http: HttpClient, private auth: AdminAuthService, private zone: NgZone) {
    this.connection = new HubConnectionBuilder().withUrl(environment.chatHubUrl.replace(/\/chat$/, '/admin'), {
      accessTokenFactory: () => this.auth.token, withCredentials: false
    }).withAutomaticReconnect([0, 2000, 5000, 10000]).configureLogging(LogLevel.Warning).build();
    this.connection.on('QueueChanged', () => this.zone.run(() => this.changes$.next()));
    this.connection.on('SupportMessage', (message: SupportMessage) => this.zone.run(() => this.messages$.next(message)));
    this.connection.on('TicketChanged', (ticket: SupportTicket) => this.zone.run(() => this.ticketChanges$.next(ticket)));
    this.connection.onreconnecting(() => this.zone.run(() => this.online$.next(false)));
    this.connection.onclose(() => this.zone.run(() => this.online$.next(false)));
    this.connection.onreconnected(async () => {
      this.zone.run(() => this.online$.next(true));
      if (this.watched) { await this.connection.invoke('WatchTicket', this.watched); }
      this.zone.run(() => this.changes$.next());
    });
  }
  async connect(): Promise<void> {
    if (this.connection.state === HubConnectionState.Connected) { return; }
    if (this.connecting) { return this.connecting; }
    this.connecting = this.connection.start().then(() => {
      this.zone.run(() => this.online$.next(true));
      if (!this.heartbeat) {
        this.heartbeat = window.setInterval(() => {
          if (this.connection.state === HubConnectionState.Connected) {
            this.connection.invoke('Heartbeat').catch(() => this.disconnect());
          }
        }, 30000);
      }
    }).finally(() => { this.connecting = undefined; });
    return this.connecting;
  }
  async disconnect(): Promise<void> {
    if (this.heartbeat) { clearInterval(this.heartbeat); this.heartbeat = undefined; }
    await this.connection.stop(); this.online$.next(false); this.watched = undefined;
  }
  overview(): Promise<any> { return this.http.get(this.root + '/overview').toPromise(); }
  agents(): Promise<Agent[]> { return this.http.get<Agent[]>(this.root + '/agents').toPromise(); }
  tickets(status: string, search: string): Promise<SupportTicket[]> {
    return this.http.get<SupportTicket[]>(this.root + '/tickets', { params: new HttpParams().set('status', status).set('search', search) }).toPromise();
  }
  async ticket(id: string): Promise<{ ticket: SupportTicket; messages: SupportMessage[] }> {
    if (this.watched && this.watched !== id && this.connection.state === HubConnectionState.Connected) { await this.connection.invoke('LeaveTicket', this.watched); }
    this.watched = id;
    await this.connect();
    await this.connection.invoke('WatchTicket', id);
    return this.http.get<{ ticket: SupportTicket; messages: SupportMessage[] }>(this.root + '/tickets/' + id).toPromise();
  }
  action(id: string, action: string, assignedAdminId?: string): Promise<SupportTicket> {
    return this.http.post<SupportTicket>(this.root + '/tickets/' + id + '/' + action, { assignedAdminId }).toPromise();
  }
  async reply(ticketId: string, messageId: string, text: string): Promise<void> {
    await this.connect(); await this.connection.invoke('SendReply', { ticketId, messageId, text });
  }
  async availability(value: boolean): Promise<void> { await this.connect(); await this.connection.invoke('SetAvailability', value); }
  inquiries(): Promise<ProjectEnquiry[]> { return this.http.get<ProjectEnquiry[]>(this.root + '/inquiries').toPromise(); }
  inquiry(id: string): Promise<any> { return this.http.get(this.root + '/inquiries/' + id).toPromise(); }
  replyToInquiry(id: string, replyId: string, body: string): Promise<any> { return this.http.post(this.root + '/inquiries/' + id + '/reply', { id: replyId, body }).toPromise(); }
  inquiryStatus(id: string, status: string): Promise<any> { return this.http.post(this.root + '/inquiries/' + id + '/status', { status }).toPromise(); }
  emails(): Promise<any[]> { return this.http.get<any[]>(this.root + '/emails').toPromise(); }
  mailStatus(): Promise<any> { return this.http.get(this.root + '/mail-status').toPromise(); }
  retryEmail(id: string): Promise<any> { return this.http.post(this.root + '/emails/' + id + '/retry', {}).toPromise(); }
}


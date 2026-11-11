import { Component, ElementRef, OnDestroy, OnInit, ViewChild } from '@angular/core';
import { ActivatedRoute } from '@angular/router';
import { Subscription } from 'rxjs';
import { AdminAuthService, AdminUser } from './admin-auth.service';
import { AdminSupportService, Agent, ProjectEnquiry, SupportMessage, SupportTicket } from './admin-support.service';
import { newRequestId } from '../Shared/realtime-chat.service';

@Component({ selector: 'app-admin', templateUrl: './admin.component.html', styleUrls: ['./admin.component.css'] })
export class AdminComponent implements OnInit, OnDestroy {
  @ViewChild('thread') thread?: ElementRef<HTMLElement>;
  user: AdminUser | null = null;
  checking = true; busy = false; sending = false; refreshing = false; online = false;
  email = ''; password = ''; currentPassword = ''; newPassword = ''; confirmPassword = '';
  view = 'queries'; filter = 'all'; search = ''; error = ''; notice = '';
  overview: any = { waiting: 0, active: 0, newInquiries: 0, emailPending: 0, emailFailed: 0 };
  agents: Agent[] = []; tickets: SupportTicket[] = []; inquiries: ProjectEnquiry[] = []; emails: any[] = [];
  mail: any = {}; selected?: SupportTicket; messages: SupportMessage[] = []; reply = ''; reassignId = '';
  selectedInquiry?: ProjectEnquiry; inquiryReplies: any[] = []; inquiryReply = '';
  private subscriptions = new Subscription();
  private timer?: number;
  private queuedRefresh = false;
  private replyId = newRequestId(); private replySignature = '';
  private inquiryReplyId = newRequestId(); private inquirySignature = '';
  constructor(public auth: AdminAuthService, private support: AdminSupportService, private route: ActivatedRoute) { }

  async ngOnInit(): Promise<void> {
    this.subscriptions.add(this.auth.user$.subscribe(user => { this.user = user; }));
    this.subscriptions.add(this.support.online$.subscribe(online => { this.online = online; }));
    this.subscriptions.add(this.support.changes$.subscribe(() => {
      this.refresh().then(() => { if (this.selected) { this.openTicket(this.selected.id, true); } });
    }));
    this.subscriptions.add(this.support.messages$.subscribe(message => {
      if (this.selected && message.ticketId === this.selected.id && !this.messages.some(row => row.id.toLowerCase() === message.id.toLowerCase())) {
        this.messages.push(message); this.scrollThread();
      }
    }));
    this.subscriptions.add(this.support.ticketChanges$.subscribe(ticket => { if (this.selected?.id === ticket.id) { this.selected = ticket; } }));
    try { this.user = await this.auth.restore(); if (this.user && !this.user.mustChangePassword) { await this.startWorkspace(); } }
    finally { this.checking = false; }
  }
  get available(): boolean { return this.agents.find(agent => agent.id === this.user?.id)?.isAvailable ?? true; }
  get ownsTicket(): boolean { return !!this.selected && this.selected.assignedAdminId === this.user?.id; }
  reference(id: string): string { return id.replace(/-/g, '').slice(0, 8).toUpperCase(); }
  initials(name: string): string { return name.split(' ').filter(Boolean).map(part => part[0]).slice(0, 2).join('').toUpperCase(); }
  async login(): Promise<void> {
    if (!this.email.trim() || !this.password || this.busy) { return; }
    this.busy = true; this.error = '';
    try {
      this.user = await this.auth.login(this.email.trim(), this.password);
      if (this.user.mustChangePassword) { this.currentPassword = this.password; }
      this.password = '';
      if (!this.user.mustChangePassword) { await this.startWorkspace(); }
    } catch (error) { this.error = (error as any)?.error?.message || 'We couldn’t sign you in. Please check your details and connection.'; }
    finally { this.busy = false; }
  }
  async changePassword(): Promise<void> {
    this.error = '';
    if (this.newPassword.length < 12 || this.newPassword !== this.confirmPassword) { this.error = 'Use at least 12 characters and make sure the new passwords match.'; return; }
    this.busy = true;
    try {
      this.user = await this.auth.changePassword(this.currentPassword, this.newPassword);
      this.currentPassword = ''; this.newPassword = ''; this.confirmPassword = '';
      await this.startWorkspace();
    } catch (error) { this.error = (error as any)?.error?.message || 'We couldn’t change your password. Please try again.'; }
    finally { this.busy = false; }
  }
  private async startWorkspace(): Promise<void> {
    try { await this.support.connect(); }
    catch { this.error = 'Live updates are offline. You can reconnect using Refresh.'; }
    await this.refresh();
    if (!this.timer) { this.timer = window.setInterval(() => this.refresh(), 30000); }
    const ticket = this.route.snapshot.queryParamMap.get('ticket');
    const inquiry = this.route.snapshot.queryParamMap.get('inquiry');
    if (ticket && /^[a-f0-9-]{36}$/i.test(ticket)) { await this.openTicket(ticket); }
    if (inquiry && /^[a-f0-9-]{36}$/i.test(inquiry)) { this.view = 'projects'; await this.openInquiry(inquiry); }
  }
  async refresh(): Promise<void> {
    if (!this.user || this.user.mustChangePassword) { return; }
    if (this.refreshing) { this.queuedRefresh = true; return; }
    this.refreshing = true;
    try {
      [this.overview, this.agents, this.tickets, this.inquiries, this.emails, this.mail] = await Promise.all([
        this.support.overview(), this.support.agents(), this.support.tickets(this.filter, this.search),
        this.support.inquiries(), this.support.emails(), this.support.mailStatus()
      ]);
    } catch { this.error = 'We couldn’t refresh the workspace. Check your connection or sign in again.'; }
    finally {
      this.refreshing = false;
      if (this.queuedRefresh) { this.queuedRefresh = false; this.refresh(); }
    }
  }
  async reconnect(): Promise<void> {
    this.error = '';
    try { await this.support.connect(); await this.refresh(); if (this.selected) { await this.openTicket(this.selected.id, true); } }
    catch { this.error = 'Live connection is unavailable. Please try again.'; }
  }
  async toggleAvailability(): Promise<void> {
    try { await this.support.availability(!this.available); await this.refresh(); }
    catch { this.error = 'Could not update availability.'; }
  }
  async openTicket(id: string, silent = false): Promise<void> {
    if (!silent) { this.error = ''; this.reply = ''; this.replySignature = ''; }
    try {
      const result = await this.support.ticket(id);
      this.selected = result.ticket; this.messages = result.messages; this.reassignId = result.ticket.assignedAdminId;
      this.scrollThread();
    } catch { this.error = 'We couldn’t open this query. Refresh and try again.'; }
  }
  async ticketAction(action: string): Promise<void> {
    if (!this.selected || this.busy) { return; }
    this.busy = true; this.error = '';
    try {
      this.selected = await this.support.action(this.selected.id, action, action === 'reassign' ? this.reassignId : undefined);
      await this.refresh();
    } catch (error) { this.error = (error as any)?.error?.message || 'The query could not be updated.'; }
    finally { this.busy = false; }
  }
  async sendReply(): Promise<void> {
    if (!this.selected || !this.ownsTicket || this.selected.status !== 'Active' || !this.reply.trim() || this.sending) { return; }
    this.sending = true; this.error = '';
    const signature = this.selected.id + ':' + this.reply.trim();
    if (this.replySignature && signature !== this.replySignature) { this.replyId = newRequestId(); }
    this.replySignature = signature;
    try {
      await this.support.reply(this.selected.id, this.replyId, this.reply.trim());
      this.reply = ''; this.replyId = newRequestId(); this.replySignature = '';
    } catch { this.error = 'Your reply wasn’t sent. The text is kept so you can retry.'; }
    finally { this.sending = false; }
  }
  async openInquiry(id: string): Promise<void> {
    this.error = ''; this.notice = ''; this.inquiryReply = ''; this.inquirySignature = '';
    try { const result = await this.support.inquiry(id); this.selectedInquiry = result.inquiry; this.inquiryReplies = result.replies; }
    catch { this.error = 'Could not open this project enquiry.'; }
  }
  async respondToInquiry(): Promise<void> {
    if (!this.selectedInquiry || this.inquiryReply.trim().length < 10 || this.sending) { return; }
    this.sending = true; this.error = '';
    const signature = this.selectedInquiry.id + ':' + this.inquiryReply.trim();
    if (this.inquirySignature && this.inquirySignature !== signature) { this.inquiryReplyId = newRequestId(); }
    this.inquirySignature = signature;
    try {
      await this.support.replyToInquiry(this.selectedInquiry.id, this.inquiryReplyId, this.inquiryReply.trim());
      const id = this.selectedInquiry.id; await this.openInquiry(id); await this.refresh();
      this.notice = 'Response saved. Email copies are queued for the customer and directors.';
      this.inquiryReplyId = newRequestId(); this.inquirySignature = '';
    } catch { this.error = 'Your response wasn’t saved. You can retry without losing the text.'; }
    finally { this.sending = false; }
  }
  async setInquiryStatus(status: string): Promise<void> {
    if (!this.selectedInquiry) { return; }
    try { await this.support.inquiryStatus(this.selectedInquiry.id, status); this.selectedInquiry.status = status; await this.refresh(); }
    catch { this.error = 'Could not update this enquiry.'; }
  }
  async retryEmail(id: string): Promise<void> {
    try { await this.support.retryEmail(id); await this.refresh(); this.notice = 'The email is queued for another delivery attempt.'; }
    catch { this.error = 'Could not retry delivery.'; }
  }
  async logout(): Promise<void> {
    try { await this.auth.logout(); }
    finally {
      await this.support.disconnect(); this.user = null; this.selected = undefined; this.selectedInquiry = undefined;
      this.messages = []; this.tickets = []; this.inquiries = []; this.emails = [];
      if (this.timer) { clearInterval(this.timer); this.timer = undefined; }
      this.error = ''; this.notice = '';
    }
  }
  private scrollThread(): void { setTimeout(() => { const element = this.thread?.nativeElement; if (element) { element.scrollTop = element.scrollHeight; } }); }
  ngOnDestroy(): void { this.subscriptions.unsubscribe(); if (this.timer) { clearInterval(this.timer); } this.support.disconnect(); }
}


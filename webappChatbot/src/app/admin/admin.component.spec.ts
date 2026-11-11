import { ComponentFixture, TestBed, fakeAsync, flushMicrotasks } from '@angular/core/testing';
import { HttpClientTestingModule } from '@angular/common/http/testing';
import { BehaviorSubject, Subject } from 'rxjs';
import { AppModule } from '../app.module';
import { AdminComponent } from './admin.component';
import { AdminAuthService } from './admin-auth.service';
import { AdminSupportService } from './admin-support.service';

describe('Protected admin workspace', () => {
  let fixture: ComponentFixture<AdminComponent>;
  let auth: any;
  let support: any;
  const user = { id: 'admin-test', email: 'admin@example.com', displayName: 'Super admin test', mustChangePassword: false };
  beforeEach(async () => {
    auth = { user$: new BehaviorSubject(null), restore: jasmine.createSpy().and.returnValue(Promise.resolve(null)), clear: jasmine.createSpy(), logout: jasmine.createSpy().and.returnValue(Promise.resolve()) };
    support = {
      online$: new BehaviorSubject(true), changes$: new Subject(), messages$: new Subject(), ticketChanges$: new Subject(),
      connect: jasmine.createSpy().and.returnValue(Promise.resolve()), disconnect: jasmine.createSpy().and.returnValue(Promise.resolve()),
      overview: jasmine.createSpy().and.returnValue(Promise.resolve({ waiting: 1, active: 0, newInquiries: 1, emailPending: 2, emailFailed: 0 })),
      agents: jasmine.createSpy().and.returnValue(Promise.resolve([])), tickets: jasmine.createSpy().and.returnValue(Promise.resolve([])),
      inquiries: jasmine.createSpy().and.returnValue(Promise.resolve([])), emails: jasmine.createSpy().and.returnValue(Promise.resolve([])),
      mailStatus: jasmine.createSpy().and.returnValue(Promise.resolve({ mode: 'Disabled' }))
    };
    await TestBed.configureTestingModule({ imports: [AppModule, HttpClientTestingModule], providers: [
      { provide: AdminAuthService, useValue: auth }, { provide: AdminSupportService, useValue: support }
    ] }).compileComponents();
  });
  afterEach(() => fixture?.destroy());
  it('shows sign-in and does not request customer data without authentication', fakeAsync(() => {
    fixture = TestBed.createComponent(AdminComponent); fixture.detectChanges(); flushMicrotasks(); fixture.detectChanges();
    expect(fixture.nativeElement.querySelector('#admin-email')).not.toBeNull();
    expect(fixture.nativeElement.querySelector('.admin-workspace')).toBeNull();
    expect(support.tickets).not.toHaveBeenCalled();
  }));
  it('requires the first-login password change before opening the inbox', fakeAsync(() => {
    auth.restore.and.returnValue(Promise.resolve({ ...user, mustChangePassword: true }));
    fixture = TestBed.createComponent(AdminComponent); fixture.detectChanges(); flushMicrotasks(); fixture.detectChanges();
    expect(fixture.nativeElement.querySelector('#new-password')).not.toBeNull();
    expect(support.tickets).not.toHaveBeenCalled();
    expect(fixture.nativeElement.querySelector('.admin-workspace')).toBeNull();
  }));
  it('opens the authenticated workspace and exposes email delivery status', fakeAsync(() => {
    auth.restore.and.returnValue(Promise.resolve(user));
    fixture = TestBed.createComponent(AdminComponent); fixture.detectChanges(); flushMicrotasks(); fixture.detectChanges();
    expect(support.tickets).toHaveBeenCalled();
    expect(fixture.nativeElement.querySelector('.admin-workspace')).not.toBeNull();
    fixture.componentInstance.view = 'delivery'; fixture.detectChanges();
    expect(fixture.nativeElement.querySelector('.delivery-section').textContent).toContain('Delivery paused');
    fixture.destroy();
  }));
  it('keeps the authenticated workspace within mobile and desktop viewports', fakeAsync(() => {
    auth.restore.and.returnValue(Promise.resolve(user));
    fixture = TestBed.createComponent(AdminComponent); fixture.detectChanges(); flushMicrotasks(); fixture.detectChanges();
    const styles = Array.from(document.querySelectorAll('style')).map(style => style.outerHTML).join('');
    const frame = document.createElement('iframe');
    frame.style.cssText = 'position:absolute;left:-10000px;top:0;width:390px;height:844px;border:0';
    document.body.appendChild(frame);
    try {
      const doc = frame.contentDocument!;
      doc.open(); doc.write('<!doctype html><html><head>' + styles + '</head><body style="margin:0">' + fixture.nativeElement.outerHTML + '</body></html>'); doc.close();
      for (const width of [360, 768, 1280]) {
        frame.style.width = width + 'px';
        expect(doc.documentElement.scrollWidth).withContext('admin viewport ' + width).toBeLessThanOrEqual(width + 1);
      }
    } finally { frame.remove(); fixture.destroy(); }
  }));
});

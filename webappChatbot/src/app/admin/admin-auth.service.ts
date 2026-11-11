import { Injectable } from '@angular/core';
import { HttpClient, HttpErrorResponse, HttpEvent, HttpHandler, HttpInterceptor, HttpRequest } from '@angular/common/http';
import { BehaviorSubject, Observable, throwError } from 'rxjs';
import { catchError } from 'rxjs/operators';
export interface AdminUser { id: string; email: string; displayName: string; mustChangePassword: boolean; }
interface AdminSession { token: string; expiresAt: string; user: AdminUser; }
@Injectable({ providedIn: 'root' })
export class AdminAuthService {
  readonly user$ = new BehaviorSubject<AdminUser | null>(null);
  private session?: AdminSession;
  constructor(private http: HttpClient) {
    try {
      const value = JSON.parse(sessionStorage.getItem('compileon.admin.v1') || 'null') as AdminSession;
      if (value && new Date(value.expiresAt).getTime() > Date.now()) { this.session = value; this.user$.next(value.user); }
    } catch { }
  }
  get token(): string { return this.session?.token || ''; }
  async login(email: string, password: string): Promise<AdminUser> {
    const result = await this.http.post<AdminSession>('/api/api/admin/auth/login', { email, password }).toPromise();
    return this.save(result);
  }
  async restore(): Promise<AdminUser | null> {
    if (!this.token) { return null; }
    try {
      const user = await this.http.get<AdminUser>('/api/api/admin/auth/me').toPromise();
      if (this.session) { this.session.user = user; this.save(this.session); }
      return user;
    } catch { this.clear(); return null; }
  }
  async changePassword(currentPassword: string, newPassword: string): Promise<AdminUser> {
    const result = await this.http.post<AdminSession>('/api/api/admin/auth/change-password', { currentPassword, newPassword }).toPromise();
    return this.save(result);
  }
  async logout(): Promise<void> {
    try { if (this.token) { await this.http.post('/api/api/admin/auth/logout', {}).toPromise(); } }
    finally { this.clear(); }
  }
  clear(): void {
    this.session = undefined; this.user$.next(null);
    try { sessionStorage.removeItem('compileon.admin.v1'); } catch { }
  }
  private save(session: AdminSession): AdminUser {
    this.session = session; this.user$.next(session.user);
    try { sessionStorage.setItem('compileon.admin.v1', JSON.stringify(session)); } catch { }
    return session.user;
  }
}
@Injectable()
export class AdminTokenInterceptor implements HttpInterceptor {
  constructor(private auth: AdminAuthService) { }
  intercept(request: HttpRequest<any>, next: HttpHandler): Observable<HttpEvent<any>> {
    const internal = request.url.startsWith('/api/api/');
    if (internal && this.auth.token) { request = request.clone({ setHeaders: { Authorization: 'Bearer ' + this.auth.token } }); }
    return next.handle(request).pipe(catchError((error: HttpErrorResponse) => {
      if (internal && error.status === 401 && !request.url.endsWith('/auth/login')) { this.auth.clear(); }
      return throwError(error);
    }));
  }
}


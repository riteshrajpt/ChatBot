import { Injectable } from '@angular/core';
import { CanActivate, Router } from '@angular/router';
import { AdminAuthService } from './admin-auth.service';
@Injectable({ providedIn: 'root' })
export class AdminGuard implements CanActivate {
  constructor(private auth: AdminAuthService, private router: Router) { }
  async canActivate(): Promise<boolean> {
    const user = await this.auth.restore();
    if (user && !user.mustChangePassword) { return true; }
    await this.router.navigate(['/admin']); return false;
  }
}


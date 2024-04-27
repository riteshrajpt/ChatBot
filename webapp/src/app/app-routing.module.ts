import { ForbiddenComponent } from './forbidden/forbidden.component';
import { AuthGuard } from './auth/auth.guard';
import { NgModule } from '@angular/core';
import { Routes, RouterModule } from '@angular/router';
import { UserComponent } from './user/user.component';
import { RegistrationComponent } from './user/registration/registration.component';
import { LoginComponent } from './user/login/login.component';
import { HomeComponent } from './home/home.component';
import { ChatbotComponent } from './chatbot/chatbot.component';
import { ChatbotRptComponent } from './chatbot-rpt/chatbot-rpt.component';


const routes: Routes = [
  {path:"",redirectTo:'/homepage',pathMatch:'full'},
  {
    path: 'user', component: UserComponent,
    children: [
      { path: 'registration', component: RegistrationComponent },
      { path: 'login', component: LoginComponent }
    ]
  },
  {path:'homepage',component:ChatbotComponent},
  {path:'ChatbotRpt',component:ChatbotRptComponent},
  {path:'dashboard',component:HomeComponent,canActivate:[AuthGuard]},
  {path:'forbidden',component:ForbiddenComponent},
];

@NgModule({
  imports: [RouterModule.forRoot(routes)],
  exports: [RouterModule]
})
export class AppRoutingModule { }

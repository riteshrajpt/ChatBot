import { NgModule } from '@angular/core';
import { PreloadAllModules, RouterModule, Routes } from '@angular/router';
import { ChatBotRptComponent } from './chat-bot-rpt/chat-bot-rpt.component';
import { ChatBoxComponent } from './chat-box/chat-box.component';
import { AdminComponent } from './admin/admin.component';
import { AdminGuard } from './admin/admin.guard';
const routes: Routes = [
  {
    path: "",
    redirectTo: '/homepage',
    pathMatch: 'full'
  },
  {
    path: "homepage",
    component: ChatBoxComponent,
    data: {
      title: "Compileon Innovation",
    },
  },
  {
    path: 'admin',
    component: AdminComponent,
    data: { title: 'Compileon Support Workspace' }
  },
  {
    path: "chat-bot-rpt",
    component: ChatBotRptComponent,
    canActivate: [AdminGuard],
    data: {
      title: "ChatBot Reports",
    },
  }
];

@NgModule({
  imports: [RouterModule.forRoot(routes, { preloadingStrategy: PreloadAllModules })],
  exports: [RouterModule]
})
export class AppRoutingModule { }

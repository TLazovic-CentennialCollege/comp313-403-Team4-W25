import { Routes } from '@angular/router';
import { HrDashboardComponent } from './components/hr-dashboard/hr-dashboard.component';
import { HrAuthGuard } from './guards/hr-auth.guard';
import { AuthGuard } from './guards/auth.guard';

export const routes: Routes = [
  { path: '', redirectTo: 'login', pathMatch: 'full' },
  {
    path: 'login',
    loadComponent: () =>
      import('./components/login/login.component').then(
        (c) => c.LoginComponent
      ),
  },

  {
    path: 'home',
    loadComponent: () =>
      import('./components/home/home.component').then((c) => c.HomeComponent),
    canActivate: [AuthGuard],
  },

  {
    path: 'user-edit',
    loadComponent: () =>
      import('./components/user-edit/user-edit.component').then(
        (c) => c.UserEditComponent
      ),
    canActivate: [AuthGuard],
  },

  {
    path: 'ticketcreate',
    loadComponent: () =>
      import('./components/ticket-create/ticket-create.component').then(
        (c) => c.TicketCreateComponent
      ),
    canActivate: [AuthGuard],
  },
  {
    path: 'ticket-edit',
    loadComponent: () =>
      import('./components/ticket-edit/ticket-edit.component').then(
        (c) => c.TicketEditComponent
      ),
    canActivate: [AuthGuard],
  },
  {
    path: 'hr-dashboard',
    component: HrDashboardComponent,
    canActivate: [HrAuthGuard],
  },
  { path: '**', redirectTo: 'login' },
];
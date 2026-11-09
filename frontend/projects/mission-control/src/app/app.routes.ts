import { Routes } from '@angular/router';
import { authGuard } from './core/auth-guard';
import { ShellComponent } from './layout/shell';

export const routes: Routes = [
  {
    path: 'sign-in',
    title: 'Sign in · Hewn',
    loadComponent: () => import('./pages/sign-in/sign-in.page').then((m) => m.SignInPage),
  },
  {
    path: '',
    component: ShellComponent,
    canActivate: [authGuard],
    children: [
      { path: '', pathMatch: 'full', redirectTo: 'projects/new' },
      {
        path: 'projects',
        pathMatch: 'full',
        title: 'Projects · Hewn',
        loadComponent: () => import('./pages/projects/projects.page').then((m) => m.ProjectsPage),
      },
      {
        path: 'projects/new',
        title: 'New direction · Hewn',
        loadComponent: () =>
          import('./pages/new-direction/new-direction.page').then((m) => m.NewDirectionPage),
      },
      {
        path: 'projects/:projectId',
        title: 'Project · Hewn',
        loadComponent: () => import('./pages/project/project.page').then((m) => m.ProjectPage),
      },
      {
        path: 'workers',
        title: 'Workers · Hewn',
        loadComponent: () => import('./pages/workers/workers.page').then((m) => m.WorkersPage),
      },
      {
        path: 'settings',
        title: 'Settings · Hewn',
        loadComponent: () => import('./pages/settings/settings.page').then((m) => m.SettingsPage),
      },
      {
        path: '**',
        title: 'Not found · Hewn',
        loadComponent: () => import('./pages/not-found/not-found.page').then((m) => m.NotFoundPage),
      },
    ],
  },
];

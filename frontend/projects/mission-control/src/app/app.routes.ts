import { Routes } from '@angular/router';
import { authGuard } from './core/auth-guard';
import { ShellComponent } from './layout/shell';
import { ProjectsPage } from './pages/projects/projects.page';

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
        // Eager: the page L2-045 AC1 measures loads without waiting for a route chunk; every other route is lazy.
        component: ProjectsPage,
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
        // Input binding sets an input with no route data to undefined, so each section names itself.
        data: { section: 'pipeline' },
        loadComponent: () => import('./pages/project/project.page').then((m) => m.ProjectPage),
      },
      {
        path: 'projects/:projectId/backlog',
        title: 'Backlog · Hewn',
        data: { section: 'backlog' },
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

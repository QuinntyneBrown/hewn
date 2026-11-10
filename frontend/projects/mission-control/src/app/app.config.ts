import { provideHttpClient, withInterceptors, withXsrfConfiguration } from '@angular/common/http';
import {
  ApplicationConfig,
  inject,
  provideAppInitializer,
  provideBrowserGlobalErrorListeners,
} from '@angular/core';
import { provideRouter, withComponentInputBinding } from '@angular/router';
import {
  ALLOW_LIST_API,
  HttpAllowListApi,
  HttpProjectsApi,
  HttpSessionApi,
  HttpSettingsApi,
  PROJECT_EVENTS,
  AUDIT_API,
  HttpAuditApi,
  PROJECTS_API,
  SESSION_API,
  SETTINGS_API,
  HttpWorkersApi,
  WORKERS_API,
  SignalRProjectEvents,
} from '@hewn/api';
import { routes } from './app.routes';
import { ProjectsPrefetch } from './core/projects-prefetch';
import { sessionExpiryInterceptor } from './core/session-expiry';
import { SessionStore } from './core/session-store';

/** Composition root: every API contract is bound to its implementation here. */
export const appConfig: ApplicationConfig = {
  providers: [
    provideBrowserGlobalErrorListeners(),
    provideRouter(routes, withComponentInputBinding()),
    provideHttpClient(
      withXsrfConfiguration({ cookieName: 'XSRF-TOKEN', headerName: 'X-XSRF-TOKEN' }),
      withInterceptors([sessionExpiryInterceptor]),
    ),
    { provide: ALLOW_LIST_API, useClass: HttpAllowListApi },
    { provide: PROJECTS_API, useClass: HttpProjectsApi },
    { provide: SESSION_API, useClass: HttpSessionApi },
    { provide: SETTINGS_API, useClass: HttpSettingsApi },
    { provide: WORKERS_API, useClass: HttpWorkersApi },
    { provide: AUDIT_API, useClass: HttpAuditApi },
    { provide: PROJECT_EVENTS, useClass: SignalRProjectEvents },
    provideAppInitializer(() => {
      // Opening on Projects, its list is requested alongside the session, not after it (L2-045 AC1).
      if (location.pathname === '/projects') inject(ProjectsPrefetch).start();
      return inject(SessionStore).load();
    }),
  ],
};

import { provideHttpClient, withXsrfConfiguration } from '@angular/common/http';
import {
  ApplicationConfig,
  inject,
  provideAppInitializer,
  provideBrowserGlobalErrorListeners,
} from '@angular/core';
import { provideRouter, withComponentInputBinding } from '@angular/router';
import { HttpProjectsApi, HttpSessionApi, PROJECTS_API, SESSION_API } from '@hewn/api';
import { routes } from './app.routes';
import { SessionStore } from './core/session-store';

/** Composition root: every API contract is bound to its implementation here. */
export const appConfig: ApplicationConfig = {
  providers: [
    provideBrowserGlobalErrorListeners(),
    provideRouter(routes, withComponentInputBinding()),
    provideHttpClient(
      withXsrfConfiguration({ cookieName: 'XSRF-TOKEN', headerName: 'X-XSRF-TOKEN' }),
    ),
    { provide: PROJECTS_API, useClass: HttpProjectsApi },
    { provide: SESSION_API, useClass: HttpSessionApi },
    provideAppInitializer(() => inject(SessionStore).load()),
  ],
};

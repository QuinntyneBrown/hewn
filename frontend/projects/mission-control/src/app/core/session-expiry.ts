import { HttpErrorResponse, HttpInterceptorFn } from '@angular/common/http';
import { inject } from '@angular/core';
import { tap } from 'rxjs';
import { SessionStore } from './session-store';

/** The sign-in address for a session that ended while the app was open, coming back to where the user was. */
export function expiredSignIn(path: string): string {
  const back = path.startsWith('/sign-in') ? '' : `&returnUrl=${encodeURIComponent(path)}`;
  return `/sign-in?reason=expired${back}`;
}

/**
 * A 401 from the API once signed in means the session ended (after 8 hours, or signed out elsewhere: L2-038 AC3).
 * The browser reloads at sign-in, so nothing from the old session stays in memory.
 */
export const sessionExpiryInterceptor: HttpInterceptorFn = (request, next) => {
  const session = inject(SessionStore);
  return next(request).pipe(
    tap({
      error: (error: unknown) => {
        if (error instanceof HttpErrorResponse && error.status === 401 && session.signedIn()) {
          session.me.set(null);
          location.assign(expiredSignIn(location.pathname + location.search));
        }
      },
    }),
  );
};

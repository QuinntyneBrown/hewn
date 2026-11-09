import { inject } from '@angular/core';
import { CanActivateFn, Router } from '@angular/router';
import { SessionStore } from './session-store';

/** Pages need a session; without one the browser goes to sign-in. */
export const authGuard: CanActivateFn = () =>
  inject(SessionStore).signedIn() ? true : inject(Router).parseUrl('/sign-in');

import { inject } from '@angular/core';
import { CanActivateFn, Router } from '@angular/router';
import { SessionStore } from './session-store';

/** Pages need a session; without one the browser goes to sign-in, and comes back after it (L2-038 AC1). */
export const authGuard: CanActivateFn = (_route, state) =>
  inject(SessionStore).signedIn()
    ? true
    : inject(Router).createUrlTree(['/sign-in'], { queryParams: { returnUrl: state.url } });

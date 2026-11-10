import { expiredSignIn } from './session-expiry';

describe('a session that ends while the app is open (L2-038 AC3)', () => {
  it('goes to sign-in saying so, and comes back where the user was', () => {
    expect(expiredSignIn('/projects/42/backlog?tab=all')).toBe(
      '/sign-in?reason=expired&returnUrl=%2Fprojects%2F42%2Fbacklog%3Ftab%3Dall',
    );
    expect(expiredSignIn('/sign-in')).toBe('/sign-in?reason=expired');
  });
});

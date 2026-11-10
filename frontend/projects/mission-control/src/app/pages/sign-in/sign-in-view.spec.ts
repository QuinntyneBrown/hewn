import { gitHubSignIn, localReturn, signInState } from './sign-in-view';

describe('the sign-in page (L2-038)', () => {
  it('reads its state from the address', () => {
    expect(signInState({})).toEqual({ kind: 'default' });
    expect(signInState({ error: 'denied', login: 'devon-park' })).toEqual({
      kind: 'denied',
      login: 'devon-park',
    });
    expect(signInState({ error: 'github' })).toEqual({ kind: 'error' });
    expect(signInState({ reason: 'expired' })).toEqual({ kind: 'expired' });
    expect(signInState({ reason: 'signed-out' })).toEqual({ kind: 'signed-out' });
  });

  it('only ever returns to a page on this site', () => {
    expect(localReturn('/projects/42?tab=backlog')).toBe('/projects/42?tab=backlog');
    expect(localReturn('//evil.example')).toBe('/');
    expect(localReturn('https://evil.example')).toBe('/');
    expect(localReturn('/sign-in?error=github')).toBe('/');
    expect(localReturn(undefined)).toBe('/');
  });

  it('starts GitHub sign-in at the API with where to come back', () => {
    expect(gitHubSignIn('/projects')).toBe('/api/auth/github?returnUrl=%2Fprojects');
  });
});

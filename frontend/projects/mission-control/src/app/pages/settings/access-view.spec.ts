import { lastSignInText, loginInitials, notAdded } from './access-view';

describe('who can sign in (L2-038 AC5)', () => {
  const now = new Date(2026, 10, 9, 14, 31);

  it('says when each login last signed in', () => {
    expect(lastSignInText(new Date(2026, 10, 9, 8, 2).toISOString(), now)).toBe(
      'Last sign-in: Today, 08:02',
    );
    expect(lastSignInText(new Date(2026, 10, 8, 17, 40).toISOString(), now)).toBe(
      'Last sign-in: Yesterday, 17:40',
    );
    expect(lastSignInText(new Date(2026, 10, 2, 9, 5).toISOString(), now)).toBe(
      'Last sign-in: 2 Nov, 09:05',
    );
    expect(lastSignInText(null, now)).toBe('Last sign-in: Never');
  });

  it('shows each login by its first two letters', () => {
    expect(loginInitials('quinntynebrown')).toBe('QU');
    expect(loginInitials('ama-osei')).toBe('AM');
  });

  it('says why a login wasn’t added when GitHub couldn’t confirm it', () => {
    expect(notAdded('nadia-k', 'GitHub couldn’t confirm the login exists (rate limited)')).toEqual({
      title: '@nadia-k wasn’t added',
      body: 'GitHub couldn’t confirm the login exists (rate limited). Try again in a minute.',
    });
  });
});

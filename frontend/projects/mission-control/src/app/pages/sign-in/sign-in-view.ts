/** What the sign-in page says (L2-038): the mocks' default, denied, error, expired and signed-out states. */
export type SignInState =
  | { kind: 'default' }
  | { kind: 'denied'; login: string }
  | { kind: 'error' }
  | { kind: 'expired' }
  | { kind: 'signed-out' };

/**
 * Reads the state from the address the API and the app send people to: `?error=denied&login=` (not on the allow
 * list), `?error=github` (GitHub failed or didn't answer), `?reason=expired` and `?reason=signed-out`.
 */
export function signInState(params: {
  error?: string | null;
  login?: string | null;
  reason?: string | null;
}): SignInState {
  if (params.error === 'denied')
    return { kind: 'denied', login: params.login?.trim() || 'This account' };
  if (params.error) return { kind: 'error' };
  if (params.reason === 'expired') return { kind: 'expired' };
  if (params.reason === 'signed-out') return { kind: 'signed-out' };
  return { kind: 'default' };
}

/** A path on this site to return to after sign-in; anything else ("//host", a full URL) returns to the start. */
export function localReturn(returnUrl: string | null | undefined): string {
  const url = returnUrl ?? '';
  const local = url.startsWith('/') && !url.startsWith('//') && !url.startsWith('/\\');
  return local && !url.startsWith('/sign-in') ? url : '/';
}

/** Where "Continue with GitHub" goes: the API starts GitHub sign-in and comes back to `returnUrl`. */
export function gitHubSignIn(returnUrl: string | null | undefined): string {
  return `/api/auth/github?returnUrl=${encodeURIComponent(localReturn(returnUrl))}`;
}

/** The pipeline beside the sign-in, as the mock lists it. */
export const PIPELINE: readonly (readonly [string, string, string])[] = [
  ['00', 'Bootstrap', '.hewn/skills.lock'],
  ['01', 'Idea', 'docs/brief.md'],
  ['02', 'Designs', 'docs/mocks/'],
  ['03', 'Design system', 'docs/design-system/'],
  ['04', 'Stack', 'docs/adr/0001-stack.md'],
  ['05', 'Requirements', 'docs/specs/'],
  ['06', 'Scaffold', 'Solution + CI'],
  ['07', 'Detailed designs', 'docs/detailed-designs/'],
  ['08', 'User journeys', 'docs/journeys.md'],
  ['09', 'Estimates', 'docs/estimates/'],
  ['10', 'Increments', 'Test → Code → Video → PR'],
];

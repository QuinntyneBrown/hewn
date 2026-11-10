# 20 · Sign in and sign out

This is journey twenty of Hewn, the software factory: sign in and sign out. Mission Control is private. Only GitHub accounts on Hewn's allow list may see it, a session lasts at most eight hours, and signing out has to end it for good. This video walks through how it was built: sign-in with GitHub, sign-out, the pages the API now serves with their protections, and the tests.

## The goal

Signed out, any page goes to sign-in, and after GitHub, back to that page. An account not on the allow list is refused with "This account doesn't have access". A session ends after eight hours or on sign-out, even if its cookie is replayed. And every page carries a content security policy that allows no inline scripts.

## Signing in

Here is the sign-in flow. The API sends the browser to GitHub with a one-time state, kept in a protected cookie for ten minutes. When GitHub sends the user back, the callback checks that state, exchanges the code for the GitHub login, with a thirty second limit, and looks the login up in the allow list.

The callback answers every outcome with a page. A forged state or a GitHub failure goes to sign-in saying GitHub didn't answer. A login not on the list goes to sign-in with that login, and no session. Otherwise the user gets an eight hour cookie, HTTP only, secure and same-site lax, and returns where they started, but only to a page on this site.

The sign-in page reads its state from the address: denied, GitHub failed, the session expired, or signed out. Each is a state from the mocks.

## Signing out

The mocks had no way to sign out, so the control was designed first in Magic Patterns: a Sign out icon button beside the signed-in user, at the foot of the sidebar. The mocks and the design system were rebuilt from it.

Signing out records the session's id as revoked, and every request checks that id, held in memory so the check costs nothing per request. A replayed cookie gets four oh one. That is recorded as A D R twenty two.

When any request gets four oh one while the app is open, because the eight hours passed or the user signed out in another tab, the app reloads at sign-in, saying the session ended, and comes back to the same page after.

## Page protections

Until now only the development server served Mission Control. Now the API serves the built app. Signed out, a page redirects to sign-in with where it was going. Every response is marked no sniff, and every page gets the content security policy.

Angular's build loads its stylesheet with one small inline handler, so the policy allows exactly that handler by its hash, and no other inline script. Frames are allowed only from the preview origin, and only this site may frame Mission Control.

Here is what the API answers, signed out.

## Tests

The backend tests came first, and failed: six of them, with four oh one and a replayed cookie accepted. Now thirteen cover sign-in, refusal, a forged state, cancelling, the eight hours, sign-out with a replayed cookie, the pages and their headers.

End to end, a test signs in through a fake GitHub authorize page and lands back on the page it started from.

All green, the backend has two hundred and sixty one tests and the frontend four new view tests. End to end, there are eighteen new tests: six for behaviour, six visual comparisons with the mocks, and six accessibility checks.

## The screens

Here is Mission Control served by the API. Signed out, Workers goes to sign-in. Continue with GitHub opens GitHub's authorize page, here the fake one, and after it, Workers again. Sign out returns to sign-in, saying so.

A login not on the allow list is refused, and told who to ask.

GitHub failing, and a session that ended, each say what happened.

The page reads the same in dark mode, and on a phone.

## Recap

Journey twenty is complete. Mission Control signs in with GitHub, and only the allow list gets in. Sessions end at eight hours or on sign-out, even for a replayed cookie. And the API serves every page with a strict content security policy. Next comes journey twenty one.

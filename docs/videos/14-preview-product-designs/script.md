# 14 · Preview product designs

This is journey fourteen of Hewn, the software factory: preview product designs. Stage two designs every screen of a product in Magic Patterns, in every state, and exports the HTML into the project's repository. Owners and Viewers want to look at those designs without leaving Mission Control, at any size and in either theme, and jump to Magic Patterns to change one. This video walks through how it was built: the designs endpoint, a preview host on its own origin, the sandboxed frame, the size and theme controls, and the tests.

## The goal

A user opens a project's Designs and sees a gallery of every screen and state, each with a thumbnail and an open in Magic Patterns link. Opening a state renders it from a separate origin, inside a sandboxed frame that can't read Mission Control's cookies or storage. And the user picks X S, S, M, L or X L, and light or dark, and the frame resizes and switches theme to match.

## The flow

Here is the flow. The Designs tab asks the API for the designs. The API reads the manifest stage two wrote, at the head of the default branch, and signs a preview link for that commit. The frame then loads each page from the preview host, which checks the signature and serves the file at that commit, sandboxed.

## Listing the designs

The designs handler reads docs slash mocks slash manifest dot json from GitHub, with the commit it was read at. Each screen gives its title, its Magic Patterns link and its states, and each state its path and a preview URL. A project before stage two has no manifest, so it has no designs, and a manifest that can't be parsed is a five oh two that names the commit.

## Signed links

A preview link carries a token: the project, the commit and an expiry, signed with an H-MAC under a key made when the API starts. One token covers the whole commit, so a mock's links to its own styles still work. It lasts sixty minutes, and a tampered or expired token is simply not found.

## The preview host

The preview host is the API itself, but only on another host name. The route is mapped for the preview origin's host alone, so on Mission Control's host it doesn't exist. It serves only docs slash mocks and docs slash design system, at the signed commit, read from GitHub and cached. Every response says content security policy sandbox allow scripts, sends no cookie, and sets the theme on the page's html element.

## The sandbox

In the browser, the frame is sandboxed with allow scripts, and never allow same origin. So the page runs in an opaque origin of its own. Reading document dot cookie, local storage or the parent page throws a security error. And because cookies are kept per host, Mission Control's session never even reaches the preview origin.

## Size and theme

Width and theme are radio groups, with the arrow keys moving within each. The frame is laid out at exactly the chosen width, three seventy five up to twelve hundred pixels, then scaled to fit, so the mock's own media queries see the real width. The theme goes to the preview host as a query parameter.

## Tests

The backend tests came first, and failed with not found: there was no route. Now eight tests cover the listing, the sandbox headers and the theme, a preview pinned to its commit, the two allowed folders and nothing else, tampered and expired tokens and Mission Control's host refused, a project with no designs, an unreadable manifest, and Viewers.

The isolation test runs a probe page inside the real frame. It reports its own origin as null, and that cookies, storage and the parent page are all blocked, while Mission Control itself has a readable cookie. Another test clicks X S to X L and watches the probe report each width, then switches to dark.

All green, the backend has two hundred and twenty two tests, the worker one hundred and forty four, and the frontend five new view tests. End to end, there are fourteen new tests: five for behaviour, five visual comparisons with the mocks, and four accessibility checks.

## The screens

Here is Kiln Booking, after a real worker ran stages zero to two. Its Designs tab lists every screen and state that stage two exported, each with a live thumbnail. Choosing a state opens it in the preview. Then the sizes, from X S to X L, and dark, and back.

At X S and dark, the frame is phone width. At X L it is laid out at twelve hundred pixels and scaled to fit. The tab works in Mission Control's dark mode and on a phone.

Here is the probe in the real frame, served from another origin, with every read blocked. And a project before stage two says it has no designs yet, while an unreadable manifest names its commit, with try again.

## Recap

Journey fourteen is complete. The gallery lists every screen and state, with thumbnails and Magic Patterns links. Each preview comes from a separate origin, signed for one commit, in a sandbox that can't reach Mission Control. And the frame resizes from X S to X L and switches between light and dark. Next comes journey fifteen.

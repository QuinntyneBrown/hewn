# 21 · Manage Owner and Viewer access

This is journey twenty one of Hewn, the software factory: manage Owner and Viewer access. Only GitHub logins on the allow list can sign in, and each has a role. Owners give direction and stop work; Viewers watch. This video walks through how it was built: the allow list in Settings, how removing a login signs it out at once, the checks that keep Viewers read-only, and the tests.

## The goal

In Settings, an Owner adds a GitHub login as Owner or Viewer, or removes one, and a Viewer sees the list read-only. A Viewer gets four oh three from every endpoint that changes state, whatever the client shows. And a project the user can't see answers not found, with no hint that it exists.

## The allow list

Here is the flow. The Owner opens Add a GitHub login and confirms. The API checks the login isn't listed already, and asks GitHub whether the account exists. Only then is it added, and they can sign in at once.

The handler refuses a login that's listed, malformed, or unknown to GitHub, each with an error on the login field. When GitHub can't say, for example when it rate limits, nothing is added and the dialog says why.

Removing works the other way. The login leaves the allow list, and its sessions end on their next request: every request now checks that its login is still listed with the role it signed in with. The logins and roles are held in memory, so the check costs no database read. An Owner can't remove themselves, so the list always keeps an Owner. That is recorded as A D R twenty three.

## Viewers read only

Settings shows the list to everyone. Only an Owner sees Add a GitHub login, and a Remove button on every login but their own. The sidebar hides Audit and New direction from Viewers, as the mocks show.

Hiding a button isn't the protection, though. The server answers four oh three. Here is what it answers when a Viewer sends the requests by hand, and when a removed login tries again.

## Not found

Every project route answers a project the caller can't see exactly as one that never existed: four oh four, with the code not found. The hub refuses to join it, too.

## Tests

The backend tests came first, and failed with not found: there was no route yet. Nine now cover the list, adding, the field errors, GitHub failing, removing, and Viewers.

Two more call every endpoint the API maps. One sends each state-changing request as a Viewer and expects four oh three; the other asks for every project route of a project nobody can see and expects the same not found. Both passed at once, because earlier journeys already enforce the rules, and now any new endpoint without them fails.

All green, the backend has two hundred and seventy six tests and the frontend three new view tests. End to end, there are fifteen new tests: seven for behaviour, three visual comparisons with the mocks, and five accessibility checks.

## The screens

Here the Owner adds nadia-k as a Viewer. She's listed at once, never signed in yet.

She signs in through GitHub. There's no New direction and no Audit, and Settings is read-only. By hand, her changes get four oh three.

The Owner removes her. Her session ends on its next request, with four oh one.

A login already on the list, and one GitHub couldn't confirm, each say what happened in the dialog.

The list reads the same in dark mode, and on a phone.

## Recap

Journey twenty one is complete. Owners add and remove GitHub logins as Owner or Viewer, confirmed with GitHub. A removed login is signed out on its next request. Viewers get four oh three on every change, and a project nobody can see is simply not found. Next comes journey twenty two.

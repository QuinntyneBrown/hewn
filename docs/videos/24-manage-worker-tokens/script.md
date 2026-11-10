# 24 · Manage worker tokens

This is journey twenty four of Hewn, the software factory: manage worker tokens. A worker proves who it is with a token. This video shows an Owner creating one, a worker starting with it, and what happens when the Owner revokes it while that worker is in the middle of a run.

## The goal

An Owner creates a worker token, and sees it exactly once; Hewn stores only its hash. The Owner chooses when it expires: in thirty days, ninety days or a year, and it stops working then. And when an Owner revokes a token whose worker is connected, the worker is disconnected within ten seconds and its lease is released.

## Creating a token

Here is Workers, signed in as an Owner. New worker token asks for a name, where the worker runs, and when the token expires. The name is shown on Workers and will be in the audit log, so it is checked: three to forty lowercase letters, digits or hyphens.

Create token shows it once, with Copy, and the command that starts a worker with it. Copy puts it on the clipboard. Once the token is showing, Escape and a click outside do nothing; only Done closes the dialog, so the token isn't lost by accident.

## What Hewn keeps

Here is how a token is made. It is the prefix h w t underscore, then thirty two random bytes in base sixty four. The prefix lets secret scanners recognise one that leaks.

Creating a token stores its SHA two fifty six, with the name, location, who created it and the expiry, and answers with the token itself, once, marked no store.

This is the row Hewn keeps for the token just created: an id, the name, a hash, and the expiry. The token isn't in it. Nor is it in any response from Workers.

Every worker request is checked by hash. A token that is unknown, revoked or past its expiry gets a 401. The token set in the API's own configuration still works, as a development token for a local stack and the tests.

## A worker on the token

Here the command runs with Docker. The worker registers under the token's name and location, whatever it calls itself. Then a direction is submitted, and this worker leases it. Its row shows the project it is working on, and its heartbeat keeps refreshing while the stage runs.

In the register handler, an issued token supplies the name and the location, so Workers shows what the Owner chose. The development token leaves both to the worker.

## Revoking

Each worker row now has Revoke. A Viewer sees Workers without it, and without New worker token, and the API answers a Viewer's request with 403.

Revoke asks first. The dialog names the worker, and says what happens to a step it is running: the lease is released, and the run resumes on another worker from its last checkpoint. Confirming revokes the token, and every worker on it, and saves that before anything else, so no request on the token is accepted from then on.

Then each run those workers lease is halted and released, with a line in its log saying whose token was revoked and the step it resumes from. The held control poll is woken, and Workers is told.

Here it is with the worker in the middle of a step. Revoke, confirm, and the row is gone at once. The container exits within a third of a second, and the standby worker picks the run up from its checkpoint.

## The worker stops

On the worker, any 401 means its token was refused. The control poll is held open while a run executes, so it hears first: the step in progress is aborted. Then the loop ends, and the process exits with code three, so a restart policy doesn't keep retrying a dead token.

The sequence puts it together, with no hub involved: the control poll is how a revocation reaches a running worker. A d r twenty six records why.

## Tests

On the backend, eleven new tests cover creating, expiring and revoking. This one revokes a worker holding a lease, and checks the held control poll ends inside ten seconds, every later call is refused, and another worker resumes the run. They failed first, as there was no worker tokens table. The backend has two hundred and ninety four tests, all green.

On the worker, two new tests check that a refused token aborts the run and stops the loop. They failed first, as the fake API couldn't revoke. The worker has one hundred and fifty five tests.

End to end, four new tests create and copy a token, revoke a leased worker, reject a bad name, and keep a Viewer out. The dialogs match their mocks, and have no accessibility violations.

## The screens

Workers reads the same in dark mode, and on a phone.

## Recap

Journey twenty four is complete. An Owner creates a worker token that is shown once and stored as a hash, with the expiry they chose. Revoking it stops its worker within ten seconds, and the run resumes elsewhere. Next comes journey twenty five.

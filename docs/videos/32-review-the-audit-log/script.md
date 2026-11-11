# 32 · Review the audit log

This is journey thirty two of Hewn, the software factory: review the audit log. When something changes, an Owner needs to know who did it, and from where. This video shows Hewn recording each action as it happens, and an Owner finding it again in Audit.

## The goal

Every sign-in, direction submission, pause, resume, cancel, stop all, start workers, token creation or revocation, and merge writes an audit entry. It records who did it, what, when and from which IP. No API can edit an entry. Owners open Audit to see entries newest first, and filter them by project and action. Viewers are not shown the log.

## Finding it

Earlier, the Owner submitted two directions, paused and resumed Tidewater, cancelled Ledgerline and created a worker token. Here the Owner opens Workers and presses Stop all workers. The dialog asks first, and the Owner confirms. Every worker stops, and the banner says so. Then the Owner starts them again.

Now the Owner opens Audit. Start workers and Stop all workers are at the top, newest first, with the time to the second, the Owner's login, the target and the IP. Below them come the sign-in, the token, the cancel, the resume, the pause and both directions. Cancel and Stop all read in the warning colour, and their names say what they did.

The Owner chooses Tidewater. The filter goes into the address, and only Tidewater's three entries are left. Choosing Pause leaves one. Stop all workers isn't recorded against a project, and the empty state says so. Clear filters shows everything again.

## Nothing edits it

Every way an API might change an entry was tried: put, patch, delete and post, on the log and on an entry. Each answer is not found, because there is no such endpoint. Under that, the database refuses too.

A Viewer who opens Audit sees that only Owners can read it, and the API answers them with forbidden.

## How it works

Each audited handler calls the audit writer before it saves. The writer adds the entry to the same change, so the action and its entry are saved together, or not at all. The address comes from the request, after forwarded headers from a proxy on the same machine, so a client can't name its own.

A merge is made by Hewn, so its entry names whoever submitted the direction, and has no address.

Hewn's database is SQLite, which has no roles to withhold update and delete. So the migration adds two triggers that refuse both, and a new decision record explains why. Each entry keeps its project's name, so deleting a project leaves its entries readable.

The log is read newest first, a page at a time. The answer also names every project in the log, for the filter.

This sequence shows a pause being recorded, and then found.

## Tests

The backend tests go through the real API. Signing in, submitting, pausing, resuming, cancelling, stopping, starting, creating and revoking a token, and merging each add the right entry, with the address. Filters and paging work, and an unknown action is a bad request. A Viewer is forbidden. And an update or delete straight on the table fails. Before the endpoint existed, all of them failed. All three hundred and thirty three backend tests pass.

End to end, a behaviour test does the actions, finds them in Audit, filters by project and action, reloads, and clears the filters. Another tries every edit and checks a Viewer is refused. Without the Audit route the first test failed, finding Page not found. Visual tests compare every state with its mock, and an accessibility test checks each one.

## The screens

The log reads the same in dark mode. On a phone the target moves under the action, and the address column goes.

## Recap

Journey thirty two is complete. Each audited action records who, what, when, the target and the address, in the same save. Owners find entries in Audit and filter them by project and action. And nothing edits an entry: there is no endpoint, and the database refuses. Next comes journey thirty three.

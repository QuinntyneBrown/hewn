# 26 · Continue after a worker or server crash

This is journey twenty six of Hewn, the software factory: continue after a worker or server crash. A worker can die mid-run, and so can the API. This video shows that nothing acknowledged is lost, that a run carries on from its last checkpoint on another worker, and that a worker whose lease has moved on can no longer write.

## The goal

The API stores every direction, run and event before it acknowledges it. A worker that stops heartbeating loses its lease after sixty seconds, and another worker resumes the run after its last completed step. After a server restart, every lease is either kept by its worker's next heartbeat or expires. No completed step runs twice. This is for Owners, who watch their projects survive a crash, and for anyone running Hewn's workers.

## What was already there

Much of this came with the worker loop. Every grant raises the run's lease epoch, and every worker call carries it, so a stale call is refused. A sweep returns silent leases to the queue every ten seconds and at start-up, keeping the checkpoint. And every GitHub write carries an idempotency key naming its run and step, so a repeated step gets its first commit back instead of making a second.

## The gap: a write in flight

One gap remained. A GitHub write checked its lease, and then called GitHub. If the lease expired in between and went to another worker, the old worker's write still landed.

The fix is a lock per run. A write takes it before its fence check, and keeps it until the write is recorded.

Granting a lease and expiring one take the same lock. So an expiry waits for a write in flight, and every write after it carries an old epoch that the fence refuses.

The sequence shows it. The stale worker's commit holds the lock while GitHub answers. The expiry waits, then moves the lease to epoch two. The worker's next call, a commit or a heartbeat, gets four oh nine, lease lost, and nothing reaches GitHub.

## Killing a worker

Now, the crash. A Local worker leases a new direction, and a Cloud worker waits as a standby. After the laptop's first checkpoint, it is killed outright, with no goodbye to the API.

Sixty seconds after its last heartbeat, the sweep expires the lease and says so in the run log, with the worker's name and the step it reached. The standby leases the run with a new epoch, and the log says who resumed it, and after which step. It starts at step two; step one does not run again.

The expiry now loads each run under its lock, logs, and saves. The lease handler logs the resume whenever a run is leased a second time.

On Workers, the laptop shows Offline with its lease released, and the Cloud worker holds the project. Here it took sixty seven seconds from the kill to the resume: sixty without a heartbeat, plus the next ten second sweep.

## Restarting the API

Next, the server. A run is under way on the Cloud worker. The API process is killed, and started again on the same database. It was down for under two seconds. The worker's next heartbeat reaches the new process and keeps its lease, and the log carries on where it was.

The end to end API can now restart without resetting its database, so this can be watched.

## Tests

On the backend, three new test classes. The first holds a commit in flight in the fake GitHub, and moves the clock past sixty seconds. The expiry must wait for the write. It failed first: the lease expired while the write was still in flight. Then the stale worker's next write is refused, and the repository gets no new commit.

The second restarts the API on the same database file. The direction is still running, and the worker's next heartbeat keeps its lease. A lease whose worker never returns expires and resumes from its checkpoint. These passed at once, as the behaviour came with the worker loop; disabling the expiry made the second fail, so they guard it.

The third checks the two log lines. It failed first, with no such lines. The backend has two hundred and ninety nine tests, all green.

End to end, a pipeline test kills a worker with a kill signal after its first checkpoint, and waits for the log to show the expiry and the resume. It passes in about seventy seconds.

## The screens

The run log reads the same in dark mode and on a phone.

## Recap

Journey twenty six is complete. A write and a lease change never interleave. A killed worker's run resumes on another worker after its last checkpoint, and the log says so. And the API can restart mid-run without losing anything. Next comes journey twenty seven.

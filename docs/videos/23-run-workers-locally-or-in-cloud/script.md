# 23 · Run workers locally or in the cloud

This is journey twenty three of Hewn, the software factory: run workers locally or in the cloud. Workers are the processes that run Hewn's agents. This video shows one worker image running on a laptop with Docker and configured for the cloud, how an idle worker gets work the moment it is queued, and how each run is kept to itself.

## The goal

The same worker, configured as Local or as Cloud, registers with its location, host and version, and appears in Workers within 2 seconds. An idle worker leases new work at once and heartbeats while it runs. And every run is isolated: its own workspace and container, only allowed hosts on the network, and only its stage's tools, with anything else blocked and logged.

## One image

Here is the worker image. It builds the worker from source, then copies it into a slim Node image with git and ffmpeg. It runs as an unprivileged user and opens no port, because a worker only ever connects out. Location, API address, token and name are environment variables, so they are the only differences between a laptop and the cloud.

Here Workers is already open. One docker run starts the image as a Local worker, and it appears without a reload. A second starts the same image configured as Cloud.

Each row shows the host, location and version the worker registered with.

## Showing up at once

Workers used to refresh every five seconds. Now the API tells it. When a worker registers, or a stage starts or ends, the hub sends Workers Changed to everyone on the workers group.

The shell subscribes through the live client and reads the list again. The five second refresh stays, for heartbeats.

## The work loop

Here is the work loop. The worker registers, then asks for a lease with a wait of twenty seconds. If nothing is queued, the API holds the request open. Every stored event pulses a work signal, so the moment a direction is queued, the held request leases it. If nothing comes, the worker asks again fifteen seconds after its last request began, so an idle worker makes at most four requests a minute.

Here a direction is submitted while both workers are idle. Its first stage starts within moments, not at the next poll. On Workers, the run shows as leased, and the heartbeat keeps refreshing while it runs.

## Isolation

Now isolation. For every run, the work loop starts an egress proxy and hands each stage a tool gate.

The proxy allows the model API, Magic Patterns and the npm and NuGet registries. GitHub isn't on the list: a run reaches its repository only through Hewn's API. Any other host gets a 403, and a line in the run's log.

The tool gate is built from the stage's allowed tools. Every tool call goes through require. A tool that isn't allowed throws, and is logged as a security event.

Commands the run executes get none of the worker's variables. With the docker sandbox, each command runs in its own container, with only the workspace mounted, no capabilities, and an internal network whose only peer is the proxy.

Here is the whole run as a sequence: the proxy and the gate both write to the run's log, and nothing in the run talks to GitHub.

Here a worker plays an agent misled by what it read. In the Idea stage, it tries the Bash tool and a request to an unknown host. Both are refused, and the log shows them, flagged error and warn.

A d r twenty five records these choices, and why the git sidecar can wait.

## Tests

On the backend, a new test follows the hub and checks Workers is told within two seconds of a register, a lease and a finish. It failed first, as the hub had no workers group. The backend has two hundred and eighty two tests, all green.

The worker's isolation tests run the proxy for real: an allowed host passes, others get a 403, and the run's log records both refusals. They failed first, with no isolation module at all. The worker has one hundred and fifty two tests.

End to end, three new tests start real workers: Local and Cloud ones appearing in Workers, an idle worker pushed new work, and the refused tool and request in the run's log.

## The screens

Workers reads the same in dark mode, and on a phone.

## Recap

Journey twenty three is complete. One image runs anywhere, and configuration says where. New workers show at once, and idle ones are pushed work. Each run has its own proxy, gate and sandbox, and every refusal is in its log. Next comes journey twenty four.

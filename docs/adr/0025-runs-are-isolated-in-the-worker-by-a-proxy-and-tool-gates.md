# 0025. Runs are isolated in the worker by an egress proxy, tool gates and a command sandbox

- **Status:** Accepted
- **Date:** 2026-11-10
- **Requirements:** L2-042, L2-026, L2-027

## Context

L2-042 asks that each run is contained. It runs in its own container and workspace (AC1). It reaches only allowed
hosts, and other requests are blocked and logged (AC2). A tool outside its stage's allow list is denied and logged
as a security event (AC3). The agent-isolation design names `RunSandbox`, `EgressProxy`, `ToolGate` and a git
sidecar. Two things shape what can be built now. First, workers already commit through the API's commit mutation
and download the repository through it ([ADR 0006](0006-commit-mutation-before-git-proxy.md)), so a run needs no
git remote at all. Second, the only agent so far is the scripted one; the Claude Agent SDK agent is still to come.

L2-027 asks that one worker build runs locally or in the cloud, with configuration as the only difference.

## Decision

- **One worker image.** `worker/Dockerfile` builds it (Node 24, git, ffmpeg, an unprivileged user, no open port).
  `HEWN_LOCATION` and the other variables are its only differences between a developer machine and the cloud.
- **An egress proxy per run.** The work loop starts an HTTP proxy for each run and stops it when the run ends. It
  tunnels (`CONNECT`) or forwards requests to the model API, the Magic Patterns MCP host and the npm and NuGet
  registries, plus any hosts in `HEWN_EGRESS_ALLOW`. It answers 403 to anything else and writes
  `Egress blocked: {host}` to the run's log. GitHub isn't on the list: the run reaches its repository only
  through the API, as the design says.
- **A tool gate per stage.** Each agent task carries a `ToolGate` built from the stage's `allowedTools`. Every
  tool call goes through `require(tool)`. A call to a tool that isn't allowed throws `ToolDeniedError`, and
  `Security event: tool {tool} denied` goes to the run's log at error level. The scripted agent gates its reads and
  writes the same way.
- **Commands see no credential.** Test gate commands get a fresh environment: `PATH`, locale, `HOME` set to the
  workspace, `CI=1` and the proxy variables. They never get the worker token, a Magic Patterns token or anything
  else the worker holds.
- **`HEWN_SANDBOX=docker`** runs each command in its own container with only the workspace mounted, every
  capability dropped, `no-new-privileges` and an unprivileged user. The container joins `HEWN_SANDBOX_NETWORK`,
  an internal Docker network whose only other member is the worker. So the proxy is its only route out, whether or
  not a tool honours the proxy variables. The default, `process`, suits a developer machine.

## Alternatives

- **The git sidecar now.** It isn't needed while git goes through the commit mutation. It comes back with the
  git push proxy.
- **Containers on the default bridge network with proxy variables.** This is simpler, but any tool that ignores
  `HTTPS_PROXY` reaches the internet directly, so "blocked" would only be advice.
- **Filtering egress with iptables on the host.** This catches everything, but it needs root on every worker
  host and differs between a laptop and the cloud, against L2-027.

## Consequences

- A blocked request and a denied tool appear in Mission Control's log for that run, next to its other lines.
- Under `process`, a command that ignores the proxy variables can still reach the network. Use `docker` wherever
  that matters, which is everywhere outside a developer machine.
- The Claude Agent SDK agent must route its tool dispatch through the `ToolGate` it is given, and its HTTP
  through `egressProxyUrl`. The scripted agent shows the contract.
- Security events are log lines for now. A queryable security log comes with the audit work.

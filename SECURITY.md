# Security Policy

## Supported Versions

Security fixes are applied to the default branch.

| Version | Supported |
| ------- | --------- |
| `main`  | Yes       |

## Reporting a Vulnerability

Do not report suspected security vulnerabilities in public issues, discussions
or pull requests.

Report them privately through GitHub's
[private vulnerability reporting](https://github.com/QuinntyneBrown/hewn/security/advisories/new)
(**Security → Report a vulnerability**). Include as much detail as possible:

- the affected component (API, SignalR hub, worker, Mission Control, CLI) and commit;
- reproduction steps or a proof of concept;
- expected and actual impact;
- the configuration or environment involved (local or cloud worker);
- a suggested mitigation, if known.

## Response Expectations

Maintainers aim to acknowledge reports within 3 business days, share an
initial assessment within 10 business days, and coordinate a fix and
disclosure with the reporter. If a report is not accepted as a vulnerability,
maintainers will explain why.

## Security-Sensitive Areas

Hewn runs autonomous agents that write and merge code, so these areas receive
extra review:

- authentication, the GitHub sign-in allow list and session handling;
- authorization of Owner and Viewer actions and of SignalR group membership;
- worker tokens, leases and revocation;
- storage, redaction and rotation of secrets (GitHub App keys, model API keys,
  Magic Patterns credentials);
- agent isolation: workspaces, the network egress allow list and per-stage
  tool allow lists;
- prompt injection through repository content, designs or fetched web content;
- GitHub webhook signature verification;
- automatic merge and branch protection;
- the sandboxed origin that serves exported mocks.

## Safe Harbor

We will not pursue legal action against researchers who act in good faith,
avoid privacy violations and service disruption, do not access or modify data
that is not their own, and give us reasonable time to fix an issue before
disclosure.

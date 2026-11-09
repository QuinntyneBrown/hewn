# Secrets and redaction

## Overview

Hewn holds four kinds of secret: model API keys, Magic Patterns credentials, the GitHub App private key and worker tokens. They are encrypted at rest, in a cloud key vault when Hewn runs in the cloud and in the operating system's key store when a worker runs locally, and no API response ever contains one.

Secrets can still leak into text an agent writes. Every log line, event and pull request body passes a *redactor* before it is stored or sent: any value equal to a stored secret, or matching a known token pattern for GitHub, Anthropic or Azure, is replaced with `***`. When a run ends, credentials written into its workspace are deleted.

Terms used in this design:

- **secret store** — cloud key vault (cloud) or OS key store (local) holding encrypted secrets
- **redactor** — filter that replaces secret values and token patterns with `***`

## Description

The slice is a secret abstraction and a redaction filter applied at every output boundary.

- **`ISecretStore`** — `GetAsync(name)`, `SetAsync(name, value)`. `KeyVaultSecretStore` backs the API in the cloud; `OsKeyStoreSecretStore` (macOS Keychain, Windows Credential Manager, libsecret) backs Local workers. The cloud vault product is <TO SUPPLY>.
- **`SecretRef`** — the only form in which secrets appear in settings DTOs: name and last-updated time, never the value. Responses are serialized through DTOs that have no value field.
- **`Redactor`** — holds the current secret values (refreshed on change) plus regexes for GitHub tokens (`gh[pousr]_…`, `github_pat_…`), Anthropic keys (`sk-ant-…`) and Azure keys and connection strings. `Redact(text)` replaces matches with `***`.
- **`Redaction points`** — `LogLineSink`, `EventStore.Append` and `PullRequestTemplate.Body` all call `Redactor.Redact` before storing or sending; workers apply the same redactor before shipping logs.
- **`WorkspaceCredentialScrubber (worker)`** — at run end removes git credential helpers, `.npmrc` tokens and any file the run wrote from the credential broker, then destroys the workspace volume ([Agent isolation](../../agent-runtime/agent-isolation/README.md)).

## Requirements

The feature realizes the following level-2 (L2) requirements. Each L2 requirement refines the level-1 (L1) requirement cited beside it. The text is copied from `docs/specs/L2.md`.

| L2 ID | Refines (L1) | Requirement |
|-------|--------------|-------------|
| `L2-040` | `L1-019` | **Secrets.**<br>1. Given model API keys, Magic Patterns credentials, GitHub App keys and worker tokens, when they are stored, then they are encrypted at rest (a cloud key vault in the cloud, the OS key store locally) and no API response ever contains them.<br>2. Given a log line, event or PR body, when it contains a value matching a stored secret or a known token pattern (GitHub, Anthropic, Azure), then the value is replaced with `***` before it is stored or sent.<br>3. Given an agent workspace, when a run ends, then credentials written into it are deleted. |

## Diagrams

### System context

Owners enter credentials once; Hewn keeps them in the secret store and never shows them again.

![C4 system context for storing secrets and redacting them](diagrams/c4-context.png)

### Containers

Secret values flow only into the API and the secret store; logs and events reach the database already redacted.

![C4 container view for storing secrets and redacting them](diagrams/c4-container.png)

### Components

Redaction is applied at ingest by the same `Redactor`, so no storage path bypasses it.

![C4 component view for storing secrets and redacting them](diagrams/c4-component.png)

### Class structure

Two `ISecretStore` implementations cover cloud and local. `SecretRef` is the value-free form used in responses.

![Class diagram for storing secrets and redacting them](diagrams/class-structure.png)

### Behaviour — store a secret and redact output

Secrets are encrypted at rest and never returned (L2-040 AC1). Matching values are replaced with `***` before storage (AC2). Workspace credentials are deleted at run end (AC3).

![Sequence diagram: store a secret and redact output](diagrams/sequence-redact.png)

# 0037. Credentials live in Azure Key Vault or the OS key store, supplied from the command line

- **Status:** Accepted
- **Date:** 2026-11-11
- **Requirements:** L2-040, L2-042

## Context

L2-040 asks that the model API key, Magic Patterns credentials, the GitHub App key and worker tokens are encrypted
at rest, in a cloud key vault in the cloud and the OS key store locally, that no API response contains one, and that
a stored secret or a GitHub, Anthropic or Azure token is replaced with `***` in any log line, event or pull request
body. The secrets design left the vault product `<TO SUPPLY>`. Until now every credential came from an environment
variable, and the redactor masked with `[redacted]` and knew only token patterns. Mission Control has no screen for
credentials, and some of them (the GitHub OAuth client secret, the worker token) are needed before anyone can sign
in.

## Decision

- **The cloud vault is Azure Key Vault.** `HEWN_SECRET_STORE=keyvault` with `HEWN_KEY_VAULT_URI` keeps each
  credential as a Key Vault secret under its name, read with `DefaultAzureCredential` (the API's managed identity in
  Azure). Cloud workers get theirs through their container's Key Vault references.
- **Locally, the OS key store**: `HEWN_SECRET_STORE=os` uses the login keychain on macOS (`security`) and the Secret
  Service on Linux (`secret-tool`). Each credential is one item under the service `hewn` (or
  `HEWN_KEY_STORE_SERVICE`), account = its name, holding `hewn1:{unix ms}:{base64 value}`. The encoding keeps
  multi-line keys intact and gives every item its own last-updated time. A value only ever reaches the tool on
  standard input.
- **Unset, the store is in memory**, so tests and a stack configured from environment variables work as before.
- **Seven credentials have names**: `model-api-key`, `magic-patterns-token`, `github-app-private-key`,
  `github-client-secret`, `github-webhook-secret`, `worker-token` and `metrics-token`. No other name can be stored.
- **Operators supply them with the CLI**: `hewn secret set <name>` reads the value on standard input, so it is
  never in shell history, a process list or a response. `hewn secret list` prints the references. The API and
  workers read the store at start; restart them after a change.
- **The API reads credentials through a configuration source** over the environment, which reloads when a credential
  is set in-process. `GET /api/settings/credentials` returns each credential's name, description and last-updated
  time, never a value.
- **The redactor masks with `***`**, matches every credential's value (from the store or the environment) as well as
  the token patterns, and keeps an assignment's name (`token=***`). Event payloads have every string redacted before
  they are stored and sent. A pull request's title and body are redacted before they reach GitHub. The worker
  redacts a run's log lines and failure before sending them.
- **A run's workspace is deleted when the run ends**, and a folder the run left read-only is made writable and the
  deletion tried again, so credentials written there never outlive the run (L2-040 AC3).
- **Agents get tools from one catalogue** of workspace, shell, skill and Magic Patterns design tools, none of which
  touches Hewn configuration, budgets, secrets or another project (L2-042 AC4).

## Alternatives

- **A Mission Control screen to paste credentials.** It needs a design, and it can't supply the credentials needed
  to sign in at all. The CLI covers every credential; a screen can come later on the same store.
- **AWS Secrets Manager or HashiCorp Vault.** Hewn's token patterns and docs already name Azure, and Key Vault
  needs no server of its own. Another store is one more `ISecretStore`.
- **Windows Credential Manager.** It has no command-line tool that reads a secret back, so it needs native calls
  that this journey couldn't run. Windows uses Key Vault for now, and the CLI says so.
- **A file encrypted with a key from the environment.** The key would sit beside the file; that is not the OS key
  store the requirement names.

## Consequences

- A credential set with the CLI reaches a running API or worker only after a restart.
- The OS key store holds Hewn's own encoding; an item typed in by hand reads as not set.
- Short credential values (under 8 characters) aren't matched as values, so they can't mask ordinary words; their
  patterns still apply.
- Redacting every event payload costs a JSON parse per event.

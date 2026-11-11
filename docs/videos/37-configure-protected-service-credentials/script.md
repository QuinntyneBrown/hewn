# 37 · Configure protected service credentials

This is journey thirty seven of Hewn, the software factory: configure protected service credentials. It is for the operator who runs Hewn. The model API key, the Magic Patterns token and the GitHub keys now live encrypted in a secret store. Settings show only references. Anything that would leak one into a log, an event or a pull request says three stars instead. And a run's workspace takes its credentials with it when the run ends.

## The goal

The requirements come in two parts. Secrets: credentials are encrypted at rest, in a cloud key vault in the cloud and the OS key store locally, and no API response contains one. A log line, event or pull request body holding a stored secret, or a GitHub, Anthropic or Azure token, is redacted to three stars before it is stored or sent. And credentials written into a workspace are deleted when the run ends. Agent isolation adds one more: whatever an agent reads, no tool lets it change Hewn configuration, budgets, secrets or another project.

## Supplying a credential

An operator supplies a credential with the Hewn command line. Hewn secret set takes the value on standard input, so it is never in the shell's history or a process list. Asking to store anything that isn't one of Hewn's seven credentials is refused.

Hewn secret list prints each credential with the time it was last set, and nothing more. Locally the store is the login keychain on macOS, or the Secret Service on Linux. The keychain entry is a generic password under the service name, with the credential as its account.

The API shows the same thing. Settings slash credentials lists each name, what it is for, and when it was updated. There is no value field to fill.

The secret store interface has three implementations. Azure Key Vault in the cloud. The OS key store locally, which only ever passes a value to the keychain tool on standard input. And memory, for tests. A configuration source reads each credential into the key the API already used, so nothing that reads the worker token or the GitHub App key had to change.

The worker reads its own credentials the same way, from the same keychain. Its log says which it found, by name.

## Redaction

To show redaction, a scripted run fails on purpose, with an error that holds the model key from the keychain, a GitHub token planted in a readme, and an Azure storage key read from a mock.

Mission Control shows the failure with three stars where each of them was, in the failure callout and in the run's log. Here it is in dark, and on a phone.

The server's JSON log line for the same failure is redacted the same way.

The redaction pipeline shows every way out. Text from the worker is redacted before it leaves the worker. In the API, run log lines, pull request titles and bodies, server log entries and every event payload pass the same redactor, before the database, SignalR, GitHub or standard output.

The redactor first replaces the value of every credential Hewn holds, whether it came from the store or the environment. Then the token patterns: GitHub tokens, Anthropic keys, Azure account keys, signatures and client secrets, private keys and bearer tokens. An assignment keeps its name, so token equals three stars still says what was there.

Every event is redacted string by string after it is serialized, so no event type can slip past, and a pull request's title and body are redacted before they reach GitHub.

## The workspace after a run

The scripted run also writes git and npm credentials into its workspace, as a build's tools might. While the stage runs, they are there. When it ends, the whole workspace is gone.

A run can leave a folder read only, and that used to make the deletion throw, leaving the files behind and stopping the worker. Now the worker makes the run's folders writable and tries again, and reports any credential file it still could not delete.

## Agents can't reach configuration

Every stage's tools now come from one catalogue: files in the workspace, a shell in the run's container, skills, and the Magic Patterns design tools. None of them touches Hewn configuration, budgets, secrets or another project. A stage's gate denies anything else, a run's commands see no credential, and the run's proxy won't reach the Hewn API.

## Tests

Each slice started with a failing test. The credentials test asks for the references before the store existed, and failed to compile. It now checks that a supplied key appears only as a name and a time, and that a credential in the store is the one the API uses.

The redaction test sends a log line and a failure holding every kind of secret, and opens a pull request with them. It failed with the old mask and the stored value showing. Now the stored line, the events, the server log and the pull request on GitHub all say three stars.

The workspace test writes credentials, then ends runs by success, failure and a lost lease. The read only case failed with directory not empty, and the worker took no more runs. Now every workspace is gone.

The agent tests check the tool catalogue, and that the worker's token opens none of the settings, budget, credential or project endpoints. Those already held; the tests keep them that way. In all, the backend has three hundred and fifty four tests passing, and the worker a hundred and seventy seven.

## Recap

Journey thirty seven is complete. Credentials live in Key Vault or the OS key store, supplied on standard input, and shown only as references. Every log line, event and pull request leaves with three stars where a secret was. And a run's workspace, credentials included, is gone when the run ends. Next, journey thirty eight.

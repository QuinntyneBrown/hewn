# 37 · Configure protected service credentials

> **Runtime:** ~6:27 · **Audience:** Operators and Hewn contributors · **Prerequisites:** [36 · Diagnose platform health](../36-diagnose-platform-health/README.md)

**Video:** [37-configure-protected-service-credentials.mp4](37-configure-protected-service-credentials.mp4) · [Slides](slides.html) · **Audio:** [37-configure-protected-service-credentials.mp3](37-configure-protected-service-credentials.mp3) · [Transcript](script.md)

## Why this video exists

This is the video for journey 37 (L2-040 AC1-AC3, L2-042 AC4). Everything on screen comes from a real run against the
macOS login keychain, under the service `hewn-video`. `hewn secret set` stores a credential from standard input,
`hewn secret list` and `GET /api/settings/credentials` show only names and last-updated times, and a name that isn't a
credential is refused. The API and the scripted worker read their credentials from the keychain, with no
`HEWN_WORKER_TOKEN` in the environment. The worker writes `.git-credentials` and `.npmrc` into stage 1's workspace,
which is gone when the stage ends. Stage 2 fails with a planted model key, GitHub token and Azure account key. The
failure, the run log, Mission Control (light, dark and phone) and the API's JSON log all show `***` instead. The outputs
are in `screens/records.json`.

The values in the demo are fake, and the `hewn-video` keychain items were deleted after the capture. The Key Vault
store is shown in code only; it is tested against a fake `SecretClient`.

## Learning objectives

By the end, the viewer can:

- supply a credential to Hewn without it reaching the shell history, a process list or an API response;
- say where redaction happens and what it replaces;
- explain why a run's credentials do not outlive its workspace, and why no agent tool reaches Hewn's configuration.

## Key questions

| Question | What a strong answer includes |
|---|---|
| Where are credentials kept? | Azure Key Vault in the cloud, the OS key store locally (macOS keychain, Linux Secret Service); memory in tests (ADR 0037). |
| Why does the value go on standard input? | Arguments show up in `ps` and shell history; `security -i` and `secret-tool store` read it from stdin. |
| What does an API response show? | Name, description and `updatedAt`; the DTO has no value field. |
| What does the redactor replace? | Every stored credential's value, then GitHub, Anthropic and Azure token patterns, private keys and bearer tokens, with `***`; assignments keep their name. |
| Where is it applied? | In the worker before anything leaves, and in the API on run log lines, failures, every event payload, PR titles and bodies, and server log entries. |
| What happens to a workspace's credentials? | The workspace is removed when the run ends, retrying with the folders made writable; any credential file left is reported. |

## Code / assets on screen

| File | What to show |
|---|---|
| `backend/src/Hewn.Cli/Program.cs` | `hewn secret set` reading standard input |
| `backend/src/Hewn.Infrastructure/Secrets/OsKeyStoreSecretStore.cs`, `SecretStores.cs` | The keychain call, the configuration source |
| `worker/src/secret-store.ts` | The worker reading its credentials |
| `backend/src/Hewn.Application/Common/SecretRedactor.cs` | Known values, then the token patterns |
| `backend/src/Hewn.Application/Events/EventAppender.cs`, `Pipeline/PullRequestCommands.cs` | Redaction at the event store and before GitHub |
| `worker/src/isolation/workspace.ts`, `worker/src/agents/tool-catalog.ts` | Removing the workspace, the stage tool catalogue |
| `redaction-pipeline` | The secrets and redaction design's new diagram |
| `Settings/*Tests.cs`, `Workers/AgentReachTests.cs`, `worker/test/workspace-credentials.spec.ts` | Red then green |
| `screens/*.png`, `screens/records.json` | Captured by `clips/clips.mjs` |

## Run sheet

| Time | Segment | Content |
|---|---|---|
| 00:00-00:28 | Introduction | The redacted failure |
| 00:28-01:09 | Goal | L2-040, L2-042 |
| 01:09-02:28 | Supply | `hewn secret set` and `list`, the keychain, the API, the stores, the worker |
| 02:28-03:52 | Redaction | The planted failure, Mission Control, the API log, the pipeline, the redactor |
| 03:52-04:23 | Workspace | Credentials during and after a run; removing the workspace |
| 04:23-04:48 | Agent tools | The tool catalogue |
| 04:48-05:59 | Tests | Credentials, redaction, workspace, agent reach; totals |
| 05:59-06:27 | Recap | Three points and what comes next |

## Demo commands

```sh
export HEWN_SECRET_STORE=os HEWN_KEY_STORE_SERVICE=hewn-video
for name in worker-token model-api-key github-webhook-secret; do
  printf '%s\n' "<fake value>" | dotnet run --project backend/src/Hewn.Cli -- secret set $name
done
HEWN_ALLOWED_GITHUB_USERS=quinntynebrown:Owner Hewn__Fakes__Enabled=true Hewn__Retry__BackoffSeconds=1,1,1 \
  pwsh eng/Start-Api.ps1 -Database cred-video.db -DevSignIn > api.log
(cd frontend && npx ng serve mission-control --port 4301 --proxy-config proxy.conf.json)
API_LOG=api.log node docs/videos/37-configure-protected-service-credentials/clips/clips.mjs
for name in worker-token model-api-key github-webhook-secret magic-patterns-token; do
  security delete-generic-password -s hewn-video -a $name
done
node tools/video-audio/generate-audio.mjs docs/videos/37-configure-protected-service-credentials
node tools/video-build/build-video.mjs docs/videos/37-configure-protected-service-credentials --music docs/videos/assets/music/en-la-playa-soca.mp3
```

## Pitfalls

- Use a keychain service of its own (`hewn-video`), so the capture never touches a real `hewn` credential, and delete
  its items afterwards.
- The scripted worker is started by `clips.mjs` with `HEWN_SCRIPTED_CREDENTIALS_STAGE=1` and `HEWN_SCRIPTED_FAIL_STAGE=2`;
  stop any other worker first, or it may lease the stages.
- The failure retries with the configured backoff before the direction is Blocked; `Hewn__Retry__BackoffSeconds=1,1,1`
  keeps that short.
- Project names are unique: each rerun of `clips.mjs` takes the next free "Seed Swap" name.

## Music

_En La Playa – Trinidad and Tobago Soca_ by JuliusH,
[pixabay.com/music/world-en-la-playa-trinidad-and-tobago-soca-4662](https://pixabay.com/music/world-en-la-playa-trinidad-and-tobago-soca-4662/),
under the [Pixabay Content License](https://pixabay.com/service/license-summary/). Mixed about 20 dB under the
narration. Voice: Kokoro-82M `af_heart` ([hexgrad/Kokoro-82M](https://huggingface.co/hexgrad/Kokoro-82M), Apache-2.0).

## References

- [Journey 37 prompt](../../prompts/37-configure-protected-service-credentials.md), [docs/specs/L2.md](../../specs/L2.md)
- [Secrets and redaction design](../../detailed-designs/security/secrets-and-redaction/README.md)
- [ADR 0037](../../adr/0037-credentials-live-in-key-vault-or-the-os-key-store.md)

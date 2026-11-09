# Sign in (journey 1, L2-001)

## What

Sign in: L2-001 of journey 1, Sign in.

[Video](docs/videos/sign-in/sign-in.mp4) of the journey in the running app.

## Design and decisions

- [product/sign-in](docs/detailed-designs/product/sign-in/README.md)
- Decisions the agent made are recorded in [docs/decisions.md](docs/decisions.md).

## API

No backend changes.

## Tests

| Command | Passed | Failed |
|---|---:|---:|
| `dotnet test` | 1 | 0 |
| `npm run lint` | 0 | 0 |
| `npm test` | 1 | 0 |
| `npx playwright test` | 1 | 0 |

1 new acceptance tests trace to L2-001.

## Deferred

Nothing in this increment is deferred.

## Notes

- Red recorded: 1 new acceptance tests failed on the test commit.
- Green after 1 of 10 implement-and-test iterations.

Built by Hewn · direction d7d7d7d7 · run-0412abcd

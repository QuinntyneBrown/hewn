# Top 3 critical design gaps

| Rank | Gap | Description |
| --- | --- | --- |
| 1 | [Expired worker fencing](agent-runtime/worker-loop/README.md#description) | No stale-worker rejection protocol is specified; define atomic lease acquisition and fencing to prevent concurrent writes after reassignment. |
| 2 | [Checkpoint crash recovery](agent-runtime/worker-loop/README.md#description) | Git commits and API checkpoints lack reconciliation; define recovery and idempotent external operations to prevent repeating completed work. |
| 3 | [Durable event delivery](mission-control/real-time-events/README.md#description) | Publishing after commit lacks durable retries; define an outbox dispatcher so crashes cannot leave connected clients indefinitely stale. |

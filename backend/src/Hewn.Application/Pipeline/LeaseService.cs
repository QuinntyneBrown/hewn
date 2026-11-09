using Hewn.Application.Abstractions;
using Hewn.Domain;
using Microsoft.EntityFrameworkCore;

namespace Hewn.Application.Pipeline;

/// <summary>
/// Grants, fences and expires run leases. A grant is one conditional statement: the run moves from Queued to
/// Leased only if no other run of the same project is leased, so at most one worker holds a project (L2-026 AC4).
/// Every grant raises the run's epoch; LeaseEpoch is a concurrency token, so a write based on an older read fails.
/// </summary>
public sealed class LeaseService(IAppDbContext db, TimeProvider clock)
{
    private const int Attempts = 5;

    /// <summary>Leases the oldest queued run whose project has no lease, or returns null when there is none.</summary>
    public async Task<Run?> TryLeaseAsync(string workerId, CancellationToken cancellationToken)
    {
        for (var attempt = 0; attempt < Attempts; attempt++)
        {
            var due = clock.GetUtcNow();
            var candidate = await db.Runs.AsNoTracking()
                .Where(r => r.Status == RunStatus.Queued)
                // A retry waits out its backoff (L2-006 AC1).
                .Where(r => r.NotBefore == null || r.NotBefore <= due)
                .Where(r => !db.Runs.Any(o => o.ProjectId == r.ProjectId && o.Status == RunStatus.Leased))
                .Where(r => !db.LeasingSwitches.Any(s => s.Stopped))
                .OrderBy(r => r.CreatedAt)
                .Select(r => new { r.Id, r.ProjectId })
                .FirstOrDefaultAsync(cancellationToken);
            if (candidate is null)
            {
                return null;
            }

            var now = clock.GetUtcNow();
            var expires = now + Run.LeaseDuration;
            var granted = await db.Runs
                .Where(r => r.Id == candidate.Id && r.Status == RunStatus.Queued)
                .Where(r => !db.Runs.Any(o => o.ProjectId == candidate.ProjectId && o.Status == RunStatus.Leased))
                // Checked in the same statement, so nothing is leased once Stop all workers has saved the switch.
                .Where(r => !db.LeasingSwitches.Any(s => s.Stopped))
                .ExecuteUpdateAsync(set => set
                    .SetProperty(r => r.Status, RunStatus.Leased)
                    .SetProperty(r => r.WorkerId, workerId)
                    .SetProperty(r => r.RanBy, workerId)
                    .SetProperty(r => r.StartedAt, r => r.StartedAt ?? now)
                    .SetProperty(r => r.LeaseEpoch, r => r.LeaseEpoch + 1)
                    .SetProperty(r => r.LeaseExpiresAt, expires),
                    cancellationToken);
            if (granted == 1)
            {
                return await db.Runs.SingleAsync(r => r.Id == candidate.Id, cancellationToken);
            }

            // Another worker took this run or this project between the read and the update; look again.
        }

        return null;
    }

    /// <summary>Loads the run for a worker request, refusing when the worker or the epoch no longer match.</summary>
    public async Task<Run> FenceAsync(Guid runId, string workerId, long epoch, CancellationToken cancellationToken)
    {
        var run = await db.Runs.SingleOrDefaultAsync(r => r.Id == runId, cancellationToken);
        if (run is null || !run.IsHeldBy(workerId, epoch))
        {
            throw new LeaseLostException();
        }

        return run;
    }

    /// <summary>Returns runs whose lease has had no heartbeat for 60 seconds to the queue, keeping the checkpoint.</summary>
    public Task<int> ExpireStaleAsync(CancellationToken cancellationToken)
    {
        var now = clock.GetUtcNow();
        return db.Runs
            .Where(r => r.Status == RunStatus.Leased && r.LeaseExpiresAt < now)
            .ExecuteUpdateAsync(set => set
                .SetProperty(r => r.Status, RunStatus.Queued)
                .SetProperty(r => r.WorkerId, (string?)null)
                .SetProperty(r => r.LeaseExpiresAt, (DateTimeOffset?)null),
                cancellationToken);
    }
}

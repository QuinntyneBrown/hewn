using Hewn.Application.Abstractions;
using Hewn.Application.Events;
using Hewn.Domain;
using Microsoft.EntityFrameworkCore;

namespace Hewn.Application.Pipeline;

/// <summary>
/// Grants, fences and expires run leases. A grant is one conditional statement: the run moves from Queued to
/// Leased only if no other run of the same project is leased, so at most one worker holds a project (L2-026 AC4).
/// Every grant raises the run's epoch; LeaseEpoch is a concurrency token, so a write based on an older read fails.
/// </summary>
public sealed class LeaseService(IAppDbContext db, TimeProvider clock, RunWriteLock locks, EventAppender events)
{
    private const int Attempts = 5;

    /// <summary>Leases the oldest queued run whose project has no lease, or returns null when there is none.</summary>
    public async Task<Run?> TryLeaseAsync(string workerId, CancellationToken cancellationToken)
    {
        // A held lease request may outlive its worker's revocation (L2-041 AC2): a revoked worker leases nothing.
        if (await db.Workers.AnyAsync(w => w.Id == workerId && w.RevokedAt != null, cancellationToken))
        {
            return null;
        }

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

            using var held = await locks.HoldAsync(candidate.Id, cancellationToken);
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

    /// <summary>
    /// Puts back a lease the worker never received: the grant commits on its own, so when the rest of the lease
    /// request fails (or the worker has gone) the run would otherwise wait out the 60-second lease on a worker that
    /// doesn't know it holds it, and a cancel would wait on that worker too. Only this grant (worker and epoch) is undone.
    /// </summary>
    public async Task ReturnUndeliveredAsync(Run run, string workerId)
    {
        var epoch = run.LeaseEpoch;
        await db.Runs
            .Where(r => r.Id == run.Id && r.Status == RunStatus.Leased && r.WorkerId == workerId && r.LeaseEpoch == epoch)
            .ExecuteUpdateAsync(set => set
                .SetProperty(r => r.Status, RunStatus.Queued)
                .SetProperty(r => r.WorkerId, (string?)null)
                .SetProperty(r => r.LeaseExpiresAt, (DateTimeOffset?)null),
                CancellationToken.None);
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

    /// <summary>"after step 2", or "from the start" before any checkpoint.</summary>
    public static string After(int checkpointStep) =>
        checkpointStep > 0 ? $"after step {checkpointStep}" : "from the start";

    /// <summary>
    /// Fences a GitHub write and holds the run's write lock until the result is disposed, so the lease cannot be
    /// moved between the fence check and the write's saved record.
    /// </summary>
    public async Task<FencedWrite> FenceForWriteAsync(Guid runId, string workerId, long epoch, CancellationToken cancellationToken)
    {
        var held = await locks.HoldAsync(runId, cancellationToken);
        try
        {
            return new FencedWrite(await FenceAsync(runId, workerId, epoch, cancellationToken), held);
        }
        catch
        {
            held.Dispose();
            throw;
        }
    }

    /// <summary>Returns runs whose lease has had no heartbeat for 60 seconds to the queue, keeping the checkpoint.</summary>
    public async Task<int> ExpireStaleAsync(CancellationToken cancellationToken)
    {
        var now = clock.GetUtcNow();
        var stale = await db.Runs.AsNoTracking()
            .Where(r => r.Status == RunStatus.Leased && r.LeaseExpiresAt < now)
            .Select(r => r.Id)
            .ToListAsync(cancellationToken);
        var expired = 0;
        foreach (var runId in stale)
        {
            // Waits for a write in flight under this lease; a heartbeat that renewed it meanwhile keeps it.
            using var held = await locks.HoldAsync(runId, cancellationToken);
            var run = await db.Runs.SingleOrDefaultAsync(
                r => r.Id == runId && r.Status == RunStatus.Leased && r.LeaseExpiresAt < now, cancellationToken);
            if (run is null)
            {
                continue;
            }

            var worker = await db.Workers.AsNoTracking().Where(w => w.Id == run.WorkerId).Select(w => w.Name)
                .FirstOrDefaultAsync(cancellationToken) ?? run.WorkerId;
            await events.LockAsync(run.ProjectId, cancellationToken);
            run.ExpireLease();
            await RunLog.InfoAsync(
                db, events, run,
                $"Lease expired: no heartbeat from {worker} for {Run.LeaseDuration.TotalSeconds:0} seconds; queued again {After(run.CheckpointStep)}",
                now, cancellationToken);
            await db.SaveChangesAsync(cancellationToken);
            await events.PublishAsync(cancellationToken);
            expired++;
        }

        return expired;
    }
}

/// <summary>A fenced run with its write lock held; dispose it once the write is recorded.</summary>
public sealed class FencedWrite(Run run, IDisposable held) : IDisposable
{
    public Run Run { get; } = run;

    public void Dispose() => held.Dispose();
}

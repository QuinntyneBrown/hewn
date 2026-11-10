using Hewn.Application.Abstractions;
using Hewn.Domain;
using Microsoft.EntityFrameworkCore;

namespace Hewn.Application.Workers;

/// <summary>
/// A worker is online while it was heard from in the last 60 seconds, so it goes Offline without any request
/// arriving. Each sweep compares who is online with the last sweep and tells Workers when that changed (L2-031 AC1);
/// registering, leasing and finishing tell it themselves.
/// </summary>
public sealed class WorkerPresence(IWorkersNotifier workers, TimeProvider clock)
{
    private readonly SemaphoreSlim _gate = new(1, 1);
    private HashSet<string>? _online;

    /// <summary>True when the online workers changed since the last sweep; the first sweep only takes note.</summary>
    public async Task<bool> SweepAsync(IAppDbContext db, CancellationToken cancellationToken)
    {
        await _gate.WaitAsync(cancellationToken);
        try
        {
            var since = clock.GetUtcNow() - Run.LeaseDuration;
            var online = (await db.Workers.AsNoTracking()
                .Where(w => w.RevokedAt == null && w.LastSeenAt >= since)
                .Select(w => w.Id)
                .ToListAsync(cancellationToken)).ToHashSet();
            var changed = _online is not null && !online.SetEquals(_online);
            _online = online;
            if (changed)
            {
                await workers.WorkersChangedAsync(cancellationToken);
            }

            return changed;
        }
        finally
        {
            _gate.Release();
        }
    }
}

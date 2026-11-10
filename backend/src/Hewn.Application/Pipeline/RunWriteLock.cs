using System.Collections.Concurrent;

namespace Hewn.Application.Pipeline;

/// <summary>
/// Per-run mutual exclusion. A GitHub write holds it from its fence check to its saved record, and a lease is
/// granted or expired only while holding it, so a reassignment waits for an in-flight write and every write after
/// it carries an epoch the fence refuses. Hewn runs one API process, so the lock lives in memory.
/// </summary>
public sealed class RunWriteLock
{
    /// <summary>No write or lease change waits longer than this for a run.</summary>
    public static readonly TimeSpan Ceiling = TimeSpan.FromSeconds(30);

    private readonly ConcurrentDictionary<Guid, SemaphoreSlim> _runs = new();

    public async Task<IDisposable> HoldAsync(Guid runId, CancellationToken cancellationToken)
    {
        var gate = _runs.GetOrAdd(runId, _ => new SemaphoreSlim(1, 1));
        if (!await gate.WaitAsync(Ceiling, cancellationToken))
        {
            throw new TimeoutException($"Run {runId} stayed locked for {Ceiling.TotalSeconds} seconds.");
        }

        return new Held(gate);
    }

    private sealed class Held(SemaphoreSlim gate) : IDisposable
    {
        private int _released;

        public void Dispose()
        {
            if (Interlocked.Exchange(ref _released, 1) == 0)
            {
                gate.Release();
            }
        }
    }
}

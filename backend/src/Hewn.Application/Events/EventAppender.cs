using System.Collections.Concurrent;
using System.Text.Json;
using Hewn.Application.Abstractions;
using Hewn.Domain;
using Microsoft.EntityFrameworkCore;

namespace Hewn.Application.Events;

/// <summary>
/// Adds a client-visible event with the next per-project sequence number to the current unit of work.
/// The first append for a project takes that project's write lock, held until the events are published (or the
/// unit of work ends), so two writers in this API never pick the same number: a worker's log batch and its model
/// call routinely arrive together. The unique (project, sequence) index still rejects any other concurrent writer.
/// </summary>
public sealed class EventAppender(IAppDbContext db, IProjectEventPublisher publisher, Pipeline.WorkSignal work, TimeProvider clock) : IDisposable
{
    private static readonly ConcurrentDictionary<Guid, SemaphoreSlim> Locks = new();

    private static readonly JsonSerializerOptions Json = new(JsonSerializerDefaults.Web);

    private readonly Dictionary<Guid, long> _pending = [];
    private readonly List<StoredEvent> _unpublished = [];
    private readonly Dictionary<Guid, SemaphoreSlim> _held = [];

    public async Task<StoredEvent> AppendAsync(Guid projectId, string type, object payload, CancellationToken cancellationToken)
    {
        await LockAsync(projectId, cancellationToken);
        if (!_pending.TryGetValue(projectId, out var last))
        {
            last = await db.Events.Where(e => e.ProjectId == projectId)
                .Select(e => (long?)e.Sequence)
                .MaxAsync(cancellationToken) ?? 0;
        }

        var stored = new StoredEvent(projectId, last + 1, type, JsonSerializer.Serialize(payload, Json), clock.GetUtcNow());
        _pending[projectId] = stored.Sequence;
        db.Events.Add(stored);
        _unpublished.Add(stored);
        return stored;
    }

    /// <summary>
    /// Takes the project's write lock now, for a handler that numbers something else per project or run (such as log
    /// lines) before it appends. Appending takes it anyway.
    /// </summary>
    public async Task LockAsync(Guid projectId, CancellationToken cancellationToken)
    {
        if (_held.ContainsKey(projectId))
        {
            return;
        }

        var gate = Locks.GetOrAdd(projectId, _ => new SemaphoreSlim(1, 1));
        await gate.WaitAsync(cancellationToken);
        _held[projectId] = gate;
    }

    /// <summary>Broadcasts the events appended in this unit of work. Call after SaveChangesAsync succeeds.</summary>
    public async Task PublishAsync(CancellationToken cancellationToken)
    {
        if (_unpublished.Count == 0)
        {
            Release();
            return;
        }

        var events = _unpublished.ToList();
        _unpublished.Clear();
        try
        {
            await publisher.PublishAsync(events, cancellationToken);
        }
        finally
        {
            Release();

            // Work may be leasable now: wake idle workers' held lease requests, which each look once (L2-026 AC5).
            // Every path that queues a run publishes an event, whatever its type, so any publish wakes them.
            work.Pulse();
        }
    }

    /// <summary>Releases the project locks if the unit of work ended without publishing (for example, it failed).</summary>
    public void Dispose() => Release();

    private void Release()
    {
        // The next append reads the stored sequence again, under the lock.
        _pending.Clear();
        foreach (var gate in _held.Values)
        {
            gate.Release();
        }

        _held.Clear();
    }
}

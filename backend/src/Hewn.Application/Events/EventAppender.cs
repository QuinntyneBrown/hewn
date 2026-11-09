using System.Text.Json;
using Hewn.Application.Abstractions;
using Hewn.Domain;
using Microsoft.EntityFrameworkCore;

namespace Hewn.Application.Events;

/// <summary>
/// Adds a client-visible event with the next per-project sequence number to the current unit of work.
/// The unique (project, sequence) index rejects a concurrent writer that picked the same number.
/// </summary>
public sealed class EventAppender(IAppDbContext db, TimeProvider clock)
{
    private static readonly JsonSerializerOptions Json = new(JsonSerializerDefaults.Web);

    private readonly Dictionary<Guid, long> _pending = [];

    public async Task<StoredEvent> AppendAsync(Guid projectId, string type, object payload, CancellationToken cancellationToken)
    {
        if (!_pending.TryGetValue(projectId, out var last))
        {
            last = await db.Events.Where(e => e.ProjectId == projectId)
                .Select(e => (long?)e.Sequence)
                .MaxAsync(cancellationToken) ?? 0;
        }

        var stored = new StoredEvent(projectId, last + 1, type, JsonSerializer.Serialize(payload, Json), clock.GetUtcNow());
        _pending[projectId] = stored.Sequence;
        db.Events.Add(stored);
        return stored;
    }
}

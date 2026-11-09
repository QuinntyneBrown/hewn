namespace Hewn.Domain;

/// <summary>A client-visible state change, stored with the next per-project sequence number before it is broadcast.</summary>
public sealed class StoredEvent
{
    private StoredEvent()
    {
        Type = string.Empty;
        Payload = string.Empty;
    }

    public StoredEvent(Guid projectId, long sequence, string type, string payload, DateTimeOffset occurredAt)
    {
        ProjectId = projectId;
        Sequence = sequence;
        Type = type;
        Payload = payload;
        OccurredAt = occurredAt;
    }

    public long Id { get; private set; }

    public Guid ProjectId { get; private set; }

    public long Sequence { get; private set; }

    public string Type { get; private set; }

    public string Payload { get; private set; }

    public DateTimeOffset OccurredAt { get; private set; }
}

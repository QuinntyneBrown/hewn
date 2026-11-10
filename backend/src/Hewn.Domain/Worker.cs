namespace Hewn.Domain;

/// <summary>A process that leases runs and executes agents, on a developer machine or in the cloud.</summary>
public sealed class Worker
{
    private Worker()
    {
        Id = Name = Host = Version = string.Empty;
    }

    public Worker(string name, WorkerLocation location, string host, string version, DateTimeOffset now, string? tokenId = null)
    {
        TokenId = tokenId;
        Id = $"wkr_{Guid.NewGuid():N}"[..16];
        Name = name;
        Location = location;
        Host = host;
        Version = version;
        Status = WorkerStatus.Idle;
        RegisteredAt = now;
        LastSeenAt = now;
    }

    public string Id { get; private set; }

    public string Name { get; private set; }

    public WorkerLocation Location { get; private set; }

    public string Host { get; private set; }

    public string Version { get; private set; }

    public WorkerStatus Status { get; private set; }

    public DateTimeOffset RegisteredAt { get; private set; }

    public DateTimeOffset LastSeenAt { get; private set; }

    /// <summary>The issued token it registered with; null for the API's configured development token.</summary>
    public string? TokenId { get; private set; }

    /// <summary>Set when its token is revoked (L2-041 AC2); a revoked worker leaves Workers and leases nothing.</summary>
    public DateTimeOffset? RevokedAt { get; private set; }

    public void Revoke(DateTimeOffset now) => RevokedAt ??= now;

    public void Seen(DateTimeOffset now, WorkerStatus status)
    {
        LastSeenAt = now;
        Status = status;
    }
}

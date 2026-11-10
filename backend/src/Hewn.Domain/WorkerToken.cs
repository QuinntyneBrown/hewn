namespace Hewn.Domain;

/// <summary>
/// A token a worker presents to connect (L2-041). Only the SHA-256 hash of the token is stored; the token itself is
/// shown once, when it is created. It stops working at <see cref="ExpiresAt"/> or once revoked.
/// </summary>
public sealed class WorkerToken
{
    /// <summary>The expiries an Owner may choose (AC3): 30 days, 90 days or 1 year.</summary>
    public static readonly IReadOnlyList<int> ExpiryDays = [30, 90, 365];

    private WorkerToken()
    {
        Id = Name = Hash = CreatedBy = string.Empty;
    }

    public WorkerToken(string name, WorkerLocation location, string hash, string createdBy, DateTimeOffset now, int expiresInDays)
    {
        Id = $"wtk_{Guid.NewGuid():N}"[..16];
        Name = name;
        Location = location;
        Hash = hash;
        CreatedBy = createdBy;
        CreatedAt = now;
        ExpiresAt = now.AddDays(expiresInDays);
    }

    public string Id { get; private set; }

    public string Name { get; private set; }

    public WorkerLocation Location { get; private set; }

    /// <summary>Lower-case hex SHA-256 of the token.</summary>
    public string Hash { get; private set; }

    public string CreatedBy { get; private set; }

    public DateTimeOffset CreatedAt { get; private set; }

    public DateTimeOffset ExpiresAt { get; private set; }

    public DateTimeOffset? RevokedAt { get; private set; }

    public string? RevokedBy { get; private set; }

    public bool IsValid(DateTimeOffset now) => RevokedAt is null && now < ExpiresAt;

    public void Revoke(string login, DateTimeOffset now)
    {
        RevokedAt ??= now;
        RevokedBy ??= login;
    }
}

namespace Hewn.Domain;

/// <summary>A signed-out session (L2-038 AC3): its cookie is refused even if replayed, until it would have expired anyway.</summary>
public sealed class RevokedSession
{
    public RevokedSession(Guid id, DateTimeOffset expiresAt)
    {
        Id = id;
        ExpiresAt = expiresAt;
    }

    public Guid Id { get; private set; }

    public DateTimeOffset ExpiresAt { get; private set; }
}

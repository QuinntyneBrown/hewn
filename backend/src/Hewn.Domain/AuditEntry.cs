namespace Hewn.Domain;

/// <summary>An action the audit log records (L2-044 AC1).</summary>
public enum AuditAction
{
    SignIn,
    DirectionSubmitted,
    Pause,
    Resume,
    Cancel,
    Merge,
    TokenCreated,
    TokenRevoked,
    StopAll,
    StartWorkers,
}

/// <summary>
/// One audited action (L2-044 AC1): who did it, what, when, to what and from which IP address. It has no mutators, no
/// API changes it, and the database refuses to update or delete it. The project's name is kept with it, so the entry
/// still reads after the project is deleted.
/// </summary>
public sealed class AuditEntry
{
    public const int MaxTargetLength = 200;

    public AuditEntry(DateTimeOffset at, string actor, AuditAction action, Guid? projectId, string? projectName, string? target, string? ipAddress)
    {
        At = at;
        Actor = actor;
        Action = action;
        ProjectId = projectId;
        ProjectName = projectName;
        Target = target is { Length: > MaxTargetLength } ? target[..MaxTargetLength] : target;
        IpAddress = ipAddress;
    }

    /// <summary>Increases with each entry, so it orders them by when they were written.</summary>
    public long Id { get; private set; }

    public DateTimeOffset At { get; private set; }

    /// <summary>The GitHub login of whoever acted; for a merge, whoever submitted the direction it belongs to.</summary>
    public string Actor { get; private set; }

    public AuditAction Action { get; private set; }

    public Guid? ProjectId { get; private set; }

    /// <summary>The project's name when the entry was written.</summary>
    public string? ProjectName { get; private set; }

    /// <summary>What it was done to, as shown: a project's name, "Ledgerline #27", a worker's name or "All projects".</summary>
    public string? Target { get; private set; }

    /// <summary>The client's address, or null for an action Hewn took itself, such as a merge.</summary>
    public string? IpAddress { get; private set; }
}

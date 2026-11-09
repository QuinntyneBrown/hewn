namespace Hewn.Domain;

/// <summary>
/// Whether workers may lease new runs (L2-029 AC4). Stop all workers turns it off and Start workers turns it back on;
/// it is stored, so a restarted server keeps it. One row.
/// </summary>
public sealed class LeasingSwitch
{
    public const int SingletonId = 1;

    private LeasingSwitch()
    {
    }

    public LeasingSwitch(bool stopped, string changedBy, DateTimeOffset now)
    {
        Id = SingletonId;
        Set(stopped, changedBy, now);
    }

    public int Id { get; private set; }

    public bool Stopped { get; private set; }

    public string ChangedBy { get; private set; } = string.Empty;

    public DateTimeOffset ChangedAt { get; private set; }

    public void Set(bool stopped, string changedBy, DateTimeOffset now)
    {
        Stopped = stopped;
        ChangedBy = changedBy;
        ChangedAt = now;
    }
}

namespace Hewn.Domain;

public enum Role
{
    Viewer,
    Owner,
}

public enum DirectionKind
{
    Product,
    Feature,
}

public enum DirectionStatus
{
    Queued,
    Running,
    Paused,
    Complete,
    Cancelled,
    /// <summary>A stage failed after its automatic retries (L2-006 AC2); waits for an Owner's Retry stage.</summary>
    Blocked,
}

public enum StageStatus
{
    Pending,
    Running,
    Paused,
    Succeeded,
    Failed,
    Skipped,
    Cancelled,
}

public enum ProjectStatus
{
    Running,
    Idle,
    Paused,
    Blocked,
    Cancelled,
    Complete,
}

public enum WorkerLocation
{
    Local,
    Cloud,
}

public enum WorkerStatus
{
    Idle,
    Busy,
    Offline,
}

public enum RunStatus
{
    Queued,
    Leased,
    Succeeded,
    Failed,
    Cancelled,
    /// <summary>Stopped with its direction (for example at the budget); keeps its checkpoint for a resume.</summary>
    Paused,
    /// <summary>Stopped by Stop all workers (L2-029 AC4); keeps its worker, epoch and checkpoint until Start workers queues it again.</summary>
    Halted,
}

public enum IncrementStatus
{
    Queued,
    InProgress,
    Blocked,
    Merged,
    Deferred,
}

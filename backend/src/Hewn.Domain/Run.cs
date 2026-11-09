namespace Hewn.Domain;

/// <summary>One execution of one stage for one direction. Leased by one worker at a time, fenced by its epoch.</summary>
public sealed class Run
{
    public static readonly TimeSpan LeaseDuration = TimeSpan.FromSeconds(60);

    private Run()
    {
    }

    /// <summary>A retry of a failed run (L2-006 AC1): attempt 2 to 4 of the stage, leasable from <paramref name="notBefore"/>.</summary>
    public Run(Guid projectId, Guid directionId, int stage, DateTimeOffset now, int attempt, DateTimeOffset notBefore)
        : this(projectId, directionId, stage, now)
    {
        Attempt = attempt;
        NotBefore = notBefore;
    }

    public Run(Guid projectId, Guid directionId, int stage, DateTimeOffset now)
    {
        Id = Guid.NewGuid();
        ProjectId = projectId;
        DirectionId = directionId;
        Stage = stage;
        Status = RunStatus.Queued;
        CreatedAt = now;
        Attempt = 1;
    }

    /// <summary>1 for the first try of a stage, 2 to 4 for its automatic retries (L2-006 AC1).</summary>
    public int Attempt { get; private set; }

    /// <summary>A retry waits out its backoff: it is not leased before this time.</summary>
    public DateTimeOffset? NotBefore { get; private set; }

    public Guid Id { get; private set; }

    public Guid ProjectId { get; private set; }

    public Guid DirectionId { get; private set; }

    public int Stage { get; private set; }

    public RunStatus Status { get; private set; }

    public string? WorkerId { get; private set; }

    /// <summary>Raised on every grant; a request carrying an older epoch is refused.</summary>
    public long LeaseEpoch { get; private set; }

    public DateTimeOffset? LeaseExpiresAt { get; private set; }

    /// <summary>The last completed step (0 when none).</summary>
    public int CheckpointStep { get; private set; }

    public string? CheckpointSha { get; private set; }

    public string? Error { get; private set; }

    public DateTimeOffset CreatedAt { get; private set; }

    public DateTimeOffset? StartedAt { get; private set; }

    /// <summary>The worker that last held the lease; kept after the run ends, unlike <see cref="WorkerId"/>.</summary>
    public string? RanBy { get; private set; }

    /// <summary>The step the worker is on (1-based), while the run is leased.</summary>
    public int? CurrentStep { get; private set; }

    public string? CurrentStepName { get; private set; }

    public DateTimeOffset? EndedAt { get; private set; }

    public bool IsHeldBy(string workerId, long epoch) =>
        Status == RunStatus.Leased && WorkerId == workerId && LeaseEpoch == epoch;

    public void Renew(DateTimeOffset now) => LeaseExpiresAt = now + LeaseDuration;

    public const int MaxStepNameLength = 200;

    public void StartStep(int step, string name)
    {
        CurrentStep = step;
        CurrentStepName = name.Length > MaxStepNameLength ? name[..MaxStepNameLength] : name;
    }

    public void Checkpoint(int step, string? sha)
    {
        if (step > CheckpointStep)
        {
            CheckpointStep = step;
            CheckpointSha = sha;
        }
    }

    /// <summary>Releases the lease and keeps the checkpoint, so a resume carries on from the last completed step.</summary>
    public void Pause()
    {
        Status = RunStatus.Paused;
        WorkerId = null;
        LeaseExpiresAt = null;
    }

    /// <summary>Queues a paused run again; its next lease carries on after the checkpoint it kept.</summary>
    public void Resume()
    {
        if (Status != RunStatus.Paused)
        {
            throw new InvalidOperationException($"Run {Id} is {Status}; only a paused run resumes.");
        }

        Status = RunStatus.Queued;
    }

    /// <summary>When the worker heard Cancel on its control poll and stopped the run.</summary>
    public DateTimeOffset? StopAcknowledgedAt { get; private set; }

    /// <summary>True when a worker held the run as it was cancelled, so Cancel waits for it to stop.</summary>
    public bool HadWorkerWhenCancelled => Status == RunStatus.Cancelled && WorkerId is not null;

    /// <summary>
    /// Cancel (L2-029 AC3): the run ends and its lease no longer fences anything, so every write the worker tries is
    /// refused. The worker and epoch are kept so its control poll can still hear the cancel.
    /// </summary>
    public void Cancel(DateTimeOffset now)
    {
        Status = RunStatus.Cancelled;
        EndedAt = now;
        LeaseExpiresAt = null;
    }

    /// <summary>
    /// Stop all workers (L2-029 AC4): the lease no longer fences anything, so the worker's writes are refused, and the
    /// checkpoint is kept. The worker and epoch stay so its control poll can still hear the halt.
    /// </summary>
    public void Halt()
    {
        Status = RunStatus.Halted;
        LeaseExpiresAt = null;
        StopAcknowledgedAt = null;
    }

    /// <summary>Start workers: a halted run waits for a worker again and carries on after its checkpoint.</summary>
    public void Release()
    {
        if (Status != RunStatus.Halted)
        {
            throw new InvalidOperationException($"Run {Id} is {Status}; only a halted run is released.");
        }

        Status = RunStatus.Queued;
        WorkerId = null;
        CurrentStep = null;
        CurrentStepName = null;
        StopAcknowledgedAt = null;
    }

    public bool AcknowledgeStop(DateTimeOffset now)
    {
        if (StopAcknowledgedAt is not null)
        {
            return false;
        }

        StopAcknowledgedAt = now;
        return true;
    }

    public void Succeed(DateTimeOffset now) => End(RunStatus.Succeeded, null, now);

    public void Fail(string error, DateTimeOffset now) => End(RunStatus.Failed, error, now);

    private void End(RunStatus status, string? error, DateTimeOffset now)
    {
        Status = status;
        Error = error;
        EndedAt = now;
        WorkerId = null;
        LeaseExpiresAt = null;
    }
}

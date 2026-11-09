namespace Hewn.Domain;

/// <summary>One execution of one stage for one direction. Leased by one worker at a time, fenced by its epoch.</summary>
public sealed class Run
{
    public static readonly TimeSpan LeaseDuration = TimeSpan.FromSeconds(60);

    private Run()
    {
    }

    public Run(Guid projectId, Guid directionId, int stage, DateTimeOffset now)
    {
        Id = Guid.NewGuid();
        ProjectId = projectId;
        DirectionId = directionId;
        Stage = stage;
        Status = RunStatus.Queued;
        CreatedAt = now;
    }

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

    public DateTimeOffset? EndedAt { get; private set; }

    public bool IsHeldBy(string workerId, long epoch) =>
        Status == RunStatus.Leased && WorkerId == workerId && LeaseEpoch == epoch;

    public void Renew(DateTimeOffset now) => LeaseExpiresAt = now + LeaseDuration;

    public void Checkpoint(int step, string? sha)
    {
        if (step > CheckpointStep)
        {
            CheckpointStep = step;
            CheckpointSha = sha;
        }
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

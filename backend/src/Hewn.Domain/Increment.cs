namespace Hewn.Domain;

/// <summary>
/// One entry of a direction's backlog from stage 9 (L2-020): an increment of one journey or part of one, or a
/// descoped design with its reason (L2-019). Stage 10 works through the queued increments in number order.
/// </summary>
public sealed class Increment
{
    private Increment()
    {
        Title = L2Ids = DependsOn = string.Empty;
    }

    private Increment(Guid directionId, int? number, string title, int? journey, IEnumerable<string> l2Ids, decimal estimateDays,
        IEnumerable<int> dependsOn, IncrementStatus status, string? reason)
    {
        Id = Guid.NewGuid();
        DirectionId = directionId;
        Number = number;
        Title = title;
        Journey = journey;
        L2Ids = string.Join(',', l2Ids);
        EstimateDays = estimateDays;
        DependsOn = string.Join(',', dependsOn);
        Status = status;
        Reason = reason;
    }

    public Guid Id { get; private set; }

    public Guid DirectionId { get; private set; }

    /// <summary>Position in the backlog, from 1; null for a deferred design.</summary>
    public int? Number { get; private set; }

    public string Title { get; private set; }

    public int? Journey { get; private set; }

    /// <summary>Comma-separated L2 IDs.</summary>
    public string L2Ids { get; private set; }

    public decimal EstimateDays { get; private set; }

    /// <summary>Comma-separated numbers of earlier increments this one needs.</summary>
    public string DependsOn { get; private set; }

    public IncrementStatus Status { get; private set; }

    /// <summary>Why a design was descoped; null for planned increments.</summary>
    public string? Reason { get; private set; }

    public int? PullRequestNumber { get; private set; }

    /// <summary>Acceptance tests failing and passing on the test commit (L2-021 AC3); null until the red run.</summary>
    public int? RedFailing { get; private set; }

    public int? RedPassing { get; private set; }

    /// <summary>Every new acceptance test passed before any implementation; noted in the pull request.</summary>
    public bool TestsPassedEarly { get; private set; }

    /// <summary>Implement-and-test iterations used so far (L2-022 AC2).</summary>
    public int Iterations { get; private set; }

    /// <summary>Newline-separated failing tests of a Blocked increment.</summary>
    public string? FailingTests { get; private set; }

    /// <summary>Acceptance tests in the test commit (L2-021 AC2).</summary>
    public int? TestCount { get; private set; }

    /// <summary>The iteration on which every test first passed (L2-022 AC1); null until green.</summary>
    public int? GreenAfter { get; private set; }

    /// <summary>Recorded or Failed (L2-023); a failed video never blocks the increment.</summary>
    public string? Video { get; private set; }

    /// <summary>The video's folder, or why it failed.</summary>
    public string? VideoNote { get; private set; }

    public DateTimeOffset? StartedAt { get; private set; }

    public DateTimeOffset? TestsCommittedAt { get; private set; }

    public DateTimeOffset? GreenAt { get; private set; }

    public DateTimeOffset? VideoAt { get; private set; }

    public DateTimeOffset? PullRequestOpenedAt { get; private set; }

    /// <summary>When the increment merged or blocked.</summary>
    public DateTimeOffset? FinishedAt { get; private set; }

    /// <summary>When GitHub last told Hewn about the pull request's checks, by webhook or polling (L2-037 AC1).</summary>
    public DateTimeOffset? ChecksHeardAt { get; private set; }

    /// <summary>
    /// Applies a progress report from stage 10 at <paramref name="now"/>. Queued or InProgress may become
    /// InProgress; only InProgress may become Blocked or Merged. Returns false for any other transition. Each
    /// step's time is kept from its first report.
    /// </summary>
    public bool Apply(IncrementProgress progress, DateTimeOffset now)
    {
        var allowed = progress.Status switch
        {
            IncrementStatus.InProgress => Status is IncrementStatus.Queued or IncrementStatus.InProgress,
            IncrementStatus.Blocked or IncrementStatus.Merged => Status == IncrementStatus.InProgress,
            _ => false,
        };
        if (!allowed)
        {
            return false;
        }

        Status = progress.Status;
        StartedAt ??= now;
        if (progress.RedFailing is not null && progress.RedPassing is not null)
        {
            RedFailing = progress.RedFailing;
            RedPassing = progress.RedPassing;
            TestsPassedEarly = progress.RedFailing == 0;
            TestCount = progress.TestCount ?? progress.RedFailing + progress.RedPassing;
            TestsCommittedAt ??= now;
        }

        Iterations = progress.Iterations ?? Iterations;
        if (progress.GreenAfter is not null)
        {
            GreenAfter = progress.GreenAfter;
            GreenAt = now;
        }

        if (progress.Video is not null)
        {
            Video = progress.Video;
            VideoNote = progress.VideoNote;
            VideoAt ??= now;
        }

        if (progress.PullRequestNumber is not null && PullRequestNumber is null)
        {
            PullRequestOpenedAt = now;
        }

        PullRequestNumber = progress.PullRequestNumber ?? PullRequestNumber;
        if (progress.FailingTests is not null)
        {
            FailingTests = string.Join('\n', progress.FailingTests);
        }

        if (Status is IncrementStatus.Blocked or IncrementStatus.Merged)
        {
            FinishedAt = now;
        }

        return true;
    }

    /// <summary>GitHub reported on the pull request's checks, by webhook or polling.</summary>
    public void HeardChecks(DateTimeOffset now) => ChecksHeardAt = now;

    public static Increment Planned(Guid directionId, int number, string title, int journey, IEnumerable<string> l2Ids, decimal estimateDays, IEnumerable<int> dependsOn) =>
        new(directionId, number, title, journey, l2Ids, estimateDays, dependsOn, IncrementStatus.Queued, null);

    public static Increment Deferred(Guid directionId, string title, IEnumerable<string> l2Ids, decimal estimateDays, string reason) =>
        new(directionId, null, title, null, l2Ids, estimateDays, [], IncrementStatus.Deferred, reason);
}

/// <summary>One progress report from stage 10; null fields leave the increment as it is.</summary>
public sealed record IncrementProgress(
    IncrementStatus Status,
    int? RedFailing = null,
    int? RedPassing = null,
    int? Iterations = null,
    IReadOnlyList<string>? FailingTests = null,
    int? PullRequestNumber = null,
    int? TestCount = null,
    int? GreenAfter = null,
    string? Video = null,
    string? VideoNote = null);

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

    /// <summary>
    /// Applies a progress report from stage 10. Queued or InProgress may become InProgress; only InProgress may
    /// become Blocked or Merged. Returns false for any other transition.
    /// </summary>
    public bool Apply(IncrementStatus status, int? redFailing, int? redPassing, int? iterations, IReadOnlyList<string>? failingTests, int? pullRequestNumber)
    {
        var allowed = status switch
        {
            IncrementStatus.InProgress => Status is IncrementStatus.Queued or IncrementStatus.InProgress,
            IncrementStatus.Blocked or IncrementStatus.Merged => Status == IncrementStatus.InProgress,
            _ => false,
        };
        if (!allowed)
        {
            return false;
        }

        Status = status;
        if (redFailing is not null && redPassing is not null)
        {
            RedFailing = redFailing;
            RedPassing = redPassing;
            TestsPassedEarly = redFailing == 0;
        }

        Iterations = iterations ?? Iterations;
        PullRequestNumber = pullRequestNumber ?? PullRequestNumber;
        if (failingTests is not null)
        {
            FailingTests = string.Join('\n', failingTests);
        }

        return true;
    }

    public static Increment Planned(Guid directionId, int number, string title, int journey, IEnumerable<string> l2Ids, decimal estimateDays, IEnumerable<int> dependsOn) =>
        new(directionId, number, title, journey, l2Ids, estimateDays, dependsOn, IncrementStatus.Queued, null);

    public static Increment Deferred(Guid directionId, string title, IEnumerable<string> l2Ids, decimal estimateDays, string reason) =>
        new(directionId, null, title, null, l2Ids, estimateDays, [], IncrementStatus.Deferred, reason);
}

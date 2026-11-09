namespace Hewn.Domain;

/// <summary>An instruction to build a product or add a feature, carried through the stages.</summary>
public sealed class Direction
{
    private readonly List<StageState> _stages = [];

    private Direction()
    {
        Idea = string.Empty;
        SubmittedBy = string.Empty;
    }

    private Direction(Guid projectId, DirectionKind kind, string idea, decimal budgetUsd, string submittedBy, DateTimeOffset now)
    {
        Id = Guid.NewGuid();
        ProjectId = projectId;
        Kind = kind;
        Idea = idea;
        BudgetUsd = budgetUsd;
        SubmittedBy = submittedBy;
        SubmittedAt = now;
        Status = DirectionStatus.Queued;
        for (var number = 0; number < Domain.Stages.Count; number++)
        {
            _stages.Add(new StageState(number));
        }
    }

    public Guid Id { get; private set; }

    public Guid ProjectId { get; private set; }

    public DirectionKind Kind { get; private set; }

    public string Idea { get; private set; }

    public decimal BudgetUsd { get; private set; }

    /// <summary>The cost of every model call the direction's runs made (L2-052).</summary>
    public decimal SpendUsd { get; private set; }

    /// <summary>Set once spend reaches 80% of the budget, so the warning is sent once (L2-053 AC2).</summary>
    public bool BudgetWarned { get; private set; }

    /// <summary>Why a Paused direction stopped, such as "Budget reached".</summary>
    public string? PauseReason { get; private set; }

    public const decimal WarnAtFraction = 0.8m;

    public const string BudgetReached = "Budget reached";

    /// <summary>The reason an Owner's Pause records (L2-029 AC1).</summary>
    public const string PausedByOwner = "Paused by an Owner";

    /// <summary>The Owner who pressed Pause, while the step in progress finishes; null when no pause is pending.</summary>
    public string? PauseRequestedBy { get; private set; }

    /// <summary>Who paused the direction and when it became Paused, for "Paused by … at …".</summary>
    public string? PausedBy { get; private set; }

    public DateTimeOffset? PausedAt { get; private set; }

    /// <summary>Who cancelled the direction and when (L2-029 AC3), for "Cancelled by … on … at …".</summary>
    public string? CancelledBy { get; private set; }

    public DateTimeOffset? CancelledAt { get; private set; }

    /// <summary>True from a Cancel until the worker that held the run confirms it stopped.</summary>
    public bool AwaitingStop { get; private set; }

    /// <summary>Seconds from Cancel to the worker stopping its run; null when no worker held a run.</summary>
    public int? StoppedWithinSeconds { get; private set; }

    /// <summary>Open pull requests labelled <c>hewn:cancelled</c>, comma-separated.</summary>
    public string? LabelledPullRequests { get; private set; }

    public IReadOnlyList<int> LabelledPullRequestNumbers =>
        string.IsNullOrEmpty(LabelledPullRequests) ? [] : [.. LabelledPullRequests.Split(',').Select(int.Parse)];

    public DirectionStatus Status { get; private set; }

    public string SubmittedBy { get; private set; }

    public DateTimeOffset SubmittedAt { get; private set; }

    public DateTimeOffset? CompletedAt { get; private set; }

    public IReadOnlyList<StageState> Stages => _stages;

    /// <summary>For a feature direction, stage 1's recorded decision on whether the feature changes the user interface.</summary>
    public bool? HasUiChange { get; private set; }

    /// <summary>The rationale stage 1 recorded with that decision.</summary>
    public string? UiDecision { get; private set; }

    /// <summary>A feature direction never runs Bootstrap, Stack or Scaffold (L2-005 AC1).</summary>
    public static readonly IReadOnlyList<int> FeatureSkippedStages = [0, 4, 6];

    /// <summary>Designs and Design system, skipped when a feature has no user interface change (L2-005 AC2).</summary>
    public static readonly IReadOnlyList<int> UiStages = [2, 3];

    public bool IsActive => Status is DirectionStatus.Queued or DirectionStatus.Running or DirectionStatus.Paused;

    /// <summary>The first stage of the plan: a product direction runs all eleven; a feature direction starts at Idea.</summary>
    public int FirstStage => _stages.First(s => s.Status == StageStatus.Pending).Number;

    /// <summary>Starts a stage. Refuses when an earlier stage has not succeeded or been skipped.</summary>
    public StageState StartStage(int number, DateTimeOffset now)
    {
        if (!IsActive)
        {
            throw new InvalidOperationException($"Direction {Id} is {Status}; stage {number} cannot start.");
        }

        var blocker = _stages.FirstOrDefault(s => s.Number < number && s.Status is not (StageStatus.Succeeded or StageStatus.Skipped));
        if (blocker is not null)
        {
            throw new InvalidOperationException($"Stage {number} cannot start before stage {blocker.Number} succeeds.");
        }

        var stage = Stage(number);
        stage.Start(now);
        Status = DirectionStatus.Running;
        return stage;
    }

    /// <summary>Marks a running stage Succeeded and returns the next stage to run, or null when the direction is complete.</summary>
    public int? CompleteStage(int number, DateTimeOffset now)
    {
        Stage(number).End(StageStatus.Succeeded, now);
        var next = _stages.Where(s => s.Number > number && s.Status == StageStatus.Pending).Select(s => (int?)s.Number).FirstOrDefault();
        if (next is null)
        {
            Status = DirectionStatus.Complete;
            CompletedAt = now;
            PauseRequestedBy = null;
        }

        return next;
    }

    /// <summary>
    /// Records stage 1's decision on a feature direction. Without a UI change, Designs and Design system are
    /// Skipped; the skipped stages are returned so the caller can announce them.
    /// </summary>
    public IReadOnlyList<StageState> RecordUiChange(bool hasUiChange, string rationale, DateTimeOffset now)
    {
        if (Kind != DirectionKind.Feature)
        {
            throw new InvalidOperationException($"Direction {Id} is a {Kind} direction; only a feature records a UI change decision.");
        }

        HasUiChange = hasUiChange;
        UiDecision = rationale;
        var skipped = new List<StageState>();
        foreach (var number in UiStages)
        {
            var stage = Stage(number);
            if (hasUiChange || stage.Status != StageStatus.Pending)
            {
                continue;
            }

            stage.End(StageStatus.Skipped, now);
            skipped.Add(stage);
        }

        return skipped;
    }

    /// <summary>
    /// Adds a model call's cost and applies the budget rule (L2-053): Stop once spend reaches the budget, Warn the
    /// first time it reaches 80%, otherwise Continue. A call that jumps straight past both still marks the warning sent.
    /// </summary>
    public (BudgetVerdict Verdict, bool Warned) RecordSpend(decimal costUsd)
    {
        SpendUsd = Math.Round(SpendUsd + costUsd, 6, MidpointRounding.AwayFromZero);
        var warned = false;
        if (!BudgetWarned && SpendUsd >= BudgetUsd * WarnAtFraction)
        {
            BudgetWarned = true;
            warned = true;
        }

        if (SpendUsd >= BudgetUsd)
        {
            return (BudgetVerdict.Stop, warned);
        }

        return (warned ? BudgetVerdict.Warn : BudgetVerdict.Continue, warned);
    }

    /// <summary>Pauses the direction and its running stage, recording why (L2-053 AC3).</summary>
    public StageState Pause(int stageNumber, string reason)
    {
        Status = DirectionStatus.Paused;
        PauseReason = reason;
        PauseRequestedBy = null;
        var stage = Stage(stageNumber);
        stage.Pause();
        return stage;
    }

    /// <summary>
    /// An Owner pressed Pause (L2-029 AC1). Nothing stops yet: the step in progress finishes, and its checkpoint
    /// pauses the direction. Returns false when a pause was already requested.
    /// </summary>
    public bool RequestPause(string requestedBy)
    {
        if (Status is not (DirectionStatus.Queued or DirectionStatus.Running))
        {
            throw new InvalidOperationException($"Direction {Id} is {Status}; only a queued or running direction pauses.");
        }

        if (PauseRequestedBy is not null)
        {
            return false;
        }

        PauseRequestedBy = requestedBy;
        return true;
    }

    /// <summary>
    /// The requested pause takes effect at a checkpoint or before a stage starts: the direction is Paused and a
    /// running stage pauses with it. Returns the stage when its status changed.
    /// </summary>
    public StageState? PauseAsRequested(int stageNumber, DateTimeOffset now)
    {
        if (PauseRequestedBy is null)
        {
            throw new InvalidOperationException($"Direction {Id} has no pause requested.");
        }

        Status = DirectionStatus.Paused;
        PauseReason = PausedByOwner;
        PausedBy = PauseRequestedBy;
        PausedAt = now;
        PauseRequestedBy = null;
        var stage = Stage(stageNumber);
        if (stage.Status != StageStatus.Running)
        {
            return null;
        }

        stage.Pause();
        return stage;
    }

    /// <summary>True when an Owner paused the direction and Resume continues it.</summary>
    public bool IsPausedByOwner => Status == DirectionStatus.Paused && PauseReason == PausedByOwner;

    /// <summary>Resume (L2-029 AC2): the direction runs again and a paused stage carries on. Returns the stage when its status changed.</summary>
    public StageState? Resume(int stageNumber)
    {
        if (!IsPausedByOwner)
        {
            throw new InvalidOperationException($"Direction {Id} is not paused by an Owner.");
        }

        var stage = Stage(stageNumber);
        // A direction paused before its first stage started waits for a worker again, as it did before.
        Status = _stages.Any(s => s.StartedAt is not null) ? DirectionStatus.Running : DirectionStatus.Queued;
        PauseReason = null;
        PausedBy = null;
        PausedAt = null;
        if (stage.Status != StageStatus.Paused)
        {
            return null;
        }

        stage.Resume();
        return stage;
    }

    /// <summary>True when the direction stopped at its budget and only Raise and resume continues it.</summary>
    public bool IsPausedAtBudget => Status == DirectionStatus.Paused && PauseReason == BudgetReached;

    /// <summary>
    /// Raises the budget above the spend so far and resumes the paused stage, in one action (L2-053 AC3). The 80%
    /// warning applies again to the new budget.
    /// </summary>
    public StageState RaiseBudgetAndResume(decimal budgetUsd, int stageNumber)
    {
        if (!IsPausedAtBudget)
        {
            throw new InvalidOperationException($"Direction {Id} is not paused at its budget.");
        }

        if (budgetUsd <= SpendUsd)
        {
            throw new InvalidOperationException($"A budget of {budgetUsd} is not above the {SpendUsd} spent.");
        }

        BudgetUsd = budgetUsd;
        BudgetWarned = false;
        Status = DirectionStatus.Running;
        PauseReason = null;
        var stage = Stage(stageNumber);
        stage.Resume();
        return stage;
    }

    /// <summary>
    /// Cancel (L2-029 AC3): the direction is Cancelled for good and its running or paused stage with it. Returns the
    /// stage when its status changed.
    /// </summary>
    public StageState? Cancel(string cancelledBy, DateTimeOffset now, bool awaitingStop)
    {
        if (!IsActive)
        {
            throw new InvalidOperationException($"Direction {Id} is {Status}; only an active direction cancels.");
        }

        Status = DirectionStatus.Cancelled;
        CancelledBy = cancelledBy;
        CancelledAt = now;
        AwaitingStop = awaitingStop;
        PauseRequestedBy = null;
        PauseReason = null;
        var stage = _stages.FirstOrDefault(s => s.Status is StageStatus.Running or StageStatus.Paused);
        stage?.End(StageStatus.Cancelled, now);
        return stage;
    }

    /// <summary>The worker heard Cancel and stopped; records how long that took, in whole seconds, at least one.</summary>
    public void RecordStop(DateTimeOffset now)
    {
        var seconds = CancelledAt is { } at ? (int)Math.Ceiling((now - at).TotalSeconds) : 1;
        StoppedWithinSeconds = Math.Max(1, seconds);
        AwaitingStop = false;
    }

    public void RecordLabelled(IReadOnlyList<int> numbers) =>
        LabelledPullRequests = numbers.Count == 0 ? null : string.Join(',', numbers);

    public void FailStage(int number, DateTimeOffset now)
    {
        Stage(number).End(StageStatus.Failed, now);
        PauseRequestedBy = null;
    }

    public StageState Stage(int number) => _stages.Single(s => s.Number == number);

    internal static Direction Feature(Guid projectId, string idea, decimal budgetUsd, string submittedBy, DateTimeOffset now)
    {
        var direction = new Direction(projectId, DirectionKind.Feature, idea, budgetUsd, submittedBy, now);
        foreach (var number in FeatureSkippedStages)
        {
            direction.Stage(number).End(StageStatus.Skipped, now);
        }

        return direction;
    }

    internal static Direction Product(Guid projectId, string idea, decimal budgetUsd, string submittedBy, DateTimeOffset now) =>
        new(projectId, DirectionKind.Product, idea, budgetUsd, submittedBy, now);
}

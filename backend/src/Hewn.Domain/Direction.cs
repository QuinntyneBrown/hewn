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

    public void FailStage(int number, DateTimeOffset now) => Stage(number).End(StageStatus.Failed, now);

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

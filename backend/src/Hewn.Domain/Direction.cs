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

    public bool IsActive => Status is DirectionStatus.Queued or DirectionStatus.Running or DirectionStatus.Paused;

    /// <summary>The first stage of the plan; every product direction runs all eleven.</summary>
    public int FirstStage => 0;

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

    public void FailStage(int number, DateTimeOffset now) => Stage(number).End(StageStatus.Failed, now);

    public StageState Stage(int number) => _stages.Single(s => s.Number == number);

    internal static Direction Product(Guid projectId, string idea, decimal budgetUsd, string submittedBy, DateTimeOffset now) =>
        new(projectId, DirectionKind.Product, idea, budgetUsd, submittedBy, now);
}

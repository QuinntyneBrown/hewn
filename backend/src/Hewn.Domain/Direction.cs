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

    internal static Direction Product(Guid projectId, string idea, decimal budgetUsd, string submittedBy, DateTimeOffset now) =>
        new(projectId, DirectionKind.Product, idea, budgetUsd, submittedBy, now);
}

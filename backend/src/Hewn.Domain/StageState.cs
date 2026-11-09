namespace Hewn.Domain;

/// <summary>The status of one stage of one direction.</summary>
public sealed class StageState
{
    private StageState()
    {
        Name = string.Empty;
    }

    internal StageState(int number)
    {
        Number = number;
        Name = Stages.Names[number];
        Status = StageStatus.Pending;
    }

    public Guid DirectionId { get; private set; }

    public int Number { get; private set; }

    public string Name { get; private set; }

    public StageStatus Status { get; private set; }

    public DateTimeOffset? StartedAt { get; private set; }

    public DateTimeOffset? EndedAt { get; private set; }
}

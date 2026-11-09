namespace Hewn.Domain;

/// <summary>One model call a run made, with its tokens and cost (L2-052 AC1).</summary>
public sealed class ModelCall
{
    public const int MaxModelLength = 100;
    public const int MaxCallIdLength = 100;

    private ModelCall()
    {
        CallId = string.Empty;
        Model = string.Empty;
    }

    public ModelCall(Run run, string callId, string model, long inputTokens, long outputTokens, decimal costUsd, DateTimeOffset now)
    {
        Id = Guid.NewGuid();
        RunId = run.Id;
        ProjectId = run.ProjectId;
        DirectionId = run.DirectionId;
        Stage = run.Stage;
        CallId = callId;
        Model = model;
        InputTokens = inputTokens;
        OutputTokens = outputTokens;
        CostUsd = costUsd;
        RecordedAt = now;
    }

    public Guid Id { get; private set; }

    public Guid RunId { get; private set; }

    public Guid ProjectId { get; private set; }

    public Guid DirectionId { get; private set; }

    public int Stage { get; private set; }

    /// <summary>The worker's key for the call, so a call reported twice is counted once.</summary>
    public string CallId { get; private set; }

    public string Model { get; private set; }

    public long InputTokens { get; private set; }

    public long OutputTokens { get; private set; }

    public decimal CostUsd { get; private set; }

    public DateTimeOffset RecordedAt { get; private set; }
}

/// <summary>What the worker does after a model call: go on, go on with a warning, or stop (L2-053).</summary>
public enum BudgetVerdict
{
    Continue,
    Warn,
    Stop,
}

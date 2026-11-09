namespace Hewn.Domain;

/// <summary>
/// A question a skill would have asked, answered by the agent in a run and recorded in the product's
/// <c>docs/decisions.md</c> (L2-054). Hewn keeps a copy so the stage's Decisions tab can list it. Text is redacted
/// before it is stored.
/// </summary>
public sealed class RunDecision
{
    public const int MaxQuestionLength = 1000;
    public const int MaxAnswerLength = 2000;
    public const int MaxRationaleLength = 4000;

    private RunDecision()
    {
        Question = Answer = Rationale = string.Empty;
    }

    public RunDecision(Run run, string question, string answer, string rationale, DateTimeOffset now)
    {
        RunId = run.Id;
        ProjectId = run.ProjectId;
        DirectionId = run.DirectionId;
        Stage = run.Stage;
        Question = Cap(question, MaxQuestionLength);
        Answer = Cap(answer, MaxAnswerLength);
        Rationale = Cap(rationale, MaxRationaleLength);
        RecordedAt = now;
    }

    public long Id { get; private set; }

    public Guid RunId { get; private set; }

    public Guid ProjectId { get; private set; }

    public Guid DirectionId { get; private set; }

    public int Stage { get; private set; }

    public string Question { get; private set; }

    public string Answer { get; private set; }

    public string Rationale { get; private set; }

    public DateTimeOffset RecordedAt { get; private set; }

    private static string Cap(string text, int max) => text.Length > max ? text[..max] : text;
}

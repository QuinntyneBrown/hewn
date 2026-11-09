namespace Hewn.Domain;

/// <summary>One line of a run's log, numbered per run. Text is redacted before it is stored.</summary>
public sealed class RunLogLine
{
    public const int MaxTextLength = 2000;

    private RunLogLine()
    {
        Level = Text = string.Empty;
    }

    public RunLogLine(Guid runId, long sequence, string level, string text, DateTimeOffset at)
    {
        RunId = runId;
        Sequence = sequence;
        Level = level;
        Text = text.Length > MaxTextLength ? text[..MaxTextLength] : text;
        At = at;
    }

    public long Id { get; private set; }

    public Guid RunId { get; private set; }

    public long Sequence { get; private set; }

    public string Level { get; private set; }

    public string Text { get; private set; }

    public DateTimeOffset At { get; private set; }
}

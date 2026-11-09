namespace Hewn.Domain;

/// <summary>
/// A required check on an increment's pull request, as GitHub last reported it (L2-024 AC3, L2-037): status
/// queued, in_progress or completed, and a conclusion once completed.
/// </summary>
public sealed class IncrementCheck
{
    private IncrementCheck()
    {
        Name = string.Empty;
        Status = string.Empty;
    }

    public IncrementCheck(Guid incrementId, int pullRequestNumber, string name)
    {
        Id = Guid.NewGuid();
        IncrementId = incrementId;
        PullRequestNumber = pullRequestNumber;
        Name = name;
        Status = string.Empty;
    }

    public Guid Id { get; private set; }

    public Guid IncrementId { get; private set; }

    public int PullRequestNumber { get; private set; }

    public string Name { get; private set; }

    public string Status { get; private set; }

    public string? Conclusion { get; private set; }

    public DateTimeOffset? StartedAt { get; private set; }

    public DateTimeOffset? CompletedAt { get; private set; }

    /// <summary>Takes GitHub's latest report; returns false when nothing visible changed.</summary>
    public bool Update(string status, string? conclusion, DateTimeOffset? startedAt, DateTimeOffset? completedAt)
    {
        var changed = Status != status || Conclusion != conclusion;
        Status = status;
        Conclusion = conclusion;
        StartedAt = startedAt ?? StartedAt;
        CompletedAt = completedAt ?? CompletedAt;
        return changed;
    }
}

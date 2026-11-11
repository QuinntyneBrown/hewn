namespace Hewn.Domain;

public enum SkillsUpdateStatus
{
    Open,
    Merged,
    ChecksFailed,
}

/// <summary>
/// A pull request that refreshes a project's skills from Greenlit (L2-008 AC2). It merges once its checks pass; at
/// most one is open per project.
/// </summary>
public sealed class SkillsUpdate
{
    private SkillsUpdate()
    {
    }

    public SkillsUpdate(Guid projectId, string fromSha, string toSha, string branch, int pullRequestNumber, string pullRequestUrl, string requestedBy, DateTimeOffset now)
    {
        Id = Guid.NewGuid();
        ProjectId = projectId;
        FromSha = fromSha;
        ToSha = toSha;
        Branch = branch;
        PullRequestNumber = pullRequestNumber;
        PullRequestUrl = pullRequestUrl;
        RequestedBy = requestedBy;
        CreatedAt = now;
        Status = SkillsUpdateStatus.Open;
    }

    public Guid Id { get; private set; }

    public Guid ProjectId { get; private set; }

    /// <summary>The Greenlit SHA in the lock when the update was opened.</summary>
    public string FromSha { get; private set; } = string.Empty;

    /// <summary>The Greenlit SHA the pull request locks.</summary>
    public string ToSha { get; private set; } = string.Empty;

    public string Branch { get; private set; } = string.Empty;

    public int PullRequestNumber { get; private set; }

    public string PullRequestUrl { get; private set; } = string.Empty;

    public string RequestedBy { get; private set; } = string.Empty;

    public SkillsUpdateStatus Status { get; private set; }

    public DateTimeOffset CreatedAt { get; private set; }

    public DateTimeOffset? EndedAt { get; private set; }

    /// <summary>The failing checks, when <see cref="Status"/> is ChecksFailed.</summary>
    public string? FailedChecks { get; private set; }

    public void Merged(DateTimeOffset now)
    {
        Status = SkillsUpdateStatus.Merged;
        EndedAt = now;
    }

    public void ChecksFailed(IEnumerable<string> checks, DateTimeOffset now)
    {
        Status = SkillsUpdateStatus.ChecksFailed;
        FailedChecks = string.Join(", ", checks);
        EndedAt = now;
    }
}

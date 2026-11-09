namespace Hewn.Domain;

/// <summary>A GitHub change made for a run, keyed so a retried request returns the first result instead of repeating it.</summary>
public sealed class GitHubMutation
{
    private GitHubMutation()
    {
        IdempotencyKey = Kind = Result = string.Empty;
    }

    public GitHubMutation(Guid runId, string idempotencyKey, string kind, string result, DateTimeOffset now)
    {
        RunId = runId;
        IdempotencyKey = idempotencyKey;
        Kind = kind;
        Result = result;
        CreatedAt = now;
    }

    public long Id { get; private set; }

    public Guid RunId { get; private set; }

    public string IdempotencyKey { get; private set; }

    public string Kind { get; private set; }

    public string Result { get; private set; }

    public DateTimeOffset CreatedAt { get; private set; }
}

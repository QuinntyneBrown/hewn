namespace Hewn.Application.Abstractions;

public sealed record GitHubRepositoryInfo(string Owner, string Name, bool IsPrivate, IReadOnlyList<string> Topics, int CommitCount);

public sealed record RepositoryFile(string Path, byte[] Content);

public sealed record PullRequestInfo(int Number, string Url, string Head, bool Merged);

/// <summary>A check on a pull request's head commit: status queued, in_progress or completed; conclusion once completed.</summary>
public sealed record CheckRunInfo(string Name, string Status, string? Conclusion);

/// <summary>A GitHub refusal or failure whose message is safe to show (it never carries a credential).</summary>
public sealed class GitHubException(string message) : Exception(message);

/// <summary>Repository operations the API performs for runs. Only the API holds GitHub credentials.</summary>
public interface IGitHubRepositories
{
    Task<GitHubRepositoryInfo?> FindAsync(string owner, string name, CancellationToken cancellationToken);

    /// <summary>Creates a private repository with an initial commit and the `hewn` topic.</summary>
    Task<GitHubRepositoryInfo> CreatePrivateAsync(string owner, string name, string description, CancellationToken cancellationToken);

    /// <summary>Names of the directories directly under <paramref name="path"/> on the default branch; empty when the path is absent.</summary>
    Task<IReadOnlyList<string>> ListDirectoriesAsync(string owner, string name, string path, CancellationToken cancellationToken);

    /// <summary>The default branch as a gzipped tarball with one top-level folder, as GitHub serves it.</summary>
    Task<Stream> DownloadArchiveAsync(string owner, string name, CancellationToken cancellationToken);

    /// <summary>Commits the files to the default branch and returns the new commit SHA.</summary>
    Task<string> CommitAsync(string owner, string name, string message, IReadOnlyList<RepositoryFile> files, CancellationToken cancellationToken);

    /// <summary>Commits to <paramref name="branch"/>, creating it from the default branch when it doesn't exist.</summary>
    Task<string> CommitToBranchAsync(string owner, string name, string branch, string message, IReadOnlyList<RepositoryFile> files, CancellationToken cancellationToken);

    /// <summary>Opens a pull request from <paramref name="head"/> into the default branch.</summary>
    Task<PullRequestInfo> OpenPullRequestAsync(string owner, string name, string head, string title, string body, CancellationToken cancellationToken);

    Task<PullRequestInfo?> GetPullRequestAsync(string owner, string name, int number, CancellationToken cancellationToken);

    Task<IReadOnlyList<CheckRunInfo>> ListChecksAsync(string owner, string name, int number, CancellationToken cancellationToken);

    /// <summary>Squash-merges the pull request and returns the merge commit SHA.</summary>
    Task<string> MergePullRequestAsync(string owner, string name, int number, string title, CancellationToken cancellationToken);

    /// <summary>Requires the named checks to pass before anything merges into the default branch.</summary>
    Task ProtectDefaultBranchAsync(string owner, string name, IReadOnlyList<string> checks, CancellationToken cancellationToken);
}

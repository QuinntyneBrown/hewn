namespace Hewn.Application.Abstractions;

public sealed record GitHubRepositoryInfo(string Owner, string Name, bool IsPrivate, IReadOnlyList<string> Topics, int CommitCount);

public sealed record RepositoryFile(string Path, byte[] Content);

public sealed record PullRequestInfo(int Number, string Url, string Head, bool Merged, string Title);

/// <summary>A check on a pull request's head commit: status queued, in_progress or completed; conclusion once completed.</summary>
public sealed record CheckRunInfo(string Name, string Status, string? Conclusion);

/// <summary>A GitHub refusal or failure whose message is safe to show (it never carries a credential).</summary>
public class GitHubException(string message) : Exception(message);

/// <summary>The default branch moved since the pull request's branch was made; rebase before merging (L2-025 AC2).</summary>
public sealed class GitHubBranchBehindException(string message) : GitHubException(message);

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

    /// <summary>
    /// Commits to <paramref name="branch"/>, creating it from the default branch when it doesn't exist. With
    /// <paramref name="rebase"/>, the commit's parent is the default branch's head and the branch is moved to it,
    /// so the files given must be every file the branch changes.
    /// </summary>
    Task<string> CommitToBranchAsync(string owner, string name, string branch, string message, IReadOnlyList<RepositoryFile> files, bool rebase, CancellationToken cancellationToken);

    /// <summary>Deletes the branch; a branch already gone is not an error.</summary>
    Task DeleteBranchAsync(string owner, string name, string branch, CancellationToken cancellationToken);

    /// <summary>Opens a pull request from <paramref name="head"/> into the default branch.</summary>
    Task<PullRequestInfo> OpenPullRequestAsync(string owner, string name, string head, string title, string body, CancellationToken cancellationToken);

    Task<PullRequestInfo?> GetPullRequestAsync(string owner, string name, int number, CancellationToken cancellationToken);

    /// <summary>Adds a label to a pull request, leaving it open (L2-029 AC3).</summary>
    Task AddLabelAsync(string owner, string name, int number, string label, CancellationToken cancellationToken);

    Task<IReadOnlyList<CheckRunInfo>> ListChecksAsync(string owner, string name, int number, CancellationToken cancellationToken);

    /// <summary>Squash-merges the pull request and returns the merge commit SHA; throws <see cref="GitHubBranchBehindException"/> when its branch is behind.</summary>
    Task<string> MergePullRequestAsync(string owner, string name, int number, string title, CancellationToken cancellationToken);

    /// <summary>Requires the named checks to pass before anything merges into the default branch.</summary>
    Task ProtectDefaultBranchAsync(string owner, string name, IReadOnlyList<string> checks, CancellationToken cancellationToken);
}

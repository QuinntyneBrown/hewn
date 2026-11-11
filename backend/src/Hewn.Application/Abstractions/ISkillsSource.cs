namespace Hewn.Application.Abstractions;

/// <summary>A Greenlit commit: its full SHA and the first line of its message.</summary>
public sealed record SkillsCommit(string Sha, string Message);

/// <summary>Greenlit couldn't be fetched or read. The message never carries the source URL or git's output.</summary>
public sealed class SkillsSourceException(string message) : Exception(message);

/// <summary>The Greenlit skill library (HEWN_SKILLS_SOURCE), read at its default branch (L2-008).</summary>
public interface ISkillsSource
{
    /// <summary>The default branch's head SHA, fetching it again when the last fetch is stale.</summary>
    Task<string> HeadAsync(CancellationToken cancellationToken);

    /// <summary>Commits on the default branch after <paramref name="sha"/>, newest first; empty when it is unknown.</summary>
    Task<IReadOnlyList<SkillsCommit>> CommitsSinceAsync(string sha, CancellationToken cancellationToken);

    /// <summary>Every file under <c>.claude/skills/</c> and <c>.agents/skills/</c> at <paramref name="sha"/>.</summary>
    Task<IReadOnlyList<RepositoryFile>> SkillFilesAsync(string sha, CancellationToken cancellationToken);
}

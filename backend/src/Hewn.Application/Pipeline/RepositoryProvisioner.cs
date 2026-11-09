using System.Text.RegularExpressions;
using Hewn.Application.Abstractions;
using Hewn.Domain;
using Microsoft.Extensions.Options;

namespace Hewn.Application.Pipeline;

/// <summary>
/// Before a product direction's first stage 0 runs, creates {owner}/{kebab-name} as a private repository and
/// records it on the project (L2-036 AC1). Idempotent: a fresh repository with the `hewn` topic, left by an
/// attempt that crashed before recording it, is adopted; any other repository with that name fails the run.
/// </summary>
public sealed partial class RepositoryProvisioner(IGitHubRepositories gitHub, IOptions<PipelineOptions> options)
{
    public const string Topic = "hewn";

    public static string FormatName(string projectName) =>
        NonAlphanumeric().Replace(projectName.ToLowerInvariant(), "-").Trim('-');

    /// <summary>Returns true when it attached a repository; throws GitHubException with a safe message when it cannot.</summary>
    public async Task<bool> EnsureRepositoryAsync(Project project, CancellationToken cancellationToken)
    {
        if (project.Repository is not null)
        {
            return false;
        }

        var owner = options.Value.GitHubOwner;
        if (string.IsNullOrWhiteSpace(owner))
        {
            throw new GitHubException("HEWN_GITHUB_OWNER is not configured, so Hewn has nowhere to create the repository.");
        }

        var name = FormatName(project.Name);
        var existing = await gitHub.FindAsync(owner, name, cancellationToken);
        if (existing is null)
        {
            await gitHub.CreatePrivateAsync(owner, name, Describe(project.Idea), cancellationToken);
        }
        else if (!existing.Topics.Contains(Topic) || existing.CommitCount > 1)
        {
            throw new GitHubException($"{owner}/{name} already exists and was not created by Hewn.");
        }

        project.AttachRepository(owner, name);
        return true;
    }

    private static string Describe(string idea)
    {
        var firstLine = idea.Split('\n', 2)[0].Trim();
        return firstLine.Length <= 300 ? firstLine : firstLine[..297] + "...";
    }

    [GeneratedRegex("[^a-z0-9]+")]
    private static partial Regex NonAlphanumeric();
}

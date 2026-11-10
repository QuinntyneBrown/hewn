using Hewn.Application.Abstractions;
using Hewn.Application.Events;
using Hewn.Domain;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Logging;

namespace Hewn.Application.Skills;

/// <summary>
/// L2-008 AC2 with L2-025: merges each open skills update once every check on its pull request has passed. A default
/// branch that moved is rebased (the checks then run again); a failed check leaves the pull request open and unmerged,
/// and the update is offered again.
/// </summary>
public sealed class SkillsUpdateMerger(
    IAppDbContext db,
    IGitHubRepositories gitHub,
    ISkillsSource skills,
    EventAppender events,
    TimeProvider clock,
    ILogger<SkillsUpdateMerger> logger)
{
    /// <summary>Checks every open update once; returns how many it merged.</summary>
    public async Task<int> SweepAsync(CancellationToken cancellationToken)
    {
        var open = await db.SkillsUpdates.Where(u => u.Status == SkillsUpdateStatus.Open).ToListAsync(cancellationToken);
        var merged = 0;
        foreach (var update in open)
        {
            try
            {
                merged += await SweepAsync(update, cancellationToken) ? 1 : 0;
            }
            catch (Exception e) when (e is GitHubException or SkillsSourceException)
            {
                logger.LogWarning("Skills update #{Number} for project {Project} waits: {Reason}", update.PullRequestNumber, update.ProjectId, e.Message);
            }
        }

        return merged;
    }

    private async Task<bool> SweepAsync(SkillsUpdate update, CancellationToken cancellationToken)
    {
        var project = await db.Projects.AsNoTracking().SingleAsync(p => p.Id == update.ProjectId, cancellationToken);
        var (owner, name) = (project.RepositoryOwner!, project.RepositoryName!);
        var checks = await gitHub.ListChecksAsync(owner, name, update.PullRequestNumber, cancellationToken);
        if (checks.Count == 0 || checks.Any(c => c.Status != "completed"))
        {
            return false;
        }

        var failed = checks.Where(c => c.Conclusion is not ("success" or "skipped" or "neutral")).Select(c => c.Name).ToList();
        if (failed.Count > 0)
        {
            update.ChecksFailed(failed, clock.GetUtcNow());
            await events.AppendAsync(project.Id, "SkillsUpdateChecksFailed", new { number = update.PullRequestNumber, checks = failed }, cancellationToken);
            await db.SaveChangesAsync(cancellationToken);
            await events.PublishAsync(cancellationToken);
            return false;
        }

        try
        {
            await gitHub.MergePullRequestAsync(owner, name, update.PullRequestNumber, $"Update skills to greenlit@{update.ToSha[..7]}", cancellationToken);
        }
        catch (GitHubBranchBehindException)
        {
            // The default branch moved: put the same files on top of it; the checks run again before the next try.
            var locked = SkillsLock.Parse((await gitHub.ReadFileAsync(owner, name, SkillsLock.Path, null, cancellationToken))?.Content)
                ?? new SkillsLock(string.Empty, update.FromSha, []);
            var files = await SkillsUpdateFiles.BuildAsync(gitHub, skills, owner, name, locked, update.ToSha, cancellationToken);
            await gitHub.CommitToBranchAsync(owner, name, update.Branch, $"Update skills to greenlit@{update.ToSha[..7]}", files, rebase: true, cancellationToken);
            return false;
        }

        update.Merged(clock.GetUtcNow());
        await events.AppendAsync(project.Id, "SkillsUpdateMerged", new { number = update.PullRequestNumber, toSha = update.ToSha }, cancellationToken);
        await db.SaveChangesAsync(cancellationToken);
        await events.PublishAsync(cancellationToken);
        return true;
    }
}

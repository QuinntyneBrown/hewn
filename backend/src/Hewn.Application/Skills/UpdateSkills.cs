using System.Text;
using Hewn.Application.Abstractions;
using Hewn.Application.Common;
using Hewn.Application.Events;
using Hewn.Domain;
using MediatR;
using Microsoft.EntityFrameworkCore;

namespace Hewn.Application.Skills;

public sealed record UpdateSkillsCommand(Guid ProjectId) : IRequest<UpdateSkillsResult>;

public sealed record UpdateSkillsResult(SkillsUpdatePullRequestDto PullRequest);

/// <summary>
/// L2-008 AC2: opens a pull request on <c>hewn/update-skills-{short-sha}</c> that writes Greenlit's skill files at its
/// head and the new <c>.hewn/skills.lock</c>. Skill folders the project kept at bootstrap stay its own; skills new in
/// Greenlit are added. <c>SkillsUpdateMerger</c> merges it when its checks pass. While one is open, asking again
/// returns it.
/// </summary>
public sealed class UpdateSkillsHandler(
    IAppDbContext db,
    IGitHubRepositories gitHub,
    ISkillsSource skills,
    EventAppender events,
    ICurrentUser user,
    TimeProvider clock) : IRequestHandler<UpdateSkillsCommand, UpdateSkillsResult>
{
    private static readonly string[] Roots = [".claude/skills", ".agents/skills"];

    public async Task<UpdateSkillsResult> Handle(UpdateSkillsCommand command, CancellationToken cancellationToken)
    {
        var project = await db.Projects.AsNoTracking().SingleOrDefaultAsync(p => p.Id == command.ProjectId, cancellationToken)
            ?? throw new NotFoundException();
        if (project.RepositoryOwner is not { } owner || project.RepositoryName is not { } name)
        {
            throw new ConflictException("no_skills_lock", "Stage 0 hasn’t written .hewn/skills.lock yet.");
        }

        var open = await db.SkillsUpdates.AsNoTracking()
            .SingleOrDefaultAsync(u => u.ProjectId == project.Id && u.Status == SkillsUpdateStatus.Open, cancellationToken);
        if (open is not null)
        {
            return new UpdateSkillsResult(new SkillsUpdatePullRequestDto(open.PullRequestNumber, open.PullRequestUrl));
        }

        var locked = SkillsLock.Parse((await gitHub.ReadFileAsync(owner, name, SkillsLock.Path, null, cancellationToken))?.Content)
            ?? throw new ConflictException("no_skills_lock", "Stage 0 hasn’t written .hewn/skills.lock yet.");
        var head = await skills.HeadAsync(cancellationToken);
        var commits = await skills.CommitsSinceAsync(locked.Sha, cancellationToken);
        if (commits.Count == 0)
        {
            throw new ConflictException("skills_up_to_date", "The skills are already at Greenlit’s head.");
        }

        // Folders the repository had that the lock doesn't list were kept at bootstrap (L2-007 AC3): leave them alone.
        var existing = new HashSet<string>(StringComparer.Ordinal);
        foreach (var root in Roots)
        {
            existing.UnionWith(await gitHub.ListDirectoriesAsync(owner, name, root, cancellationToken));
        }

        var kept = existing.Except(locked.Skills).ToHashSet(StringComparer.Ordinal);
        var files = (await skills.SkillFilesAsync(head, cancellationToken)).Where(f => !kept.Contains(SkillName(f.Path))).ToList();
        var lockFile = new SkillsLock(locked.Source, head, [.. files.Select(f => SkillName(f.Path)).Distinct().Order(StringComparer.Ordinal)]);
        files.Add(new RepositoryFile(SkillsLock.Path, lockFile.ToBytes()));

        var shortSha = head[..7];
        var branch = $"hewn/update-skills-{shortSha}";
        var title = $"Update skills to greenlit@{shortSha}";
        await gitHub.CommitToBranchAsync(owner, name, branch, title, files, rebase: false, cancellationToken);
        var pull = await gitHub.OpenPullRequestAsync(owner, name, branch, title, Body(locked.Sha, head, commits), cancellationToken);

        var update = new SkillsUpdate(project.Id, locked.Sha, head, branch, pull.Number, pull.Url, user.Login, clock.GetUtcNow());
        db.SkillsUpdates.Add(update);
        await events.AppendAsync(project.Id, "SkillsUpdateOpened", new { number = pull.Number, url = pull.Url, toSha = head }, cancellationToken);
        await db.SaveChangesAsync(cancellationToken);
        await events.PublishAsync(cancellationToken);
        return new UpdateSkillsResult(new SkillsUpdatePullRequestDto(pull.Number, pull.Url));
    }

    /// <summary>The skill a file under <c>.claude/skills/</c> or <c>.agents/skills/</c> belongs to.</summary>
    private static string SkillName(string path) => path.Split('/')[2];

    private static string Body(string from, string to, IReadOnlyList<SkillsCommit> commits)
    {
        var body = new StringBuilder()
            .AppendLine($"Updates the skill files and `.hewn/skills.lock` from Greenlit {from[..7]} to {to[..7]} ({commits.Count} commits). It merges automatically when checks pass.")
            .AppendLine();
        foreach (var commit in commits)
        {
            body.AppendLine($"- {commit.Sha[..7]} {commit.Message}");
        }

        return body.ToString();
    }
}

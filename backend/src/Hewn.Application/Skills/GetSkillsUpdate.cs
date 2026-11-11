using Hewn.Application.Abstractions;
using Hewn.Application.Common;
using MediatR;
using Microsoft.EntityFrameworkCore;

namespace Hewn.Application.Skills;

public sealed record GetSkillsUpdateQuery(Guid ProjectId) : IRequest<SkillsUpdateDto>;

/// <param name="Available">Commits on Greenlit's default branch after the locked SHA; 0 with no lock.</param>
/// <param name="LockedSha">The SHA in <c>.hewn/skills.lock</c>, or null before stage 0 wrote one.</param>
/// <param name="HeadSha">Greenlit's default branch head, or null with no lock.</param>
/// <param name="Commits">The commits after the locked SHA, newest first.</param>
/// <param name="PullRequest">The open skills update, if one is waiting for its checks.</param>
public sealed record SkillsUpdateDto(int Available, string? LockedSha, string? HeadSha, IReadOnlyList<SkillsCommit> Commits, SkillsUpdatePullRequestDto? PullRequest);

public sealed record SkillsUpdatePullRequestDto(int Number, string Url);

/// <summary>L2-008 AC1: how far Greenlit's default branch is ahead of the project's locked SHA, and the commits.</summary>
public sealed class GetSkillsUpdateHandler(IAppDbContext db, IGitHubRepositories gitHub, ISkillsSource skills)
    : IRequestHandler<GetSkillsUpdateQuery, SkillsUpdateDto>
{
    private static readonly SkillsUpdateDto None = new(0, null, null, [], null);

    public async Task<SkillsUpdateDto> Handle(GetSkillsUpdateQuery query, CancellationToken cancellationToken)
    {
        var project = await db.Projects.AsNoTracking().SingleOrDefaultAsync(p => p.Id == query.ProjectId, cancellationToken)
            ?? throw new NotFoundException();
        if (project.RepositoryOwner is not { } owner || project.RepositoryName is not { } name)
        {
            return None;
        }

        var open = await db.SkillsUpdates.AsNoTracking()
            .Where(u => u.ProjectId == project.Id && u.Status == Domain.SkillsUpdateStatus.Open)
            .Select(u => new SkillsUpdatePullRequestDto(u.PullRequestNumber, u.PullRequestUrl))
            .SingleOrDefaultAsync(cancellationToken);
        var locked = SkillsLock.Parse((await gitHub.ReadFileAsync(owner, name, SkillsLock.Path, null, cancellationToken))?.Content);
        if (locked is null)
        {
            return None;
        }

        try
        {
            var head = await skills.HeadAsync(cancellationToken);
            var commits = await skills.CommitsSinceAsync(locked.Sha, cancellationToken);
            return new SkillsUpdateDto(commits.Count, locked.Sha, head, commits, open);
        }
        catch (SkillsSourceException)
        {
            // An unreachable Greenlit offers no update; the project page carries on without the link.
            return None with { LockedSha = locked.Sha, PullRequest = open };
        }
    }
}

using Hewn.Application.Abstractions;
using Hewn.Application.Common;
using Hewn.Application.Pipeline;
using Hewn.Domain;
using MediatR;
using Microsoft.EntityFrameworkCore;

namespace Hewn.Application.Increments;

/// <param name="Captions">The WebVTT captions instead of the MP4.</param>
public sealed record GetIncrementVideoQuery(Guid ProjectId, int Number, bool Captions) : IRequest<IncrementVideoFile>;

public sealed record IncrementVideoFile(byte[] Content, string ContentType, string Name);

public static class IncrementVideo
{
    public const string Recorded = "Recorded";
}

/// <summary>
/// L2-023 AC2: the increment's recorded video, or its captions, read from the product repository at the commit
/// stage 10 recorded it in (on the increment's branch, which GitHub keeps after the squash merge), so the increment
/// page can play it. The page and the PR body point at the same file.
/// </summary>
public sealed class GetIncrementVideoHandler(IAppDbContext db, IGitHubRepositories gitHub)
    : IRequestHandler<GetIncrementVideoQuery, IncrementVideoFile>
{
    public async Task<IncrementVideoFile> Handle(GetIncrementVideoQuery query, CancellationToken cancellationToken)
    {
        var project = await db.Projects.AsNoTracking()
            .Include(p => p.Directions)
            .SingleOrDefaultAsync(p => p.Id == query.ProjectId, cancellationToken)
            ?? throw new NotFoundException();
        var direction = project.ActiveDirection ?? project.Directions.OrderByDescending(d => d.SubmittedAt).FirstOrDefault()
            ?? throw new NotFoundException();
        var increment = await db.Increments.AsNoTracking()
            .SingleOrDefaultAsync(i => i.DirectionId == direction.Id && i.Number == query.Number, cancellationToken)
            ?? throw new NotFoundException();
        if (increment.Video != IncrementVideo.Recorded || increment.VideoNote is not { } folder
            || project.RepositoryOwner is not { } owner || project.RepositoryName is not { } name)
        {
            throw new NotFoundException("no_video", "This increment has no recorded video.");
        }

        // docs/videos/{slug}/ holds {slug}.mp4 and {slug}.vtt.
        var slug = folder.TrimEnd('/').Split('/')[^1];
        var path = $"{folder.TrimEnd('/')}/{slug}.{(query.Captions ? "vtt" : "mp4")}";

        var runs = await db.Runs.AsNoTracking()
            .Where(r => r.DirectionId == direction.Id && r.Stage == Stages.Count - 1)
            .Select(r => r.Id)
            .ToListAsync(cancellationToken);
        var commits = await db.GitHubMutations.AsNoTracking()
            .Where(m => runs.Contains(m.RunId) && m.Kind == "commit")
            .OrderByDescending(m => m.Id)
            .Select(m => m.Result)
            .ToListAsync(cancellationToken);
        var sha = commits.Select(CommitRecord.Read).FirstOrDefault(c => c.Paths.Contains(path))?.Sha
            ?? throw new NotFoundException("no_video", "No commit recorded this increment's video.");

        var file = await gitHub.ReadFileAsync(owner, name, path, sha, cancellationToken)
            ?? throw new GitHubException($"{path} couldn’t be read at {sha[..7]}");
        return new IncrementVideoFile(file.Content, query.Captions ? "text/vtt" : "video/mp4", Path.GetFileName(path));
    }
}

using System.Text.Json;
using Hewn.Application.Abstractions;
using Hewn.Application.Common;
using Hewn.Application.Pipeline;
using Hewn.Domain;
using MediatR;
using Microsoft.EntityFrameworkCore;

namespace Hewn.Application.Projects;

public sealed record GetArtifactsQuery(Guid ProjectId) : IRequest<ArtifactsDto>;

/// <summary>L2-034 AC2: each stage's artifacts, newest stage first, in the project's repository.</summary>
public sealed record ArtifactsDto(string? Repository, IReadOnlyList<StageArtifactsDto> Stages);

public sealed record StageArtifactsDto(int Stage, string Name, IReadOnlyList<VersionedArtifactDto> Artifacts);

/// <param name="Folder">A folder of the stage's output, such as <c>docs/mocks/statements/</c>, standing for the files under it.</param>
/// <param name="Sha">The version: the commit that holds the artifact (L2-034 AC1).</param>
/// <param name="Url">The file (blob) or folder (tree) on GitHub at that commit.</param>
public sealed record VersionedArtifactDto(string Path, bool Folder, string Sha, DateTimeOffset CommittedAt, string? Url);

/// <summary>
/// Reads the artifacts from the commits each stage's succeeded runs made to the default branch. A path's version is
/// the latest such commit that wrote it. Files in a subfolder of the stage's output folder fold into that subfolder.
/// </summary>
public sealed class GetArtifactsHandler(IAppDbContext db) : IRequestHandler<GetArtifactsQuery, ArtifactsDto>
{
    public async Task<ArtifactsDto> Handle(GetArtifactsQuery query, CancellationToken cancellationToken)
    {
        var repository = await db.Projects.Where(p => p.Id == query.ProjectId).Select(p => new { p.Repository }).SingleOrDefaultAsync(cancellationToken)
            ?? throw new NotFoundException();

        var runs = await db.Runs.AsNoTracking()
            .Where(r => r.ProjectId == query.ProjectId && r.Status == RunStatus.Succeeded)
            .Select(r => new { r.Id, r.Stage })
            .ToListAsync(cancellationToken);
        var stageOf = runs.ToDictionary(r => r.Id, r => r.Stage);
        var runIds = stageOf.Keys.ToList();
        var commits = await db.GitHubMutations.AsNoTracking()
            .Where(m => runIds.Contains(m.RunId) && m.Kind == "commit")
            .ToListAsync(cancellationToken);

        var stages = commits
            .Select(m => (Stage: stageOf[m.RunId], m.CreatedAt, Commit: CommitRecord.Read(m.Result)))
            .Where(c => c.Commit.Branch is null)
            .SelectMany(c => c.Commit.Paths
                .Where(path => path != CommitPolicy.DecisionLog)
                .Select(path => Fold(c.Stage, path))
                .Distinct()
                .Select(entry => (c.Stage, entry.Path, entry.Folder, c.Commit.Sha, c.CreatedAt)))
            .GroupBy(a => a.Stage)
            .OrderByDescending(g => g.Key)
            .Select(g => new StageArtifactsDto(
                g.Key,
                g.Key < Stages.Count ? Stages.Names[g.Key] : $"Stage {g.Key}",
                g.GroupBy(a => a.Path)
                    .Select(versions => versions.OrderByDescending(v => v.CreatedAt).First())
                    .OrderBy(a => a.Path, StringComparer.Ordinal)
                    .Select(a => new VersionedArtifactDto(a.Path, a.Folder, a.Sha, a.CreatedAt, Url(repository.Repository, a.Sha, a.Path, a.Folder)))
                    .ToList()))
            .ToList();
        return new ArtifactsDto(repository.Repository, stages);
    }

    /// <summary><c>docs/mocks/statements/default.html</c> folds into <c>docs/mocks/statements/</c>; <c>docs/mocks/manifest.json</c> stays.</summary>
    private static (string Path, bool Folder) Fold(int stage, string path)
    {
        foreach (var root in CommitPolicy.OutputFolders(stage))
        {
            if (path.StartsWith(root, StringComparison.Ordinal))
            {
                var slash = path.IndexOf('/', root.Length);
                if (slash > root.Length)
                {
                    return (path[..(slash + 1)], true);
                }
            }
        }

        return (path, false);
    }

    private static string? Url(string? repository, string sha, string path, bool folder) =>
        repository is null ? null : $"https://github.com/{repository}/{(folder ? "tree" : "blob")}/{sha}/{path}";
}

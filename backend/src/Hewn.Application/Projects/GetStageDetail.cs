using System.Text.Json;
using Hewn.Application.Abstractions;
using Hewn.Application.Common;
using Hewn.Domain;
using MediatR;
using Microsoft.EntityFrameworkCore;

namespace Hewn.Application.Projects;

public sealed record GetStageDetailQuery(Guid ProjectId, Guid DirectionId, int Stage) : IRequest<StageDetailDto>;

/// <summary>A run of a stage. Status is the run's own: Queued, Running, Succeeded, Failed or Cancelled.</summary>
public sealed record RunDto(Guid Id, string Status, string? Worker, DateTimeOffset? StartedAt, DateTimeOffset? EndedAt, string? Error);

/// <summary>A file a run of the stage committed, with the commit that holds it.</summary>
public sealed record ArtifactDto(string Path, string Sha, DateTimeOffset CommittedAt);

public sealed record DecisionDto(Guid RunId, string Question, string Answer, string Rationale, DateTimeOffset RecordedAt);

public sealed record StageDetailDto(
    int Stage,
    string? Repository,
    IReadOnlyList<RunDto> Runs,
    IReadOnlyList<ArtifactDto> Artifacts,
    IReadOnlyList<DecisionDto> Decisions);

/// <summary>L2-030 AC3: a selected stage's runs (newest first), the files they committed and the decisions they recorded.</summary>
public sealed class GetStageDetailHandler(IAppDbContext db) : IRequestHandler<GetStageDetailQuery, StageDetailDto>
{
    public async Task<StageDetailDto> Handle(GetStageDetailQuery query, CancellationToken cancellationToken)
    {
        var direction = await db.Directions.AsNoTracking()
            .SingleOrDefaultAsync(d => d.Id == query.DirectionId && d.ProjectId == query.ProjectId, cancellationToken);
        if (direction is null || direction.Stages.All(s => s.Number != query.Stage))
        {
            throw new NotFoundException();
        }

        var repository = await db.Projects.Where(p => p.Id == query.ProjectId).Select(p => p.Repository).SingleAsync(cancellationToken);
        var runs = await db.Runs.AsNoTracking()
            .Where(r => r.DirectionId == direction.Id && r.Stage == query.Stage)
            .ToListAsync(cancellationToken);
        runs = runs.OrderByDescending(r => r.CreatedAt).ToList();
        var workerIds = runs.Select(r => r.RanBy).OfType<string>().Distinct().ToList();
        var workers = await db.Workers.AsNoTracking()
            .Where(w => workerIds.Contains(w.Id))
            .ToDictionaryAsync(w => w.Id, w => w.Name, cancellationToken);

        var runIds = runs.Select(r => r.Id).ToList();
        var commits = await db.GitHubMutations.AsNoTracking()
            .Where(m => runIds.Contains(m.RunId) && m.Kind == "commit")
            .ToListAsync(cancellationToken);
        var artifacts = commits
            .OrderBy(m => m.CreatedAt)
            .SelectMany(m => Paths(m.Result).Select(path => new ArtifactDto(path, Sha(m.Result), m.CreatedAt)))
            .ToList();

        var decisions = await db.RunDecisions.AsNoTracking()
            .Where(d => d.DirectionId == direction.Id && d.Stage == query.Stage)
            .ToListAsync(cancellationToken);

        return new StageDetailDto(
            query.Stage,
            repository,
            runs.Select(r => new RunDto(r.Id, RunStatusLabel(r.Status), r.RanBy is null ? null : workers.GetValueOrDefault(r.RanBy, r.RanBy), r.StartedAt, r.EndedAt, r.Error)).ToList(),
            artifacts,
            decisions.OrderBy(d => d.RecordedAt).ThenBy(d => d.Id)
                .Select(d => new DecisionDto(d.RunId, d.Question, d.Answer, d.Rationale, d.RecordedAt))
                .ToList());
    }

    /// <summary>A leased run is shown as Running, the word the rest of Mission Control uses.</summary>
    public static string RunStatusLabel(RunStatus status) => status == RunStatus.Leased ? "Running" : status.ToString();

    private static string Sha(string result) => JsonDocument.Parse(result).RootElement.GetProperty("sha").GetString()!;

    /// <summary>Commits recorded before paths were kept list none.</summary>
    private static IEnumerable<string> Paths(string result) =>
        JsonDocument.Parse(result).RootElement.TryGetProperty("paths", out var paths)
            ? paths.EnumerateArray().Select(p => p.GetString()!).ToList()
            : [];
}

public sealed record GetRunLogQuery(Guid ProjectId, Guid RunId, long After, int Limit) : IRequest<IReadOnlyList<LogLineDto>>;

public sealed record LogLineDto(long Line, DateTimeOffset At, string Level, string Text);

/// <summary>L2-033: a run's log after a line number, in pages, for opening a log and catching up.</summary>
public sealed class GetRunLogHandler(IAppDbContext db) : IRequestHandler<GetRunLogQuery, IReadOnlyList<LogLineDto>>
{
    public const int MaxPage = 5000;

    public async Task<IReadOnlyList<LogLineDto>> Handle(GetRunLogQuery query, CancellationToken cancellationToken)
    {
        if (!await db.Runs.AnyAsync(r => r.Id == query.RunId && r.ProjectId == query.ProjectId, cancellationToken))
        {
            throw new NotFoundException();
        }

        var limit = Math.Clamp(query.Limit, 1, MaxPage);
        var lines = await db.RunLogLines.AsNoTracking()
            .Where(l => l.RunId == query.RunId && l.Sequence > query.After)
            .OrderBy(l => l.Sequence)
            .Take(limit)
            .ToListAsync(cancellationToken);
        return lines.Select(l => new LogLineDto(l.Sequence, l.At, l.Level, l.Text)).ToList();
    }
}

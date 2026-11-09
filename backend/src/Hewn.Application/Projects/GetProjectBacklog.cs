using Hewn.Application.Abstractions;
using Hewn.Application.Common;
using Hewn.Domain;
using MediatR;
using Microsoft.EntityFrameworkCore;

namespace Hewn.Application.Projects;

public sealed record GetProjectBacklogQuery(Guid ProjectId) : IRequest<BacklogDto>;

/// <summary>The current direction's backlog for the Backlog page (L2-020 AC2, L2-019 AC4, L2-018, L2-025 AC4).</summary>
/// <param name="Merged">Increments merged so far, of <paramref name="Total"/>.</param>
/// <param name="MergedDays">Ideal days of merged increments, of <paramref name="TotalDays"/>, the backlog's overall estimate.</param>
/// <param name="PercentComplete">The project's percent complete, as Projects shows it; it moves with every merge.</param>
public sealed record BacklogDto(
    Guid? DirectionId,
    IReadOnlyList<BacklogIncrementDto> Increments,
    IReadOnlyList<DeferredDesignDto> Deferred,
    int Merged,
    int Total,
    decimal MergedDays,
    decimal TotalDays,
    int PercentComplete);

/// <param name="FailingTests">What still fails on a Blocked increment, as the test gate reported it.</param>
/// <param name="PullRequestUrl">The increment's pull request once one exists and the project has a repository.</param>
public sealed record BacklogIncrementDto(
    int Number,
    string Title,
    int? Journey,
    IReadOnlyList<string> L2Ids,
    decimal EstimateDays,
    IReadOnlyList<int> DependsOn,
    string Status,
    int Iterations,
    IReadOnlyList<string> FailingTests,
    int? PullRequestNumber,
    string? PullRequestUrl);

public sealed record DeferredDesignDto(string Title, IReadOnlyList<string> L2Ids, decimal EstimateDays, string Reason);

public sealed class GetProjectBacklogHandler(IAppDbContext db, ProjectSummaryReader summaries) : IRequestHandler<GetProjectBacklogQuery, BacklogDto>
{
    public async Task<BacklogDto> Handle(GetProjectBacklogQuery query, CancellationToken cancellationToken)
    {
        var project = await db.Projects.AsNoTracking()
            .Include(p => p.Directions)
            .SingleOrDefaultAsync(p => p.Id == query.ProjectId, cancellationToken)
            ?? throw new NotFoundException();
        var summary = (await summaries.ReadAsync(project.Id, cancellationToken)).Single();

        // The direction Projects describes: the active one, else the latest.
        var direction = project.ActiveDirection ?? project.Directions.OrderByDescending(d => d.SubmittedAt).FirstOrDefault();
        var rows = direction is null
            ? []
            : await db.Increments.AsNoTracking().Where(i => i.DirectionId == direction.Id).ToListAsync(cancellationToken);

        var increments = rows
            .Where(i => i.Number != null)
            .OrderBy(i => i.Number)
            .Select(i => new BacklogIncrementDto(
                i.Number!.Value,
                i.Title,
                i.Journey,
                Split(i.L2Ids, ','),
                i.EstimateDays,
                Split(i.DependsOn, ',').Select(int.Parse).ToList(),
                i.Status.ToString(),
                i.Iterations,
                Split(i.FailingTests, '\n'),
                i.PullRequestNumber,
                i.PullRequestNumber is { } n && project.Repository is { } repository ? $"https://github.com/{repository}/pull/{n}" : null))
            .ToList();
        var deferred = rows
            .Where(i => i.Number == null)
            .OrderBy(i => i.Title, StringComparer.OrdinalIgnoreCase)
            .Select(i => new DeferredDesignDto(i.Title, Split(i.L2Ids, ','), i.EstimateDays, i.Reason ?? string.Empty))
            .ToList();
        var merged = increments.Where(i => i.Status == nameof(IncrementStatus.Merged)).ToList();

        return new BacklogDto(
            direction?.Id,
            increments,
            deferred,
            merged.Count,
            increments.Count,
            merged.Sum(i => i.EstimateDays),
            increments.Sum(i => i.EstimateDays),
            summary.PercentComplete);
    }

    private static List<string> Split(string? value, char separator) =>
        string.IsNullOrEmpty(value) ? [] : [.. value.Split(separator, StringSplitOptions.RemoveEmptyEntries | StringSplitOptions.TrimEntries)];
}

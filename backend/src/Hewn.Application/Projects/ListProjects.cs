using Hewn.Application.Abstractions;
using Hewn.Application.Pipeline;
using Hewn.Domain;
using MediatR;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Options;

namespace Hewn.Application.Projects;

public sealed record ListProjectsQuery : IRequest<IReadOnlyList<ProjectSummaryDto>>;

/// <summary>One project's row on the Projects page (L2-002).</summary>
/// <param name="Idea">The product's idea, or "Feature: …" while a feature direction is the project's current one.</param>
/// <param name="Stage">The current direction's current stage: the first not yet Succeeded or Skipped, else its last.</param>
/// <param name="Note">What the stage is doing (its step), why it stopped (paused, failed), or null.</param>
/// <param name="PercentComplete">Finished stages of the current direction's planned stages, with stage 10's merged increments as a fraction.</param>
/// <param name="SpendUsd">Spend to date across every direction.</param>
/// <param name="LastActivityAt">When the project's latest event was stored.</param>
/// <param name="FirstDirectionComplete">A feature for a project whose first direction isn't Complete queues behind it.</param>
public sealed record ProjectSummaryDto(
    Guid Id,
    string Name,
    string Idea,
    string? Repository,
    string Status,
    StageRefDto Stage,
    string? Note,
    int PercentComplete,
    decimal SpendUsd,
    DateTimeOffset LastActivityAt,
    bool FirstDirectionComplete);

public sealed record StageRefDto(int Number, string Name);

public sealed class ListProjectsHandler(ProjectSummaryReader reader) : IRequestHandler<ListProjectsQuery, IReadOnlyList<ProjectSummaryDto>>
{
    public async Task<IReadOnlyList<ProjectSummaryDto>> Handle(ListProjectsQuery query, CancellationToken cancellationToken) =>
        (await reader.ReadAsync(null, cancellationToken))
            .OrderByDescending(p => p.LastActivityAt)
            .ThenBy(p => p.Name, StringComparer.OrdinalIgnoreCase)
            .ToList();
}

/// <summary>
/// Builds project rows from the projects, their directions, leased runs, increments and the latest event, read on
/// request rather than kept in a separate table (ADR 0016). Used for the list and for each live row update.
/// </summary>
public sealed class ProjectSummaryReader(IAppDbContext db, IOptions<PipelineOptions> options)
{
    public async Task<IReadOnlyList<ProjectSummaryDto>> ReadAsync(Guid? projectId, CancellationToken cancellationToken)
    {
        var projects = await db.Projects.AsNoTracking()
            .Include(p => p.Directions)
            .Where(p => projectId == null || p.Id == projectId)
            .ToListAsync(cancellationToken);
        if (projects.Count == 0)
        {
            return [];
        }

        var ids = projects.Select(p => p.Id).ToList();
        var lastSequences = await db.Events.AsNoTracking()
            .Where(e => ids.Contains(e.ProjectId))
            .GroupBy(e => e.ProjectId)
            .Select(g => g.Max(e => e.Id))
            .ToListAsync(cancellationToken);
        var lastActivity = (await db.Events.AsNoTracking()
                .Where(e => lastSequences.Contains(e.Id))
                .Select(e => new { e.ProjectId, e.OccurredAt })
                .ToListAsync(cancellationToken))
            .ToDictionary(e => e.ProjectId, e => e.OccurredAt);
        var steps = (await db.Runs.AsNoTracking()
                .Where(r => ids.Contains(r.ProjectId) && r.Status == RunStatus.Leased)
                .Select(r => new { r.DirectionId, r.Stage, r.CurrentStepName })
                .ToListAsync(cancellationToken))
            .GroupBy(r => (r.DirectionId, r.Stage))
            .ToDictionary(g => g.Key, g => g.First().CurrentStepName);
        var directionIds = projects.SelectMany(p => p.Directions).Select(d => d.Id).ToList();
        var increments = (await db.Increments.AsNoTracking()
                .Where(i => directionIds.Contains(i.DirectionId) && i.Status != IncrementStatus.Deferred)
                .Select(i => new { i.DirectionId, i.Status })
                .ToListAsync(cancellationToken))
            .GroupBy(i => i.DirectionId)
            .ToDictionary(g => g.Key, g => (Merged: g.Count(i => i.Status == IncrementStatus.Merged), Total: g.Count()));

        return projects.Select(p => Summarize(p, lastActivity, steps, increments)).ToList();
    }

    private ProjectSummaryDto Summarize(
        Project project,
        Dictionary<Guid, DateTimeOffset> lastActivity,
        Dictionary<(Guid, int), string?> steps,
        Dictionary<Guid, (int Merged, int Total)> increments)
    {
        // The active direction, else the latest one: the one the row describes.
        var direction = project.ActiveDirection ?? project.Directions.OrderByDescending(d => d.SubmittedAt).First();
        var planned = direction.Stages.Where(s => s.Status != StageStatus.Skipped).OrderBy(s => s.Number).ToList();
        var stage = planned.FirstOrDefault(s => s.Status != StageStatus.Succeeded) ?? planned[^1];
        var (merged, total) = increments.GetValueOrDefault(direction.Id);

        var done = (double)planned.Count(s => s.Status == StageStatus.Succeeded);
        if (stage.Number == Stages.Count - 1 && stage.Status != StageStatus.Succeeded && total > 0)
        {
            done += (double)merged / total;
        }

        var percent = direction.Status == DirectionStatus.Complete ? 100 : (int)Math.Floor(100 * done / planned.Count);

        return new ProjectSummaryDto(
            project.Id,
            project.Name,
            direction.Kind == DirectionKind.Feature ? $"Feature: {direction.Idea}" : project.Idea,
            project.RepositoryOwner is null ? null : $"{project.RepositoryOwner}/{project.RepositoryName}",
            project.Status.ToString(),
            new StageRefDto(stage.Number, stage.Name),
            Note(direction, stage, steps.GetValueOrDefault((direction.Id, stage.Number)), merged, total),
            percent,
            project.Directions.Sum(d => d.SpendUsd),
            lastActivity.TryGetValue(project.Id, out var at) ? at : project.CreatedAt,
            project.FirstDirectionComplete);
    }

    private string? Note(Direction direction, StageState stage, string? step, int merged, int total)
    {
        switch (direction.Status)
        {
            case DirectionStatus.Blocked:
                return $"{Stages.Names[direction.FailedStage ?? stage.Number]} failed after {options.Value.RetryBackoffSeconds.Count} retries";
            case DirectionStatus.Paused:
                return direction.PauseReason;
            case DirectionStatus.Running:
                var increment = stage.Number == Stages.Count - 1 && total > 0 ? $"Increment {Math.Min(merged + 1, total)} of {total}" : null;
                return increment is null ? step : step is null ? increment : $"{increment} · {step}";
            default:
                return null;
        }
    }
}

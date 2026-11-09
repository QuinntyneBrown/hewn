using Hewn.Application.Abstractions;
using Hewn.Application.Common;
using Hewn.Domain;
using MediatR;
using Microsoft.EntityFrameworkCore;

namespace Hewn.Application.Projects;

public sealed record GetProjectQuery(Guid ProjectId) : IRequest<ProjectDto>;

/// <summary>A stage of a direction. While it runs, Step and LatestLine come from its leased run (L2-030 AC2).</summary>
public sealed record StageDto(
    int Number,
    string Name,
    string Status,
    DateTimeOffset? StartedAt,
    DateTimeOffset? EndedAt,
    string? Step = null,
    string? LatestLine = null,
    Guid? RunId = null);

public sealed record DirectionDto(
    Guid Id,
    string Kind,
    string Status,
    string Idea,
    decimal BudgetUsd,
    string SubmittedBy,
    DateTimeOffset SubmittedAt,
    DateTimeOffset? CompletedAt,
    IReadOnlyList<StageDto> Stages,
    bool? HasUiChange,
    string? UiDecision,
    decimal SpendUsd,
    bool BudgetWarned,
    string? PauseReason,
    bool PauseRequested,
    string? PausedBy,
    DateTimeOffset? PausedAt,
    string? CancelledBy,
    DateTimeOffset? CancelledAt,
    int? StoppedWithinSeconds,
    IReadOnlyList<int> LabelledPullRequests);

public sealed record ProjectDto(
    Guid Id,
    string Name,
    string Idea,
    string? StackPreference,
    string? Repository,
    string Status,
    DateTimeOffset CreatedAt,
    long LastSequence,
    IReadOnlyList<DirectionDto> Directions,
    decimal SpendUsd);

public sealed class GetProjectHandler(IAppDbContext db) : IRequestHandler<GetProjectQuery, ProjectDto>
{
    public async Task<ProjectDto> Handle(GetProjectQuery query, CancellationToken cancellationToken)
    {
        var project = await db.Projects.AsNoTracking()
            .Include(p => p.Directions)
            .SingleOrDefaultAsync(p => p.Id == query.ProjectId, cancellationToken)
            ?? throw new NotFoundException();

        var lastSequence = await db.Events.Where(e => e.ProjectId == project.Id)
            .Select(e => (long?)e.Sequence)
            .MaxAsync(cancellationToken) ?? 0;

        var leased = await db.Runs.AsNoTracking()
            .Where(r => r.ProjectId == project.Id && r.Status == RunStatus.Leased)
            .Select(r => new { r.Id, r.DirectionId, r.Stage, r.CurrentStepName })
            .ToListAsync(cancellationToken);
        var live = new Dictionary<(Guid, int), LiveStage>();
        foreach (var run in leased)
        {
            var latest = await db.RunLogLines.AsNoTracking()
                .Where(l => l.RunId == run.Id)
                .OrderByDescending(l => l.Sequence)
                .Select(l => l.Text)
                .FirstOrDefaultAsync(cancellationToken);
            live[(run.DirectionId, run.Stage)] = new LiveStage(run.Id, run.CurrentStepName, latest);
        }

        var dto = ToDto(project, lastSequence);
        return dto with
        {
            Directions = dto.Directions.Select(d => d with
            {
                Stages = d.Stages.Select(s => s.Status == nameof(StageStatus.Running) && live.TryGetValue((d.Id, s.Number), out var l)
                    ? s with { Step = l.Step, LatestLine = l.LatestLine, RunId = l.RunId }
                    : s).ToList(),
            }).ToList(),
        };
    }

    private sealed record LiveStage(Guid RunId, string? Step, string? LatestLine);

    public static ProjectDto ToDto(Project project, long lastSequence) => new(
        project.Id,
        project.Name,
        project.Idea,
        project.StackPreference,
        project.Repository,
        project.Status.ToString(),
        project.CreatedAt,
        lastSequence,
        project.Directions.OrderBy(d => d.SubmittedAt).Select(ToDto).ToList(),
        project.Directions.Sum(d => d.SpendUsd));

    public static DirectionDto ToDto(Direction d) => new(
        d.Id,
        d.Kind.ToString(),
        d.Status.ToString(),
        d.Idea,
        d.BudgetUsd,
        d.SubmittedBy,
        d.SubmittedAt,
        d.CompletedAt,
        d.Stages.OrderBy(s => s.Number)
            .Select(s => new StageDto(s.Number, s.Name, s.Status.ToString(), s.StartedAt, s.EndedAt))
            .ToList(),
        d.HasUiChange,
        d.UiDecision,
        d.SpendUsd,
        d.BudgetWarned,
        d.PauseReason,
        d.PauseRequestedBy is not null,
        d.PausedBy,
        d.PausedAt,
        d.CancelledBy,
        d.CancelledAt,
        d.StoppedWithinSeconds,
        d.LabelledPullRequestNumbers);
}

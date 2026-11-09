using Hewn.Application.Abstractions;
using Hewn.Application.Common;
using Hewn.Domain;
using MediatR;
using Microsoft.EntityFrameworkCore;

namespace Hewn.Application.Projects;

public sealed record GetProjectQuery(Guid ProjectId) : IRequest<ProjectDto>;

public sealed record StageDto(int Number, string Name, string Status, DateTimeOffset? StartedAt, DateTimeOffset? EndedAt);

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
    string? UiDecision);

public sealed record ProjectDto(
    Guid Id,
    string Name,
    string Idea,
    string? StackPreference,
    string? Repository,
    string Status,
    DateTimeOffset CreatedAt,
    long LastSequence,
    IReadOnlyList<DirectionDto> Directions);

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

        return ToDto(project, lastSequence);
    }

    public static ProjectDto ToDto(Project project, long lastSequence) => new(
        project.Id,
        project.Name,
        project.Idea,
        project.StackPreference,
        project.Repository,
        project.Status.ToString(),
        project.CreatedAt,
        lastSequence,
        project.Directions.OrderBy(d => d.SubmittedAt).Select(d => new DirectionDto(
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
            d.UiDecision)).ToList());
}

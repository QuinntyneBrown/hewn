using FluentValidation;
using Hewn.Application.Abstractions;
using Hewn.Application.Common;
using Hewn.Application.Events;
using Hewn.Application.Pipeline;
using Hewn.Domain;
using MediatR;
using Microsoft.EntityFrameworkCore;

namespace Hewn.Application.Projects;

public sealed record SubmitFeatureDirectionCommand(Guid ProjectId, string? Idea, decimal BudgetUsd) : IRequest<SubmitProductDirectionResult>;

public sealed class SubmitFeatureDirectionValidator : AbstractValidator<SubmitFeatureDirectionCommand>
{
    public SubmitFeatureDirectionValidator()
    {
        RuleFor(c => c.Idea)
            .Must(i => i is { Length: >= Project.MinIdeaLength and <= Project.MaxIdeaLength })
            .WithMessage(c => $"The feature must be 10 to 20,000 characters. This one has {c.Idea?.Length ?? 0:N0}.")
            .WithState(_ => "The feature must be 10 to 20,000 characters");

        RuleFor(c => c.BudgetUsd)
            .Must(b => b > 0 && b <= SubmitProductDirectionValidator.MaxBudgetUsd)
            .WithMessage("Budget must be more than $0 and at most $100,000.")
            .WithState(_ => "Budget must be more than $0");
    }
}

/// <summary>
/// L2-005: adds a feature direction to an existing product. It starts at once on an idle project, or queues behind
/// the active direction, first in, first out (AC4, L2-004 AC4).
/// </summary>
public sealed class SubmitFeatureDirectionHandler(
    IAppDbContext db,
    ICurrentUser user,
    EventAppender events,
    PipelineOrchestrator pipeline,
    TimeProvider clock) : IRequestHandler<SubmitFeatureDirectionCommand, SubmitProductDirectionResult>
{
    public async Task<SubmitProductDirectionResult> Handle(SubmitFeatureDirectionCommand command, CancellationToken cancellationToken)
    {
        var project = await db.Projects.Include(p => p.Directions)
            .SingleOrDefaultAsync(p => p.Id == command.ProjectId, cancellationToken)
            ?? throw new NotFoundException();

        var startsNow = project.AddFeatureDirection(command.Idea!, command.BudgetUsd, user.Login, clock.GetUtcNow(), out var direction);
        db.Directions.Add(direction); // a new child with its own key; EF would otherwise treat it as an existing row
        await events.AppendAsync(
            project.Id,
            "DirectionQueued",
            new { directionId = direction.Id, kind = direction.Kind.ToString(), stage = direction.FirstStage, stageStatus = StageStatus.Pending.ToString(), startsNow, direction = GetProjectHandler.ToDto(direction) },
            cancellationToken);
        if (startsNow)
        {
            await pipeline.StartDirectionAsync(project, direction, cancellationToken);
        }

        await db.SaveChangesAsync(cancellationToken);
        await events.PublishAsync(cancellationToken);
        return new SubmitProductDirectionResult(project.Id, direction.Id);
    }
}

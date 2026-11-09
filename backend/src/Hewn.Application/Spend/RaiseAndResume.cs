using FluentValidation;
using Hewn.Application.Abstractions;
using Hewn.Application.Common;
using Hewn.Application.Events;
using Hewn.Application.Pipeline;
using Hewn.Application.Projects;
using Hewn.Domain;
using MediatR;
using Microsoft.EntityFrameworkCore;

namespace Hewn.Application.Spend;

/// <summary>
/// Raise and resume (L2-053 AC3): on a direction Paused with "Budget reached", raises the budget above the spend so
/// far and resumes the direction from its next step, in one action. `CurrentBudgetUsd` is the budget the Owner saw,
/// so a budget another session changed meanwhile is refused.
/// </summary>
public sealed record RaiseAndResumeCommand(Guid ProjectId, Guid DirectionId, decimal BudgetUsd, decimal CurrentBudgetUsd)
    : IRequest<RaiseAndResumeResult>;

public sealed record RaiseAndResumeResult(Guid DirectionId, decimal BudgetUsd, decimal SpendUsd, string Status);

public sealed class RaiseAndResumeValidator : AbstractValidator<RaiseAndResumeCommand>
{
    public RaiseAndResumeValidator()
    {
        RuleFor(c => c.BudgetUsd)
            .Must(b => b > 0 && b <= SubmitProductDirectionValidator.MaxBudgetUsd)
            .WithMessage("New budget must be more than $0 and at most $100,000.")
            .WithState(_ => "New budget is out of range");
    }
}

public sealed class RaiseAndResumeHandler(
    IAppDbContext db,
    PipelineOrchestrator pipeline,
    EventAppender events,
    ICurrentUser user) : IRequestHandler<RaiseAndResumeCommand, RaiseAndResumeResult>
{
    public const string BudgetRaised = "BudgetRaised";

    public async Task<RaiseAndResumeResult> Handle(RaiseAndResumeCommand command, CancellationToken cancellationToken)
    {
        // Model calls add to the same spend; the project lock keeps the check and the resume on one value.
        await events.LockAsync(command.ProjectId, cancellationToken);
        var project = await db.Projects.Include(p => p.Directions).SingleOrDefaultAsync(p => p.Id == command.ProjectId, cancellationToken)
            ?? throw new NotFoundException();
        var direction = project.Directions.SingleOrDefault(d => d.Id == command.DirectionId) ?? throw new NotFoundException();

        // A stale budget means another session already acted: say so before anything else.
        if (direction.BudgetUsd != command.CurrentBudgetUsd)
        {
            throw new ConflictException("budget_changed", "Another session changed this budget a moment ago.");
        }

        if (!direction.IsPausedAtBudget)
        {
            throw new ConflictException("not_budget_paused", "The direction is not paused at its budget.");
        }

        var budget = Math.Round(command.BudgetUsd, 2, MidpointRounding.AwayFromZero);
        if (budget <= direction.SpendUsd)
        {
            throw new FieldValidationException(
            [
                new FieldError(
                    "budgetUsd",
                    $"New budget must be more than the {direction.SpendUsd:$#,##0.00} already spent.",
                    "New budget must be more than the spend so far"),
            ]);
        }

        var run = await db.Runs.SingleAsync(r => r.DirectionId == direction.Id && r.Status == RunStatus.Paused, cancellationToken);
        await events.AppendAsync(
            project.Id,
            BudgetRaised,
            new { directionId = direction.Id, budgetUsd = budget, spendUsd = direction.SpendUsd, raisedBy = user.Login },
            cancellationToken);
        await pipeline.OnBudgetRaisedAsync(run, project, direction, budget, cancellationToken);
        await db.SaveChangesAsync(cancellationToken);
        await events.PublishAsync(cancellationToken);

        return new RaiseAndResumeResult(direction.Id, direction.BudgetUsd, direction.SpendUsd, direction.Status.ToString());
    }
}

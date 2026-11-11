using FluentValidation;
using Hewn.Application.Abstractions;
using Hewn.Application.Common;
using Hewn.Application.Events;
using Hewn.Application.Pipeline;
using Hewn.Domain;
using MediatR;
using Microsoft.EntityFrameworkCore;

namespace Hewn.Application.Spend;

public sealed record RecordModelCallCommand(
    Guid RunId, string WorkerId, long Epoch, string CallId, string Model, long InputTokens, long OutputTokens)
    : IRequest<ModelCallVerdict>;

/// <summary>What the worker does next, with the spend so far.</summary>
public sealed record ModelCallVerdict(string Verdict, decimal DirectionSpendUsd, decimal BudgetUsd);

public sealed class RecordModelCallValidator : AbstractValidator<RecordModelCallCommand>
{
    public RecordModelCallValidator()
    {
        RuleFor(c => c.CallId).NotEmpty().MaximumLength(ModelCall.MaxCallIdLength);
        RuleFor(c => c.Model).NotEmpty().MaximumLength(ModelCall.MaxModelLength);
        RuleFor(c => c.InputTokens).GreaterThanOrEqualTo(0);
        RuleFor(c => c.OutputTokens).GreaterThanOrEqualTo(0);
    }
}

/// <summary>
/// The spend ledger and the budget guard in one unit of work, so the verdict for a call always reflects that call
/// (L2-052 AC1, L2-053 AC2-AC3). Reaching the budget pauses the direction, its stage and its run, releasing the
/// lease: the worker stops after the call it just made, and nothing of the direction is leased again until the
/// budget is raised (journey 5).
/// </summary>
public sealed class RecordModelCallHandler(
    IAppDbContext db,
    LeaseService leases,
    PriceTable prices,
    PipelineOrchestrator pipeline,
    EventAppender events,
    HewnMetrics metrics,
    TimeProvider clock) : IRequestHandler<RecordModelCallCommand, ModelCallVerdict>
{
    public const string SpendUpdated = "SpendUpdated";
    public const string BudgetWarning = "BudgetWarning";

    public async Task<ModelCallVerdict> Handle(RecordModelCallCommand command, CancellationToken cancellationToken)
    {
        var run = await leases.FenceAsync(command.RunId, command.WorkerId, command.Epoch, cancellationToken);

        // Spend is read, added to and saved; the project lock keeps two calls from both adding to the same total.
        await events.LockAsync(run.ProjectId, cancellationToken);
        var project = await db.Projects.Include(p => p.Directions).SingleAsync(p => p.Id == run.ProjectId, cancellationToken);
        var direction = project.Directions.Single(d => d.Id == run.DirectionId);
        var model = SecretRedactor.Redact(command.Model);

        // A call reported again (a retried request) is counted once.
        if (await db.ModelCalls.AnyAsync(c => c.RunId == run.Id && c.CallId == command.CallId, cancellationToken))
        {
            return new ModelCallVerdict(BudgetVerdict.Continue.ToString(), direction.SpendUsd, direction.BudgetUsd);
        }

        var cost = prices.Cost(model, command.InputTokens, command.OutputTokens);
        var call = new ModelCall(run, command.CallId, model, command.InputTokens, command.OutputTokens, cost, clock.GetUtcNow());
        db.ModelCalls.Add(call);
        var (verdict, warned) = direction.RecordSpend(cost);

        await events.AppendAsync(project.Id, SpendUpdated, new
        {
            directionId = direction.Id,
            stage = run.Stage,
            runId = run.Id,
            model,
            inputTokens = call.InputTokens,
            outputTokens = call.OutputTokens,
            costUsd = cost,
            directionSpendUsd = direction.SpendUsd,
            projectSpendUsd = project.Directions.Sum(d => d.SpendUsd),
            budgetUsd = direction.BudgetUsd,
        }, cancellationToken);

        if (warned)
        {
            await events.AppendAsync(project.Id, BudgetWarning, new
            {
                directionId = direction.Id,
                spendUsd = direction.SpendUsd,
                budgetUsd = direction.BudgetUsd,
            }, cancellationToken);
        }

        if (verdict == BudgetVerdict.Stop)
        {
            await pipeline.OnBudgetReachedAsync(run, project, direction, cancellationToken);
        }

        await FencedSave.SaveAsync(db, cancellationToken);
        metrics.ModelCalled(model, call.InputTokens, call.OutputTokens, cost);
        await events.PublishAsync(cancellationToken);
        return new ModelCallVerdict(verdict.ToString(), direction.SpendUsd, direction.BudgetUsd);
    }
}

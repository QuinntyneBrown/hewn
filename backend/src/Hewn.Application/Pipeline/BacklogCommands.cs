using FluentValidation;
using Hewn.Application.Abstractions;
using Hewn.Application.Events;
using Hewn.Application.Common;
using Hewn.Domain;
using MediatR;
using Microsoft.EntityFrameworkCore;

namespace Hewn.Application.Pipeline;

public sealed record PlannedIncrement(int Number, string Title, int Journey, IReadOnlyList<string> L2Ids, decimal EstimateDays, IReadOnlyList<int> DependsOn);

public sealed record DeferredDesign(string Title, IReadOnlyList<string> L2Ids, decimal EstimateDays, string Reason);

public sealed record RecordBacklogCommand(Guid RunId, string WorkerId, long Epoch, IReadOnlyList<PlannedIncrement> Increments, IReadOnlyList<DeferredDesign> Deferred)
    : IRequest;

public sealed class RecordBacklogValidator : AbstractValidator<RecordBacklogCommand>
{
    public RecordBacklogValidator()
    {
        RuleFor(c => c.Increments).Must(i => i.Count <= 500);
        RuleFor(c => c.Deferred).Must(d => d.Count <= 500);
        RuleFor(c => c.Increments)
            .Must(i => i.Select(x => x.Number).SequenceEqual(Enumerable.Range(1, i.Count)))
            .WithMessage("Increments are numbered 1, 2, 3… in order.");
        RuleForEach(c => c.Increments).ChildRules(i =>
        {
            i.RuleFor(x => x.Title).NotEmpty().MaximumLength(200);
            i.RuleFor(x => x.L2Ids).NotEmpty();
            i.RuleFor(x => x.EstimateDays).GreaterThanOrEqualTo(0);
            // L2-020 AC1: no increment comes before one it depends on.
            i.RuleFor(x => x).Must(x => x.DependsOn.All(d => d >= 1 && d < x.Number))
                .WithName("dependsOn").WithMessage(x => $"Increment {x.Number} may depend only on earlier increments.");
        });
        RuleForEach(c => c.Deferred).ChildRules(d =>
        {
            d.RuleFor(x => x.Title).NotEmpty().MaximumLength(200);
            d.RuleFor(x => x.Reason).NotEmpty().MaximumLength(500);
        });
    }
}

/// <summary>Stage 9 replaces the direction's backlog with its plan; repeating the request leaves the same backlog.</summary>
public sealed class RecordBacklogHandler(IAppDbContext db, LeaseService leases, EventAppender events) : IRequestHandler<RecordBacklogCommand>
{
    private const int EstimateStage = 9;

    public async Task Handle(RecordBacklogCommand command, CancellationToken cancellationToken)
    {
        var run = await leases.FenceAsync(command.RunId, command.WorkerId, command.Epoch, cancellationToken);
        if (run.Stage != EstimateStage)
        {
            throw new FieldValidationException(
                [new FieldError("stage", $"Stage {run.Stage} may not record the backlog.", "Only stage 9 records the backlog")],
                "mutation_not_allowed");
        }

        db.Increments.RemoveRange(await db.Increments.Where(i => i.DirectionId == run.DirectionId).ToListAsync(cancellationToken));
        foreach (var i in command.Increments)
        {
            db.Increments.Add(Increment.Planned(run.DirectionId, i.Number, i.Title, i.Journey, i.L2Ids, i.EstimateDays, i.DependsOn));
        }

        foreach (var d in command.Deferred)
        {
            db.Increments.Add(Increment.Deferred(run.DirectionId, d.Title, d.L2Ids, d.EstimateDays, SecretRedactor.Redact(d.Reason)));
        }

        await events.AppendAsync(run.ProjectId, "BacklogPlanned", new
        {
            directionId = run.DirectionId,
            increments = command.Increments.Count,
            deferred = command.Deferred.Count,
            estimateDays = command.Increments.Sum(i => i.EstimateDays),
        }, cancellationToken);
        await FencedSave.SaveAsync(db, cancellationToken);
        await events.PublishAsync(cancellationToken);
    }
}

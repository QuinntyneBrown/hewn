using FluentValidation;
using Hewn.Application.Abstractions;
using Hewn.Application.Common;
using Hewn.Application.Events;
using Hewn.Domain;
using MediatR;
using Microsoft.EntityFrameworkCore;

namespace Hewn.Application.Pipeline;

public sealed record IncrementDto(
    int Number,
    string Title,
    int Journey,
    IReadOnlyList<string> L2Ids,
    decimal EstimateDays,
    IReadOnlyList<int> DependsOn,
    string Status,
    int Iterations);

public sealed record GetNextIncrementQuery(Guid RunId, string WorkerId, long Epoch) : IRequest<IncrementDto?>;

public sealed record UpdateIncrementCommand(
    Guid RunId,
    string WorkerId,
    long Epoch,
    int Number,
    IncrementStatus Status,
    int? RedFailing,
    int? RedPassing,
    int? Iterations,
    IReadOnlyList<string>? FailingTests,
    int? PullRequestNumber) : IRequest;

public sealed class UpdateIncrementValidator : AbstractValidator<UpdateIncrementCommand>
{
    public UpdateIncrementValidator()
    {
        RuleFor(c => c.Number).GreaterThan(0);
        RuleFor(c => c.RedFailing).GreaterThanOrEqualTo(0);
        RuleFor(c => c.RedPassing).GreaterThanOrEqualTo(0);
        RuleFor(c => c).Must(c => (c.RedFailing is null) == (c.RedPassing is null))
            .WithName("redFailing").WithMessage("Report both red counts or neither.");
        RuleFor(c => c.Iterations).InclusiveBetween(0, 1000);
        RuleFor(c => c.FailingTests).Must(f => f is null || f.Count <= 100);
        RuleForEach(c => c.FailingTests).NotEmpty().MaximumLength(500);
        RuleFor(c => c.PullRequestNumber).GreaterThan(0);
    }
}

/// <summary>
/// The backlog cursor (L2-022 AC2): the lowest-numbered increment still Queued or InProgress whose dependencies
/// can all still merge. An increment that depends on a Blocked one, directly or through another, is skipped.
/// </summary>
public sealed class GetNextIncrementHandler(IAppDbContext db, LeaseService leases) : IRequestHandler<GetNextIncrementQuery, IncrementDto?>
{
    public async Task<IncrementDto?> Handle(GetNextIncrementQuery query, CancellationToken cancellationToken)
    {
        var run = await leases.FenceAsync(query.RunId, query.WorkerId, query.Epoch, cancellationToken);
        IncrementRules.EnsureStage(run.Stage);
        var increments = await db.Increments.AsNoTracking()
            .Where(i => i.DirectionId == run.DirectionId && i.Number != null)
            .ToListAsync(cancellationToken);

        var unreachable = new HashSet<int>();
        foreach (var increment in increments.OrderBy(i => i.Number))
        {
            // Dependencies are always earlier (RecordBacklogValidator), so one pass in order settles every chain.
            if (increment.Status == IncrementStatus.Blocked || IncrementRules.DependsOn(increment).Any(unreachable.Contains))
            {
                unreachable.Add(increment.Number!.Value);
            }
        }

        var next = increments
            .Where(i => i.Status is IncrementStatus.Queued or IncrementStatus.InProgress && !unreachable.Contains(i.Number!.Value))
            .MinBy(i => i.Number);
        return next is null ? null : new IncrementDto(
            next.Number!.Value,
            next.Title,
            next.Journey ?? 0,
            next.L2Ids.Split(',', StringSplitOptions.RemoveEmptyEntries),
            next.EstimateDays,
            IncrementRules.DependsOn(next),
            next.Status.ToString(),
            next.Iterations);
    }
}

public sealed class UpdateIncrementHandler(IAppDbContext db, LeaseService leases, EventAppender events) : IRequestHandler<UpdateIncrementCommand>
{
    public async Task Handle(UpdateIncrementCommand command, CancellationToken cancellationToken)
    {
        var run = await leases.FenceAsync(command.RunId, command.WorkerId, command.Epoch, cancellationToken);
        IncrementRules.EnsureStage(run.Stage);
        var increment = await db.Increments
            .SingleOrDefaultAsync(i => i.DirectionId == run.DirectionId && i.Number == command.Number, cancellationToken)
            ?? throw new NotFoundException();

        // Test names can quote assertion output, so they pass through the redactor before they are stored.
        var failing = command.FailingTests?.Select(SecretRedactor.Redact).ToList();
        if (!increment.Apply(command.Status, command.RedFailing, command.RedPassing, command.Iterations, failing, command.PullRequestNumber))
        {
            throw new FieldValidationException(
                [new FieldError("status", $"Increment {command.Number} cannot become {command.Status} from {increment.Status}.", "That status change is not allowed")],
                "invalid_transition");
        }

        await events.AppendAsync(run.ProjectId, "IncrementChanged", new
        {
            directionId = run.DirectionId,
            number = increment.Number,
            title = increment.Title,
            status = increment.Status.ToString(),
            redFailing = increment.RedFailing,
            redPassing = increment.RedPassing,
            testsPassedEarly = increment.TestsPassedEarly,
            iterations = increment.Iterations,
            pullRequestNumber = increment.PullRequestNumber,
        }, cancellationToken);
        await FencedSave.SaveAsync(db, cancellationToken);
        await events.PublishAsync(cancellationToken);
    }
}

internal static class IncrementRules
{
    public static void EnsureStage(int stage)
    {
        if (stage != CommitPolicy.IncrementStage)
        {
            throw new FieldValidationException(
                [new FieldError("stage", $"Stage {stage} does not work on increments.", "Only stage 10 works on increments")],
                "mutation_not_allowed");
        }
    }

    public static IReadOnlyList<int> DependsOn(Increment increment) =>
        [.. increment.DependsOn.Split(',', StringSplitOptions.RemoveEmptyEntries).Select(int.Parse)];
}

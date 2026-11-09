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

public sealed record UpdateIncrementCommand(Guid RunId, string WorkerId, long Epoch, int Number, IncrementProgress Progress) : IRequest;

public sealed class UpdateIncrementValidator : AbstractValidator<UpdateIncrementCommand>
{
    public UpdateIncrementValidator()
    {
        RuleFor(c => c.Number).GreaterThan(0);
        RuleFor(c => c.Progress.RedFailing).GreaterThanOrEqualTo(0).OverridePropertyName("redFailing");
        RuleFor(c => c.Progress.RedPassing).GreaterThanOrEqualTo(0).OverridePropertyName("redPassing");
        RuleFor(c => c.Progress).Must(p => (p.RedFailing is null) == (p.RedPassing is null))
            .OverridePropertyName("redFailing").WithMessage("Report both red counts or neither.");
        RuleFor(c => c.Progress.Iterations).InclusiveBetween(0, 1000).OverridePropertyName("iterations");
        RuleFor(c => c.Progress.GreenAfter).InclusiveBetween(0, 1000).OverridePropertyName("greenAfter");
        RuleFor(c => c.Progress.TestCount).InclusiveBetween(0, 10_000).OverridePropertyName("testCount");
        RuleFor(c => c.Progress.FailingTests).Must(f => f is null || f.Count <= 100).OverridePropertyName("failingTests");
        RuleForEach(c => c.Progress.FailingTests).NotEmpty().MaximumLength(500).OverridePropertyName("failingTests");
        RuleFor(c => c.Progress.PullRequestNumber).GreaterThan(0).OverridePropertyName("pullRequestNumber");
        RuleFor(c => c.Progress.Video).Must(v => v is null or "Recorded" or "Failed").OverridePropertyName("video")
            .WithMessage("The video is Recorded or Failed.");
        RuleFor(c => c.Progress.VideoNote).MaximumLength(500).OverridePropertyName("videoNote");
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

public sealed class UpdateIncrementHandler(IAppDbContext db, LeaseService leases, EventAppender events, TimeProvider clock) : IRequestHandler<UpdateIncrementCommand>
{
    public async Task Handle(UpdateIncrementCommand command, CancellationToken cancellationToken)
    {
        var run = await leases.FenceAsync(command.RunId, command.WorkerId, command.Epoch, cancellationToken);
        IncrementRules.EnsureStage(run.Stage);
        var increment = await db.Increments
            .SingleOrDefaultAsync(i => i.DirectionId == run.DirectionId && i.Number == command.Number, cancellationToken)
            ?? throw new NotFoundException();

        // Test names can quote assertion output, and a video's failure can quote a command, so both pass through
        // the redactor before they are stored.
        var progress = command.Progress with
        {
            FailingTests = command.Progress.FailingTests?.Select(SecretRedactor.Redact).ToList(),
            VideoNote = command.Progress.VideoNote is null ? null : SecretRedactor.Redact(command.Progress.VideoNote),
        };
        if (!increment.Apply(progress, clock.GetUtcNow()))
        {
            throw new FieldValidationException(
                [new FieldError("status", $"Increment {command.Number} cannot become {progress.Status} from {increment.Status}.", "That status change is not allowed")],
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
            testCount = increment.TestCount,
            iterations = increment.Iterations,
            greenAfter = increment.GreenAfter,
            video = increment.Video,
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

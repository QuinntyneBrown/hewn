using FluentValidation;
using Hewn.Application.Abstractions;
using Hewn.Application.Common;
using Hewn.Application.Events;
using Hewn.Domain;
using MediatR;
using Microsoft.EntityFrameworkCore;

namespace Hewn.Application.Pipeline;

public sealed record StartStepCommand(Guid RunId, string WorkerId, long Epoch, int Step, string Name) : IRequest;

public sealed class StartStepValidator : AbstractValidator<StartStepCommand>
{
    public StartStepValidator()
    {
        RuleFor(c => c.Step).GreaterThan(0);
        RuleFor(c => c.Name).NotEmpty().MaximumLength(Run.MaxStepNameLength);
    }
}

/// <summary>L2-030 AC2: the worker names the step it starts, so the running stage shows it live.</summary>
public sealed class StartStepHandler(IAppDbContext db, LeaseService leases, EventAppender events) : IRequestHandler<StartStepCommand>
{
    public async Task Handle(StartStepCommand command, CancellationToken cancellationToken)
    {
        var run = await leases.FenceAsync(command.RunId, command.WorkerId, command.Epoch, cancellationToken);
        run.StartStep(command.Step, SecretRedactor.Redact(command.Name));
        await events.AppendAsync(
            run.ProjectId,
            "StepStarted",
            new { directionId = run.DirectionId, stage = run.Stage, runId = run.Id, step = run.CurrentStep, name = run.CurrentStepName },
            cancellationToken);
        await FencedSave.SaveAsync(db, cancellationToken);
        await events.PublishAsync(cancellationToken);
    }
}

public sealed record ReportedDecision(string Question, string Answer, string? Rationale);

public sealed record RecordDecisionsCommand(Guid RunId, string WorkerId, long Epoch, IReadOnlyList<ReportedDecision> Decisions) : IRequest;

public sealed class RecordDecisionsValidator : AbstractValidator<RecordDecisionsCommand>
{
    public RecordDecisionsValidator()
    {
        RuleFor(c => c.Decisions).NotEmpty().Must(d => d.Count <= 100).WithMessage("Report 1 to 100 decisions at a time.");
        RuleForEach(c => c.Decisions).ChildRules(d =>
        {
            d.RuleFor(x => x.Question).NotEmpty().MaximumLength(RunDecision.MaxQuestionLength);
            d.RuleFor(x => x.Answer).NotEmpty().MaximumLength(RunDecision.MaxAnswerLength);
        });
    }
}

/// <summary>
/// L2-030 AC3, L2-054: the decisions a run committed to <c>docs/decisions.md</c>, kept for the stage's Decisions
/// tab and sent as <c>DecisionRecorded</c> events.
/// </summary>
public sealed class RecordDecisionsHandler(IAppDbContext db, LeaseService leases, EventAppender events, TimeProvider clock)
    : IRequestHandler<RecordDecisionsCommand>
{
    public async Task Handle(RecordDecisionsCommand command, CancellationToken cancellationToken)
    {
        var run = await leases.FenceAsync(command.RunId, command.WorkerId, command.Epoch, cancellationToken);
        var now = clock.GetUtcNow();
        // A resumed step reports its decisions again; the run keeps the first copy of each question.
        var known = (await db.RunDecisions.Where(d => d.RunId == run.Id).Select(d => d.Question).ToListAsync(cancellationToken)).ToHashSet();
        foreach (var reported in command.Decisions)
        {
            if (!known.Add(SecretRedactor.Redact(reported.Question)))
            {
                continue;
            }

            var decision = new RunDecision(
                run,
                SecretRedactor.Redact(reported.Question),
                SecretRedactor.Redact(reported.Answer),
                SecretRedactor.Redact(reported.Rationale ?? string.Empty),
                now);
            db.RunDecisions.Add(decision);
            await events.AppendAsync(
                run.ProjectId,
                "DecisionRecorded",
                new
                {
                    directionId = run.DirectionId,
                    stage = run.Stage,
                    runId = run.Id,
                    question = decision.Question,
                    answer = decision.Answer,
                    rationale = decision.Rationale,
                    recordedAt = decision.RecordedAt,
                },
                cancellationToken);
        }

        await FencedSave.SaveAsync(db, cancellationToken);
        await events.PublishAsync(cancellationToken);
    }
}

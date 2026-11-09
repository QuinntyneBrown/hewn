using Hewn.Application.Abstractions;
using Hewn.Application.Common;
using Hewn.Application.Events;
using Hewn.Domain;
using MediatR;
using Microsoft.EntityFrameworkCore;

namespace Hewn.Application.Pipeline;

public sealed record ReportScopeCommand(Guid RunId, string WorkerId, long Epoch, bool HasUiChange, string? Rationale) : IRequest;

/// <summary>
/// L2-005 AC2, L2-054: stage 1 of a feature direction reports the decision it recorded on whether the feature
/// changes the user interface. Without a UI change, Designs and Design system are Skipped before stage 2 is queued.
/// </summary>
public sealed class ReportScopeHandler(
    IAppDbContext db,
    LeaseService leases,
    PipelineOrchestrator pipeline,
    EventAppender events,
    TimeProvider clock) : IRequestHandler<ReportScopeCommand>
{
    public const int IdeaStage = 1;

    public async Task Handle(ReportScopeCommand command, CancellationToken cancellationToken)
    {
        var run = await leases.FenceAsync(command.RunId, command.WorkerId, command.Epoch, cancellationToken);
        var direction = await db.Directions.SingleAsync(d => d.Id == run.DirectionId, cancellationToken);
        if (run.Stage != IdeaStage || direction.Kind != DirectionKind.Feature)
        {
            throw new FieldValidationException(
                [new FieldError("stage", $"Stage {run.Stage} of a {direction.Kind.ToString().ToLowerInvariant()} direction may not record the UI change decision.", "Only stage 1 of a feature direction records the UI change decision")],
                "scope_not_allowed");
        }

        var rationale = SecretRedactor.Redact(command.Rationale ?? string.Empty);
        var skipped = direction.RecordUiChange(command.HasUiChange, rationale.Length > 2000 ? rationale[..2000] : rationale, clock.GetUtcNow());
        await events.AppendAsync(run.ProjectId, "DirectionScoped", new { directionId = direction.Id, hasUiChange = command.HasUiChange, uiDecision = direction.UiDecision }, cancellationToken);
        foreach (var stage in skipped)
        {
            await pipeline.AppendStageAsync(direction, stage, cancellationToken);
        }

        await FencedSave.SaveAsync(db, cancellationToken);
        await events.PublishAsync(cancellationToken);
    }
}

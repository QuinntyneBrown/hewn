using Hewn.Application.Abstractions;
using Hewn.Application.Common;
using Hewn.Application.Events;
using Hewn.Domain;
using MediatR;

namespace Hewn.Application.Pipeline;

/// <summary>
/// Retry stage (L2-006 AC3): the Blocked direction's failed stage runs again from its start as attempt 1, with its
/// retry counter reset. A recovery action, not an approval (L2-028).
/// </summary>
public sealed record RetryStageCommand(Guid ProjectId, Guid DirectionId) : IRequest<DirectionControlResult>;

public sealed class RetryStageHandler(
    IAppDbContext db,
    PipelineOrchestrator pipeline,
    EventAppender events,
    ICurrentUser user,
    TimeProvider clock) : IRequestHandler<RetryStageCommand, DirectionControlResult>
{
    public const string StageRetried = "StageRetried";

    public async Task<DirectionControlResult> Handle(RetryStageCommand command, CancellationToken cancellationToken)
    {
        await events.LockAsync(command.ProjectId, cancellationToken);
        var (project, direction) = await DirectionControl.LoadAsync(db, command.ProjectId, command.DirectionId, cancellationToken);
        if (direction.Status != DirectionStatus.Blocked)
        {
            throw new ConflictException("not_blocked", "Only a Blocked direction can retry its failed stage.");
        }

        var stage = direction.FailedStage!.Value;
        var run = await pipeline.OnRetryStageAsync(project, direction, cancellationToken);
        await events.AppendAsync(project.Id, StageRetried, new { directionId = direction.Id, stage, retriedBy = user.Login }, cancellationToken);
        await RunLog.InfoAsync(db, events, run, $"Retry stage requested by {user.Login}", clock.GetUtcNow(), cancellationToken);
        await db.SaveChangesAsync(cancellationToken);
        await events.PublishAsync(cancellationToken);
        return DirectionControl.Result(direction);
    }
}

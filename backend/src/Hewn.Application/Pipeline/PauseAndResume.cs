using Hewn.Application.Abstractions;
using Hewn.Application.Common;
using Hewn.Application.Events;
using Hewn.Domain;
using MediatR;
using Microsoft.EntityFrameworkCore;

namespace Hewn.Application.Pipeline;

public sealed record DirectionControlResult(Guid DirectionId, string Status, bool PauseRequested);

/// <summary>
/// Pause (L2-029 AC1): the step in progress finishes and the worker's checkpoint pauses the direction; a run still
/// waiting for a worker pauses at once. Nothing new starts until Resume. Pressing Pause again changes nothing.
/// </summary>
public sealed record PauseDirectionCommand(Guid ProjectId, Guid DirectionId) : IRequest<DirectionControlResult>;

public sealed class PauseDirectionHandler(
    IAppDbContext db,
    PipelineOrchestrator pipeline,
    EventAppender events,
    ICurrentUser user,
    TimeProvider clock) : IRequestHandler<PauseDirectionCommand, DirectionControlResult>
{
    public const string PauseRequested = "PauseRequested";

    public async Task<DirectionControlResult> Handle(PauseDirectionCommand command, CancellationToken cancellationToken)
    {
        await events.LockAsync(command.ProjectId, cancellationToken);
        var (project, direction) = await DirectionControl.LoadAsync(db, command.ProjectId, command.DirectionId, cancellationToken);
        var run = await db.Runs.SingleOrDefaultAsync(
            r => r.DirectionId == direction.Id && (r.Status == RunStatus.Queued || r.Status == RunStatus.Leased),
            cancellationToken);
        if (run is null || direction.Status is not (DirectionStatus.Queued or DirectionStatus.Running))
        {
            throw new ConflictException("not_running", "Only a running direction can be paused.");
        }

        if (!direction.RequestPause(user.Login))
        {
            return DirectionControl.Result(direction);
        }

        var now = clock.GetUtcNow();
        await events.AppendAsync(project.Id, PauseRequested, new { directionId = direction.Id, requestedBy = user.Login }, cancellationToken);
        await RunLog.InfoAsync(db, events, run, $"Pause requested by {user.Login}", now, cancellationToken);
        if (run.Status == RunStatus.Queued)
        {
            // No step is in progress, so there is nothing to wait for.
            await pipeline.OnPauseTakesEffectAsync(run, project, direction, cancellationToken);
        }

        await db.SaveChangesAsync(cancellationToken);
        await events.PublishAsync(cancellationToken);
        return DirectionControl.Result(direction);
    }
}

/// <summary>Resume (L2-029 AC2): the paused run is queued again and its next lease carries on after its checkpoint.</summary>
public sealed record ResumeDirectionCommand(Guid ProjectId, Guid DirectionId) : IRequest<DirectionControlResult>;

public sealed class ResumeDirectionHandler(
    IAppDbContext db,
    PipelineOrchestrator pipeline,
    EventAppender events,
    ICurrentUser user,
    TimeProvider clock) : IRequestHandler<ResumeDirectionCommand, DirectionControlResult>
{
    public const string DirectionResumed = "DirectionResumed";

    public async Task<DirectionControlResult> Handle(ResumeDirectionCommand command, CancellationToken cancellationToken)
    {
        await events.LockAsync(command.ProjectId, cancellationToken);
        var (project, direction) = await DirectionControl.LoadAsync(db, command.ProjectId, command.DirectionId, cancellationToken);
        if (direction.IsPausedAtBudget)
        {
            throw new ConflictException("budget_reached", "The direction reached its budget; raise the budget to resume it.");
        }

        if (!direction.IsPausedByOwner)
        {
            throw new ConflictException("not_paused", "Only a paused direction can be resumed.");
        }

        var run = await db.Runs.SingleAsync(r => r.DirectionId == direction.Id && r.Status == RunStatus.Paused, cancellationToken);
        await events.AppendAsync(project.Id, DirectionResumed, new { directionId = direction.Id, resumedBy = user.Login }, cancellationToken);
        await RunLog.InfoAsync(db, events, run, $"Resumed by {user.Login}", clock.GetUtcNow(), cancellationToken);
        await pipeline.OnResumedAsync(run, project, direction, cancellationToken);
        await db.SaveChangesAsync(cancellationToken);
        await events.PublishAsync(cancellationToken);
        return DirectionControl.Result(direction);
    }
}

internal static class DirectionControl
{
    public static async Task<(Project Project, Direction Direction)> LoadAsync(
        IAppDbContext db, Guid projectId, Guid directionId, CancellationToken cancellationToken)
    {
        var project = await db.Projects.Include(p => p.Directions).SingleOrDefaultAsync(p => p.Id == projectId, cancellationToken)
            ?? throw new NotFoundException();
        var direction = project.Directions.SingleOrDefault(d => d.Id == directionId) ?? throw new NotFoundException();
        return (project, direction);
    }

    public static DirectionControlResult Result(Direction direction) =>
        new(direction.Id, direction.Status.ToString(), direction.PauseRequestedBy is not null);
}

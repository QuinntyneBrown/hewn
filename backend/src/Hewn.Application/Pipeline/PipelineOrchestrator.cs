using Hewn.Application.Abstractions;
using Hewn.Application.Events;
using Hewn.Domain;

namespace Hewn.Application.Pipeline;

/// <summary>
/// Decides what runs next. It changes stage, direction and project state, appends the matching events and
/// queues the next run, all in the caller's unit of work, so state and events commit together.
/// </summary>
public sealed class PipelineOrchestrator(IAppDbContext db, EventAppender events, TimeProvider clock)
{
    public const string StageChanged = "StageChanged";
    public const string DirectionChanged = "DirectionChanged";
    public const string ProjectChanged = "ProjectChanged";

    /// <summary>Makes the direction's first stage leasable.</summary>
    public void QueueFirstRun(Direction direction) =>
        db.Runs.Add(new Run(direction.ProjectId, direction.Id, direction.FirstStage, clock.GetUtcNow()));

    /// <summary>Starts a direction that waited for none or whose turn came: queues its first run and sets the project Running.</summary>
    public async Task StartDirectionAsync(Project project, Direction direction, CancellationToken cancellationToken)
    {
        QueueFirstRun(direction);
        if (project.Status != ProjectStatus.Running)
        {
            project.ChangeStatus(ProjectStatus.Running);
            await AppendProjectAsync(project, cancellationToken);
        }
    }

    /// <summary>A worker leased the run. On the first lease the stage starts; a resumed run changes nothing visible.</summary>
    public async Task OnLeasedAsync(Run run, Direction direction, CancellationToken cancellationToken)
    {
        var stage = direction.Stage(run.Stage);
        if (stage.Status != StageStatus.Pending)
        {
            return;
        }

        var wasRunning = direction.Status == DirectionStatus.Running;
        var now = clock.GetUtcNow();
        direction.StartStage(run.Stage, now);
        if (!wasRunning)
        {
            await AppendDirectionAsync(direction, cancellationToken);
        }

        await AppendStageAsync(direction, stage, cancellationToken);
    }

    public async Task OnSucceededAsync(Run run, Project project, Direction direction, CancellationToken cancellationToken)
    {
        var now = clock.GetUtcNow();
        var next = direction.CompleteStage(run.Stage, now);
        await AppendStageAsync(direction, direction.Stage(run.Stage), cancellationToken);

        if (next is int stage)
        {
            var nextRun = new Run(project.Id, direction.Id, stage, now);
            db.Runs.Add(nextRun);
            if (direction.PauseRequestedBy is not null)
            {
                // Pause was pressed during the stage that just finished: the next one waits for Resume (L2-029 AC1).
                await OnPauseTakesEffectAsync(nextRun, project, direction, cancellationToken);
            }

            return;
        }

        await AppendDirectionAsync(direction, cancellationToken);
        if (project.NextQueuedDirection(direction.Id) is { } queued)
        {
            // One direction per project, first in, first out (L2-004 AC4, L2-005 AC4).
            await StartDirectionAsync(project, queued, cancellationToken);
            return;
        }

        project.ChangeStatus(ProjectStatus.Idle);
        await AppendProjectAsync(project, cancellationToken);
    }

    public async Task OnFailedAsync(Run run, Project project, Direction direction, CancellationToken cancellationToken)
    {
        direction.FailStage(run.Stage, clock.GetUtcNow());
        await AppendStageAsync(direction, direction.Stage(run.Stage), cancellationToken);
        project.ChangeStatus(ProjectStatus.Blocked);
        await AppendProjectAsync(project, cancellationToken);
    }

    /// <summary>
    /// L2-053 AC3: spend reached the budget. The run releases its lease and keeps its checkpoint, the stage and
    /// direction pause with "Budget reached", and the project shows Paused. A safety stop, not an approval (L2-028).
    /// </summary>
    public async Task OnBudgetReachedAsync(Run run, Project project, Direction direction, CancellationToken cancellationToken)
    {
        run.Pause();
        var stage = direction.Pause(run.Stage, Direction.BudgetReached);
        await AppendStageAsync(direction, stage, cancellationToken);
        await AppendDirectionAsync(direction, cancellationToken);
        project.ChangeStatus(ProjectStatus.Paused);
        await AppendProjectAsync(project, cancellationToken);
    }

    /// <summary>Raise and resume (L2-053 AC3): the paused run is queued again and its stage, direction and project run.</summary>
    public async Task OnBudgetRaisedAsync(Run run, Project project, Direction direction, decimal budgetUsd, CancellationToken cancellationToken)
    {
        run.Resume();
        var stage = direction.RaiseBudgetAndResume(budgetUsd, run.Stage);
        await AppendStageAsync(direction, stage, cancellationToken);
        await AppendDirectionAsync(direction, cancellationToken);
        project.ChangeStatus(ProjectStatus.Running);
        await AppendProjectAsync(project, cancellationToken);
    }

    /// <summary>
    /// L2-029 AC1: the pause an Owner requested takes effect at a checkpoint, or before a run starts. The run releases
    /// its lease and keeps its checkpoint; the direction, a running stage and the project show Paused.
    /// </summary>
    public async Task OnPauseTakesEffectAsync(Run run, Project project, Direction direction, CancellationToken cancellationToken)
    {
        run.Pause();
        if (direction.PauseAsRequested(run.Stage, clock.GetUtcNow()) is { } stage)
        {
            await AppendStageAsync(direction, stage, cancellationToken);
        }

        await AppendDirectionAsync(direction, cancellationToken);
        project.ChangeStatus(ProjectStatus.Paused);
        await AppendProjectAsync(project, cancellationToken);
    }

    /// <summary>L2-029 AC2: Resume queues the paused run again, so its next lease carries on after its checkpoint.</summary>
    public async Task OnResumedAsync(Run run, Project project, Direction direction, CancellationToken cancellationToken)
    {
        run.Resume();
        if (direction.Resume(run.Stage) is { } stage)
        {
            await AppendStageAsync(direction, stage, cancellationToken);
        }

        await AppendDirectionAsync(direction, cancellationToken);
        project.ChangeStatus(ProjectStatus.Running);
        await AppendProjectAsync(project, cancellationToken);
    }

    /// <summary>
    /// L2-029 AC3: the direction is Cancelled with its run and its running or paused stage. The next queued direction
    /// starts (L2-004 AC4); with none, the project shows Cancelled.
    /// </summary>
    public async Task OnCancelledAsync(Run? run, Project project, Direction direction, string cancelledBy, CancellationToken cancellationToken)
    {
        var now = clock.GetUtcNow();
        run?.Cancel(now);
        if (direction.Cancel(cancelledBy, now) is { } stage)
        {
            await AppendStageAsync(direction, stage, cancellationToken);
        }

        await AppendDirectionAsync(direction, cancellationToken);
        if (project.NextQueuedDirection(direction.Id) is { } queued)
        {
            await StartDirectionAsync(project, queued, cancellationToken);
            return;
        }

        project.ChangeStatus(ProjectStatus.Cancelled);
        await AppendProjectAsync(project, cancellationToken);
    }

    /// <summary>The direction's record changed after it ended (the worker stopped, pull requests were labelled).</summary>
    public Task OnDirectionRecordChangedAsync(Direction direction, CancellationToken cancellationToken) =>
        AppendDirectionAsync(direction, cancellationToken);

    public Task OnRepositoryAttachedAsync(Project project, CancellationToken cancellationToken) =>
        AppendProjectAsync(project, cancellationToken);

    public Task AppendStageAsync(Direction direction, StageState stage, CancellationToken cancellationToken) =>
        events.AppendAsync(direction.ProjectId, StageChanged, new
        {
            directionId = direction.Id,
            stage = stage.Number,
            name = stage.Name,
            status = stage.Status.ToString(),
            startedAt = stage.StartedAt,
            endedAt = stage.EndedAt,
        }, cancellationToken);

    private Task AppendDirectionAsync(Direction direction, CancellationToken cancellationToken) =>
        events.AppendAsync(direction.ProjectId, DirectionChanged, new
        {
            directionId = direction.Id,
            status = direction.Status.ToString(),
            completedAt = direction.CompletedAt,
            pauseReason = direction.PauseReason,
            pauseRequested = direction.PauseRequestedBy is not null,
            pausedBy = direction.PausedBy,
            pausedAt = direction.PausedAt,
            cancelledBy = direction.CancelledBy,
            cancelledAt = direction.CancelledAt,
            stoppedWithinSeconds = direction.StoppedWithinSeconds,
            labelledPullRequests = direction.LabelledPullRequestNumbers,
        }, cancellationToken);

    private Task AppendProjectAsync(Project project, CancellationToken cancellationToken) =>
        events.AppendAsync(project.Id, ProjectChanged, new { status = project.Status.ToString(), repository = project.Repository }, cancellationToken);
}

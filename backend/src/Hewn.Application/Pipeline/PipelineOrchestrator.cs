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
            db.Runs.Add(new Run(project.Id, direction.Id, stage, now));
            return;
        }

        await AppendDirectionAsync(direction, cancellationToken);
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

    public Task OnRepositoryAttachedAsync(Project project, CancellationToken cancellationToken) =>
        AppendProjectAsync(project, cancellationToken);

    private Task AppendStageAsync(Direction direction, StageState stage, CancellationToken cancellationToken) =>
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
        }, cancellationToken);

    private Task AppendProjectAsync(Project project, CancellationToken cancellationToken) =>
        events.AppendAsync(project.Id, ProjectChanged, new { status = project.Status.ToString(), repository = project.Repository }, cancellationToken);
}

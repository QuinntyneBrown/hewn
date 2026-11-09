using System.Collections.Concurrent;
using System.Text.Json;
using Hewn.Application.Abstractions;
using Hewn.Application.Common;
using Hewn.Application.Events;
using Hewn.Domain;
using MediatR;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Options;

namespace Hewn.Application.Pipeline;

/// <summary>
/// The outcome of Cancel. <c>Stopped</c> is false when the worker holding the run did not answer within the deadline;
/// the direction is Cancelled anyway and the worker's writes are refused, so pressing Cancel again only checks.
/// </summary>
public sealed record CancelDirectionResult(Guid DirectionId, string Status, bool Stopped, int? StoppedWithinSeconds, string? Worker);

/// <summary>
/// Cancel (L2-029 AC3): the direction and its run are Cancelled at once, the worker hears it on its control poll and
/// stops, open pull requests are labelled <c>hewn:cancelled</c> and left open, and the next queued direction starts
/// (L2-004 AC4). Pressing Cancel again on a Cancelled direction waits for the worker again.
/// </summary>
public sealed record CancelDirectionCommand(Guid ProjectId, Guid DirectionId) : IRequest<CancelDirectionResult>;

public sealed class CancelDirectionHandler(
    IAppDbContext db,
    PipelineOrchestrator pipeline,
    EventAppender events,
    RunControlSignals signals,
    IGitHubRepositories gitHub,
    IOptions<PipelineOptions> options,
    ICurrentUser user,
    TimeProvider clock) : IRequestHandler<CancelDirectionCommand, CancelDirectionResult>
{
    public const string DirectionCancelled = "DirectionCancelled";

    public const string CancelledLabel = "hewn:cancelled";

    public async Task<CancelDirectionResult> Handle(CancelDirectionCommand command, CancellationToken cancellationToken)
    {
        await events.LockAsync(command.ProjectId, cancellationToken);
        var (project, direction) = await DirectionControl.LoadAsync(db, command.ProjectId, command.DirectionId, cancellationToken);
        var again = direction.Status == DirectionStatus.Cancelled;
        if (!again && !direction.IsActive)
        {
            throw new ConflictException("not_active", "Only a queued, running or paused direction can be cancelled.");
        }

        var run = again
            ? await db.Runs.Where(r => r.DirectionId == direction.Id && r.Status == RunStatus.Cancelled).OrderByDescending(r => r.EndedAt).FirstOrDefaultAsync(cancellationToken)
            : await db.Runs.SingleOrDefaultAsync(
                r => r.DirectionId == direction.Id && (r.Status == RunStatus.Queued || r.Status == RunStatus.Leased || r.Status == RunStatus.Paused || r.Status == RunStatus.Halted),
                cancellationToken);
        if (!again)
        {
            await events.AppendAsync(project.Id, DirectionCancelled, new { directionId = direction.Id, cancelledBy = user.Login }, cancellationToken);
            if (run is not null)
            {
                await RunLog.InfoAsync(db, events, run, $"Cancel requested by {user.Login}", clock.GetUtcNow(), cancellationToken);
                await LabelOpenPullRequestsAsync(project, direction, run, cancellationToken);
            }

            await pipeline.OnCancelledAsync(run, project, direction, user.Login, cancellationToken);
        }

        await db.SaveChangesAsync(cancellationToken);
        await events.PublishAsync(cancellationToken);

        var stopped = true;
        if (run is { HadWorkerWhenCancelled: true, StopAcknowledgedAt: null })
        {
            signals.RequestStop(run.Id);
            stopped = await signals.WaitForAcknowledgementAsync(run.Id, TimeSpan.FromSeconds(options.Value.StopDeadlineSeconds), cancellationToken);
            signals.Forget(run.Id);
        }

        var stoppedWithin = await db.Directions.AsNoTracking().Where(d => d.Id == direction.Id).Select(d => d.StoppedWithinSeconds).SingleAsync(cancellationToken);
        var worker = stopped || run?.WorkerId is null
            ? null
            : await db.Workers.AsNoTracking().Where(w => w.Id == run.WorkerId).Select(w => w.Name).SingleOrDefaultAsync(cancellationToken);
        return new CancelDirectionResult(direction.Id, direction.Status.ToString(), stopped, stoppedWithin, worker);
    }

    /// <summary>Labels every pull request the direction's runs opened that is still open; merged work stays merged. Under the project lock.</summary>
    private async Task LabelOpenPullRequestsAsync(Project project, Direction direction, Run run, CancellationToken cancellationToken)
    {
        if (project.Repository is null)
        {
            return;
        }

        var runIds = db.Runs.Where(r => r.DirectionId == direction.Id).Select(r => r.Id);
        var opened = await db.GitHubMutations.AsNoTracking()
            .Where(m => m.Kind == "open_pull_request" && runIds.Contains(m.RunId))
            .Select(m => m.Result)
            .ToListAsync(cancellationToken);
        var numbers = opened.Select(r => JsonDocument.Parse(r).RootElement.GetProperty("number").GetInt32()).Distinct().Order().ToList();
        if (numbers.Count == 0)
        {
            return;
        }

        var labelled = new List<int>();
        var lines = new List<RunLogEntry>();
        foreach (var number in numbers)
        {
            try
            {
                var pull = await gitHub.GetPullRequestAsync(project.RepositoryOwner!, project.RepositoryName!, number, cancellationToken);
                if (pull is null || pull.Merged)
                {
                    continue;
                }

                await gitHub.AddLabelAsync(project.RepositoryOwner!, project.RepositoryName!, number, CancelledLabel, cancellationToken);
                labelled.Add(number);
                lines.Add(new RunLogEntry("tool", $"gh pr edit {number} --add-label {CancelledLabel}"));
            }
            catch (GitHubException e)
            {
                lines.Add(new RunLogEntry("warn", $"Pull request #{number} could not be labelled {CancelledLabel}: {e.Message}"));
            }
        }

        direction.RecordLabelled(labelled);
        await RunLog.AppendAsync(db, events, run, lines, clock.GetUtcNow(), cancellationToken);
    }
}

/// <summary>
/// The worker's control poll: held open up to <c>WaitSeconds</c> while its run executes, it answers <c>Cancel</c>
/// the moment the run is cancelled, or <c>Halt</c> when all workers are stopped, and records that the worker heard
/// it. Null means carry on and poll again.
/// </summary>
public sealed record PollRunControlQuery(Guid RunId, string WorkerId, long Epoch, int WaitSeconds) : IRequest<string?>;

public sealed class PollRunControlHandler(
    IAppDbContext db,
    PipelineOrchestrator pipeline,
    EventAppender events,
    RunControlSignals signals,
    TimeProvider clock) : IRequestHandler<PollRunControlQuery, string?>
{
    public const string Cancel = "Cancel";

    public const string Halt = "Halt";

    public const int MaxWaitSeconds = 30;

    public async Task<string?> Handle(PollRunControlQuery query, CancellationToken cancellationToken)
    {
        var status = await StatusAsync(query, cancellationToken);
        if (status == RunStatus.Leased && query.WaitSeconds > 0)
        {
            var wait = TimeSpan.FromSeconds(Math.Min(query.WaitSeconds, MaxWaitSeconds));
            if (!await signals.WaitForStopAsync(query.RunId, wait, cancellationToken))
            {
                return null;
            }

            status = await StatusAsync(query, cancellationToken);
        }

        if (status is not (RunStatus.Cancelled or RunStatus.Halted))
        {
            return null;
        }

        await AcknowledgeAsync(query.RunId, cancellationToken);
        return status == RunStatus.Halted ? Halt : Cancel;
    }

    /// <summary>The run's status for this worker and epoch; another holder means the lease is lost.</summary>
    private async Task<RunStatus> StatusAsync(PollRunControlQuery query, CancellationToken cancellationToken)
    {
        var run = await db.Runs.AsNoTracking()
            .Where(r => r.Id == query.RunId)
            .Select(r => new { r.Status, r.WorkerId, r.LeaseEpoch })
            .SingleOrDefaultAsync(cancellationToken);
        if (run is null || run.WorkerId != query.WorkerId || run.LeaseEpoch != query.Epoch)
        {
            throw new LeaseLostException();
        }

        return run.Status;
    }

    private async Task AcknowledgeAsync(Guid runId, CancellationToken cancellationToken)
    {
        var projectId = await db.Runs.AsNoTracking().Where(r => r.Id == runId).Select(r => r.ProjectId).SingleAsync(cancellationToken);
        await events.LockAsync(projectId, cancellationToken);
        var run = await db.Runs.SingleAsync(r => r.Id == runId, cancellationToken);
        var now = clock.GetUtcNow();
        if (run.Status == RunStatus.Halted)
        {
            if (run.AcknowledgeStop(now))
            {
                await RunLog.InfoAsync(db, events, run, $"Run halted at step {run.CurrentStep ?? run.CheckpointStep + 1}", now, cancellationToken);
                await db.SaveChangesAsync(cancellationToken);
            }
        }
        else if (run.AcknowledgeStop(now))
        {
            var direction = await db.Directions.SingleAsync(d => d.Id == run.DirectionId, cancellationToken);
            direction.RecordStop(now);
            await RunLog.InfoAsync(db, events, run, $"Run stopped at step {run.CurrentStep ?? run.CheckpointStep + 1}", now, cancellationToken);
            await pipeline.OnDirectionRecordChangedAsync(direction, cancellationToken);
            await db.SaveChangesAsync(cancellationToken);
        }

        await events.PublishAsync(cancellationToken);
        signals.Acknowledge(runId);
    }
}

/// <summary>
/// Wakes a worker's held control poll when its run is cancelled, and wakes Cancel when the worker has heard. In
/// process: the database records the outcome, so a poll or a retry that misses a signal still finds the state.
/// </summary>
public sealed class RunControlSignals
{
    private readonly ConcurrentDictionary<Guid, TaskCompletionSource> _stops = new();
    private readonly ConcurrentDictionary<Guid, TaskCompletionSource> _acknowledgements = new();

    public void RequestStop(Guid runId) => Signal(_stops, runId).TrySetResult();

    public Task<bool> WaitForStopAsync(Guid runId, TimeSpan wait, CancellationToken cancellationToken) =>
        WaitAsync(_stops, runId, wait, cancellationToken);

    public void Acknowledge(Guid runId) => Signal(_acknowledgements, runId).TrySetResult();

    public Task<bool> WaitForAcknowledgementAsync(Guid runId, TimeSpan wait, CancellationToken cancellationToken) =>
        WaitAsync(_acknowledgements, runId, wait, cancellationToken);

    public void Forget(Guid runId)
    {
        _stops.TryRemove(runId, out _);
        _acknowledgements.TryRemove(runId, out _);
    }

    private static TaskCompletionSource Signal(ConcurrentDictionary<Guid, TaskCompletionSource> signals, Guid runId) =>
        signals.GetOrAdd(runId, _ => new TaskCompletionSource(TaskCreationOptions.RunContinuationsAsynchronously));

    private static async Task<bool> WaitAsync(ConcurrentDictionary<Guid, TaskCompletionSource> signals, Guid runId, TimeSpan wait, CancellationToken cancellationToken)
    {
        var signal = Signal(signals, runId);
        var done = await Task.WhenAny(signal.Task, Task.Delay(wait, cancellationToken)) == signal.Task;
        if (!done)
        {
            // Nobody signalled: drop this wait's entry unless a signal arrived meanwhile.
            signals.TryRemove(new KeyValuePair<Guid, TaskCompletionSource>(runId, signal));
        }

        return done;
    }
}

using Hewn.Application.Abstractions;
using Hewn.Application.Events;
using Hewn.Application.Pipeline;
using Hewn.Domain;
using MediatR;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Options;

namespace Hewn.Application.Workers;

public sealed record LeasingDto(bool Stopped, string? ChangedBy, DateTimeOffset? ChangedAt);

public sealed record WorkingOnDto(Guid ProjectId, string ProjectName, int Stage, string StageName);

/// <summary>A registered worker. <c>Holding</c> is true while a run it halted waits at its checkpoint for Start workers.</summary>
public sealed record WorkerDto(
    string Id,
    string Name,
    string Host,
    string Location,
    string Version,
    string Status,
    bool Online,
    DateTimeOffset LastSeenAt,
    DateTimeOffset RegisteredAt,
    WorkingOnDto? WorkingOn,
    bool Holding);

public sealed record WorkersDto(LeasingDto Leasing, IReadOnlyList<WorkerDto> Workers);

/// <summary>The outcome of Stop all workers: <c>Unconfirmed</c> names each worker that didn't hear the halt in time.</summary>
public sealed record StopWorkersResult(bool Stopped, int Halted, IReadOnlyList<string> Unconfirmed);

/// <summary>Reads and stores the leasing switch (L2-029 AC4). No row means leasing is on.</summary>
public static class Leasing
{
    public static async Task<LeasingDto> ReadAsync(IAppDbContext db, CancellationToken cancellationToken) =>
        await db.LeasingSwitches.AsNoTracking()
            .Where(s => s.Id == LeasingSwitch.SingletonId)
            .Select(s => new LeasingDto(s.Stopped, s.ChangedBy, s.ChangedAt))
            .SingleOrDefaultAsync(cancellationToken)
        ?? new LeasingDto(false, null, null);

    public static async Task<LeasingDto> SetAsync(IAppDbContext db, bool stopped, string login, DateTimeOffset now, CancellationToken cancellationToken)
    {
        var current = await db.LeasingSwitches.SingleOrDefaultAsync(s => s.Id == LeasingSwitch.SingletonId, cancellationToken);
        if (current is null)
        {
            db.LeasingSwitches.Add(current = new LeasingSwitch(stopped, login, now));
        }
        else if (current.Stopped != stopped)
        {
            current.Set(stopped, login, now);
        }

        await db.SaveChangesAsync(cancellationToken);
        return new LeasingDto(current.Stopped, current.ChangedBy, current.ChangedAt);
    }
}

public sealed record GetWorkersQuery : IRequest<WorkersDto>;

public sealed class GetWorkersHandler(IAppDbContext db, TimeProvider clock) : IRequestHandler<GetWorkersQuery, WorkersDto>
{
    public async Task<WorkersDto> Handle(GetWorkersQuery query, CancellationToken cancellationToken)
    {
        var leasing = await Leasing.ReadAsync(db, cancellationToken);
        var workers = await db.Workers.AsNoTracking().Where(w => w.RevokedAt == null).OrderBy(w => w.Name).ToListAsync(cancellationToken);
        var runs = await db.Runs.AsNoTracking()
            .Where(r => r.WorkerId != null && (r.Status == RunStatus.Leased || r.Status == RunStatus.Halted))
            .Join(db.Projects, r => r.ProjectId, p => p.Id, (r, p) => new { r.WorkerId, r.Status, r.ProjectId, ProjectName = p.Name, r.Stage })
            .ToListAsync(cancellationToken);
        var onlineSince = clock.GetUtcNow() - Run.LeaseDuration;
        return new WorkersDto(leasing, workers.Select(w =>
        {
            var leased = runs.FirstOrDefault(r => r.WorkerId == w.Id && r.Status == RunStatus.Leased);
            var online = w.LastSeenAt >= onlineSince;
            var status = !online ? WorkerStatus.Offline : leased is null ? WorkerStatus.Idle : WorkerStatus.Busy;
            return new WorkerDto(
                w.Id,
                w.Name,
                w.Host,
                w.Location.ToString(),
                w.Version,
                status.ToString(),
                online,
                w.LastSeenAt,
                w.RegisteredAt,
                leased is null ? null : new WorkingOnDto(leased.ProjectId, leased.ProjectName, leased.Stage, Stages.Names[leased.Stage]),
                runs.Any(r => r.WorkerId == w.Id && r.Status == RunStatus.Halted));
        }).ToList());
    }
}

/// <summary>
/// Stop all workers (L2-029 AC4): leasing is switched off and stored first, then every leased run is halted at its
/// checkpoint, project by project, and each worker hears Halt on its control poll. Waits up to the stop deadline for
/// every worker to confirm; pressing it again waits again for the ones that didn't.
/// </summary>
public sealed record StopWorkersCommand : IRequest<StopWorkersResult>;

public sealed class StopWorkersHandler(
    IAppDbContext db,
    EventAppender events,
    RunControlSignals signals,
    IOptions<PipelineOptions> options,
    ICurrentUser user,
    TimeProvider clock) : IRequestHandler<StopWorkersCommand, StopWorkersResult>
{
    public async Task<StopWorkersResult> Handle(StopWorkersCommand command, CancellationToken cancellationToken)
    {
        await Leasing.SetAsync(db, true, user.Login, clock.GetUtcNow(), cancellationToken);

        // A lease granted before the switch was saved shows up here; none is granted after it.
        var leased = await db.Runs.AsNoTracking().Where(r => r.Status == RunStatus.Leased).Select(r => new { r.Id, r.ProjectId }).ToListAsync(cancellationToken);
        var halted = 0;
        foreach (var project in leased.GroupBy(r => r.ProjectId))
        {
            await events.LockAsync(project.Key, cancellationToken);
            var ids = project.Select(r => r.Id).ToList();
            foreach (var run in await db.Runs.Where(r => ids.Contains(r.Id) && r.Status == RunStatus.Leased).ToListAsync(cancellationToken))
            {
                run.Halt();
                await RunLog.InfoAsync(db, events, run, $"Halted: all workers stopped by {user.Login}; resumes from step {run.CheckpointStep + 1}", clock.GetUtcNow(), cancellationToken);
                halted++;
            }

            await db.SaveChangesAsync(cancellationToken);
            await events.PublishAsync(cancellationToken);
        }

        var waiting = await Unconfirmed().Select(r => r.Id).ToListAsync(cancellationToken);
        var deadline = TimeSpan.FromSeconds(options.Value.StopDeadlineSeconds);
        foreach (var runId in waiting)
        {
            signals.RequestStop(runId);
        }

        await Task.WhenAll(waiting.Select(runId => signals.WaitForAcknowledgementAsync(runId, deadline, cancellationToken)));
        foreach (var runId in waiting)
        {
            signals.Forget(runId);
        }

        var unconfirmed = await Unconfirmed()
            .Join(db.Workers, r => r.WorkerId, w => w.Id, (r, w) => w.Name)
            .Distinct()
            .OrderBy(name => name)
            .ToListAsync(cancellationToken);
        return new StopWorkersResult(unconfirmed.Count == 0, halted, unconfirmed);
    }

    /// <summary>Halted runs whose worker hasn't heard the halt yet.</summary>
    private IQueryable<Run> Unconfirmed() =>
        db.Runs.AsNoTracking().Where(r => r.Status == RunStatus.Halted && r.WorkerId != null && r.StopAcknowledgedAt == null);
}

/// <summary>Start workers: leasing is switched back on and every halted run is queued again, to resume after its checkpoint.</summary>
public sealed record StartWorkersCommand : IRequest<LeasingDto>;

public sealed class StartWorkersHandler(IAppDbContext db, EventAppender events, ICurrentUser user, TimeProvider clock)
    : IRequestHandler<StartWorkersCommand, LeasingDto>
{
    public async Task<LeasingDto> Handle(StartWorkersCommand command, CancellationToken cancellationToken)
    {
        var halted = await db.Runs.AsNoTracking().Where(r => r.Status == RunStatus.Halted).Select(r => new { r.Id, r.ProjectId }).ToListAsync(cancellationToken);
        foreach (var project in halted.GroupBy(r => r.ProjectId))
        {
            await events.LockAsync(project.Key, cancellationToken);
            var ids = project.Select(r => r.Id).ToList();
            foreach (var run in await db.Runs.Where(r => ids.Contains(r.Id) && r.Status == RunStatus.Halted).ToListAsync(cancellationToken))
            {
                run.Release();
                await RunLog.InfoAsync(db, events, run, $"Queued again: workers started by {user.Login}", clock.GetUtcNow(), cancellationToken);
            }

            await db.SaveChangesAsync(cancellationToken);
            await events.PublishAsync(cancellationToken);
        }

        // Queued again before leasing comes back on, so the halted runs keep their place in the queue.
        return await Leasing.SetAsync(db, false, user.Login, clock.GetUtcNow(), cancellationToken);
    }
}

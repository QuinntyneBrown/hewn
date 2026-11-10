using FluentValidation;
using Hewn.Application.Abstractions;
using Hewn.Application.Common;
using Hewn.Application.Events;
using Hewn.Domain;
using MediatR;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Options;

namespace Hewn.Application.Pipeline;

/// <summary><c>TokenId</c> is the issued token the worker connected with; null for the configured development token.</summary>
public sealed record RegisterWorkerCommand(string Name, string Location, string Host, string Version, string? TokenId = null) : IRequest<string>;

public sealed class RegisterWorkerValidator : AbstractValidator<RegisterWorkerCommand>
{
    public RegisterWorkerValidator()
    {
        RuleFor(c => c.Name).NotEmpty().MaximumLength(100);
        RuleFor(c => c.Location).Must(l => Enum.TryParse<WorkerLocation>(l, ignoreCase: true, out _))
            .WithMessage("Location must be Local or Cloud.");
        RuleFor(c => c.Host).NotEmpty().MaximumLength(255);
        RuleFor(c => c.Version).NotEmpty().MaximumLength(64);
    }
}

public sealed class RegisterWorkerHandler(IAppDbContext db, IWorkersNotifier workers, TimeProvider clock) : IRequestHandler<RegisterWorkerCommand, string>
{
    public async Task<string> Handle(RegisterWorkerCommand command, CancellationToken cancellationToken)
    {
        // An issued token names its worker and says where it runs (L2-041); the configured token leaves both to the worker.
        var token = command.TokenId is null
            ? null
            : await db.WorkerTokens.AsNoTracking().Where(t => t.Id == command.TokenId).Select(t => new { t.Name, t.Location }).SingleAsync(cancellationToken);
        var worker = new Worker(
            token?.Name ?? command.Name,
            token?.Location ?? Enum.Parse<WorkerLocation>(command.Location, ignoreCase: true),
            command.Host,
            command.Version,
            clock.GetUtcNow(),
            command.TokenId);
        db.Workers.Add(worker);
        await db.SaveChangesAsync(cancellationToken);
        await workers.WorkersChangedAsync(cancellationToken);
        return worker.Id;
    }
}

public sealed record LeasedRunProject(Guid Id, string Name, string Idea, string? StackPreference, string? Repository);

/// <summary>What the run's direction asks for: the product idea, or the feature to add.</summary>
public sealed record LeasedRunDirection(string Kind, string Idea, bool? HasUiChange);

public sealed record LeasedRunDto(
    Guid RunId,
    long Epoch,
    Guid ProjectId,
    Guid DirectionId,
    int Stage,
    string StageName,
    int CheckpointStep,
    string? CheckpointSha,
    LeasedRunProject Project,
    LeasedRunDirection Direction,
    string SkillsSource,
    decimal DescopeThresholdDays,
    int MaxIterations,
    int Attempt);

public sealed record LeaseRunCommand(string WorkerId) : IRequest<LeasedRunDto?>;

public sealed class LeaseRunHandler(
    IAppDbContext db,
    LeaseService leases,
    PipelineOrchestrator pipeline,
    RepositoryProvisioner provisioner,
    EventAppender events,
    IOptions<PipelineOptions> options,
    Spend.DirectionDefaultsReader defaults,
    TimeProvider clock) : IRequestHandler<LeaseRunCommand, LeasedRunDto?>
{
    public async Task<LeasedRunDto?> Handle(LeaseRunCommand command, CancellationToken cancellationToken)
    {
        var worker = await WorkerLookup.FindAsync(db, command.WorkerId, cancellationToken);
        var run = await leases.TryLeaseAsync(worker.Id, cancellationToken);
        if (run is null)
        {
            worker.Seen(clock.GetUtcNow(), WorkerStatus.Idle);
            await db.SaveChangesAsync(cancellationToken);
            return null;
        }

        var project = await db.Projects.Include(p => p.Directions).SingleAsync(p => p.Id == run.ProjectId, cancellationToken);
        var direction = project.Directions.Single(d => d.Id == run.DirectionId);
        if (run.Stage == 0 && !await ProvisionAsync(run, project, direction, cancellationToken))
        {
            worker.Seen(clock.GetUtcNow(), WorkerStatus.Idle);
            await db.SaveChangesAsync(cancellationToken);
            await events.PublishAsync(cancellationToken);
            return null;
        }

        await pipeline.OnLeasedAsync(run, direction, cancellationToken);
        if (run.LeaseEpoch > 1)
        {
            // Leased before: the Owner sees which worker carries on, and from where (L2-050 AC3).
            await events.LockAsync(run.ProjectId, cancellationToken);
            await RunLog.InfoAsync(db, events, run, $"Resumed by {worker.Name} {LeaseService.After(run.CheckpointStep)}", clock.GetUtcNow(), cancellationToken);
        }

        worker.Seen(clock.GetUtcNow(), WorkerStatus.Busy);
        await db.SaveChangesAsync(cancellationToken);
        await events.PublishAsync(cancellationToken);

        return new LeasedRunDto(
            run.Id,
            run.LeaseEpoch,
            project.Id,
            direction.Id,
            run.Stage,
            Stages.Names[run.Stage],
            run.CheckpointStep,
            run.CheckpointSha,
            new LeasedRunProject(project.Id, project.Name, project.Idea, project.StackPreference, project.Repository),
            new LeasedRunDirection(direction.Kind.ToString(), direction.Idea, direction.HasUiChange),
            options.Value.SkillsSource,
            // The Owner's threshold from Settings, read at each lease (L2-019 AC1).
            (await defaults.ReadAsync(cancellationToken)).DescopeThresholdDays,
            options.Value.MaxIterations,
            run.Attempt);
    }

    /// <summary>Creates or adopts the repository; on refusal fails the run with GitHub's reason and returns false.</summary>
    private async Task<bool> ProvisionAsync(Run run, Project project, Direction direction, CancellationToken cancellationToken)
    {
        try
        {
            if (await provisioner.EnsureRepositoryAsync(project, cancellationToken))
            {
                await pipeline.OnRepositoryAttachedAsync(project, cancellationToken);
            }

            return true;
        }
        catch (GitHubException e)
        {
            await pipeline.OnLeasedAsync(run, direction, cancellationToken);
            run.Fail(SecretRedactor.Redact(e.Message), clock.GetUtcNow());
            await pipeline.OnFailedAsync(run, project, direction, cancellationToken);
            return false;
        }
    }
}

public sealed record HeartbeatCommand(Guid RunId, string WorkerId, long Epoch) : IRequest;

public sealed class HeartbeatHandler(IAppDbContext db, LeaseService leases, TimeProvider clock) : IRequestHandler<HeartbeatCommand>
{
    public async Task Handle(HeartbeatCommand command, CancellationToken cancellationToken)
    {
        var run = await leases.FenceAsync(command.RunId, command.WorkerId, command.Epoch, cancellationToken);
        var now = clock.GetUtcNow();
        run.Renew(now);
        (await WorkerLookup.FindAsync(db, command.WorkerId, cancellationToken)).Seen(now, WorkerStatus.Busy);
        await FencedSave.SaveAsync(db, cancellationToken);
    }
}

public sealed record ReportCheckpointCommand(Guid RunId, string WorkerId, long Epoch, int Step, string? Sha) : IRequest<CheckpointVerdict>;

/// <summary>What the worker does after a checkpoint: carry on, or stop there because an Owner pressed Pause (L2-029 AC1).</summary>
public sealed record CheckpointVerdict(string Verdict)
{
    public static readonly CheckpointVerdict Continue = new("Continue");
    public static readonly CheckpointVerdict Pause = new("Pause");
}

public sealed class ReportCheckpointValidator : AbstractValidator<ReportCheckpointCommand>
{
    public ReportCheckpointValidator()
    {
        RuleFor(c => c.Step).GreaterThan(0);
        RuleFor(c => c.Sha).Matches("^[0-9a-f]{7,64}$").When(c => c.Sha is not null);
    }
}

public sealed class ReportCheckpointHandler(
    IAppDbContext db,
    LeaseService leases,
    PipelineOrchestrator pipeline,
    EventAppender events,
    TimeProvider clock) : IRequestHandler<ReportCheckpointCommand, CheckpointVerdict>
{
    public async Task<CheckpointVerdict> Handle(ReportCheckpointCommand command, CancellationToken cancellationToken)
    {
        var run = await leases.FenceAsync(command.RunId, command.WorkerId, command.Epoch, cancellationToken);
        var now = clock.GetUtcNow();
        run.Checkpoint(command.Step, command.Sha);
        run.Renew(now);

        var pending = await db.Directions.AnyAsync(d => d.Id == run.DirectionId && d.PauseRequestedBy != null, cancellationToken);
        if (!pending)
        {
            await FencedSave.SaveAsync(db, cancellationToken);
            return CheckpointVerdict.Continue;
        }

        // The step in progress has finished and is checkpointed: this is where the requested pause takes effect.
        await events.LockAsync(run.ProjectId, cancellationToken);
        var project = await db.Projects.Include(p => p.Directions).SingleAsync(p => p.Id == run.ProjectId, cancellationToken);
        var direction = project.Directions.Single(d => d.Id == run.DirectionId);
        var sha = command.Sha is null ? string.Empty : $" {command.Sha[..7]}";
        await RunLog.InfoAsync(db, events, run, $"Step {command.Step} finished · checkpoint{sha} · direction Paused", now, cancellationToken);
        await pipeline.OnPauseTakesEffectAsync(run, project, direction, cancellationToken);
        await FencedSave.SaveAsync(db, cancellationToken);
        await events.PublishAsync(cancellationToken);
        return CheckpointVerdict.Pause;
    }
}

public sealed record ReportResultCommand(Guid RunId, string WorkerId, long Epoch, string Outcome, string? Error) : IRequest;

public sealed class ReportResultValidator : AbstractValidator<ReportResultCommand>
{
    public ReportResultValidator()
    {
        RuleFor(c => c.Outcome).Must(o => o is "Succeeded" or "Failed").WithMessage("Outcome must be Succeeded or Failed.");
        RuleFor(c => c.Error).NotEmpty().When(c => c.Outcome == "Failed");
    }
}

public sealed class ReportResultHandler(
    IAppDbContext db,
    LeaseService leases,
    PipelineOrchestrator pipeline,
    EventAppender events,
    TimeProvider clock) : IRequestHandler<ReportResultCommand>
{
    public async Task Handle(ReportResultCommand command, CancellationToken cancellationToken)
    {
        var run = await leases.FenceAsync(command.RunId, command.WorkerId, command.Epoch, cancellationToken);
        var project = await db.Projects.Include(p => p.Directions).SingleAsync(p => p.Id == run.ProjectId, cancellationToken);
        var direction = project.Directions.Single(d => d.Id == run.DirectionId);
        var now = clock.GetUtcNow();

        if (command.Outcome == "Succeeded")
        {
            run.Succeed(now);
            await pipeline.OnSucceededAsync(run, project, direction, cancellationToken);
        }
        else
        {
            var error = SecretRedactor.Redact(command.Error!);
            run.Fail(error.Length > 2000 ? error[..2000] : error, now);
            await pipeline.OnFailedAsync(run, project, direction, cancellationToken);
        }

        (await WorkerLookup.FindAsync(db, command.WorkerId, cancellationToken)).Seen(now, WorkerStatus.Idle);
        await FencedSave.SaveAsync(db, cancellationToken);
        await events.PublishAsync(cancellationToken);
    }
}

internal static class WorkerLookup
{
    public static async Task<Worker> FindAsync(IAppDbContext db, string workerId, CancellationToken cancellationToken) =>
        await db.Workers.SingleOrDefaultAsync(w => w.Id == workerId, cancellationToken) ?? throw new NotFoundException();
}

internal static class FencedSave
{
    /// <summary>Saves; a concurrent re-grant changed the epoch since the fence read it, so the write is refused.</summary>
    public static async Task SaveAsync(IAppDbContext db, CancellationToken cancellationToken)
    {
        try
        {
            await db.SaveChangesAsync(cancellationToken);
        }
        catch (DbUpdateConcurrencyException)
        {
            throw new LeaseLostException();
        }
    }
}

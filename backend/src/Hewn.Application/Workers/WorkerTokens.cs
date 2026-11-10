using System.Security.Cryptography;
using System.Text;
using System.Text.RegularExpressions;
using Hewn.Application.Abstractions;
using Hewn.Application.Common;
using Hewn.Application.Events;
using Hewn.Application.Pipeline;
using Hewn.Domain;
using MediatR;
using Microsoft.EntityFrameworkCore;

namespace Hewn.Application.Workers;

/// <summary>How a worker token becomes the only form Hewn keeps: lower-case hex SHA-256 (L2-041 AC1).</summary>
public static class WorkerTokenHash
{
    public const string Prefix = "hwt_";

    public static string Of(string token) => Convert.ToHexStringLower(SHA256.HashData(Encoding.UTF8.GetBytes(token)));

    /// <summary>32 random bytes, base64url, after the <c>hwt_</c> prefix that lets secret scanners spot it.</summary>
    public static string NewToken() => Prefix + Convert.ToBase64String(RandomNumberGenerator.GetBytes(32))
        .TrimEnd('=').Replace('+', '-').Replace('/', '_');
}

/// <summary>A token just created. <c>Token</c> is the only time it is ever returned.</summary>
public sealed record CreatedWorkerTokenDto(string Id, string Name, string Location, DateTimeOffset ExpiresAt, string Token);

/// <summary>An Owner creates a worker token (L2-041 AC1, AC3).</summary>
public sealed record CreateWorkerTokenCommand(string Name, string Location, int ExpiresInDays, string CreatedBy) : IRequest<CreatedWorkerTokenDto>;

public sealed partial class CreateWorkerTokenHandler(IAppDbContext db, TimeProvider clock) : IRequestHandler<CreateWorkerTokenCommand, CreatedWorkerTokenDto>
{
    public const string NameRule = "Worker name must be 3–40 lowercase letters, digits or hyphens.";

    [GeneratedRegex("^[a-z0-9-]{3,40}$")]
    private static partial Regex NamePattern();

    public async Task<CreatedWorkerTokenDto> Handle(CreateWorkerTokenCommand command, CancellationToken cancellationToken)
    {
        var name = command.Name.Trim();
        var errors = new List<FieldError>();
        if (!NamePattern().IsMatch(name))
        {
            errors.Add(new FieldError("name", NameRule, "The worker name isn't valid"));
        }

        if (!Enum.TryParse<WorkerLocation>(command.Location, ignoreCase: true, out var location) || !Enum.IsDefined(location))
        {
            errors.Add(new FieldError("location", "Choose Local or Cloud.", "Choose a location"));
        }

        if (!WorkerToken.ExpiryDays.Contains(command.ExpiresInDays))
        {
            errors.Add(new FieldError("expiresInDays", "Choose 30 days, 90 days or 1 year.", "Choose an expiry"));
        }

        if (errors.Count > 0)
        {
            throw new FieldValidationException(errors);
        }

        var token = WorkerTokenHash.NewToken();
        var stored = new WorkerToken(name, location, WorkerTokenHash.Of(token), command.CreatedBy, clock.GetUtcNow(), command.ExpiresInDays);
        db.WorkerTokens.Add(stored);
        await db.SaveChangesAsync(cancellationToken);
        return new CreatedWorkerTokenDto(stored.Id, stored.Name, stored.Location.ToString(), stored.ExpiresAt, token);
    }
}

/// <summary>
/// An Owner revokes a worker (L2-041 AC2): its token stops working at once, every worker on that token leaves
/// Workers, and each run they hold is released at its checkpoint and queued for another worker. A held control poll
/// is woken, so the worker hears it lost the lease straight away; every later call it makes is refused.
/// </summary>
public sealed record RevokeWorkerCommand(string WorkerId, string RevokedBy) : IRequest;

public sealed class RevokeWorkerHandler(
    IAppDbContext db,
    EventAppender events,
    RunControlSignals signals,
    IWorkersNotifier workers,
    TimeProvider clock) : IRequestHandler<RevokeWorkerCommand>
{
    public async Task Handle(RevokeWorkerCommand command, CancellationToken cancellationToken)
    {
        var worker = await db.Workers.SingleOrDefaultAsync(w => w.Id == command.WorkerId && w.RevokedAt == null, cancellationToken)
            ?? throw new NotFoundException("worker_not_found", "Worker not found");
        if (worker.TokenId is null)
        {
            throw new ConflictException(
                "configured_token",
                $"{worker.Name} uses the API's configured development token; remove HEWN_WORKER_TOKEN from the API to stop it.");
        }

        var now = clock.GetUtcNow();
        var token = await db.WorkerTokens.SingleAsync(t => t.Id == worker.TokenId, cancellationToken);
        token.Revoke(command.RevokedBy, now);
        var onToken = await db.Workers.Where(w => w.TokenId == token.Id && w.RevokedAt == null).ToListAsync(cancellationToken);
        foreach (var revoked in onToken)
        {
            revoked.Revoke(now);
        }

        // Stored before any run is released, so no request on this token is accepted from here on.
        await db.SaveChangesAsync(cancellationToken);

        var ids = onToken.Select(w => w.Id).ToList();
        var held = await db.Runs.AsNoTracking()
            .Where(r => r.Status == RunStatus.Leased && r.WorkerId != null && ids.Contains(r.WorkerId))
            .Select(r => new { r.Id, r.ProjectId })
            .ToListAsync(cancellationToken);
        foreach (var project in held.GroupBy(r => r.ProjectId))
        {
            await events.LockAsync(project.Key, cancellationToken);
            var runIds = project.Select(r => r.Id).ToList();
            foreach (var run in await db.Runs.Where(r => runIds.Contains(r.Id) && r.Status == RunStatus.Leased).ToListAsync(cancellationToken))
            {
                var name = onToken.First(w => w.Id == run.WorkerId).Name;
                run.Halt();
                run.Release();
                await RunLog.InfoAsync(db, events, run, $"Released: {name}'s token revoked by {command.RevokedBy}; resumes from step {run.CheckpointStep + 1}", now, cancellationToken);
            }

            await db.SaveChangesAsync(cancellationToken);
            await events.PublishAsync(cancellationToken);
        }

        // Wakes the held control poll, which finds the run no longer this worker's; a fresh signal for the next holder.
        foreach (var run in held)
        {
            signals.RequestStop(run.Id);
            signals.Forget(run.Id);
        }

        await workers.WorkersChangedAsync(cancellationToken);
    }
}

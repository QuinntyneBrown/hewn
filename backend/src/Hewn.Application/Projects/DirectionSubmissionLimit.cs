using System.Collections.Concurrent;
using Hewn.Application.Abstractions;
using Hewn.Application.Common;
using MediatR;
using Microsoft.EntityFrameworkCore;

namespace Hewn.Application.Projects;

/// <summary>A request that submits a direction, product or feature; it counts against the Owner's limit.</summary>
public interface IDirectionSubmission;

/// <summary>
/// L2-043 AC4: an Owner submits at most 10 directions (Hewn:RateLimit:DirectionsPerMinute) in any minute; the extra requests are refused with 429 and
/// when they may submit again. The count is of directions stored with the Owner as submitter, by the injected
/// clock, so refused and invalid requests do not count, and the limit survives a restart (ADR 0015).
/// Runs before validation; the anti-forgery filter has already run.
/// </summary>
public sealed class DirectionSubmissionLimit<TRequest, TResponse>(
    IAppDbContext db,
    ICurrentUser user,
    DirectionSubmissionGate gate,
    Microsoft.Extensions.Options.IOptions<Pipeline.PipelineOptions> options,
    TimeProvider clock) : IPipelineBehavior<TRequest, TResponse>
    where TRequest : notnull
{
    public static readonly TimeSpan Window = TimeSpan.FromMinutes(1);

    public async Task<TResponse> Handle(TRequest request, RequestHandlerDelegate<TResponse> next, CancellationToken cancellationToken)
    {
        if (request is not IDirectionSubmission)
        {
            return await next();
        }

        // One submission per Owner at a time, so two at once cannot both be the tenth.
        var turn = gate.For(user.Login);
        await turn.WaitAsync(cancellationToken);
        try
        {
            var perMinute = options.Value.DirectionsPerMinute;
            var now = clock.GetUtcNow();
            var since = now - Window;
            var recent = await db.Directions.AsNoTracking()
                .Where(d => d.SubmittedBy == user.Login && d.SubmittedAt > since)
                .OrderBy(d => d.SubmittedAt)
                .Select(d => d.SubmittedAt)
                .ToListAsync(cancellationToken);
            if (recent.Count >= perMinute)
            {
                var opens = recent[recent.Count - perMinute] + Window;
                var wait = Math.Max(1, (int)Math.Ceiling((opens - now).TotalSeconds));
                throw new TooManyRequestsException(
                    "rate_limited",
                    $"You’ve submitted {recent.Count} directions in the last minute. You can submit again in {wait} seconds.",
                    perMinute,
                    wait);
            }

            return await next();
        }
        finally
        {
            turn.Release();
        }
    }
}

/// <summary>One lock per Owner around counting and storing a submission.</summary>
public sealed class DirectionSubmissionGate
{
    private readonly ConcurrentDictionary<string, SemaphoreSlim> _turns = new(StringComparer.OrdinalIgnoreCase);

    public SemaphoreSlim For(string login) => _turns.GetOrAdd(login, _ => new SemaphoreSlim(1, 1));
}

using Hewn.Application.Abstractions;
using MediatR;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.DependencyInjection;

namespace Hewn.Application.Pipeline;

/// <summary>
/// Wakes held lease requests when work may have been queued, which is whenever project events are published (L2-026 AC5).
/// Waiters take <see cref="Next"/> before they look for work, so a change between looking and waiting isn't missed.
/// </summary>
public sealed class WorkSignal
{
    private TaskCompletionSource _next = New();

    public Task Next => Volatile.Read(ref _next).Task;

    public void Pulse() => Interlocked.Exchange(ref _next, New()).TrySetResult();

    private static TaskCompletionSource New() => new(TaskCreationOptions.RunContinuationsAsynchronously);
}

/// <summary>
/// An idle worker's lease request, held until a run can be leased or the wait ends (L2-026 AC5): the server's push.
/// Each attempt is its own unit of work, so it sees what other requests queued meanwhile.
/// </summary>
public sealed class HeldLease(IServiceScopeFactory scopes, WorkSignal signal)
{
    public const int MaxWaitSeconds = 30;

    public async Task<LeasedRunDto?> LeaseAsync(string workerId, int waitSeconds, CancellationToken cancellationToken)
    {
        // Wall-clock time, not the domain clock: this holds an HTTP request open.
        var wait = TimeSpan.FromSeconds(Math.Clamp(waitSeconds, 0, MaxWaitSeconds));
        var held = System.Diagnostics.Stopwatch.StartNew();
        // Ends the backoff timers when the request is answered, so none outlives it.
        using var answered = CancellationTokenSource.CreateLinkedTokenSource(cancellationToken);
        try
        {
            return await HoldAsync(workerId, wait, held, answered.Token, cancellationToken);
        }
        finally
        {
            await answered.CancelAsync();
        }
    }

    private async Task<LeasedRunDto?> HoldAsync(
        string workerId, TimeSpan wait, System.Diagnostics.Stopwatch held, CancellationToken timers, CancellationToken cancellationToken)
    {
        while (true)
        {
            var changed = signal.Next;
            Task retryDue;
            using (var scope = scopes.CreateScope())
            {
                var run = await scope.ServiceProvider.GetRequiredService<IMediator>().Send(new LeaseRunCommand(workerId), cancellationToken);
                if (run is not null)
                {
                    return run;
                }

                // A retry becomes leasable when its backoff ends, with no event to say so: wake then (L2-006 AC1).
                retryDue = await NextRetryDueAsync(scope.ServiceProvider, timers);
            }

            var remaining = wait - held.Elapsed;
            if (remaining <= TimeSpan.Zero)
            {
                return null;
            }

            var timeout = Task.Delay(remaining, cancellationToken);
            if (await Task.WhenAny(changed, retryDue, timeout) == timeout)
            {
                cancellationToken.ThrowIfCancellationRequested();
                return null;
            }
        }
    }

    private static readonly Task Never = new TaskCompletionSource().Task;

    /// <summary>A task that completes when the earliest queued retry's backoff ends, on the domain clock; never when there is none.</summary>
    private static async Task<Task> NextRetryDueAsync(IServiceProvider services, CancellationToken cancellationToken)
    {
        var db = services.GetRequiredService<IAppDbContext>();
        var clock = services.GetRequiredService<TimeProvider>();
        var now = clock.GetUtcNow();
        var due = (await db.Runs.AsNoTracking()
                .Where(r => r.Status == Hewn.Domain.RunStatus.Queued && r.NotBefore != null)
                .Select(r => r.NotBefore!.Value)
                .ToListAsync(cancellationToken))
            .Where(d => d > now)
            .DefaultIfEmpty(DateTimeOffset.MaxValue)
            .Min();
        return due == DateTimeOffset.MaxValue
            ? Never
            : Task.Delay(due - now, clock, cancellationToken).ContinueWith(_ => { }, TaskScheduler.Default);
    }
}

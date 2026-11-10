using Hewn.Application.Abstractions;
using MediatR;
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
        while (true)
        {
            var changed = signal.Next;
            using (var scope = scopes.CreateScope())
            {
                var run = await scope.ServiceProvider.GetRequiredService<IMediator>().Send(new LeaseRunCommand(workerId), cancellationToken);
                if (run is not null)
                {
                    return run;
                }
            }

            var remaining = wait - held.Elapsed;
            if (remaining <= TimeSpan.Zero)
            {
                return null;
            }

            var timeout = Task.Delay(remaining, cancellationToken);
            if (await Task.WhenAny(changed, timeout) == timeout)
            {
                cancellationToken.ThrowIfCancellationRequested();
                return null;
            }
        }
    }
}

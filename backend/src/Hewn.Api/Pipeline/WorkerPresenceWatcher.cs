using Hewn.Application.Abstractions;
using Hewn.Application.Workers;

namespace Hewn.Api.Pipeline;

/// <summary>
/// Sweeps worker presence every second, so Workers hears within a second when a worker goes Offline or comes back
/// (L2-031 AC1). The sweep reads one small table.
/// </summary>
public sealed class WorkerPresenceWatcher(
    IServiceScopeFactory scopes,
    WorkerPresence presence,
    TimeProvider clock,
    ILogger<WorkerPresenceWatcher> logger) : BackgroundService
{
    private static readonly TimeSpan Interval = TimeSpan.FromSeconds(1);

    protected override async Task ExecuteAsync(CancellationToken stoppingToken)
    {
        using var timer = new PeriodicTimer(Interval, clock);
        do
        {
            try
            {
                using var scope = scopes.CreateScope();
                await presence.SweepAsync(scope.ServiceProvider.GetRequiredService<IAppDbContext>(), stoppingToken);
            }
            catch (Exception e) when (e is not OperationCanceledException)
            {
                logger.LogError(e, "Worker presence sweep failed");
            }
        }
        while (await timer.WaitForNextTickAsync(stoppingToken));
    }
}

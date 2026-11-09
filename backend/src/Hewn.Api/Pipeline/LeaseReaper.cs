using Hewn.Application.Pipeline;

namespace Hewn.Api.Pipeline;

/// <summary>Returns expired leases to the queue once at start-up and every 10 seconds (L2-026 AC3).</summary>
public sealed class LeaseReaper(IServiceScopeFactory scopes, TimeProvider clock, ILogger<LeaseReaper> logger) : BackgroundService
{
    private static readonly TimeSpan Interval = TimeSpan.FromSeconds(10);

    protected override async Task ExecuteAsync(CancellationToken stoppingToken)
    {
        using var timer = new PeriodicTimer(Interval, clock);
        do
        {
            try
            {
                using var scope = scopes.CreateScope();
                var expired = await scope.ServiceProvider.GetRequiredService<LeaseService>().ExpireStaleAsync(stoppingToken);
                if (expired > 0)
                {
                    logger.LogInformation("Returned {Count} expired leases to the queue", expired);
                }
            }
            catch (Exception e) when (e is not OperationCanceledException)
            {
                logger.LogError(e, "Lease expiry sweep failed");
            }
        }
        while (await timer.WaitForNextTickAsync(stoppingToken));
    }
}

using Hewn.Application.Pipeline;

namespace Hewn.Api.Pipeline;

/// <summary>Runs the check poller every 10 seconds; it reads only pull requests GitHub has been silent about for 60 (L2-037 AC1).</summary>
public sealed class CheckPollerService(CheckPoller poller, TimeProvider clock, ILogger<CheckPollerService> logger) : BackgroundService
{
    private static readonly TimeSpan Interval = TimeSpan.FromSeconds(10);

    protected override async Task ExecuteAsync(CancellationToken stoppingToken)
    {
        using var timer = new PeriodicTimer(Interval, clock);
        do
        {
            try
            {
                var polled = await poller.PollAsync(stoppingToken);
                if (polled > 0)
                {
                    logger.LogInformation("Polled the checks of {Count} pull requests with no webhook for 60 seconds", polled);
                }
            }
            catch (Exception e) when (e is not OperationCanceledException)
            {
                logger.LogError(e, "Check poll failed");
            }
        }
        while (await timer.WaitForNextTickAsync(stoppingToken));
    }
}

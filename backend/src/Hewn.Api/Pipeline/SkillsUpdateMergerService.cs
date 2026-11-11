using Hewn.Application.Skills;

namespace Hewn.Api.Pipeline;

/// <summary>Runs the skills update merger every 10 seconds (L2-008 AC2); off with Hewn:Skills:MergerEnabled=false.</summary>
public sealed class SkillsUpdateMergerService(IServiceScopeFactory scopes, TimeProvider clock, ILogger<SkillsUpdateMergerService> logger) : BackgroundService
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
                var merged = await scope.ServiceProvider.GetRequiredService<SkillsUpdateMerger>().SweepAsync(stoppingToken);
                if (merged > 0)
                {
                    logger.LogInformation("Merged {Count} skills updates", merged);
                }
            }
            catch (Exception e) when (e is not OperationCanceledException)
            {
                logger.LogError(e, "Skills update sweep failed");
            }
        }
        while (await timer.WaitForNextTickAsync(stoppingToken));
    }
}

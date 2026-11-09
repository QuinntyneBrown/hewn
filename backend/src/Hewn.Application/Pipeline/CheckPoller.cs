using Hewn.Application.Abstractions;
using Hewn.Domain;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.DependencyInjection;
using Microsoft.Extensions.Logging;

namespace Hewn.Application.Pipeline;

/// <summary>
/// The fallback for a missed webhook (L2-037 AC1): reads the checks of every open increment pull request that
/// GitHub has said nothing about for 60 seconds.
/// </summary>
public sealed class CheckPoller(IServiceScopeFactory scopes, TimeProvider clock, ILogger<CheckPoller> logger)
{
    public static readonly TimeSpan Silence = TimeSpan.FromSeconds(60);

    /// <summary>Polls each pull request that is due; returns how many it read.</summary>
    public async Task<int> PollAsync(CancellationToken cancellationToken)
    {
        using var scope = scopes.CreateScope();
        var db = scope.ServiceProvider.GetRequiredService<IAppDbContext>();
        var due = clock.GetUtcNow() - Silence;
        var open = await (
            from increment in db.Increments
            join direction in db.Directions on increment.DirectionId equals direction.Id
            join project in db.Projects on direction.ProjectId equals project.Id
            where increment.Status == IncrementStatus.InProgress && increment.PullRequestNumber != null
                && project.RepositoryOwner != null && project.RepositoryName != null
            select new { increment.Id, ProjectId = project.Id, Owner = project.RepositoryOwner!, Name = project.RepositoryName!, increment.ChecksHeardAt, increment.PullRequestOpenedAt })
            .ToListAsync(cancellationToken);

        var polled = 0;
        foreach (var pull in open.Where(p => (p.ChecksHeardAt ?? p.PullRequestOpenedAt ?? DateTimeOffset.MinValue) <= due))
        {
            // Each pull request in its own scope, so one GitHub failure leaves the others' records intact.
            using var unit = scopes.CreateScope();
            var services = unit.ServiceProvider;
            try
            {
                var increment = await services.GetRequiredService<IAppDbContext>().Increments.SingleAsync(i => i.Id == pull.Id, cancellationToken);
                var checks = await services.GetRequiredService<IGitHubRepositories>()
                    .ListChecksAsync(pull.Owner, pull.Name, increment.PullRequestNumber!.Value, cancellationToken);
                await services.GetRequiredService<CheckRecorder>().RecordAsync(pull.ProjectId, increment, checks, cancellationToken);
                polled++;
            }
            catch (GitHubException e)
            {
                logger.LogWarning("Could not poll the checks of {Owner}/{Name}: {Message}", pull.Owner, pull.Name, e.Message);
            }
        }

        return polled;
    }
}

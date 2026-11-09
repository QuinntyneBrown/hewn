using Hewn.Application.Abstractions;
using Hewn.Application.Events;
using Hewn.Domain;
using Microsoft.EntityFrameworkCore;

namespace Hewn.Application.Pipeline;

/// <summary>
/// Records what GitHub reports about an increment's pull request checks, from the webhook, the poller or the
/// worker's own reads. Each check whose status or conclusion changed becomes a <c>CheckChanged</c> event on the
/// project's stream (L2-037 AC1, L2-024 AC3), and the increment notes that GitHub was heard from.
/// </summary>
public sealed class CheckRecorder(IAppDbContext db, EventAppender events, TimeProvider clock)
{
    /// <summary>The increment in <paramref name="projectId"/> whose pull request is <paramref name="number"/>, newest direction first.</summary>
    public Task<Increment?> FindAsync(Guid projectId, int number, CancellationToken cancellationToken) =>
        (from increment in db.Increments
         join direction in db.Directions on increment.DirectionId equals direction.Id
         where direction.ProjectId == projectId && increment.PullRequestNumber == number
         orderby direction.SubmittedAt descending
         select increment).FirstOrDefaultAsync(cancellationToken);

    public async Task RecordAsync(Guid projectId, Increment increment, IReadOnlyList<CheckRunInfo> checks, CancellationToken cancellationToken)
    {
        var number = increment.PullRequestNumber ?? throw new InvalidOperationException("The increment has no pull request.");
        // The webhook, the poller and the worker can report the same check at once: the project's lock orders them.
        await events.LockAsync(projectId, cancellationToken);
        var stored = await db.IncrementChecks
            .Where(c => c.IncrementId == increment.Id && c.PullRequestNumber == number)
            .ToListAsync(cancellationToken);
        increment.HeardChecks(clock.GetUtcNow());
        foreach (var check in checks)
        {
            var row = stored.FirstOrDefault(c => c.Name == check.Name);
            if (row is null)
            {
                row = new IncrementCheck(increment.Id, number, check.Name);
                db.IncrementChecks.Add(row);
                stored.Add(row);
            }

            if (row.Update(check.Status, check.Conclusion, check.StartedAt, check.CompletedAt))
            {
                await events.AppendAsync(projectId, "CheckChanged", new
                {
                    directionId = increment.DirectionId,
                    number = increment.Number,
                    pullRequestNumber = number,
                    name = check.Name,
                    status = check.Status,
                    conclusion = check.Conclusion,
                }, cancellationToken);
            }
        }

        await db.SaveChangesAsync(cancellationToken);
        await events.PublishAsync(cancellationToken);
    }
}

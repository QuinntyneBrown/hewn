using Hewn.Application.Abstractions;
using MediatR;
using Microsoft.EntityFrameworkCore;

namespace Hewn.Application.Pipeline;

/// <summary>A verified <c>check_run</c> webhook: the repository, the pull requests it covers, and the check.</summary>
public sealed record RecordCheckRunCommand(string Repository, IReadOnlyList<int> PullRequests, CheckRunInfo Check) : IRequest<int>;

/// <summary>Records the check on each increment whose pull request it covers; returns how many it found.</summary>
public sealed class RecordCheckRunHandler(IAppDbContext db, CheckRecorder recorder) : IRequestHandler<RecordCheckRunCommand, int>
{
    public async Task<int> Handle(RecordCheckRunCommand command, CancellationToken cancellationToken)
    {
        var parts = command.Repository.Split('/');
        if (parts.Length != 2)
        {
            return 0;
        }

        var (owner, name) = (parts[0], parts[1]);
        var projects = await db.Projects.AsNoTracking()
            .Where(p => p.RepositoryOwner == owner && p.RepositoryName == name)
            .Select(p => p.Id)
            .ToListAsync(cancellationToken);
        var found = 0;
        foreach (var projectId in projects)
        {
            foreach (var number in command.PullRequests)
            {
                if (await recorder.FindAsync(projectId, number, cancellationToken) is { } increment)
                {
                    await recorder.RecordAsync(projectId, increment, [command.Check], cancellationToken);
                    found++;
                }
            }
        }

        return found;
    }
}

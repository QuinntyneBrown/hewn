using Hewn.Application.Abstractions;
using MediatR;
using Microsoft.EntityFrameworkCore;

namespace Hewn.Application.Pipeline;

/// <summary>What a log entry about a run carries (L2-049 AC1): its project, direction, stage and own ID.</summary>
public sealed record RunCorrelation(Guid ProjectId, Guid DirectionId, int Stage, Guid RunId);

public sealed record RunCorrelationQuery(Guid RunId) : IRequest<RunCorrelation?>;

public sealed class RunCorrelationHandler(IAppDbContext db) : IRequestHandler<RunCorrelationQuery, RunCorrelation?>
{
    public Task<RunCorrelation?> Handle(RunCorrelationQuery query, CancellationToken cancellationToken) =>
        db.Runs.AsNoTracking()
            .Where(r => r.Id == query.RunId)
            .Select(r => new RunCorrelation(r.ProjectId, r.DirectionId, r.Stage, r.Id))
            .SingleOrDefaultAsync(cancellationToken);
}

using System.Text.Json;
using Hewn.Application.Abstractions;
using Hewn.Application.Common;
using MediatR;
using Microsoft.EntityFrameworkCore;

namespace Hewn.Application.Projects;

public sealed record ProjectEventDto(Guid ProjectId, long Sequence, string Type, JsonElement Payload, DateTimeOffset OccurredAt);

/// <summary>Events after a sequence number, so a reconnecting client can catch up without gaps.</summary>
public sealed record GetProjectEventsQuery(Guid ProjectId, long After) : IRequest<IReadOnlyList<ProjectEventDto>>;

public sealed class GetProjectEventsHandler(IAppDbContext db) : IRequestHandler<GetProjectEventsQuery, IReadOnlyList<ProjectEventDto>>
{
    private const int PageSize = 500;

    public async Task<IReadOnlyList<ProjectEventDto>> Handle(GetProjectEventsQuery query, CancellationToken cancellationToken)
    {
        if (!await db.Projects.AnyAsync(p => p.Id == query.ProjectId, cancellationToken))
        {
            throw new NotFoundException();
        }

        var events = await db.Events.AsNoTracking()
            .Where(e => e.ProjectId == query.ProjectId && e.Sequence > query.After)
            .OrderBy(e => e.Sequence)
            .Take(PageSize)
            .ToListAsync(cancellationToken);
        return events.Select(ToDto).ToList();
    }

    public static ProjectEventDto ToDto(Domain.StoredEvent e) =>
        new(e.ProjectId, e.Sequence, e.Type, JsonDocument.Parse(e.Payload).RootElement.Clone(), e.OccurredAt);
}

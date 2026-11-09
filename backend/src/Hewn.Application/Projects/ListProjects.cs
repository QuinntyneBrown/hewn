using Hewn.Application.Abstractions;
using MediatR;
using Microsoft.EntityFrameworkCore;

namespace Hewn.Application.Projects;

public sealed record ListProjectsQuery : IRequest<IReadOnlyList<ProjectSummaryDto>>;

/// <summary>A project in the list. A feature for a project whose first direction isn't Complete queues behind it.</summary>
public sealed record ProjectSummaryDto(Guid Id, string Name, string? Repository, string Status, bool FirstDirectionComplete);

public sealed class ListProjectsHandler(IAppDbContext db) : IRequestHandler<ListProjectsQuery, IReadOnlyList<ProjectSummaryDto>>
{
    public async Task<IReadOnlyList<ProjectSummaryDto>> Handle(ListProjectsQuery query, CancellationToken cancellationToken)
    {
        var projects = await db.Projects.AsNoTracking().Include(p => p.Directions).ToListAsync(cancellationToken);
        return projects
            .OrderBy(p => p.Name, StringComparer.OrdinalIgnoreCase)
            .Select(p => new ProjectSummaryDto(p.Id, p.Name, p.Repository, p.Status.ToString(), p.FirstDirectionComplete))
            .ToList();
    }
}

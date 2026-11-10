using Hewn.Application.Abstractions;
using Hewn.Application.Common;
using Hewn.Application.Events;
using MediatR;
using Microsoft.EntityFrameworkCore;

namespace Hewn.Application.Projects;

public sealed record ArchiveProjectCommand(Guid ProjectId) : IRequest;

public sealed record RestoreProjectCommand(Guid ProjectId) : IRequest;

/// <summary>
/// L2-003 AC1: moves a project with no active direction under the Archived filter; AC2: a project with a queued,
/// running, paused or blocked direction is refused with "Cancel the running direction first". Archiving an archived
/// project changes nothing.
/// </summary>
public sealed class ArchiveProjectHandler(IAppDbContext db, EventAppender events, ICurrentUser user, TimeProvider clock)
    : IRequestHandler<ArchiveProjectCommand>
{
    public async Task Handle(ArchiveProjectCommand command, CancellationToken cancellationToken)
    {
        var project = await db.Projects.Include(p => p.Directions)
            .SingleOrDefaultAsync(p => p.Id == command.ProjectId, cancellationToken)
            ?? throw new NotFoundException();
        if (project.HasActiveDirection)
        {
            throw new ConflictException("active_direction", "Cancel the running direction first");
        }

        if (!project.Archive(user.Login, clock.GetUtcNow()))
        {
            return;
        }

        await events.AppendAsync(project.Id, "ProjectArchived", new { by = user.Login }, cancellationToken);
        await db.SaveChangesAsync(cancellationToken);
        await events.PublishAsync(cancellationToken);
    }
}

/// <summary>L2-003 AC1: returns an archived project to the default list. Restoring one that isn't archived changes nothing.</summary>
public sealed class RestoreProjectHandler(IAppDbContext db, EventAppender events, ICurrentUser user)
    : IRequestHandler<RestoreProjectCommand>
{
    public async Task Handle(RestoreProjectCommand command, CancellationToken cancellationToken)
    {
        var project = await db.Projects.SingleOrDefaultAsync(p => p.Id == command.ProjectId, cancellationToken)
            ?? throw new NotFoundException();
        if (!project.Restore())
        {
            return;
        }

        await events.AppendAsync(project.Id, "ProjectRestored", new { by = user.Login }, cancellationToken);
        await db.SaveChangesAsync(cancellationToken);
        await events.PublishAsync(cancellationToken);
    }
}

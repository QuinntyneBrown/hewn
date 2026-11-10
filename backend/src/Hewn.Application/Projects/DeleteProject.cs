using Hewn.Application.Abstractions;
using Hewn.Application.Common;
using MediatR;
using Microsoft.EntityFrameworkCore;

namespace Hewn.Application.Projects;

public sealed record DeleteProjectCommand(Guid ProjectId, string? ConfirmName) : IRequest;

/// <summary>
/// L2-003 AC3: deletes Hewn's records for a project once the Owner has typed its name exactly: its directions and
/// their stages, runs, events, log lines, decisions, model calls, GitHub mutations, increments and their checks, and
/// skills updates. Everything goes in one save, so a failure removes nothing. GitHub is never called: the repository
/// is kept. AC2: a project with an active direction is refused with "Cancel the running direction first".
/// </summary>
public sealed class DeleteProjectHandler(IAppDbContext db, IProjectEventPublisher publisher)
    : IRequestHandler<DeleteProjectCommand>
{
    public async Task Handle(DeleteProjectCommand command, CancellationToken cancellationToken)
    {
        var project = await db.Projects.Include(p => p.Directions)
            .SingleOrDefaultAsync(p => p.Id == command.ProjectId, cancellationToken)
            ?? throw new NotFoundException();
        if (project.HasActiveDirection)
        {
            throw new ConflictException("active_direction", "Cancel the running direction first");
        }

        if (!string.Equals(command.ConfirmName, project.Name, StringComparison.Ordinal))
        {
            throw new FieldValidationException(
                [new FieldError("confirmName", $"Type {project.Name} exactly to delete it.", "The name doesn't match")],
                "confirm_name");
        }

        var runIds = await db.Runs.Where(r => r.ProjectId == project.Id).Select(r => r.Id).ToListAsync(cancellationToken);
        var directionIds = project.Directions.Select(d => d.Id).ToList();
        var increments = await db.Increments.Where(i => directionIds.Contains(i.DirectionId)).ToListAsync(cancellationToken);
        var incrementIds = increments.Select(i => i.Id).ToList();

        db.IncrementChecks.RemoveRange(await db.IncrementChecks.Where(c => incrementIds.Contains(c.IncrementId)).ToListAsync(cancellationToken));
        db.Increments.RemoveRange(increments);
        db.RunLogLines.RemoveRange(await db.RunLogLines.Where(l => runIds.Contains(l.RunId)).ToListAsync(cancellationToken));
        db.RunDecisions.RemoveRange(await db.RunDecisions.Where(d => d.ProjectId == project.Id).ToListAsync(cancellationToken));
        db.ModelCalls.RemoveRange(await db.ModelCalls.Where(c => c.ProjectId == project.Id).ToListAsync(cancellationToken));
        db.GitHubMutations.RemoveRange(await db.GitHubMutations.Where(m => runIds.Contains(m.RunId)).ToListAsync(cancellationToken));
        db.Runs.RemoveRange(await db.Runs.Where(r => r.ProjectId == project.Id).ToListAsync(cancellationToken));
        db.Events.RemoveRange(await db.Events.Where(e => e.ProjectId == project.Id).ToListAsync(cancellationToken));
        db.SkillsUpdates.RemoveRange(await db.SkillsUpdates.Where(u => u.ProjectId == project.Id).ToListAsync(cancellationToken));
        db.Directions.RemoveRange(project.Directions);
        db.Projects.Remove(project);
        await db.SaveChangesAsync(cancellationToken);

        await publisher.ProjectDeletedAsync(project.Id, cancellationToken);
    }
}

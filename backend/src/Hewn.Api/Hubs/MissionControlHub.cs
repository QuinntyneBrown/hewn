using Hewn.Application.Abstractions;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.SignalR;
using Microsoft.EntityFrameworkCore;

namespace Hewn.Api.Hubs;

/// <summary>Live updates for signed-in users. A client joins a project's group and receives its stored events.</summary>
[Authorize]
public sealed class MissionControlHub(IAppDbContext db) : Hub
{
    public const string Path = "/hubs/mission-control";

    public static string ProjectGroup(Guid projectId) => $"project:{projectId}";

    /// <summary>Clients on the Projects page; they receive each changed project's row (L2-002 AC4).</summary>
    public const string ProjectsGroup = "projects";

    public async Task JoinProject(Guid projectId)
    {
        if (!await db.Projects.AnyAsync(p => p.Id == projectId, Context.ConnectionAborted))
        {
            throw new HubException("Project not found.");
        }

        await Groups.AddToGroupAsync(Context.ConnectionId, ProjectGroup(projectId), Context.ConnectionAborted);
    }

    public Task JoinProjects() => Groups.AddToGroupAsync(Context.ConnectionId, ProjectsGroup, Context.ConnectionAborted);

    public Task LeaveProjects() => Groups.RemoveFromGroupAsync(Context.ConnectionId, ProjectsGroup, Context.ConnectionAborted);

    public Task LeaveProject(Guid projectId) =>
        Groups.RemoveFromGroupAsync(Context.ConnectionId, ProjectGroup(projectId), Context.ConnectionAborted);
}

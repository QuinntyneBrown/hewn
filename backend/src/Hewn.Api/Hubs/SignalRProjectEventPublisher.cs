using Hewn.Application.Abstractions;
using Hewn.Application.Projects;
using Hewn.Domain;
using Microsoft.AspNetCore.SignalR;

namespace Hewn.Api.Hubs;

public sealed class SignalRProjectEventPublisher(IHubContext<MissionControlHub> hub, IServiceScopeFactory scopes) : IProjectEventPublisher
{
    /// <summary>Events that never change a project's row: its log and its recorded decisions.</summary>
    private static readonly HashSet<string> RowNeutral = ["LogLines", "DecisionRecorded"];

    public async Task ProjectDeletedAsync(Guid projectId, CancellationToken cancellationToken)
    {
        var deleted = new { projectId };
        await hub.Clients.Group(MissionControlHub.ProjectsGroup).SendAsync("ProjectDeleted", deleted, cancellationToken);
        await hub.Clients.Group(MissionControlHub.ProjectGroup(projectId)).SendAsync("ProjectDeleted", deleted, cancellationToken);
    }

    public async Task PublishAsync(IReadOnlyList<StoredEvent> events, CancellationToken cancellationToken)
    {
        foreach (var stored in events)
        {
            await hub.Clients.Group(MissionControlHub.ProjectGroup(stored.ProjectId))
                .SendAsync("ProjectEvent", GetProjectEventsHandler.ToDto(stored), cancellationToken);
        }

        // A stage starting, finishing or stopping changes what a worker is doing: the Workers view reads the list again.
        if (events.Any(e => e.Type == Hewn.Application.Pipeline.PipelineOrchestrator.StageChanged))
        {
            await hub.Clients.Group(MissionControlHub.WorkersGroup).SendAsync("WorkersChanged", cancellationToken);
        }

        // The Projects page gets each changed project's row, read after the events were stored (L2-002 AC4, ADR 0016).
        var changed = events.Where(e => !RowNeutral.Contains(e.Type)).Select(e => e.ProjectId).Distinct().ToList();
        if (changed.Count == 0)
        {
            return;
        }

        await using var scope = scopes.CreateAsyncScope();
        var reader = scope.ServiceProvider.GetRequiredService<ProjectSummaryReader>();
        foreach (var projectId in changed)
        {
            foreach (var row in await reader.ReadAsync(projectId, cancellationToken))
            {
                await hub.Clients.Group(MissionControlHub.ProjectsGroup).SendAsync("ProjectSummary", row, cancellationToken);
            }
        }
    }
}

using Hewn.Application.Abstractions;
using Hewn.Application.Projects;
using Hewn.Domain;
using Microsoft.AspNetCore.SignalR;

namespace Hewn.Api.Hubs;

public sealed class SignalRProjectEventPublisher(IHubContext<MissionControlHub> hub) : IProjectEventPublisher
{
    public async Task PublishAsync(IReadOnlyList<StoredEvent> events, CancellationToken cancellationToken)
    {
        foreach (var stored in events)
        {
            await hub.Clients.Group(MissionControlHub.ProjectGroup(stored.ProjectId))
                .SendAsync("ProjectEvent", GetProjectEventsHandler.ToDto(stored), cancellationToken);
        }
    }
}

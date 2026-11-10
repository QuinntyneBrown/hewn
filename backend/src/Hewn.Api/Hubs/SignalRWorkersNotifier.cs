using Hewn.Application.Abstractions;
using Microsoft.AspNetCore.SignalR;

namespace Hewn.Api.Hubs;

/// <summary>Sends "WorkersChanged" to clients on the Workers view; they read the list again.</summary>
public sealed class SignalRWorkersNotifier(IHubContext<MissionControlHub> hub) : IWorkersNotifier
{
    public Task WorkersChangedAsync(CancellationToken cancellationToken) =>
        hub.Clients.Group(MissionControlHub.WorkersGroup).SendAsync("WorkersChanged", cancellationToken);
}

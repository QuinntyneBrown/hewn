// Acceptance Test
// Traces to: L2-030, L2-031, L2-039
// Description: Mission Control receives each stored pipeline event live, in sequence, only for projects it may see

using System.Collections.Concurrent;
using System.Net;
using System.Text.Json;
using Hewn.Api.Tests.Support;
using Hewn.Domain;
using Microsoft.AspNetCore.Http.Connections;
using Microsoft.AspNetCore.SignalR;
using Microsoft.AspNetCore.SignalR.Client;

namespace Hewn.Api.Tests.Pipeline;

public sealed class MissionControlHubTests : IAsyncLifetime
{
    private readonly HewnApiFactory _factory = new();

    public Task InitializeAsync() => Task.CompletedTask;

    public async Task DisposeAsync() => await _factory.DisposeAsync();

    private HubConnection Connect(HewnClient client)
    {
        var cookies = client.CookieHeader();
        return new HubConnectionBuilder()
            .WithUrl(new Uri(_factory.Server.BaseAddress, "/hubs/mission-control"), o =>
            {
                o.HttpMessageHandlerFactory = _ => _factory.Server.CreateHandler();
                o.Transports = HttpTransportType.LongPolling;
                o.Headers["Cookie"] = cookies;
            })
            .Build();
    }

    [Fact]
    public async Task A_joined_client_receives_stage_changes_with_increasing_sequence_numbers()
    {
        var owner = await _factory.SignInAsync("quinntynebrown", Role.Owner);
        var submitted = await owner.PostAsync("/api/projects", new
        {
            name = "Ledgerline",
            idea = "A web app for small accounting teams to reconcile statements.",
            stackPreference = (string?)null,
            repositoryUrl = (string?)null,
            budgetUsd = 300m,
        });
        var projectId = (await HewnClient.ReadJsonAsync(submitted)).GetProperty("projectId").GetGuid();
        var received = new ConcurrentQueue<JsonElement>();
        await using var hub = Connect(owner);
        hub.On<JsonElement>("ProjectEvent", e => received.Enqueue(e));
        await hub.StartAsync();
        await hub.InvokeAsync("JoinProject", projectId);

        var worker = await _factory.RegisterWorkerAsync();
        var run = await worker.LeaseAsync();
        (await worker.SucceedAsync(run!)).EnsureSuccessStatusCode();

        var events = await WaitForAsync(received, 3);
        Assert.Equal([2L, 3L, 4L], events.Select(e => e.GetProperty("sequence").GetInt64()).Take(3));
        var stageChanges = events.Where(e => e.GetProperty("type").GetString() == "StageChanged").ToList();
        Assert.Equal("Running", stageChanges[0].GetProperty("payload").GetProperty("status").GetString());
        Assert.Equal(projectId, events[0].GetProperty("projectId").GetGuid());
    }

    [Fact]
    public async Task Joining_a_project_that_does_not_exist_is_refused()
    {
        var owner = await _factory.SignInAsync("quinntynebrown", Role.Owner);
        await using var hub = Connect(owner);
        await hub.StartAsync();

        var error = await Assert.ThrowsAsync<HubException>(() => hub.InvokeAsync("JoinProject", Guid.NewGuid()));

        Assert.Contains("not found", error.Message, StringComparison.OrdinalIgnoreCase);
    }

    [Fact]
    public async Task The_hub_refuses_unauthenticated_connections()
    {
        var response = await _factory.CreateAnonymousClient().PostAsync("/hubs/mission-control/negotiate?negotiateVersion=1", null);

        Assert.Equal(HttpStatusCode.Unauthorized, response.StatusCode);
    }

    private static async Task<List<JsonElement>> WaitForAsync(ConcurrentQueue<JsonElement> queue, int count)
    {
        var deadline = DateTime.UtcNow.AddSeconds(5);
        while (queue.Count < count && DateTime.UtcNow < deadline)
        {
            await Task.Delay(25);
        }

        Assert.True(queue.Count >= count, $"Expected {count} events, got {queue.Count}.");
        return [.. queue];
    }
}

// Acceptance Test
// Traces to: L2-026, L2-031
// Description: A worker that registers appears in Mission Control's Workers view within 2 seconds: clients on Workers are told the moment a worker registers, leases a run or finishes one (L2-026 AC1, AC2), and when one goes offline after 60 seconds without a heartbeat or comes back (L2-031 AC1)

using System.Collections.Concurrent;
using System.Diagnostics;
using Hewn.Api.Tests.Support;
using Hewn.Domain;
using Microsoft.AspNetCore.Http.Connections;
using Microsoft.AspNetCore.SignalR.Client;

namespace Hewn.Api.Tests.Workers;

public sealed class WorkersLiveTests : IAsyncLifetime
{
    private readonly HewnApiFactory _factory = new();

    public Task InitializeAsync() => Task.CompletedTask;

    public async Task DisposeAsync() => await _factory.DisposeAsync();

    private async Task<(HubConnection Hub, ConcurrentQueue<long> Changes)> FollowWorkersAsync(HewnClient user)
    {
        var changes = new ConcurrentQueue<long>();
        var clock = Stopwatch.StartNew();
        var cookies = user.CookieHeader();
        var hub = new HubConnectionBuilder()
            .WithUrl(new Uri(_factory.Server.BaseAddress, "/hubs/mission-control"), o =>
            {
                o.HttpMessageHandlerFactory = _ => _factory.Server.CreateHandler();
                o.Transports = HttpTransportType.LongPolling;
                o.Headers["Cookie"] = cookies;
            })
            .Build();
        hub.On("WorkersChanged", () => changes.Enqueue(clock.ElapsedMilliseconds));
        await hub.StartAsync();
        await hub.InvokeAsync("JoinWorkers");
        return (hub, changes);
    }

    private static async Task<bool> ArrivesAsync(ConcurrentQueue<long> changes, int count)
    {
        var deadline = Stopwatch.StartNew();
        while (deadline.Elapsed < TimeSpan.FromSeconds(2))
        {
            if (changes.Count >= count)
            {
                return true;
            }

            await Task.Delay(20);
        }

        return false;
    }

    [Fact]
    public async Task Clients_on_Workers_are_told_within_2_seconds_when_a_worker_registers_leases_and_finishes()
    {
        var viewer = await _factory.SignInAsync("ada", Role.Viewer);
        var owner = await _factory.SignInAsync("quinntynebrown", Role.Owner);
        var (hub, changes) = await FollowWorkersAsync(viewer);
        await using var _ = hub;

        var worker = await _factory.RegisterWorkerAsync();
        Assert.True(await ArrivesAsync(changes, 1), "told of the registration");

        await owner.PostAsync("/api/projects", new { name = "Ledgerline", idea = "A web app for small accounting teams.", budgetUsd = 300m });
        var before = changes.Count;
        var run = await worker.LeaseAsync();
        Assert.NotNull(run);
        Assert.True(await ArrivesAsync(changes, before + 1), "told of the lease");

        before = changes.Count;
        (await worker.SucceedAsync(run)).EnsureSuccessStatusCode();
        Assert.True(await ArrivesAsync(changes, before + 1), "told the run finished");
    }

    [Fact]
    public async Task Clients_on_Workers_are_told_when_a_worker_goes_offline_and_when_it_comes_back()
    {
        var viewer = await _factory.SignInAsync("ada", Role.Viewer);
        var worker = await _factory.RegisterWorkerAsync();
        var (hub, changes) = await FollowWorkersAsync(viewer);
        await using var _ = hub;
        await _factory.SweepWorkerPresenceAsync();

        // Nothing changed: nobody is told.
        _factory.Clock.Advance(TimeSpan.FromSeconds(30));
        await _factory.SweepWorkerPresenceAsync();
        Assert.False(await ArrivesAsync(changes, 1), "told although nothing changed");

        // 60 seconds since its last heartbeat: it is Offline, and Workers is told.
        _factory.Clock.Advance(TimeSpan.FromSeconds(31));
        await _factory.SweepWorkerPresenceAsync();
        Assert.True(await ArrivesAsync(changes, 1), "told it went offline");
        var listed = (await HewnClient.ReadJsonAsync(await viewer.GetAsync("/api/workers"))).GetProperty("workers")[0];
        Assert.Equal("Offline", listed.GetProperty("status").GetString());

        // It asks for work again: it is back, and Workers is told.
        await worker.LeaseAsync();
        await _factory.SweepWorkerPresenceAsync();
        Assert.True(await ArrivesAsync(changes, 2), "told it came back");
    }
}

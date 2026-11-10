// Acceptance Test
// Traces to: L2-050, L2-026
// Description: After the API restarts mid-run nothing acknowledged is lost, and each lease is either kept by its worker's next heartbeat or expires after 60 seconds and resumes on another worker from its checkpoint (L2-050 AC1, AC2, AC3; L2-026 AC3)

using System.Net;
using Hewn.Api.Tests.Support;
using Hewn.Domain;

namespace Hewn.Api.Tests.Recovery;

public sealed class ServerRestartTests : IAsyncLifetime
{
    private HewnApiFactory _factory = new(databaseFile: true);

    public Task InitializeAsync() => Task.CompletedTask;

    public async Task DisposeAsync() => await _factory.DisposeAsync();

    /// <summary>Submits a direction, leases its first run and reports two completed steps.</summary>
    private async Task<(Guid ProjectId, WorkerClient Worker, LeasedRun Run)> RunningAsync()
    {
        var owner = await _factory.SignInAsync("quinntynebrown", Role.Owner);
        var response = await owner.PostAsync("/api/projects", new
        {
            name = "Seed Swap",
            idea = "A seed swap register for a community garden.",
            stackPreference = (string?)null,
            repositoryUrl = (string?)null,
            budgetUsd = 300m,
        });
        Assert.Equal(HttpStatusCode.Created, response.StatusCode);
        var projectId = (await HewnClient.ReadJsonAsync(response)).GetProperty("projectId").GetGuid();
        var worker = await _factory.RegisterWorkerAsync("worker-a");
        var run = (await worker.LeaseAsync())!;
        (await worker.CheckpointAsync(run, 1)).EnsureSuccessStatusCode();
        (await worker.CheckpointAsync(run, 2)).EnsureSuccessStatusCode();
        return (projectId, worker, run);
    }

    private async Task RestartAsync()
    {
        var restarted = _factory.Restart();
        await _factory.DisposeAsync();
        _factory = restarted;
    }

    [Fact]
    public async Task After_a_restart_the_direction_is_there_and_the_worker_keeps_its_lease_with_its_next_heartbeat()
    {
        var (projectId, worker, run) = await RunningAsync();

        await RestartAsync();

        var owner = await _factory.SignInAsync("quinntynebrown", Role.Owner);
        var project = await HewnClient.ReadJsonAsync(await owner.GetAsync($"/api/projects/{projectId}"));
        var stage0 = project.GetProperty("directions")[0].GetProperty("stages")[0];
        Assert.Equal("Running", stage0.GetProperty("status").GetString());

        // The worker's next heartbeat reaches the new process and keeps the lease.
        var again = worker.Reconnect(_factory.CreateAnonymousClient());
        _factory.Clock.Advance(TimeSpan.FromSeconds(10));
        (await again.HeartbeatAsync(run)).EnsureSuccessStatusCode();
        _factory.Clock.Advance(TimeSpan.FromSeconds(55));
        await _factory.ExpireStaleLeasesAsync();
        Assert.Null(await (await _factory.RegisterWorkerAsync("worker-b")).LeaseAsync());
        (await again.CheckpointAsync(run, 3)).EnsureSuccessStatusCode();
        (await again.SucceedAsync(run)).EnsureSuccessStatusCode();
    }

    [Fact]
    public async Task A_lease_whose_worker_never_comes_back_expires_after_a_restart_and_resumes_from_its_checkpoint()
    {
        var (_, worker, run) = await RunningAsync();

        await RestartAsync();

        var replacement = await _factory.RegisterWorkerAsync("worker-b");
        _factory.Clock.Advance(TimeSpan.FromSeconds(61));
        await _factory.ExpireStaleLeasesAsync();
        var resumed = (await replacement.LeaseAsync())!;
        Assert.Equal(run.RunId, resumed.RunId);
        Assert.Equal(2, resumed.CheckpointStep);
        Assert.Equal(run.Epoch + 1, resumed.Epoch);

        // The old worker turns up late: it is fenced out.
        var late = await worker.Reconnect(_factory.CreateAnonymousClient()).HeartbeatAsync(run);
        Assert.Equal(HttpStatusCode.Conflict, late.StatusCode);
        Assert.Equal("lease_lost", (await HewnClient.ReadJsonAsync(late)).GetProperty("code").GetString());
    }
}

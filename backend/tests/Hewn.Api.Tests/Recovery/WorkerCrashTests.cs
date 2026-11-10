// Acceptance Test
// Traces to: L2-026, L2-050
// Description: When a worker stops heartbeating mid-run the Owner can follow the recovery in the run log: the lease expires after 60 seconds and another worker resumes after the last checkpoint (L2-026 AC3, L2-050 AC3)

using System.Net;
using Hewn.Api.Tests.Support;
using Hewn.Domain;

namespace Hewn.Api.Tests.Recovery;

public sealed class WorkerCrashTests : IAsyncLifetime
{
    private readonly HewnApiFactory _factory = new();

    public Task InitializeAsync() => Task.CompletedTask;

    public async Task DisposeAsync() => await _factory.DisposeAsync();

    private static async Task<List<string?>> LogAsync(HewnClient client, Guid projectId) =>
        (await HewnClient.ReadJsonAsync(await client.GetAsync($"/api/projects/{projectId}/events?after=0"))).EnumerateArray()
            .Where(e => e.GetProperty("type").GetString() == "LogLines")
            .SelectMany(e => e.GetProperty("payload").GetProperty("lines").EnumerateArray())
            .Select(l => l.GetProperty("text").GetString())
            .ToList();

    [Fact]
    public async Task The_log_says_when_a_lease_expires_and_which_worker_resumes_after_which_step()
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
        var crashed = await _factory.RegisterWorkerAsync("laptop-1");
        var run = (await crashed.LeaseAsync())!;
        (await crashed.CheckpointAsync(run, 2)).EnsureSuccessStatusCode();

        _factory.Clock.Advance(TimeSpan.FromSeconds(61));
        await _factory.ExpireStaleLeasesAsync();
        Assert.Contains("Lease expired: no heartbeat from laptop-1 for 60 seconds; queued again after step 2", await LogAsync(owner, projectId));

        var standby = await _factory.RegisterWorkerAsync("cloud-1");
        var resumed = (await standby.LeaseAsync())!;
        Assert.Equal(2, resumed.CheckpointStep);
        Assert.Contains("Resumed by cloud-1 after step 2", await LogAsync(owner, projectId));
    }
}

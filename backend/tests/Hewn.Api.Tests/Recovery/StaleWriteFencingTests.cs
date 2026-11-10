// Acceptance Test
// Traces to: L2-026, L2-050
// Description: A lease is never moved while a GitHub write under it is in flight: the expiry waits for the write, and the stale worker's next write is refused (L2-026 AC3, L2-050 AC3)

using System.Net;
using System.Net.Http.Json;
using System.Text;
using Hewn.Api.Tests.Support;
using Hewn.Domain;

namespace Hewn.Api.Tests.Recovery;

public sealed class StaleWriteFencingTests : IAsyncLifetime
{
    private readonly HewnApiFactory _factory = new();

    public Task InitializeAsync() => Task.CompletedTask;

    public async Task DisposeAsync() => await _factory.DisposeAsync();

    private async Task SubmitAsync()
    {
        var owner = await _factory.SignInAsync("quinntynebrown", Role.Owner);
        var response = await owner.PostAsync("/api/projects", new
        {
            name = "Kiln Booking & Co.",
            idea = "Booking firing slots for a shared pottery kiln.",
            stackPreference = (string?)null,
            repositoryUrl = (string?)null,
            budgetUsd = 300m,
        });
        Assert.Equal(HttpStatusCode.Created, response.StatusCode);
    }

    private static Task<HttpResponseMessage> CommitAsync(WorkerClient worker, LeasedRun run, string key) =>
        worker.Http.PostAsJsonAsync($"/api/worker/runs/{run.RunId}/github/mutations", new
        {
            workerId = worker.WorkerId,
            epoch = run.Epoch,
            kind = "commit",
            idempotencyKey = $"{run.RunId}/{key}",
            message = "Bootstrap skills",
            files = new[] { new { path = ".hewn/skills.lock", contentBase64 = Convert.ToBase64String(Encoding.UTF8.GetBytes(key)) } },
        });

    [Fact]
    public async Task An_expiry_waits_for_a_write_in_flight_and_the_stale_worker_cannot_write_after_it()
    {
        await SubmitAsync();
        var stale = await _factory.RegisterWorkerAsync("worker-a");
        var run = (await stale.LeaseAsync())!;
        var entered = new TaskCompletionSource(TaskCreationOptions.RunContinuationsAsynchronously);
        var release = new TaskCompletionSource(TaskCreationOptions.RunContinuationsAsynchronously);
        _factory.GitHub.BeforeCommit = () =>
        {
            entered.TrySetResult();
            return release.Task;
        };

        // The worker's write reaches GitHub under a valid lease, then the worker goes quiet past 60 seconds.
        var inFlight = CommitAsync(stale, run, "2/commit");
        await entered.Task.WaitAsync(TimeSpan.FromSeconds(10));
        _factory.Clock.Advance(TimeSpan.FromSeconds(61));
        var expiry = _factory.ExpireStaleLeasesAsync();

        // The lease is not moved while the write is in flight.
        await Task.Delay(300);
        Assert.False(expiry.IsCompleted, "the lease expired while a write under it was in flight");

        _factory.GitHub.BeforeCommit = null;
        release.SetResult();
        (await inFlight).EnsureSuccessStatusCode();
        await expiry.WaitAsync(TimeSpan.FromSeconds(10));

        // Another worker resumes the run; the stale worker's next write is refused and reaches no repository.
        var replacement = await _factory.RegisterWorkerAsync("worker-b");
        var resumed = (await replacement.LeaseAsync())!;
        Assert.Equal(run.RunId, resumed.RunId);
        Assert.Equal(run.Epoch + 1, resumed.Epoch);
        var commits = _factory.GitHub.Repository("hewn-builds", "kiln-booking-co")!.Commits.Count;
        var refused = await CommitAsync(stale, run, "3/commit");
        Assert.Equal(HttpStatusCode.Conflict, refused.StatusCode);
        Assert.Equal("lease_lost", (await HewnClient.ReadJsonAsync(refused)).GetProperty("code").GetString());
        Assert.Equal(commits, _factory.GitHub.Repository("hewn-builds", "kiln-booking-co")!.Commits.Count);
    }
}

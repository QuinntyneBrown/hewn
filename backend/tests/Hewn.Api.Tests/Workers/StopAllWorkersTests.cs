// Acceptance Test
// Traces to: L2-029
// Description: An Owner stops all workers: every active run halts within 10 seconds and keeps its checkpoint, nothing is leased (even after a restart) until the Owner starts workers, and the halted runs then resume from their checkpoints; a worker that doesn't answer is named; Viewers get 403

using System.Diagnostics;
using System.Net;
using System.Net.Http.Json;
using System.Text.Json;
using Hewn.Api.Tests.Support;
using Hewn.Domain;

namespace Hewn.Api.Tests.Workers;

public sealed class StopAllWorkersTests : IAsyncLifetime
{
    // A database file, not the shared in-memory connection: the control polls and Stop run at the same time.
    private HewnApiFactory _factory = new(databaseFile: true);

    public Task InitializeAsync() => Task.CompletedTask;

    public async Task DisposeAsync() => await _factory.DisposeAsync();

    private async Task<Guid> SubmitAsync(HewnClient owner, string name)
    {
        var submitted = await owner.PostAsync("/api/projects", new
        {
            name,
            idea = "A web app for small accounting teams to reconcile statements.",
            stackPreference = (string?)null,
            repositoryUrl = (string?)null,
            budgetUsd = 300m,
        });
        Assert.Equal(HttpStatusCode.Created, submitted.StatusCode);
        return (await HewnClient.ReadJsonAsync(submitted)).GetProperty("projectId").GetGuid();
    }

    /// <summary>Two projects, each with a worker part-way through its Bootstrap run (step 1 checkpointed, step 2 started).</summary>
    private async Task<(HewnClient Owner, (WorkerClient Worker, LeasedRun Run)[] Running)> TwoRunningAsync()
    {
        var owner = await _factory.SignInAsync("quinntynebrown", Role.Owner);
        await SubmitAsync(owner, "Ledgerline");
        await SubmitAsync(owner, "Tidewater");
        var running = new List<(WorkerClient, LeasedRun)>();
        foreach (var name in new[] { "quinn-mbp.local", "hewn-cloud-eus-01" })
        {
            var worker = await _factory.RegisterWorkerAsync(name);
            var run = (await worker.LeaseAsync())!;
            (await worker.CheckpointAsync(run, 1)).EnsureSuccessStatusCode();
            Assert.Equal(HttpStatusCode.NoContent, (await StartStepAsync(worker, run, 2, "Run Bootstrap")).StatusCode);
            running.Add((worker, run));
        }

        return (owner, [.. running]);
    }

    private static Task<HttpResponseMessage> StopAsync(HewnClient client) => client.PostAsync("/api/workers/stop", new { });

    private static Task<HttpResponseMessage> StartAsync(HewnClient client) => client.PostAsync("/api/workers/start", new { });

    private static async Task<JsonElement> WorkersAsync(HewnClient client) =>
        await HewnClient.ReadJsonAsync(await client.GetAsync("/api/workers"));

    private static Task<HttpResponseMessage> ControlAsync(WorkerClient worker, LeasedRun run, int waitSeconds = 20) =>
        worker.Http.GetAsync($"/api/worker/runs/{run.RunId}/control?workerId={worker.WorkerId}&epoch={run.Epoch}&waitSeconds={waitSeconds}");

    private static Task<HttpResponseMessage> StartStepAsync(WorkerClient worker, LeasedRun run, int step, string name) =>
        worker.Http.PutAsJsonAsync($"/api/worker/runs/{run.RunId}/step", new { workerId = worker.WorkerId, epoch = run.Epoch, step, name });

    private static async Task<List<string?>> LogAsync(HewnClient client, Guid projectId) =>
        (await HewnClient.ReadJsonAsync(await client.GetAsync($"/api/projects/{projectId}/events?after=0"))).EnumerateArray()
            .Where(e => e.GetProperty("type").GetString() == "LogLines")
            .SelectMany(e => e.GetProperty("payload").GetProperty("lines").EnumerateArray())
            .Select(l => l.GetProperty("text").GetString())
            .ToList();

    [Fact]
    public async Task Stop_all_workers_halts_every_active_run_within_10_seconds_and_nothing_more_is_leased()
    {
        var (owner, running) = await TwoRunningAsync();
        var workers = await WorkersAsync(owner);
        Assert.False(workers.GetProperty("leasing").GetProperty("stopped").GetBoolean());
        Assert.Equal(
            new string?[] { "Ledgerline", "Tidewater" },
            workers.GetProperty("workers").EnumerateArray().Select(w => w.GetProperty("workingOn").GetProperty("projectName").GetString()).Order().ToArray());

        // Each worker holds its control poll open while its run executes.
        var polls = running.Select(r => ControlAsync(r.Worker, r.Run)).ToArray();
        var clock = Stopwatch.StartNew();
        var stopped = await StopAsync(owner);
        clock.Stop();

        Assert.Equal(HttpStatusCode.OK, stopped.StatusCode);
        var body = await HewnClient.ReadJsonAsync(stopped);
        Assert.True(body.GetProperty("stopped").GetBoolean());
        Assert.Equal(2, body.GetProperty("halted").GetInt32());
        Assert.Empty(body.GetProperty("unconfirmed").EnumerateArray());
        Assert.True(clock.Elapsed < TimeSpan.FromSeconds(10), $"took {clock.Elapsed}");
        foreach (var poll in polls)
        {
            var heard = await poll;
            Assert.Equal(HttpStatusCode.OK, heard.StatusCode);
            Assert.Equal("Halt", (await HewnClient.ReadJsonAsync(heard)).GetProperty("control").GetString());
        }

        // The halted runs refuse the old lease; no worker leases anything new.
        foreach (var (worker, run) in running)
        {
            Assert.Equal(HttpStatusCode.Conflict, (await worker.HeartbeatAsync(run)).StatusCode);
            Assert.Null(await worker.LeaseAsync());
        }

        Assert.Null(await (await _factory.RegisterWorkerAsync("hewn-cloud-eus-02")).LeaseAsync());

        workers = await WorkersAsync(owner);
        var leasing = workers.GetProperty("leasing");
        Assert.True(leasing.GetProperty("stopped").GetBoolean());
        Assert.Equal("quinntynebrown", leasing.GetProperty("changedBy").GetString());
        var holding = workers.GetProperty("workers").EnumerateArray().Where(w => w.GetProperty("holding").GetBoolean()).Select(w => w.GetProperty("name").GetString()).Order();
        Assert.Equal(["hewn-cloud-eus-01", "quinn-mbp.local"], holding);

        var log = await LogAsync(owner, running[0].Run.ProjectId);
        Assert.Contains("Halted: all workers stopped by quinntynebrown; resumes from step 2", log);
        Assert.Contains("Run halted at step 2", log);
    }

    [Fact]
    public async Task Start_workers_resumes_each_halted_run_from_its_checkpoint()
    {
        var (owner, running) = await TwoRunningAsync();
        var polls = running.Select(r => ControlAsync(r.Worker, r.Run)).ToArray();
        Assert.Equal(HttpStatusCode.OK, (await StopAsync(owner)).StatusCode);
        await Task.WhenAll(polls);

        var started = await StartAsync(owner);
        Assert.Equal(HttpStatusCode.OK, started.StatusCode);
        Assert.False((await HewnClient.ReadJsonAsync(started)).GetProperty("stopped").GetBoolean());

        var resumed = new List<LeasedRun>();
        foreach (var (worker, run) in running)
        {
            var again = (await worker.LeaseAsync())!;
            Assert.Equal(1, again.CheckpointStep);
            Assert.True(again.Epoch > run.Epoch);
            resumed.Add(again);
        }

        Assert.Equal(running.Select(r => r.Run.RunId).Order(), resumed.Select(r => r.RunId).Order());
        Assert.Contains("Queued again: workers started by quinntynebrown", await LogAsync(owner, running[0].Run.ProjectId));
        Assert.False((await WorkersAsync(owner)).GetProperty("leasing").GetProperty("stopped").GetBoolean());
    }

    [Fact]
    public async Task Leasing_stays_stopped_after_a_server_restart()
    {
        // Nobody polls here, so a 1-second deadline keeps the test quick.
        _factory.WithSettings(("Hewn:Control:StopDeadlineSeconds", "1"));
        var (owner, _) = await TwoRunningAsync();
        Assert.Equal(HttpStatusCode.OK, (await StopAsync(owner)).StatusCode);

        var restarted = _factory.Restart();
        await _factory.DisposeAsync();
        _factory = restarted;

        var after = await _factory.SignInAsync("quinntynebrown", Role.Owner);
        Assert.True((await WorkersAsync(after)).GetProperty("leasing").GetProperty("stopped").GetBoolean());
        Assert.Null(await (await _factory.RegisterWorkerAsync("hewn-cloud-eus-02")).LeaseAsync());
    }

    [Fact]
    public async Task A_worker_that_does_not_answer_is_named_and_trying_again_waits_for_it()
    {
        _factory.WithSettings(("Hewn:Control:StopDeadlineSeconds", "1"));
        var (owner, running) = await TwoRunningAsync();
        // Only the first worker holds a control poll; the second has gone quiet.
        var poll = ControlAsync(running[0].Worker, running[0].Run);

        var stopped = await StopAsync(owner);
        Assert.Equal(HttpStatusCode.OK, stopped.StatusCode);
        var body = await HewnClient.ReadJsonAsync(stopped);
        Assert.False(body.GetProperty("stopped").GetBoolean());
        Assert.Equal(["hewn-cloud-eus-01"], body.GetProperty("unconfirmed").EnumerateArray().Select(u => u.GetString()));
        Assert.Equal("Halt", (await HewnClient.ReadJsonAsync(await poll)).GetProperty("control").GetString());

        // The quiet worker comes back and hears the halt; Try again then confirms every worker.
        var late = ControlAsync(running[1].Worker, running[1].Run);
        var again = await StopAsync(owner);
        Assert.Equal("Halt", (await HewnClient.ReadJsonAsync(await late)).GetProperty("control").GetString());
        var retried = await HewnClient.ReadJsonAsync(again);
        Assert.True(retried.GetProperty("stopped").GetBoolean());
        Assert.Empty(retried.GetProperty("unconfirmed").EnumerateArray());
    }

    [Fact]
    public async Task Viewers_cannot_stop_or_start_workers_but_can_see_them()
    {
        var owner = await _factory.SignInAsync("quinntynebrown", Role.Owner);
        var viewer = await _factory.SignInAsync("ada", Role.Viewer);
        await _factory.RegisterWorkerAsync("quinn-mbp.local");

        Assert.Equal(HttpStatusCode.Forbidden, (await StopAsync(viewer)).StatusCode);
        Assert.Equal(HttpStatusCode.Forbidden, (await StartAsync(viewer)).StatusCode);
        var seen = await WorkersAsync(viewer);
        Assert.Equal("quinn-mbp.local", seen.GetProperty("workers")[0].GetProperty("name").GetString());
        Assert.False(seen.GetProperty("leasing").GetProperty("stopped").GetBoolean());

        // Stop with nothing running, twice, then Start twice: all harmless.
        Assert.Equal(0, (await HewnClient.ReadJsonAsync(await StopAsync(owner))).GetProperty("halted").GetInt32());
        Assert.Equal(HttpStatusCode.OK, (await StopAsync(owner)).StatusCode);
        Assert.Equal(HttpStatusCode.OK, (await StartAsync(owner)).StatusCode);
        Assert.Equal(HttpStatusCode.OK, (await StartAsync(owner)).StatusCode);
        Assert.Equal(HttpStatusCode.Unauthorized, (await _factory.CreateAnonymousClient().GetAsync("/api/workers")).StatusCode);
    }
}

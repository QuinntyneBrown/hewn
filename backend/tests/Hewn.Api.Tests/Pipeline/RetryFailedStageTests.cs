// Acceptance Test
// Traces to: L2-006
// Description: A failed run is retried automatically up to 3 times after 30 s, 2 min and 10 min; when the third retry fails the stage is Failed, the direction and project Blocked, and Mission Control gets an event with the reason and the last 200 log lines while other projects keep running; an Owner's Retry stage runs the stage again from its start with the counter reset; Viewers get 403

using System.Net;
using System.Net.Http.Json;
using System.Text.Json;
using Hewn.Api.Tests.Support;
using Hewn.Domain;

namespace Hewn.Api.Tests.Pipeline;

public sealed class RetryFailedStageTests : IAsyncLifetime
{
    private readonly HewnApiFactory _factory = new();

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

    private static async Task<JsonElement> ProjectAsync(HewnClient client, Guid projectId) =>
        await HewnClient.ReadJsonAsync(await client.GetAsync($"/api/projects/{projectId}"));

    private static async Task<List<JsonElement>> EventsAsync(HewnClient client, Guid projectId) =>
        (await HewnClient.ReadJsonAsync(await client.GetAsync($"/api/projects/{projectId}/events?after=0"))).EnumerateArray().ToList();

    private static List<string?> LogTexts(IEnumerable<JsonElement> events) =>
        events.Where(e => e.GetProperty("type").GetString() == "LogLines")
            .SelectMany(e => e.GetProperty("payload").GetProperty("lines").EnumerateArray())
            .Select(l => l.GetProperty("text").GetString())
            .ToList();

    private static Task<HttpResponseMessage> RetryStageAsync(HewnClient client, Guid projectId, Guid directionId) =>
        client.PostAsync($"/api/projects/{projectId}/directions/{directionId}/retry-stage", new { });

    private static async Task SendLogAsync(WorkerClient worker, LeasedRun run, int count)
    {
        for (var start = 1; start <= count; start += 50)
        {
            var lines = Enumerable.Range(start, Math.Min(50, count - start + 1)).Select(i => new { level = "info", text = $"Validating requirement {i}" });
            var sent = await worker.Http.PostAsJsonAsync($"/api/worker/runs/{run.RunId}/logs", new { workerId = worker.WorkerId, epoch = run.Epoch, lines });
            sent.EnsureSuccessStatusCode();
        }
    }

    /// <summary>Leases the next attempt, failing the test when none is leasable.</summary>
    private static async Task<LeasedRun> LeaseAsync(WorkerClient worker) =>
        await worker.LeaseAsync() ?? throw new Xunit.Sdk.XunitException("Expected a run to lease.");

    /// <summary>Fails attempts 1 to 4 of Bootstrap, waiting each backoff on the test clock.</summary>
    private async Task<LeasedRun> ExhaustRetriesAsync(WorkerClient worker, string error = "Validation failed: L2-014 has no Given/When/Then")
    {
        var run = await LeaseAsync(worker);
        foreach (var wait in new[] { 30, 120, 600 })
        {
            (await worker.FailAsync(run, error)).EnsureSuccessStatusCode();
            _factory.Clock.Advance(TimeSpan.FromSeconds(wait));
            run = await LeaseAsync(worker);
        }

        return run;
    }

    [Fact]
    public async Task A_failed_run_is_retried_up_to_3_times_after_30_seconds_2_minutes_and_10_minutes()
    {
        var owner = await _factory.SignInAsync("quinntynebrown", Role.Owner);
        var projectId = await SubmitAsync(owner, "Parcel Post");
        var worker = await _factory.RegisterWorkerAsync();

        var run = await LeaseAsync(worker);
        Assert.Equal(1, run.Body.GetProperty("attempt").GetInt32());
        var runs = new List<Guid> { run.RunId };
        foreach (var (wait, attempt) in new[] { (30, 2), (120, 3), (600, 4) })
        {
            (await worker.FailAsync(run, "Skills source unreachable")).EnsureSuccessStatusCode();

            // Nothing is leasable until the backoff has passed.
            _factory.Clock.Advance(TimeSpan.FromSeconds(wait - 1));
            Assert.Null(await worker.LeaseAsync());
            _factory.Clock.Advance(TimeSpan.FromSeconds(1));
            run = await LeaseAsync(worker);
            Assert.Equal(0, run.Stage);
            Assert.Equal(attempt, run.Body.GetProperty("attempt").GetInt32());
            Assert.Equal(0, run.CheckpointStep);
            runs.Add(run.RunId);
        }

        Assert.Equal(4, runs.Distinct().Count());
        var events = await EventsAsync(owner, projectId);
        var scheduled = events.Where(e => e.GetProperty("type").GetString() == "RunRetryScheduled").Select(e => e.GetProperty("payload")).ToList();
        Assert.Equal([2, 3, 4], scheduled.Select(p => p.GetProperty("attempt").GetInt32()));
        Assert.Equal([30, 120, 600], scheduled.Select(p => p.GetProperty("delaySeconds").GetInt32()));
        Assert.Equal("Skills source unreachable", scheduled[0].GetProperty("reason").GetString());
        var log = LogTexts(events);
        Assert.Contains("Attempt 1 failed: Skills source unreachable. Retry 1 of 3 in 30 s.", log);
        Assert.Contains("Attempt 3 failed: Skills source unreachable. Retry 3 of 3 in 10 min.", log);

        // While retrying, the stage and direction still read Running.
        var project = await ProjectAsync(owner, projectId);
        Assert.Equal("Running", project.GetProperty("status").GetString());
        var direction = project.GetProperty("directions")[0];
        Assert.Equal("Running", direction.GetProperty("status").GetString());
    }

    [Fact]
    public async Task When_the_third_retry_fails_the_stage_is_Failed_the_direction_Blocked_and_other_projects_keep_running()
    {
        var owner = await _factory.SignInAsync("quinntynebrown", Role.Owner);
        var blocked = await SubmitAsync(owner, "Parcel Post");
        var worker = await _factory.RegisterWorkerAsync();
        var last = await ExhaustRetriesAsync(worker);

        // Another project keeps running while this one waits and after it blocks.
        var other = await SubmitAsync(owner, "Ledgerline");
        await SendLogAsync(worker, last, 250);
        (await worker.FailAsync(last, "Validation failed: L2-014 has no Given/When/Then")).EnsureSuccessStatusCode();
        _factory.Clock.Advance(TimeSpan.FromHours(1));
        var next = await LeaseAsync(worker);
        Assert.Equal(other, next.ProjectId);

        var project = await ProjectAsync(owner, blocked);
        Assert.Equal("Blocked", project.GetProperty("status").GetString());
        var direction = project.GetProperty("directions")[0];
        Assert.Equal("Blocked", direction.GetProperty("status").GetString());
        Assert.Equal("Validation failed: L2-014 has no Given/When/Then", direction.GetProperty("failureReason").GetString());
        Assert.Equal(0, direction.GetProperty("failedStage").GetInt32());
        Assert.Equal("Failed", direction.GetProperty("stages")[0].GetProperty("status").GetString());

        var stageBlocked = (await EventsAsync(owner, blocked)).Single(e => e.GetProperty("type").GetString() == "StageBlocked").GetProperty("payload");
        Assert.Equal(0, stageBlocked.GetProperty("stage").GetInt32());
        Assert.Equal("Bootstrap", stageBlocked.GetProperty("stageName").GetString());
        Assert.Equal("Validation failed: L2-014 has no Given/When/Then", stageBlocked.GetProperty("reason").GetString());
        var lines = stageBlocked.GetProperty("lastLogLines").EnumerateArray().Select(l => l.GetProperty("text").GetString()).ToList();
        Assert.Equal(200, lines.Count);
        Assert.Equal("Attempt 4 failed: Validation failed: L2-014 has no Given/When/Then. Retries exhausted; the stage is Failed.", lines[^1]);
        Assert.Equal("Validating requirement 52", lines[0]);

        // Nothing more of the blocked project is leased.
        Assert.Null(await worker.LeaseAsync());
    }

    [Fact]
    public async Task Retry_stage_runs_the_failed_stage_again_from_its_start_with_the_counter_reset()
    {
        var owner = await _factory.SignInAsync("quinntynebrown", Role.Owner);
        var projectId = await SubmitAsync(owner, "Parcel Post");
        var worker = await _factory.RegisterWorkerAsync();
        var last = await ExhaustRetriesAsync(worker);
        (await worker.CheckpointAsync(last, 1)).EnsureSuccessStatusCode();
        (await worker.FailAsync(last, "Validation failed")).EnsureSuccessStatusCode();
        var directionId = (await ProjectAsync(owner, projectId)).GetProperty("directions")[0].GetProperty("id").GetGuid();

        var retried = await RetryStageAsync(owner, projectId, directionId);
        Assert.Equal(HttpStatusCode.OK, retried.StatusCode);
        Assert.Equal("Running", (await HewnClient.ReadJsonAsync(retried)).GetProperty("status").GetString());

        var project = await ProjectAsync(owner, projectId);
        Assert.Equal("Running", project.GetProperty("status").GetString());
        var direction = project.GetProperty("directions")[0];
        Assert.Equal("Running", direction.GetProperty("status").GetString());
        Assert.Equal(JsonValueKind.Null, direction.GetProperty("failureReason").ValueKind);
        Assert.Equal("Running", direction.GetProperty("stages")[0].GetProperty("status").GetString());
        Assert.Contains("Retry stage requested by quinntynebrown", LogTexts(await EventsAsync(owner, projectId)));

        // From its start: no checkpoint, attempt 1, and the next failure waits 30 s again.
        var run = await LeaseAsync(worker);
        Assert.Equal(0, run.Stage);
        Assert.Equal(0, run.CheckpointStep);
        Assert.Equal(1, run.Body.GetProperty("attempt").GetInt32());
        (await worker.FailAsync(run, "Validation failed")).EnsureSuccessStatusCode();
        var scheduled = (await EventsAsync(owner, projectId)).Last(e => e.GetProperty("type").GetString() == "RunRetryScheduled").GetProperty("payload");
        Assert.Equal(2, scheduled.GetProperty("attempt").GetInt32());
        Assert.Equal(30, scheduled.GetProperty("delaySeconds").GetInt32());

        // The stage then succeeds and the direction carries on.
        _factory.Clock.Advance(TimeSpan.FromSeconds(30));
        run = await LeaseAsync(worker);
        (await worker.SucceedAsync(run)).EnsureSuccessStatusCode();
        Assert.Equal(1, (await LeaseAsync(worker)).Stage);
    }

    [Fact]
    public async Task Only_an_Owner_retries_a_Blocked_direction()
    {
        var owner = await _factory.SignInAsync("quinntynebrown", Role.Owner);
        var viewer = await _factory.SignInAsync("ada", Role.Viewer);
        var projectId = await SubmitAsync(owner, "Parcel Post");
        var directionId = (await ProjectAsync(owner, projectId)).GetProperty("directions")[0].GetProperty("id").GetGuid();

        var running = await RetryStageAsync(owner, projectId, directionId);
        Assert.Equal(HttpStatusCode.Conflict, running.StatusCode);
        Assert.Equal("not_blocked", (await HewnClient.ReadJsonAsync(running)).GetProperty("code").GetString());

        var worker = await _factory.RegisterWorkerAsync();
        var last = await ExhaustRetriesAsync(worker);
        (await worker.FailAsync(last, "Validation failed")).EnsureSuccessStatusCode();

        Assert.Equal(HttpStatusCode.Forbidden, (await RetryStageAsync(viewer, projectId, directionId)).StatusCode);
        Assert.Equal(HttpStatusCode.NotFound, (await RetryStageAsync(owner, Guid.NewGuid(), directionId)).StatusCode);
        Assert.Equal("Blocked", (await ProjectAsync(viewer, projectId)).GetProperty("directions")[0].GetProperty("status").GetString());
    }
}

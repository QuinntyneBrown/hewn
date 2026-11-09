// Acceptance Test
// Traces to: L2-029, L2-004
// Description: An Owner cancels a running or paused direction: the active run stops within 10 seconds, the direction is Cancelled, open pull requests stay open labelled hewn:cancelled, and the next queued direction starts; Viewers get 403

using System.Diagnostics;
using System.Net;
using System.Net.Http.Json;
using System.Text;
using System.Text.Json;
using Hewn.Api.Tests.Support;
using Hewn.Domain;

namespace Hewn.Api.Tests.Pipeline;

public sealed class CancelDirectionTests : IAsyncLifetime
{
    // A database file, not the shared in-memory connection: the control poll and Cancel run at the same time.
    private HewnApiFactory _factory = new(databaseFile: true);

    public Task InitializeAsync() => Task.CompletedTask;

    public async Task DisposeAsync() => await _factory.DisposeAsync();

    private sealed record Submitted(HewnClient Owner, WorkerClient Worker, Guid ProjectId, Guid DirectionId);

    private async Task<Submitted> SubmitAsync()
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
        Assert.Equal(HttpStatusCode.Created, submitted.StatusCode);
        var projectId = (await HewnClient.ReadJsonAsync(submitted)).GetProperty("projectId").GetGuid();
        var directionId = (await DirectionsAsync(owner, projectId)).Single().GetProperty("id").GetGuid();
        return new Submitted(owner, await _factory.RegisterWorkerAsync(), projectId, directionId);
    }

    private static Task<HttpResponseMessage> CancelAsync(HewnClient client, Guid projectId, Guid directionId) =>
        client.PostAsync($"/api/projects/{projectId}/directions/{directionId}/cancel", new { });

    /// <summary>The worker's control poll, held open while its run executes.</summary>
    private static Task<HttpResponseMessage> ControlAsync(WorkerClient worker, LeasedRun run, int waitSeconds = 20) =>
        worker.Http.GetAsync($"/api/worker/runs/{run.RunId}/control?workerId={worker.WorkerId}&epoch={run.Epoch}&waitSeconds={waitSeconds}");

    private static Task<HttpResponseMessage> StartStepAsync(WorkerClient worker, LeasedRun run, int step, string name) =>
        worker.Http.PutAsJsonAsync($"/api/worker/runs/{run.RunId}/step", new { workerId = worker.WorkerId, epoch = run.Epoch, step, name });

    private static async Task<List<JsonElement>> DirectionsAsync(HewnClient client, Guid projectId) =>
        (await ProjectAsync(client, projectId)).GetProperty("directions").EnumerateArray().ToList();

    private static async Task<JsonElement> ProjectAsync(HewnClient client, Guid projectId) =>
        await HewnClient.ReadJsonAsync(await client.GetAsync($"/api/projects/{projectId}"));

    private static async Task<List<JsonElement>> EventsAsync(HewnClient client, Guid projectId, long after = 0) =>
        (await HewnClient.ReadJsonAsync(await client.GetAsync($"/api/projects/{projectId}/events?after={after}"))).EnumerateArray().ToList();

    private static List<string?> LogTexts(IEnumerable<JsonElement> events) =>
        events.Where(e => e.GetProperty("type").GetString() == "LogLines")
            .SelectMany(e => e.GetProperty("payload").GetProperty("lines").EnumerateArray())
            .Select(l => l.GetProperty("text").GetString())
            .ToList();

    [Fact]
    public async Task Cancelling_a_running_direction_stops_its_run_within_10_seconds_and_the_direction_is_Cancelled()
    {
        var s = await SubmitAsync();
        var run = (await s.Worker.LeaseAsync())!;
        Assert.Equal(HttpStatusCode.NoContent, (await StartStepAsync(s.Worker, run, 2, "Run Bootstrap")).StatusCode);
        var before = (await EventsAsync(s.Owner, s.ProjectId)).Count;
        var control = ControlAsync(s.Worker, run);

        var clock = Stopwatch.StartNew();
        var response = await CancelAsync(s.Owner, s.ProjectId, s.DirectionId);
        clock.Stop();

        // The worker hears at once, and the API answers once it has.
        Assert.Equal(HttpStatusCode.OK, response.StatusCode);
        var body = await HewnClient.ReadJsonAsync(response);
        Assert.Equal("Cancelled", body.GetProperty("status").GetString());
        Assert.True(body.GetProperty("stopped").GetBoolean());
        Assert.InRange(body.GetProperty("stoppedWithinSeconds").GetInt32(), 1, 10);
        Assert.True(clock.Elapsed < TimeSpan.FromSeconds(10));
        var heard = await control;
        Assert.Equal(HttpStatusCode.OK, heard.StatusCode);
        Assert.Equal("Cancel", (await HewnClient.ReadJsonAsync(heard)).GetProperty("control").GetString());

        var project = await ProjectAsync(s.Owner, s.ProjectId);
        Assert.Equal("Cancelled", project.GetProperty("status").GetString());
        var direction = project.GetProperty("directions")[0];
        Assert.Equal("Cancelled", direction.GetProperty("status").GetString());
        Assert.Equal("quinntynebrown", direction.GetProperty("cancelledBy").GetString());
        Assert.NotEqual(JsonValueKind.Null, direction.GetProperty("cancelledAt").ValueKind);
        Assert.Equal(body.GetProperty("stoppedWithinSeconds").GetInt32(), direction.GetProperty("stoppedWithinSeconds").GetInt32());
        Assert.Equal("Cancelled", direction.GetProperty("stages")[0].GetProperty("status").GetString());
        Assert.Equal("Pending", direction.GetProperty("stages")[1].GetProperty("status").GetString());

        // The run is over: the worker's writes are refused and nothing is offered again.
        Assert.Equal(HttpStatusCode.Conflict, (await s.Worker.HeartbeatAsync(run)).StatusCode);
        Assert.Null(await s.Worker.LeaseAsync());

        var events = await EventsAsync(s.Owner, s.ProjectId, before);
        var types = events.Select(e => e.GetProperty("type").GetString()).Where(t => t != "LogLines").ToList();
        Assert.Equal(["DirectionCancelled", "StageChanged", "DirectionChanged", "ProjectChanged"], types.Take(4));
        Assert.Equal(["Cancel requested by quinntynebrown", "Run stopped at step 2"], LogTexts(events));
    }

    [Fact]
    public async Task A_worker_that_does_not_answer_is_reported_and_the_direction_is_Cancelled_anyway()
    {
        _factory.WithSettings(("Hewn:Control:StopDeadlineSeconds", "1"));
        var s = await SubmitAsync();
        var run = (await s.Worker.LeaseAsync())!;

        var response = await CancelAsync(s.Owner, s.ProjectId, s.DirectionId);

        Assert.Equal(HttpStatusCode.OK, response.StatusCode);
        var body = await HewnClient.ReadJsonAsync(response);
        Assert.Equal("Cancelled", body.GetProperty("status").GetString());
        Assert.False(body.GetProperty("stopped").GetBoolean());
        Assert.Equal("test-worker", body.GetProperty("worker").GetString());
        Assert.Equal("Cancelled", (await DirectionsAsync(s.Owner, s.ProjectId))[0].GetProperty("status").GetString());
        Assert.Equal(HttpStatusCode.Conflict, (await s.Worker.HeartbeatAsync(run)).StatusCode);

        // The worker comes back and polls: it hears Cancel, and trying again reports the stop.
        Assert.Equal("Cancel", (await HewnClient.ReadJsonAsync(await ControlAsync(s.Worker, run))).GetProperty("control").GetString());
        var again = await HewnClient.ReadJsonAsync(await CancelAsync(s.Owner, s.ProjectId, s.DirectionId));
        Assert.True(again.GetProperty("stopped").GetBoolean());
    }

    [Fact]
    public async Task A_paused_direction_is_cancelled_at_once()
    {
        var s = await SubmitAsync();
        Assert.Equal(HttpStatusCode.OK, (await s.Owner.PostAsync($"/api/projects/{s.ProjectId}/directions/{s.DirectionId}/pause", new { })).StatusCode);

        var response = await CancelAsync(s.Owner, s.ProjectId, s.DirectionId);

        Assert.Equal(HttpStatusCode.OK, response.StatusCode);
        var body = await HewnClient.ReadJsonAsync(response);
        Assert.True(body.GetProperty("stopped").GetBoolean());
        Assert.Equal(JsonValueKind.Null, body.GetProperty("stoppedWithinSeconds").ValueKind);
        Assert.Equal("Cancelled", (await DirectionsAsync(s.Owner, s.ProjectId))[0].GetProperty("status").GetString());
        Assert.Null(await s.Worker.LeaseAsync());
    }

    [Fact]
    public async Task The_next_queued_direction_starts_when_the_active_one_is_cancelled()
    {
        var s = await SubmitAsync();
        var run = (await s.Worker.LeaseAsync())!;
        Assert.Equal(HttpStatusCode.Created, (await s.Owner.PostAsync($"/api/projects/{s.ProjectId}/directions", new { idea = "Add CSV export to the reconciliation report.", budgetUsd = 50m })).StatusCode);
        var control = ControlAsync(s.Worker, run);

        Assert.Equal(HttpStatusCode.OK, (await CancelAsync(s.Owner, s.ProjectId, s.DirectionId)).StatusCode);
        await control;

        var project = await ProjectAsync(s.Owner, s.ProjectId);
        Assert.Equal("Running", project.GetProperty("status").GetString());
        var next = (await s.Worker.LeaseAsync())!;
        Assert.NotEqual(run.RunId, next.RunId);
        Assert.Equal(1, next.Stage);
        var directions = await DirectionsAsync(s.Owner, s.ProjectId);
        Assert.Equal("Running", directions.Single(d => d.GetProperty("kind").GetString() == "Feature").GetProperty("status").GetString());
        Assert.Equal("Cancelled", directions.Single(d => d.GetProperty("id").GetGuid() == s.DirectionId).GetProperty("status").GetString());
    }

    [Fact]
    public async Task Open_pull_requests_are_left_open_and_labelled_hewn_cancelled()
    {
        var s = await SubmitAsync();
        LeasedRun run;
        while (true)
        {
            run = (await s.Worker.LeaseAsync())!;
            if (run.Stage == 6)
            {
                break;
            }

            (await s.Worker.SucceedAsync(run)).EnsureSuccessStatusCode();
        }

        (await MutateAsync(s.Worker, run, "commit", "1/commit", new { message = "Scaffold", branch = "hewn/scaffold", files = new[] { new { path = "README.md", contentBase64 = Convert.ToBase64String(Encoding.UTF8.GetBytes("# Ledgerline\n")) } } })).EnsureSuccessStatusCode();
        var opened = await MutateAsync(s.Worker, run, "open_pull_request", "1/pr", new { head = "hewn/scaffold", title = "Scaffold the solution", body = "Generated by Hewn." });
        opened.EnsureSuccessStatusCode();
        var number = (await HewnClient.ReadJsonAsync(opened)).GetProperty("number").GetInt32();
        var before = (await EventsAsync(s.Owner, s.ProjectId)).Count;
        var control = ControlAsync(s.Worker, run);

        Assert.Equal(HttpStatusCode.OK, (await CancelAsync(s.Owner, s.ProjectId, s.DirectionId)).StatusCode);
        await control;

        var pull = _factory.GitHub.Repository("hewn-builds", "ledgerline")!.PullRequests.Single(p => p.Number == number);
        Assert.True(pull.Open);
        Assert.False(pull.Merged);
        Assert.Contains("hewn:cancelled", pull.Labels);
        var direction = (await DirectionsAsync(s.Owner, s.ProjectId))[0];
        Assert.Equal([number], direction.GetProperty("labelledPullRequests").EnumerateArray().Select(n => n.GetInt32()));
        Assert.Contains($"gh pr edit {number} --add-label hewn:cancelled", LogTexts(await EventsAsync(s.Owner, s.ProjectId, before)));
    }

    [Fact]
    public async Task A_Viewer_gets_403_and_nothing_changes()
    {
        var s = await SubmitAsync();
        var viewer = await _factory.SignInAsync("ada", Role.Viewer);

        Assert.Equal(HttpStatusCode.Forbidden, (await CancelAsync(viewer, s.ProjectId, s.DirectionId)).StatusCode);
        Assert.Equal("Queued", (await DirectionsAsync(s.Owner, s.ProjectId))[0].GetProperty("status").GetString());
        Assert.NotNull(await s.Worker.LeaseAsync());
    }

    [Fact]
    public async Task A_finished_direction_answers_409_and_another_projects_direction_404()
    {
        var s = await SubmitAsync();
        await s.Worker.RunUntilIdleAsync();

        var finished = await CancelAsync(s.Owner, s.ProjectId, s.DirectionId);
        Assert.Equal(HttpStatusCode.Conflict, finished.StatusCode);
        Assert.Equal("not_active", (await HewnClient.ReadJsonAsync(finished)).GetProperty("code").GetString());
        Assert.Equal(HttpStatusCode.NotFound, (await CancelAsync(s.Owner, Guid.NewGuid(), s.DirectionId)).StatusCode);
    }

    private static Task<HttpResponseMessage> MutateAsync(WorkerClient worker, LeasedRun run, string kind, string key, object fields)
    {
        var body = JsonSerializer.SerializeToElement(fields).EnumerateObject()
            .ToDictionary(p => p.Name, p => (object?)p.Value);
        body["workerId"] = worker.WorkerId;
        body["epoch"] = run.Epoch;
        body["kind"] = kind;
        body["idempotencyKey"] = $"{run.RunId}/{key}";
        return worker.Http.PostAsJsonAsync($"/api/worker/runs/{run.RunId}/github/mutations", body);
    }
}

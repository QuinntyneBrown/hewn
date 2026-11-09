// Acceptance Test
// Traces to: L2-029, L2-050
// Description: An Owner pauses a running direction: the step in progress finishes, the direction becomes Paused and nothing new starts; Resume continues from the next step and no completed step runs twice; Viewers get 403

using System.Net;
using System.Text.Json;
using Hewn.Api.Tests.Support;
using Hewn.Domain;

namespace Hewn.Api.Tests.Pipeline;

public sealed class PauseAndResumeTests : IAsyncLifetime
{
    private readonly HewnApiFactory _factory = new();

    public Task InitializeAsync() => Task.CompletedTask;

    public async Task DisposeAsync() => await _factory.DisposeAsync();

    private sealed record Submitted(HewnClient Owner, WorkerClient Worker, Guid ProjectId, Guid DirectionId);

    private async Task<Submitted> SubmitAsync()
    {
        var owner = await _factory.SignInAsync("quinntynebrown", Role.Owner);
        var submitted = await owner.PostAsync("/api/projects", new
        {
            name = "Kiln Booking",
            idea = "Kiln firing schedules for a community pottery studio.",
            stackPreference = (string?)null,
            repositoryUrl = (string?)null,
            budgetUsd = 100m,
        });
        Assert.Equal(HttpStatusCode.Created, submitted.StatusCode);
        var projectId = (await HewnClient.ReadJsonAsync(submitted)).GetProperty("projectId").GetGuid();
        var directionId = (await DirectionAsync(owner, projectId)).GetProperty("id").GetGuid();
        return new Submitted(owner, await _factory.RegisterWorkerAsync(), projectId, directionId);
    }

    private static Task<HttpResponseMessage> PauseAsync(HewnClient client, Guid projectId, Guid directionId) =>
        client.PostAsync($"/api/projects/{projectId}/directions/{directionId}/pause", new { });

    private static Task<HttpResponseMessage> ResumeAsync(HewnClient client, Guid projectId, Guid directionId) =>
        client.PostAsync($"/api/projects/{projectId}/directions/{directionId}/resume", new { });

    private static async Task<JsonElement> ProjectAsync(HewnClient client, Guid projectId) =>
        await HewnClient.ReadJsonAsync(await client.GetAsync($"/api/projects/{projectId}"));

    private static async Task<JsonElement> DirectionAsync(HewnClient client, Guid projectId) =>
        (await ProjectAsync(client, projectId)).GetProperty("directions")[0];

    private static async Task<List<JsonElement>> EventsAsync(HewnClient client, Guid projectId, long after = 0) =>
        (await HewnClient.ReadJsonAsync(await client.GetAsync($"/api/projects/{projectId}/events?after={after}"))).EnumerateArray().ToList();

    private static async Task<string?> VerdictAsync(HttpResponseMessage checkpoint)
    {
        Assert.Equal(HttpStatusCode.OK, checkpoint.StatusCode);
        return (await HewnClient.ReadJsonAsync(checkpoint)).GetProperty("verdict").GetString();
    }

    [Fact]
    public async Task Pause_lets_the_step_in_progress_finish_then_the_direction_is_Paused_and_nothing_new_starts()
    {
        var s = await SubmitAsync();
        var run = (await s.Worker.LeaseAsync())!;
        Assert.Equal("Continue", await VerdictAsync(await s.Worker.CheckpointAsync(run, 1)));
        var before = (await EventsAsync(s.Owner, s.ProjectId)).Count;

        var response = await PauseAsync(s.Owner, s.ProjectId, s.DirectionId);

        // The step in progress carries on: the direction is still Running, with the pause requested.
        Assert.Equal(HttpStatusCode.OK, response.StatusCode);
        var body = await HewnClient.ReadJsonAsync(response);
        Assert.Equal("Running", body.GetProperty("status").GetString());
        Assert.True(body.GetProperty("pauseRequested").GetBoolean());
        var requested = await DirectionAsync(s.Owner, s.ProjectId);
        Assert.Equal("Running", requested.GetProperty("status").GetString());
        Assert.True(requested.GetProperty("pauseRequested").GetBoolean());
        Assert.Equal(HttpStatusCode.NoContent, (await s.Worker.HeartbeatAsync(run)).StatusCode);

        // The step finishes and checkpoints; the answer tells the worker to stop there.
        Assert.Equal("Pause", await VerdictAsync(await s.Worker.CheckpointAsync(run, 2)));

        var project = await ProjectAsync(s.Owner, s.ProjectId);
        Assert.Equal("Paused", project.GetProperty("status").GetString());
        var direction = project.GetProperty("directions")[0];
        Assert.Equal("Paused", direction.GetProperty("status").GetString());
        Assert.Equal("Paused by an Owner", direction.GetProperty("pauseReason").GetString());
        Assert.Equal("quinntynebrown", direction.GetProperty("pausedBy").GetString());
        Assert.NotEqual(JsonValueKind.Null, direction.GetProperty("pausedAt").ValueKind);
        Assert.False(direction.GetProperty("pauseRequested").GetBoolean());
        Assert.Equal("Paused", direction.GetProperty("stages")[0].GetProperty("status").GetString());

        // The lease is released and nothing new starts until Resume.
        Assert.Equal(HttpStatusCode.Conflict, (await s.Worker.HeartbeatAsync(run)).StatusCode);
        Assert.Null(await s.Worker.LeaseAsync());

        var events = await EventsAsync(s.Owner, s.ProjectId, before);
        Assert.Equal(["PauseRequested", "StageChanged", "DirectionChanged", "ProjectChanged"], events.Select(e => e.GetProperty("type").GetString()).Where(t => t != "LogLines"));
        Assert.Equal("quinntynebrown", events[0].GetProperty("payload").GetProperty("requestedBy").GetString());
        var log = events.Where(e => e.GetProperty("type").GetString() == "LogLines")
            .SelectMany(e => e.GetProperty("payload").GetProperty("lines").EnumerateArray())
            .Select(l => l.GetProperty("text").GetString())
            .ToList();
        Assert.Equal(["Pause requested by quinntynebrown", "Step 2 finished · checkpoint · direction Paused"], log);
    }

    [Fact]
    public async Task Resume_continues_from_the_next_step_and_no_completed_step_runs_twice()
    {
        var s = await SubmitAsync();
        var run = (await s.Worker.LeaseAsync())!;
        await PauseAsync(s.Owner, s.ProjectId, s.DirectionId);
        Assert.Equal("Pause", await VerdictAsync(await s.Worker.CheckpointAsync(run, 1)));
        var before = (await EventsAsync(s.Owner, s.ProjectId)).Count;

        var response = await ResumeAsync(s.Owner, s.ProjectId, s.DirectionId);

        Assert.Equal(HttpStatusCode.OK, response.StatusCode);
        Assert.Equal("Running", (await HewnClient.ReadJsonAsync(response)).GetProperty("status").GetString());
        var project = await ProjectAsync(s.Owner, s.ProjectId);
        Assert.Equal("Running", project.GetProperty("status").GetString());
        var direction = project.GetProperty("directions")[0];
        Assert.Equal("Running", direction.GetProperty("status").GetString());
        Assert.Equal(JsonValueKind.Null, direction.GetProperty("pauseReason").ValueKind);
        Assert.Equal(JsonValueKind.Null, direction.GetProperty("pausedBy").ValueKind);
        Assert.Equal("Running", direction.GetProperty("stages")[0].GetProperty("status").GetString());

        // The same run is leased again and starts after its checkpoint: step 1 is not run again.
        var resumed = (await s.Worker.LeaseAsync())!;
        Assert.Equal(run.RunId, resumed.RunId);
        Assert.Equal(1, resumed.CheckpointStep);
        Assert.True(resumed.Epoch > run.Epoch);
        Assert.Equal("Continue", await VerdictAsync(await s.Worker.CheckpointAsync(resumed, 2)));

        var events = await EventsAsync(s.Owner, s.ProjectId, before);
        Assert.Equal(["DirectionResumed", "StageChanged", "DirectionChanged", "ProjectChanged"], events.Select(e => e.GetProperty("type").GetString()).Where(t => t != "LogLines").Take(4));
        Assert.Equal("quinntynebrown", events[0].GetProperty("payload").GetProperty("resumedBy").GetString());
    }

    [Fact]
    public async Task A_direction_whose_run_waits_for_a_worker_pauses_at_once_and_resumes_from_the_start_of_its_stage()
    {
        var s = await SubmitAsync();

        var response = await PauseAsync(s.Owner, s.ProjectId, s.DirectionId);

        Assert.Equal(HttpStatusCode.OK, response.StatusCode);
        Assert.Equal("Paused", (await HewnClient.ReadJsonAsync(response)).GetProperty("status").GetString());
        var direction = await DirectionAsync(s.Owner, s.ProjectId);
        Assert.Equal("Paused", direction.GetProperty("status").GetString());
        Assert.Equal("Pending", direction.GetProperty("stages")[0].GetProperty("status").GetString());
        Assert.Null(await s.Worker.LeaseAsync());

        Assert.Equal(HttpStatusCode.OK, (await ResumeAsync(s.Owner, s.ProjectId, s.DirectionId)).StatusCode);
        var run = (await s.Worker.LeaseAsync())!;
        Assert.Equal(0, run.Stage);
        Assert.Equal(0, run.CheckpointStep);
        Assert.Equal("Running", (await DirectionAsync(s.Owner, s.ProjectId)).GetProperty("stages")[0].GetProperty("status").GetString());
    }

    [Fact]
    public async Task A_stage_that_finishes_while_a_pause_is_pending_pauses_before_the_next_stage_starts()
    {
        var s = await SubmitAsync();
        var run = (await s.Worker.LeaseAsync())!;
        await PauseAsync(s.Owner, s.ProjectId, s.DirectionId);

        Assert.Equal(HttpStatusCode.NoContent, (await s.Worker.SucceedAsync(run)).StatusCode);

        var direction = await DirectionAsync(s.Owner, s.ProjectId);
        Assert.Equal("Paused", direction.GetProperty("status").GetString());
        Assert.Equal("Succeeded", direction.GetProperty("stages")[0].GetProperty("status").GetString());
        Assert.Equal("Pending", direction.GetProperty("stages")[1].GetProperty("status").GetString());
        Assert.Null(await s.Worker.LeaseAsync());

        Assert.Equal(HttpStatusCode.OK, (await ResumeAsync(s.Owner, s.ProjectId, s.DirectionId)).StatusCode);
        Assert.Equal(1, (await s.Worker.LeaseAsync())!.Stage);
    }

    [Fact]
    public async Task A_Viewer_gets_403_for_Pause_and_Resume_and_nothing_changes()
    {
        var s = await SubmitAsync();
        var run = (await s.Worker.LeaseAsync())!;
        var viewer = await _factory.SignInAsync("ada", Role.Viewer);

        Assert.Equal(HttpStatusCode.Forbidden, (await PauseAsync(viewer, s.ProjectId, s.DirectionId)).StatusCode);
        Assert.False((await DirectionAsync(s.Owner, s.ProjectId)).GetProperty("pauseRequested").GetBoolean());
        Assert.Equal("Continue", await VerdictAsync(await s.Worker.CheckpointAsync(run, 1)));

        await PauseAsync(s.Owner, s.ProjectId, s.DirectionId);
        await s.Worker.CheckpointAsync(run, 2);
        Assert.Equal(HttpStatusCode.Forbidden, (await ResumeAsync(viewer, s.ProjectId, s.DirectionId)).StatusCode);
        Assert.Equal("Paused", (await DirectionAsync(s.Owner, s.ProjectId)).GetProperty("status").GetString());
    }

    [Fact]
    public async Task Pause_and_Resume_answer_409_when_the_direction_is_not_in_a_state_they_apply_to()
    {
        var s = await SubmitAsync();
        var run = (await s.Worker.LeaseAsync())!;

        var resumeRunning = await ResumeAsync(s.Owner, s.ProjectId, s.DirectionId);
        Assert.Equal(HttpStatusCode.Conflict, resumeRunning.StatusCode);
        Assert.Equal("not_paused", (await HewnClient.ReadJsonAsync(resumeRunning)).GetProperty("code").GetString());

        // Pressing Pause twice is harmless.
        Assert.Equal(HttpStatusCode.OK, (await PauseAsync(s.Owner, s.ProjectId, s.DirectionId)).StatusCode);
        Assert.Equal(HttpStatusCode.OK, (await PauseAsync(s.Owner, s.ProjectId, s.DirectionId)).StatusCode);
        await s.Worker.CheckpointAsync(run, 1);

        var pausePaused = await PauseAsync(s.Owner, s.ProjectId, s.DirectionId);
        Assert.Equal(HttpStatusCode.Conflict, pausePaused.StatusCode);
        Assert.Equal("not_running", (await HewnClient.ReadJsonAsync(pausePaused)).GetProperty("code").GetString());
    }

    [Fact]
    public async Task Another_projects_direction_is_404()
    {
        var s = await SubmitAsync();

        Assert.Equal(HttpStatusCode.NotFound, (await PauseAsync(s.Owner, Guid.NewGuid(), s.DirectionId)).StatusCode);
        Assert.Equal(HttpStatusCode.NotFound, (await ResumeAsync(s.Owner, Guid.NewGuid(), s.DirectionId)).StatusCode);
    }
}

// Acceptance Test
// Traces to: L2-004, L2-026, L2-031
// Description: A worker leases a queued product direction's runs and carries it through stages 0 to 10 in order to Complete

using System.Net;
using Hewn.Api.Tests.Support;
using Hewn.Domain;
using Microsoft.EntityFrameworkCore;

namespace Hewn.Api.Tests.Pipeline;

public sealed class RunDirectionTests : IAsyncLifetime
{
    private static readonly string[] AllowedStageStatuses =
        ["Pending", "Running", "Paused", "Succeeded", "Failed", "Skipped", "Cancelled"];

    private readonly HewnApiFactory _factory = new();

    public Task InitializeAsync() => Task.CompletedTask;

    public async Task DisposeAsync() => await _factory.DisposeAsync();

    private async Task<(HewnClient Owner, Guid ProjectId)> SubmitAsync(string name = "Ledgerline")
    {
        var owner = await _factory.SignInAsync("quinntynebrown", Role.Owner);
        var response = await owner.PostAsync("/api/projects", new
        {
            name,
            idea = "A web app for small accounting teams to reconcile statements.",
            stackPreference = (string?)null,
            repositoryUrl = (string?)null,
            budgetUsd = 300m,
        });
        Assert.Equal(HttpStatusCode.Created, response.StatusCode);
        var projectId = (await HewnClient.ReadJsonAsync(response)).GetProperty("projectId").GetGuid();
        return (owner, projectId);
    }

    [Fact]
    public async Task A_worker_runs_stages_0_to_10_in_order_and_the_direction_completes_with_the_project_idle()
    {
        var (owner, projectId) = await SubmitAsync();
        var worker = await _factory.RegisterWorkerAsync();

        var stages = await worker.RunUntilIdleAsync();

        Assert.Equal(Enumerable.Range(0, 11), stages);
        var project = await HewnClient.ReadJsonAsync(await owner.GetAsync($"/api/projects/{projectId}"));
        Assert.Equal("Idle", project.GetProperty("status").GetString());
        var direction = project.GetProperty("directions")[0];
        Assert.Equal("Complete", direction.GetProperty("status").GetString());
        Assert.True(direction.GetProperty("completedAt").ValueKind != System.Text.Json.JsonValueKind.Null);
        foreach (var stage in direction.GetProperty("stages").EnumerateArray())
        {
            Assert.Equal("Succeeded", stage.GetProperty("status").GetString());
        }
    }

    [Fact]
    public async Task Leasing_stage_0_starts_the_direction_and_marks_only_that_stage_running()
    {
        var (owner, projectId) = await SubmitAsync();
        var worker = await _factory.RegisterWorkerAsync();

        var run = await worker.LeaseAsync();

        Assert.NotNull(run);
        Assert.Equal(0, run.Stage);
        Assert.Equal(1, run.Epoch);
        Assert.Equal("Ledgerline", run.Body.GetProperty("project").GetProperty("name").GetString());
        var direction = (await HewnClient.ReadJsonAsync(await owner.GetAsync($"/api/projects/{projectId}")))
            .GetProperty("directions")[0];
        Assert.Equal("Running", direction.GetProperty("status").GetString());
        var statuses = direction.GetProperty("stages").EnumerateArray().Select(s => s.GetProperty("status").GetString()).ToList();
        Assert.Equal("Running", statuses[0]);
        Assert.All(statuses.Skip(1), s => Assert.Equal("Pending", s));
        Assert.All(statuses, s => Assert.Contains(s, AllowedStageStatuses));
    }

    [Fact]
    public async Task The_next_stage_is_offered_only_after_the_current_one_succeeds()
    {
        await SubmitAsync();
        var first = await _factory.RegisterWorkerAsync("worker-a");
        var second = await _factory.RegisterWorkerAsync("worker-b");

        var stage0 = await first.LeaseAsync();
        Assert.Null(await second.LeaseAsync());

        (await first.SucceedAsync(stage0!)).EnsureSuccessStatusCode();
        var stage1 = await second.LeaseAsync();

        Assert.Equal(1, stage1!.Stage);
    }

    [Fact]
    public async Task At_most_one_worker_holds_a_lease_per_project_while_other_projects_proceed()
    {
        var (_, ledgerline) = await SubmitAsync("Ledgerline");
        var (_, tidewater) = await SubmitAsync("Tidewater");
        var a = await _factory.RegisterWorkerAsync("worker-a");
        var b = await _factory.RegisterWorkerAsync("worker-b");
        var c = await _factory.RegisterWorkerAsync("worker-c");

        var runA = await a.LeaseAsync();
        var runB = await b.LeaseAsync();
        var runC = await c.LeaseAsync();

        Assert.NotNull(runA);
        Assert.NotNull(runB);
        Assert.Null(runC);
        Assert.Equal(new[] { ledgerline, tidewater }.OrderBy(x => x), new[] { runA.ProjectId, runB.ProjectId }.OrderBy(x => x));
    }

    [Fact]
    public async Task A_lease_with_no_heartbeat_for_60_seconds_returns_the_run_to_the_queue_with_its_checkpoint()
    {
        await SubmitAsync();
        var crashed = await _factory.RegisterWorkerAsync("worker-a");
        var run = await crashed.LeaseAsync();
        (await crashed.CheckpointAsync(run!, 2)).EnsureSuccessStatusCode();

        _factory.Clock.Advance(TimeSpan.FromSeconds(59));
        await _factory.ExpireStaleLeasesAsync();
        var replacement = await _factory.RegisterWorkerAsync("worker-b");
        Assert.Null(await replacement.LeaseAsync());

        _factory.Clock.Advance(TimeSpan.FromSeconds(2));
        await _factory.ExpireStaleLeasesAsync();
        var resumed = await replacement.LeaseAsync();

        Assert.Equal(run!.RunId, resumed!.RunId);
        Assert.Equal(2, resumed.CheckpointStep);
        Assert.Equal(2, resumed.Epoch);
        var stale = await crashed.HeartbeatAsync(run);
        Assert.Equal(HttpStatusCode.Conflict, stale.StatusCode);
        Assert.Equal("lease_lost", (await HewnClient.ReadJsonAsync(stale)).GetProperty("code").GetString());
    }

    [Fact]
    public async Task Heartbeats_keep_the_lease_alive()
    {
        await SubmitAsync();
        var worker = await _factory.RegisterWorkerAsync();
        var run = await worker.LeaseAsync();

        for (var i = 0; i < 9; i++)
        {
            _factory.Clock.Advance(TimeSpan.FromSeconds(10));
            (await worker.HeartbeatAsync(run!)).EnsureSuccessStatusCode();
            await _factory.ExpireStaleLeasesAsync();
        }

        (await worker.SucceedAsync(run!)).EnsureSuccessStatusCode();
    }

    [Fact]
    public async Task A_result_with_a_stale_epoch_is_refused_and_changes_nothing()
    {
        var (owner, projectId) = await SubmitAsync();
        var worker = await _factory.RegisterWorkerAsync();
        var run = await worker.LeaseAsync();

        var response = await worker.SucceedAsync(run!, epoch: run!.Epoch + 7);

        Assert.Equal(HttpStatusCode.Conflict, response.StatusCode);
        var stage0 = (await HewnClient.ReadJsonAsync(await owner.GetAsync($"/api/projects/{projectId}")))
            .GetProperty("directions")[0].GetProperty("stages")[0];
        Assert.Equal("Running", stage0.GetProperty("status").GetString());
    }

    [Fact]
    public async Task A_failed_run_marks_the_stage_failed_and_the_project_blocked_without_starting_the_next_stage()
    {
        var (owner, projectId) = await SubmitAsync();
        var worker = await _factory.RegisterWorkerAsync();
        var run = await worker.LeaseAsync();

        // The run and its three automatic retries (L2-006 AC1) all fail.
        (await worker.FailAsync(run!, "Greenlit could not be cloned")).EnsureSuccessStatusCode();
        foreach (var wait in new[] { 30, 120, 600 })
        {
            _factory.Clock.Advance(TimeSpan.FromSeconds(wait));
            run = await worker.LeaseAsync();
            Assert.Equal(0, run!.Stage);
            (await worker.FailAsync(run, "Greenlit could not be cloned")).EnsureSuccessStatusCode();
        }

        var project = await HewnClient.ReadJsonAsync(await owner.GetAsync($"/api/projects/{projectId}"));
        Assert.Equal("Blocked", project.GetProperty("status").GetString());
        Assert.Equal("Failed", project.GetProperty("directions")[0].GetProperty("stages")[0].GetProperty("status").GetString());
        Assert.Null(await worker.LeaseAsync());
    }

    [Fact]
    public async Task A_failure_message_is_stored_with_credentials_redacted()
    {
        await SubmitAsync();
        var worker = await _factory.RegisterWorkerAsync();
        var run = await worker.LeaseAsync();

        (await worker.FailAsync(run!, "git push failed: remote rejected ghp_abcdefghijklmnopqrstuvwxyz0123456789 token=hunter2-secret")).EnsureSuccessStatusCode();

        var stored = await _factory.QueryAsync(db => db.Runs.SingleAsync(r => r.Id == run!.RunId));
        Assert.Equal("git push failed: remote rejected *** token=***", stored.Error);
    }

    [Fact]
    public async Task Every_client_visible_change_is_an_event_numbered_one_more_than_the_last()
    {
        var (owner, projectId) = await SubmitAsync();
        var worker = await _factory.RegisterWorkerAsync();
        await worker.RunUntilIdleAsync();

        var events = await HewnClient.ReadJsonAsync(await owner.GetAsync($"/api/projects/{projectId}/events?after=0"));

        var sequences = events.EnumerateArray().Select(e => e.GetProperty("sequence").GetInt64()).ToList();
        Assert.Equal(Enumerable.Range(1, sequences.Count).Select(i => (long)i), sequences);
        var types = events.EnumerateArray().Select(e => e.GetProperty("type").GetString()).ToList();
        Assert.Equal("DirectionQueued", types[0]);
        Assert.Equal(22, types.Count(t => t == "StageChanged"));
        Assert.Equal("DirectionChanged", types[^2]);
        Assert.Equal("ProjectChanged", types[^1]);

        var later = await HewnClient.ReadJsonAsync(await owner.GetAsync($"/api/projects/{projectId}/events?after={sequences.Count - 2}"));
        Assert.Equal(2, later.GetArrayLength());
    }

    [Fact]
    public async Task Worker_endpoints_refuse_requests_without_the_worker_token()
    {
        var anonymous = _factory.CreateAnonymousClient();
        Assert.Equal(HttpStatusCode.Unauthorized, (await anonymous.PostAsync("/api/worker/lease", null)).StatusCode);

        anonymous.DefaultRequestHeaders.Authorization = new("Bearer", "not-the-token");
        Assert.Equal(HttpStatusCode.Unauthorized, (await anonymous.PostAsync("/api/worker/lease", null)).StatusCode);

        var owner = await _factory.SignInAsync("quinntynebrown", Role.Owner);
        Assert.Equal(HttpStatusCode.Unauthorized, (await owner.PostAsync("/api/worker/lease", new { workerId = "x" })).StatusCode);
    }

    [Fact]
    public async Task A_registered_worker_is_recorded_with_its_location_host_and_version()
    {
        var worker = await _factory.RegisterWorkerAsync("hewn-local-01");

        var stored = await _factory.QueryAsync(db => db.Workers.SingleAsync());

        Assert.Equal(worker.WorkerId, stored.Id);
        Assert.Equal("hewn-local-01", stored.Name);
        Assert.Equal(WorkerLocation.Local, stored.Location);
        Assert.Equal("test-host", stored.Host);
        Assert.Equal("0.0.0-test", stored.Version);
    }
}

// Acceptance Test
// Traces to: L2-030, L2-031, L2-033, L2-054
// Description: A running stage's step and latest log line reach Mission Control as numbered events, and a selected stage's runs, logs, artifacts and decisions can be read by anyone who can see the project

using System.Net;
using System.Net.Http.Json;
using System.Text;
using System.Text.Json;
using Hewn.Api.Tests.Support;
using Hewn.Domain;

namespace Hewn.Api.Tests.Pipeline;

public sealed class MonitorDirectionTests : IAsyncLifetime
{
    private readonly HewnApiFactory _factory = new();

    public Task InitializeAsync() => Task.CompletedTask;

    public async Task DisposeAsync() => await _factory.DisposeAsync();

    private async Task<(HewnClient Owner, Guid ProjectId, Guid DirectionId)> SubmitAsync(string name = "Ledgerline")
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
        var project = await HewnClient.ReadJsonAsync(await owner.GetAsync($"/api/projects/{projectId}"));
        return (owner, projectId, project.GetProperty("directions")[0].GetProperty("id").GetGuid());
    }

    private static Task<HttpResponseMessage> StartStepAsync(WorkerClient worker, LeasedRun run, int step, string name, long? epoch = null) =>
        worker.Http.PutAsJsonAsync($"/api/worker/runs/{run.RunId}/step", new { workerId = worker.WorkerId, epoch = epoch ?? run.Epoch, step, name });

    private static Task<HttpResponseMessage> LogAsync(WorkerClient worker, LeasedRun run, params (string Level, string Text)[] lines) =>
        worker.Http.PostAsJsonAsync($"/api/worker/runs/{run.RunId}/logs", new
        {
            workerId = worker.WorkerId,
            epoch = run.Epoch,
            lines = lines.Select(l => new { level = l.Level, text = l.Text }),
        });

    private static async Task<List<JsonElement>> EventsAsync(HewnClient client, Guid projectId) =>
        (await HewnClient.ReadJsonAsync(await client.GetAsync($"/api/projects/{projectId}/events?after=0"))).EnumerateArray().ToList();

    private static async Task<JsonElement> StageAsync(HewnClient client, Guid projectId, int number) =>
        (await HewnClient.ReadJsonAsync(await client.GetAsync($"/api/projects/{projectId}")))
            .GetProperty("directions")[0].GetProperty("stages")[number];

    [Fact]
    public async Task A_started_step_shows_on_the_running_stage_and_is_sent_as_a_StepStarted_event()
    {
        var (owner, projectId, directionId) = await SubmitAsync();
        var worker = await _factory.RegisterWorkerAsync();
        var run = await worker.LeaseAsync();

        var response = await StartStepAsync(worker, run!, 2, "Copy skills from Greenlit");

        Assert.Equal(HttpStatusCode.NoContent, response.StatusCode);
        Assert.Equal("Copy skills from Greenlit", (await StageAsync(owner, projectId, 0)).GetProperty("step").GetString());
        var started = (await EventsAsync(owner, projectId)).Single(e => e.GetProperty("type").GetString() == "StepStarted").GetProperty("payload");
        Assert.Equal(directionId, started.GetProperty("directionId").GetGuid());
        Assert.Equal(0, started.GetProperty("stage").GetInt32());
        Assert.Equal(run!.RunId, started.GetProperty("runId").GetGuid());
        Assert.Equal(2, started.GetProperty("step").GetInt32());
        Assert.Equal("Copy skills from Greenlit", started.GetProperty("name").GetString());
    }

    [Fact]
    public async Task A_step_from_a_stale_lease_is_refused()
    {
        await SubmitAsync();
        var worker = await _factory.RegisterWorkerAsync();
        var run = await worker.LeaseAsync();

        var response = await StartStepAsync(worker, run!, 1, "Check out repository", run!.Epoch + 1);

        Assert.Equal(HttpStatusCode.Conflict, response.StatusCode);
    }

    [Fact]
    public async Task Log_lines_are_sent_as_one_numbered_LogLines_event_per_batch_with_credentials_redacted()
    {
        var (owner, projectId, directionId) = await SubmitAsync();
        var worker = await _factory.RegisterWorkerAsync();
        var run = await worker.LeaseAsync();

        (await LogAsync(worker, run!, ("info", "Copied 14 skills"), ("warn", "token=ghp_abcdefghijklmnopqrstuvwxyz0123456789"))).EnsureSuccessStatusCode();
        (await LogAsync(worker, run!, ("info", "Committed 5a1fe37"))).EnsureSuccessStatusCode();

        var batches = (await EventsAsync(owner, projectId)).Where(e => e.GetProperty("type").GetString() == "LogLines").ToList();
        Assert.Equal(2, batches.Count);
        var first = batches[0].GetProperty("payload");
        Assert.Equal(directionId, first.GetProperty("directionId").GetGuid());
        Assert.Equal(0, first.GetProperty("stage").GetInt32());
        Assert.Equal(run!.RunId, first.GetProperty("runId").GetGuid());
        var lines = first.GetProperty("lines").EnumerateArray().ToList();
        Assert.Equal([1L, 2L], lines.Select(l => l.GetProperty("line").GetInt64()));
        Assert.Equal(["info", "warn"], lines.Select(l => l.GetProperty("level").GetString()));
        Assert.Equal(["Copied 14 skills", "token=***"], lines.Select(l => l.GetProperty("text").GetString()));
        Assert.Equal(3L, batches[1].GetProperty("payload").GetProperty("lines")[0].GetProperty("line").GetInt64());
        Assert.Equal("Committed 5a1fe37", (await StageAsync(owner, projectId, 0)).GetProperty("latestLine").GetString());
    }

    [Fact]
    public async Task Every_event_of_a_project_carries_a_sequence_number_one_more_than_the_last()
    {
        var (owner, projectId, _) = await SubmitAsync();
        var worker = await _factory.RegisterWorkerAsync();
        var run = await worker.LeaseAsync();
        (await StartStepAsync(worker, run!, 1, "Check out repository")).EnsureSuccessStatusCode();
        (await LogAsync(worker, run!, ("info", "Checked out"))).EnsureSuccessStatusCode();
        (await worker.SucceedAsync(run!)).EnsureSuccessStatusCode();

        var events = await EventsAsync(owner, projectId);

        Assert.Contains(events, e => e.GetProperty("type").GetString() == "StepStarted");
        Assert.Contains(events, e => e.GetProperty("type").GetString() == "LogLines");
        Assert.Equal(Enumerable.Range(1, events.Count).Select(i => (long)i), events.Select(e => e.GetProperty("sequence").GetInt64()));
    }

    [Fact]
    public async Task The_step_and_latest_line_belong_to_the_running_stage_only()
    {
        var (owner, projectId, _) = await SubmitAsync();
        var worker = await _factory.RegisterWorkerAsync();
        var run = await worker.LeaseAsync();
        (await StartStepAsync(worker, run!, 1, "Check out repository")).EnsureSuccessStatusCode();
        (await LogAsync(worker, run!, ("info", "Checked out"))).EnsureSuccessStatusCode();

        (await worker.SucceedAsync(run!)).EnsureSuccessStatusCode();

        var done = await StageAsync(owner, projectId, 0);
        Assert.Equal(JsonValueKind.Null, done.GetProperty("step").ValueKind);
        Assert.Equal(JsonValueKind.Null, done.GetProperty("latestLine").ValueKind);
    }

    [Fact]
    public async Task A_stage_lists_its_runs_with_status_worker_and_times()
    {
        var (owner, projectId, directionId) = await SubmitAsync();
        var worker = await _factory.RegisterWorkerAsync("build-box-02");
        var run = await worker.LeaseAsync();
        _factory.Clock.Advance(TimeSpan.FromSeconds(41));
        (await worker.SucceedAsync(run!)).EnsureSuccessStatusCode();

        var detail = await HewnClient.ReadJsonAsync(await owner.GetAsync($"/api/projects/{projectId}/directions/{directionId}/stages/0"));

        var only = Assert.Single(detail.GetProperty("runs").EnumerateArray());
        Assert.Equal(run!.RunId, only.GetProperty("id").GetGuid());
        Assert.Equal("Succeeded", only.GetProperty("status").GetString());
        Assert.Equal("build-box-02", only.GetProperty("worker").GetString());
        Assert.Equal(
            TimeSpan.FromSeconds(41),
            only.GetProperty("endedAt").GetDateTimeOffset() - only.GetProperty("startedAt").GetDateTimeOffset());
        Assert.Equal(JsonValueKind.Null, only.GetProperty("error").ValueKind);
    }

    [Fact]
    public async Task A_stage_with_no_run_yet_has_empty_runs_artifacts_and_decisions()
    {
        var (owner, projectId, directionId) = await SubmitAsync();

        var detail = await HewnClient.ReadJsonAsync(await owner.GetAsync($"/api/projects/{projectId}/directions/{directionId}/stages/5"));

        Assert.Empty(detail.GetProperty("runs").EnumerateArray());
        Assert.Empty(detail.GetProperty("artifacts").EnumerateArray());
        Assert.Empty(detail.GetProperty("decisions").EnumerateArray());
    }

    [Fact]
    public async Task A_run_log_is_read_in_pages_after_a_line_number()
    {
        var (owner, projectId, _) = await SubmitAsync();
        var worker = await _factory.RegisterWorkerAsync();
        var run = await worker.LeaseAsync();
        (await LogAsync(worker, run!, Enumerable.Range(1, 5).Select(i => ("info", $"line {i}")).ToArray())).EnsureSuccessStatusCode();

        var all = await HewnClient.ReadJsonAsync(await owner.GetAsync($"/api/projects/{projectId}/runs/{run!.RunId}/logs?after=0"));
        var later = await HewnClient.ReadJsonAsync(await owner.GetAsync($"/api/projects/{projectId}/runs/{run.RunId}/logs?after=3&limit=1"));

        Assert.Equal(["line 1", "line 2", "line 3", "line 4", "line 5"], all.EnumerateArray().Select(l => l.GetProperty("text").GetString()));
        var next = Assert.Single(later.EnumerateArray());
        Assert.Equal(4L, next.GetProperty("line").GetInt64());
        Assert.Equal("line 4", next.GetProperty("text").GetString());
        Assert.Equal("info", next.GetProperty("level").GetString());
    }

    [Fact]
    public async Task A_stage_lists_the_files_its_runs_committed_with_the_commit_sha()
    {
        var (owner, projectId, directionId) = await SubmitAsync();
        var worker = await _factory.RegisterWorkerAsync();
        LeasedRun run;
        while ((run = (await worker.LeaseAsync())!).Stage != 1)
        {
            (await worker.SucceedAsync(run)).EnsureSuccessStatusCode();
        }

        var commit = await worker.Http.PostAsJsonAsync($"/api/worker/runs/{run.RunId}/github/mutations", new
        {
            workerId = worker.WorkerId,
            epoch = run.Epoch,
            kind = "commit",
            idempotencyKey = $"{run.RunId}/2/commit",
            message = "Write the brief",
            files = new[] { "docs/brief.md", "docs/decisions.md" }.Select(p => new { path = p, contentBase64 = Convert.ToBase64String(Encoding.UTF8.GetBytes("# Doc\n")) }),
        });
        commit.EnsureSuccessStatusCode();
        var sha = (await HewnClient.ReadJsonAsync(commit)).GetProperty("sha").GetString();

        var detail = await HewnClient.ReadJsonAsync(await owner.GetAsync($"/api/projects/{projectId}/directions/{directionId}/stages/1"));

        var artifacts = detail.GetProperty("artifacts").EnumerateArray().ToList();
        Assert.Equal(["docs/brief.md", "docs/decisions.md"], artifacts.Select(a => a.GetProperty("path").GetString()));
        Assert.All(artifacts, a => Assert.Equal(sha, a.GetProperty("sha").GetString()));
        Assert.Equal("hewn-builds/ledgerline", detail.GetProperty("repository").GetString());
    }

    [Fact]
    public async Task Decisions_a_run_reports_are_stored_redacted_sent_as_events_and_listed_on_the_stage()
    {
        var (owner, projectId, directionId) = await SubmitAsync();
        var worker = await _factory.RegisterWorkerAsync();
        var run = await worker.LeaseAsync();

        var response = await worker.Http.PostAsJsonAsync($"/api/worker/runs/{run!.RunId}/decisions", new
        {
            workerId = worker.WorkerId,
            epoch = run.Epoch,
            decisions = new[]
            {
                new { question = "Which skills does the product need?", answer = "All fourteen from Greenlit.", rationale = "The brief names no reason to drop one; key ghp_abcdefghijklmnopqrstuvwxyz0123456789" },
            },
        });

        Assert.Equal(HttpStatusCode.NoContent, response.StatusCode);
        var detail = await HewnClient.ReadJsonAsync(await owner.GetAsync($"/api/projects/{projectId}/directions/{directionId}/stages/0"));
        var decision = Assert.Single(detail.GetProperty("decisions").EnumerateArray());
        Assert.Equal("Which skills does the product need?", decision.GetProperty("question").GetString());
        Assert.Equal("All fourteen from Greenlit.", decision.GetProperty("answer").GetString());
        Assert.DoesNotContain("ghp_", decision.GetProperty("rationale").GetString());
        Assert.Contains("***", decision.GetProperty("rationale").GetString());
        var recorded = (await EventsAsync(owner, projectId)).Single(e => e.GetProperty("type").GetString() == "DecisionRecorded").GetProperty("payload");
        Assert.Equal(0, recorded.GetProperty("stage").GetInt32());
        Assert.Equal("Which skills does the product need?", recorded.GetProperty("question").GetString());
    }

    [Fact]
    public async Task A_decision_reported_again_by_a_resumed_step_is_kept_once()
    {
        var (owner, projectId, directionId) = await SubmitAsync();
        var worker = await _factory.RegisterWorkerAsync();
        var run = await worker.LeaseAsync();
        var body = new
        {
            workerId = worker.WorkerId,
            epoch = run!.Epoch,
            decisions = new[] { new { question = "Which skills does the product need?", answer = "All fourteen.", rationale = "None is unused." } },
        };

        (await worker.Http.PostAsJsonAsync($"/api/worker/runs/{run.RunId}/decisions", body)).EnsureSuccessStatusCode();
        (await worker.Http.PostAsJsonAsync($"/api/worker/runs/{run.RunId}/decisions", body)).EnsureSuccessStatusCode();

        var detail = await HewnClient.ReadJsonAsync(await owner.GetAsync($"/api/projects/{projectId}/directions/{directionId}/stages/0"));
        Assert.Single(detail.GetProperty("decisions").EnumerateArray());
    }

    [Fact]
    public async Task A_decision_with_no_question_is_refused()
    {
        await SubmitAsync();
        var worker = await _factory.RegisterWorkerAsync();
        var run = await worker.LeaseAsync();

        var response = await worker.Http.PostAsJsonAsync($"/api/worker/runs/{run!.RunId}/decisions", new
        {
            workerId = worker.WorkerId,
            epoch = run.Epoch,
            decisions = new[] { new { question = "", answer = "Yes.", rationale = "Because." } },
        });

        Assert.Equal(HttpStatusCode.BadRequest, response.StatusCode);
    }

    [Fact]
    public async Task A_Viewer_reads_a_stage_and_its_log()
    {
        var (_, projectId, directionId) = await SubmitAsync();
        var worker = await _factory.RegisterWorkerAsync();
        var run = await worker.LeaseAsync();
        (await LogAsync(worker, run!, ("info", "Checked out"))).EnsureSuccessStatusCode();
        var viewer = await _factory.SignInAsync("ada", Role.Viewer);

        var detail = await viewer.GetAsync($"/api/projects/{projectId}/directions/{directionId}/stages/0");
        var log = await viewer.GetAsync($"/api/projects/{projectId}/runs/{run!.RunId}/logs?after=0");

        Assert.Equal(HttpStatusCode.OK, detail.StatusCode);
        Assert.Equal(HttpStatusCode.OK, log.StatusCode);
    }

    [Fact]
    public async Task An_unknown_stage_direction_or_run_is_not_found_and_an_anonymous_caller_is_refused()
    {
        var (owner, projectId, directionId) = await SubmitAsync();
        var worker = await _factory.RegisterWorkerAsync();
        var run = await worker.LeaseAsync();
        var (_, otherProjectId, _) = await SubmitAsync("Kiln Booking");
        var anonymous = _factory.CreateClient();

        Assert.Equal(HttpStatusCode.NotFound, (await owner.GetAsync($"/api/projects/{projectId}/directions/{directionId}/stages/11")).StatusCode);
        Assert.Equal(HttpStatusCode.NotFound, (await owner.GetAsync($"/api/projects/{projectId}/directions/{Guid.NewGuid()}/stages/0")).StatusCode);
        Assert.Equal(HttpStatusCode.NotFound, (await owner.GetAsync($"/api/projects/{otherProjectId}/directions/{directionId}/stages/0")).StatusCode);
        Assert.Equal(HttpStatusCode.NotFound, (await owner.GetAsync($"/api/projects/{otherProjectId}/runs/{run!.RunId}/logs?after=0")).StatusCode);
        Assert.Equal(HttpStatusCode.Unauthorized, (await anonymous.GetAsync($"/api/projects/{projectId}/runs/{run.RunId}/logs?after=0")).StatusCode);
    }
}

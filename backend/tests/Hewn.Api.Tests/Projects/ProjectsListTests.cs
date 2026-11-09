// Acceptance Test
// Traces to: L2-002, L2-031
// Description: GET /api/projects lists every project with its current stage, status, percent complete, spend to date and last activity, newest activity first, and a client that joins the projects list receives each changed row live

using System.Collections.Concurrent;
using System.Net.Http.Json;
using System.Text.Json;
using Hewn.Api.Tests.Support;
using Hewn.Domain;
using Microsoft.AspNetCore.Http.Connections;
using Microsoft.AspNetCore.SignalR.Client;

namespace Hewn.Api.Tests.Projects;

public sealed class ProjectsListTests : IAsyncLifetime
{
    private readonly HewnApiFactory _factory = new();

    public Task InitializeAsync() => Task.CompletedTask;

    public async Task DisposeAsync() => await _factory.DisposeAsync();

    private async Task<Guid> SubmitProductAsync(HewnClient owner, string name)
    {
        _factory.Clock.Advance(TimeSpan.FromSeconds(10));
        var response = await owner.PostAsync("/api/projects", new
        {
            name,
            idea = $"{name}: a web app for small accounting teams to reconcile statements.",
            stackPreference = (string?)null,
            repositoryUrl = (string?)null,
            budgetUsd = 300m,
        });
        response.EnsureSuccessStatusCode();
        return (await HewnClient.ReadJsonAsync(response)).GetProperty("projectId").GetGuid();
    }

    private static async Task<List<JsonElement>> ListAsync(HewnClient client)
    {
        var response = await client.GetAsync("/api/projects");
        response.EnsureSuccessStatusCode();
        return [.. (await HewnClient.ReadJsonAsync(response)).EnumerateArray()];
    }

    private static JsonElement Row(List<JsonElement> rows, string name) => rows.Single(r => r.GetProperty("name").GetString() == name);

    private static Task<HttpResponseMessage> StartStepAsync(WorkerClient worker, LeasedRun run, int step, string name) =>
        worker.Http.PutAsJsonAsync($"/api/worker/runs/{run.RunId}/step", new { workerId = worker.WorkerId, epoch = run.Epoch, step, name });

    private static Task<HttpResponseMessage> CallAsync(WorkerClient worker, LeasedRun run, string callId) =>
        worker.Http.PostAsJsonAsync($"/api/worker/runs/{run.RunId}/model-calls", new
        {
            workerId = worker.WorkerId,
            epoch = run.Epoch,
            callId,
            model = "claude-opus-5-5",
            inputTokens = 100_000L,
            outputTokens = 20_000L,
        });

    [Fact]
    public async Task Each_project_shows_its_stage_status_percent_spend_and_last_activity_newest_first()
    {
        var owner = await _factory.SignInAsync("quinntynebrown", Role.Owner);
        var viewer = await _factory.SignInAsync("ada", Role.Viewer);
        var ledgerline = await SubmitProductAsync(owner, "Ledgerline");
        await SubmitProductAsync(owner, "Tidewater");

        // Ledgerline's stage 0 is leased after Tidewater was submitted, so Ledgerline has the latest activity.
        _factory.Clock.Advance(TimeSpan.FromMinutes(1));
        var worker = await _factory.RegisterWorkerAsync();
        var run = await worker.LeaseAsync();
        Assert.Equal(ledgerline, run!.ProjectId);
        (await StartStepAsync(worker, run, 1, "Prepare workspace")).EnsureSuccessStatusCode();
        (await CallAsync(worker, run, "call-1")).EnsureSuccessStatusCode();
        var activityAt = _factory.Clock.GetUtcNow();

        var rows = await ListAsync(viewer);

        Assert.Equal(["Ledgerline", "Tidewater"], rows.Select(r => r.GetProperty("name").GetString()));
        var row = Row(rows, "Ledgerline");
        Assert.Equal(ledgerline, row.GetProperty("id").GetGuid());
        Assert.Equal("Running", row.GetProperty("status").GetString());
        Assert.Equal(0, row.GetProperty("stage").GetProperty("number").GetInt32());
        Assert.Equal("Bootstrap", row.GetProperty("stage").GetProperty("name").GetString());
        Assert.Equal("Prepare workspace", row.GetProperty("note").GetString());
        Assert.Equal(0, row.GetProperty("percentComplete").GetInt32());
        var project = await HewnClient.ReadJsonAsync(await owner.GetAsync($"/api/projects/{ledgerline}"));
        var spend = project.GetProperty("directions")[0].GetProperty("spendUsd").GetDecimal();
        Assert.True(spend > 0);
        Assert.Equal(spend, row.GetProperty("spendUsd").GetDecimal());
        Assert.Equal(activityAt, row.GetProperty("lastActivityAt").GetDateTimeOffset());
        Assert.Equal("Ledgerline: a web app for small accounting teams to reconcile statements.", row.GetProperty("idea").GetString());

        var tidewater = Row(rows, "Tidewater");
        Assert.Equal("Running", tidewater.GetProperty("status").GetString());
        Assert.Equal(0, tidewater.GetProperty("stage").GetProperty("number").GetInt32());
        Assert.Equal(JsonValueKind.Null, tidewater.GetProperty("note").ValueKind);
        Assert.Equal(0m, tidewater.GetProperty("spendUsd").GetDecimal());
        Assert.True(tidewater.GetProperty("lastActivityAt").GetDateTimeOffset() < activityAt);
    }

    [Fact]
    public async Task Percent_complete_counts_finished_stages_and_a_finished_project_is_Idle_at_100_percent()
    {
        var owner = await _factory.SignInAsync("quinntynebrown", Role.Owner);
        await SubmitProductAsync(owner, "Ledgerline");
        var worker = await _factory.RegisterWorkerAsync();

        // Stages 0 to 2 succeed: 3 of 11.
        for (var i = 0; i < 3; i++)
        {
            var run = await worker.LeaseAsync();
            (await worker.SucceedAsync(run!)).EnsureSuccessStatusCode();
        }

        var row = Row(await ListAsync(owner), "Ledgerline");
        Assert.Equal(27, row.GetProperty("percentComplete").GetInt32());
        Assert.Equal(3, row.GetProperty("stage").GetProperty("number").GetInt32());
        Assert.Equal("Design system", row.GetProperty("stage").GetProperty("name").GetString());

        await worker.RunUntilIdleAsync();

        row = Row(await ListAsync(owner), "Ledgerline");
        Assert.Equal("Idle", row.GetProperty("status").GetString());
        Assert.Equal(100, row.GetProperty("percentComplete").GetInt32());
        Assert.Equal(10, row.GetProperty("stage").GetProperty("number").GetInt32());
        Assert.Equal("Increments", row.GetProperty("stage").GetProperty("name").GetString());
    }

    [Fact]
    public async Task A_blocked_project_says_which_stage_failed()
    {
        _factory.WithSettings(("Hewn:Retry:BackoffSeconds", "1,1,1"));
        var owner = await _factory.SignInAsync("quinntynebrown", Role.Owner);
        await SubmitProductAsync(owner, "Parcel Post");
        var worker = await _factory.RegisterWorkerAsync();
        for (var attempt = 1; attempt <= 4; attempt++)
        {
            _factory.Clock.Advance(TimeSpan.FromSeconds(2));
            var run = await worker.LeaseAsync();
            (await worker.FailAsync(run!, "Validation failed")).EnsureSuccessStatusCode();
        }

        var row = Row(await ListAsync(owner), "Parcel Post");
        Assert.Equal("Blocked", row.GetProperty("status").GetString());
        Assert.Equal("Bootstrap failed after 3 retries", row.GetProperty("note").GetString());
    }

    [Fact]
    public async Task A_client_on_the_projects_list_receives_each_changed_row_live()
    {
        var owner = await _factory.SignInAsync("quinntynebrown", Role.Owner);
        var viewer = await _factory.SignInAsync("ada", Role.Viewer);
        var ledgerline = await SubmitProductAsync(owner, "Ledgerline");
        var received = new ConcurrentQueue<JsonElement>();
        var cookies = viewer.CookieHeader();
        await using var hub = new HubConnectionBuilder()
            .WithUrl(new Uri(_factory.Server.BaseAddress, "/hubs/mission-control"), o =>
            {
                o.HttpMessageHandlerFactory = _ => _factory.Server.CreateHandler();
                o.Transports = HttpTransportType.LongPolling;
                o.Headers["Cookie"] = cookies;
            })
            .Build();
        hub.On<JsonElement>("ProjectSummary", e => received.Enqueue(e));
        await hub.StartAsync();
        await hub.InvokeAsync("JoinProjects");

        var worker = await _factory.RegisterWorkerAsync();
        var run = await worker.LeaseAsync();
        (await StartStepAsync(worker, run!, 1, "Prepare workspace")).EnsureSuccessStatusCode();
        var tidewater = await SubmitProductAsync(owner, "Tidewater");

        var deadline = DateTime.UtcNow.AddSeconds(5);
        while (DateTime.UtcNow < deadline && !(Has(ledgerline, "Prepare workspace") && Has(tidewater, null)))
        {
            await Task.Delay(25);
        }

        Assert.True(Has(ledgerline, "Prepare workspace"), "Ledgerline's row with its step");
        Assert.True(Has(tidewater, null), "the new project's row");

        bool Has(Guid id, string? note) => received.Any(r =>
            r.GetProperty("id").GetGuid() == id &&
            (note is null || r.GetProperty("note").ValueKind == JsonValueKind.String && r.GetProperty("note").GetString() == note));
    }
}

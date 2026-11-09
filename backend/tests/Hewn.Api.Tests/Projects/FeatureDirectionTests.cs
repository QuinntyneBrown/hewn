// Acceptance Test
// Traces to: L2-005, L2-054
// Description: An Owner adds a feature to an existing product; it skips stages 0, 4 and 6, queues behind an active direction, and skips 2 and 3 when stage 1 records no UI change

using System.Net;
using System.Net.Http.Json;
using System.Text.Json;
using Hewn.Api.Tests.Support;
using Hewn.Domain;

namespace Hewn.Api.Tests.Projects;

public sealed class FeatureDirectionTests : IAsyncLifetime
{
    private const string Feature = "Add a CSV export to the shift report so supervisors can open it in Excel.";

    private readonly HewnApiFactory _factory = new();

    public Task InitializeAsync() => Task.CompletedTask;

    public async Task DisposeAsync() => await _factory.DisposeAsync();

    private async Task<(HewnClient Owner, Guid ProjectId)> SubmitProductAsync(string name = "Northwind Ops")
    {
        var owner = await _factory.SignInAsync("quinntynebrown", Role.Owner);
        var response = await owner.PostAsync("/api/projects", new
        {
            name,
            idea = "An operations portal for shift supervisors.",
            stackPreference = (string?)null,
            repositoryUrl = (string?)null,
            budgetUsd = 300m,
        });
        Assert.Equal(HttpStatusCode.Created, response.StatusCode);
        return (owner, (await HewnClient.ReadJsonAsync(response)).GetProperty("projectId").GetGuid());
    }

    private Task<HttpResponseMessage> SubmitFeatureAsync(HewnClient owner, Guid projectId, string? idea = Feature, decimal budgetUsd = 60m)
    {
        // Directions are ordered by when they were submitted; the test clock stands still unless advanced.
        _factory.Clock.Advance(TimeSpan.FromSeconds(1));
        return owner.PostAsync($"/api/projects/{projectId}/directions", new { idea, budgetUsd });
    }

    private static async Task<JsonElement> DirectionAsync(HewnClient owner, Guid projectId, int index) =>
        (await HewnClient.ReadJsonAsync(await owner.GetAsync($"/api/projects/{projectId}"))).GetProperty("directions")[index];

    private static List<string?> Statuses(JsonElement direction) =>
        direction.GetProperty("stages").EnumerateArray().Select(s => s.GetProperty("status").GetString()).ToList();

    private static Task<HttpResponseMessage> ReportScopeAsync(WorkerClient worker, LeasedRun run, bool hasUiChange, string rationale) =>
        worker.Http.PutAsJsonAsync($"/api/worker/runs/{run.RunId}/scope", new { workerId = worker.WorkerId, epoch = run.Epoch, hasUiChange, rationale });

    private static async Task CompleteAsync(WorkerClient worker, LeasedRun run)
    {
        (await worker.SucceedAsync(run)).EnsureSuccessStatusCode();
    }

    [Fact]
    public async Task A_feature_on_a_complete_product_skips_stages_0_4_and_6_and_runs_the_rest_in_order()
    {
        var (owner, projectId) = await SubmitProductAsync();
        var worker = await _factory.RegisterWorkerAsync();
        await worker.RunUntilIdleAsync();

        var response = await SubmitFeatureAsync(owner, projectId);

        Assert.Equal(HttpStatusCode.Created, response.StatusCode);
        var directionId = (await HewnClient.ReadJsonAsync(response)).GetProperty("directionId").GetGuid();
        var direction = await DirectionAsync(owner, projectId, 1);
        Assert.Equal(directionId, direction.GetProperty("id").GetGuid());
        Assert.Equal("Feature", direction.GetProperty("kind").GetString());
        Assert.Equal(Feature, direction.GetProperty("idea").GetString());
        Assert.Equal(["Skipped", "Pending", "Pending", "Pending", "Skipped", "Pending", "Skipped", "Pending", "Pending", "Pending", "Pending"], Statuses(direction));

        var stages = await worker.RunUntilIdleAsync();

        Assert.Equal([1, 2, 3, 5, 7, 8, 9, 10], stages);
        var project = await HewnClient.ReadJsonAsync(await owner.GetAsync($"/api/projects/{projectId}"));
        Assert.Equal("Idle", project.GetProperty("status").GetString());
        var done = project.GetProperty("directions")[1];
        Assert.Equal("Complete", done.GetProperty("status").GetString());
        Assert.Equal(["Skipped", "Succeeded", "Succeeded", "Succeeded", "Skipped", "Succeeded", "Skipped", "Succeeded", "Succeeded", "Succeeded", "Succeeded"], Statuses(done));
    }

    [Fact]
    public async Task Submitting_a_feature_to_an_idle_project_sets_it_running_and_emits_the_queued_direction()
    {
        var (owner, projectId) = await SubmitProductAsync();
        await (await _factory.RegisterWorkerAsync()).RunUntilIdleAsync();

        await SubmitFeatureAsync(owner, projectId);

        var project = await HewnClient.ReadJsonAsync(await owner.GetAsync($"/api/projects/{projectId}"));
        Assert.Equal("Running", project.GetProperty("status").GetString());
        var events = (await HewnClient.ReadJsonAsync(await owner.GetAsync($"/api/projects/{projectId}/events?after=0"))).EnumerateArray().ToList();
        var queued = events.Last(e => e.GetProperty("type").GetString() == "DirectionQueued").GetProperty("payload");
        Assert.Equal("Feature", queued.GetProperty("kind").GetString());
        // The full direction, so a page that loaded before the feature was submitted can show it.
        Assert.Equal(Feature, queued.GetProperty("direction").GetProperty("idea").GetString());
        Assert.Equal("Skipped", queued.GetProperty("direction").GetProperty("stages")[4].GetProperty("status").GetString());
        Assert.Equal("ProjectChanged", events[^1].GetProperty("type").GetString());
    }

    [Fact]
    public async Task The_lease_tells_the_worker_the_direction_kind_and_the_feature_text()
    {
        var (owner, projectId) = await SubmitProductAsync();
        var worker = await _factory.RegisterWorkerAsync();
        await worker.RunUntilIdleAsync();
        await SubmitFeatureAsync(owner, projectId);

        var run = await worker.LeaseAsync();

        Assert.Equal(1, run!.Stage);
        var direction = run.Body.GetProperty("direction");
        Assert.Equal("Feature", direction.GetProperty("kind").GetString());
        Assert.Equal(Feature, direction.GetProperty("idea").GetString());
    }

    [Fact]
    public async Task A_feature_submitted_before_the_first_direction_is_complete_queues_behind_it()
    {
        var (owner, projectId) = await SubmitProductAsync();
        var worker = await _factory.RegisterWorkerAsync();
        var stage0 = await worker.LeaseAsync();

        var response = await SubmitFeatureAsync(owner, projectId);

        Assert.Equal(HttpStatusCode.Created, response.StatusCode);
        var queued = await DirectionAsync(owner, projectId, 1);
        Assert.Equal("Queued", queued.GetProperty("status").GetString());
        await CompleteAsync(worker, stage0!);

        var stages = await worker.RunUntilIdleAsync();

        // The product direction finishes first, then the feature starts at stage 1: first in, first out.
        Assert.Equal([1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 1, 2, 3, 5, 7, 8, 9, 10], stages);
        Assert.Equal("Complete", (await DirectionAsync(owner, projectId, 1)).GetProperty("status").GetString());
    }

    [Fact]
    public async Task Two_queued_features_start_in_the_order_they_were_submitted()
    {
        var (owner, projectId) = await SubmitProductAsync();
        var worker = await _factory.RegisterWorkerAsync();
        var first = await HewnClient.ReadJsonAsync(await SubmitFeatureAsync(owner, projectId, "First feature: a CSV export."));
        var second = await HewnClient.ReadJsonAsync(await SubmitFeatureAsync(owner, projectId, "Second feature: a PDF export."));

        for (var stage = 0; stage <= 10; stage++)
        {
            await CompleteAsync(worker, (await worker.LeaseAsync())!);
        }

        var next = await worker.LeaseAsync();

        Assert.Equal(first.GetProperty("directionId").GetGuid(), next!.Body.GetProperty("directionId").GetGuid());
        Assert.Equal("Queued", (await DirectionAsync(owner, projectId, 2)).GetProperty("status").GetString());
        Assert.NotEqual(first.GetProperty("directionId").GetGuid(), second.GetProperty("directionId").GetGuid());
    }

    [Fact]
    public async Task When_stage_1_records_no_UI_change_stages_2_and_3_are_skipped_with_the_rationale()
    {
        var (owner, projectId) = await SubmitProductAsync();
        var worker = await _factory.RegisterWorkerAsync();
        await worker.RunUntilIdleAsync();
        await SubmitFeatureAsync(owner, projectId);
        var stage1 = await worker.LeaseAsync();

        var report = await ReportScopeAsync(worker, stage1!, false, "The CSV export adds no screen or state.");
        await CompleteAsync(worker, stage1!);

        Assert.Equal(HttpStatusCode.NoContent, report.StatusCode);
        var direction = await DirectionAsync(owner, projectId, 1);
        Assert.False(direction.GetProperty("hasUiChange").GetBoolean());
        Assert.Equal("The CSV export adds no screen or state.", direction.GetProperty("uiDecision").GetString());
        Assert.Equal(["Skipped", "Succeeded", "Skipped", "Skipped", "Skipped", "Pending", "Skipped", "Pending", "Pending", "Pending", "Pending"], Statuses(direction));
        Assert.Equal([5, 7, 8, 9, 10], await worker.RunUntilIdleAsync());
        var events = (await HewnClient.ReadJsonAsync(await owner.GetAsync($"/api/projects/{projectId}/events?after=0"))).EnumerateArray()
            .Where(e => e.GetProperty("type").GetString() == "StageChanged")
            .Select(e => e.GetProperty("payload"))
            .Where(p => p.GetProperty("status").GetString() == "Skipped" && p.GetProperty("stage").GetInt32() is 2 or 3)
            .ToList();
        Assert.Equal(2, events.Count);
    }

    [Fact]
    public async Task When_stage_1_records_a_UI_change_stages_2_and_3_run()
    {
        var (owner, projectId) = await SubmitProductAsync();
        var worker = await _factory.RegisterWorkerAsync();
        await worker.RunUntilIdleAsync();
        await SubmitFeatureAsync(owner, projectId, "Add a shift calendar page with a week view.");
        var stage1 = await worker.LeaseAsync();

        (await ReportScopeAsync(worker, stage1!, true, "It adds a calendar page.")).EnsureSuccessStatusCode();
        await CompleteAsync(worker, stage1!);

        Assert.Equal([2, 3, 5, 7, 8, 9, 10], await worker.RunUntilIdleAsync());
        Assert.True((await DirectionAsync(owner, projectId, 1)).GetProperty("hasUiChange").GetBoolean());
    }

    [Fact]
    public async Task Only_stage_1_of_a_feature_direction_may_record_the_UI_change_decision()
    {
        var (_, _) = await SubmitProductAsync();
        var worker = await _factory.RegisterWorkerAsync();
        var stage0 = await worker.LeaseAsync();
        await CompleteAsync(worker, stage0!);
        var productStage1 = await worker.LeaseAsync();

        var response = await ReportScopeAsync(worker, productStage1!, false, "Nothing to design.");

        Assert.Equal(HttpStatusCode.BadRequest, response.StatusCode);
        Assert.Equal("scope_not_allowed", (await HewnClient.ReadJsonAsync(response)).GetProperty("code").GetString());
    }

    [Fact]
    public async Task The_UI_change_decision_is_fenced_by_the_lease_and_its_rationale_is_redacted()
    {
        var (owner, projectId) = await SubmitProductAsync();
        var worker = await _factory.RegisterWorkerAsync();
        await worker.RunUntilIdleAsync();
        await SubmitFeatureAsync(owner, projectId);
        var stage1 = await worker.LeaseAsync();

        var stale = await worker.Http.PutAsJsonAsync($"/api/worker/runs/{stage1!.RunId}/scope", new { workerId = worker.WorkerId, epoch = stage1.Epoch + 1, hasUiChange = false, rationale = "x" });
        (await ReportScopeAsync(worker, stage1, false, "No UI. token ghp_abcdefghijklmnopqrstuvwxyz0123456789")).EnsureSuccessStatusCode();

        Assert.Equal(HttpStatusCode.Conflict, stale.StatusCode);
        var decision = (await DirectionAsync(owner, projectId, 1)).GetProperty("uiDecision").GetString();
        Assert.DoesNotContain("ghp_", decision);
    }

    [Theory]
    [InlineData("too short", 60, "idea")]
    [InlineData(Feature, 0, "budgetUsd")]
    public async Task An_invalid_feature_creates_nothing_and_names_the_field(string idea, decimal budget, string field)
    {
        var (owner, projectId) = await SubmitProductAsync();

        var response = await SubmitFeatureAsync(owner, projectId, idea, budget);

        Assert.Equal(HttpStatusCode.BadRequest, response.StatusCode);
        var problem = await HewnClient.ReadJsonAsync(response);
        Assert.True(problem.GetProperty("errors").TryGetProperty(field, out _));
        Assert.Equal(1, (await HewnClient.ReadJsonAsync(await owner.GetAsync($"/api/projects/{projectId}"))).GetProperty("directions").GetArrayLength());
    }

    [Fact]
    public async Task A_feature_for_an_unknown_project_is_404_and_a_viewer_gets_403()
    {
        var (_, projectId) = await SubmitProductAsync();
        var owner = await _factory.SignInAsync("quinntynebrown", Role.Owner);
        var viewer = await _factory.SignInAsync("ada", Role.Viewer);

        var missing = await SubmitFeatureAsync(owner, Guid.NewGuid());
        var forbidden = await SubmitFeatureAsync(viewer, projectId);

        Assert.Equal(HttpStatusCode.NotFound, missing.StatusCode);
        Assert.Equal(HttpStatusCode.Forbidden, forbidden.StatusCode);
    }

    [Fact]
    public async Task The_project_list_says_which_products_will_queue_a_feature()
    {
        var (owner, complete) = await SubmitProductAsync("Northwind Ops");
        var worker = await _factory.RegisterWorkerAsync();
        await worker.RunUntilIdleAsync();
        await SubmitProductAsync("Ledgerline");
        await worker.LeaseAsync();

        var list = (await HewnClient.ReadJsonAsync(await owner.GetAsync("/api/projects"))).EnumerateArray().ToList();

        Assert.Equal(["Ledgerline", "Northwind Ops"], list.Select(p => p.GetProperty("name").GetString()));
        Assert.False(list[0].GetProperty("firstDirectionComplete").GetBoolean());
        Assert.True(list[1].GetProperty("firstDirectionComplete").GetBoolean());
        Assert.Equal("Idle", list[1].GetProperty("status").GetString());
        Assert.StartsWith("hewn-builds/", list[1].GetProperty("repository").GetString());
        Assert.Equal(complete, list[1].GetProperty("id").GetGuid());
    }
}

// Acceptance Test
// Traces to: L2-053, L2-029
// Description: On a direction Paused with "Budget reached", an Owner raises the budget above the spend so far and the direction resumes from its next step in one action; a budget at or below the spend is refused; Viewers get 403

using System.Net;
using System.Net.Http.Json;
using System.Text.Json;
using Hewn.Api.Tests.Support;
using Hewn.Domain;
using Microsoft.EntityFrameworkCore;

namespace Hewn.Api.Tests.Spend;

public sealed class RaiseAndResumeTests : IAsyncLifetime
{
    private readonly HewnApiFactory _factory = new();

    public Task InitializeAsync() => Task.CompletedTask;

    public async Task DisposeAsync() => await _factory.DisposeAsync();

    private sealed record Paused(HewnClient Owner, WorkerClient Worker, Guid ProjectId, Guid DirectionId, LeasedRun Run);

    /// <summary>A direction with a $10 budget that one checkpoint and a $12 model call paused at "Budget reached".</summary>
    private async Task<Paused> PausedAtBudgetAsync()
    {
        var owner = await _factory.SignInAsync("quinntynebrown", Role.Owner);
        var submitted = await owner.PostAsync("/api/projects", new
        {
            name = "Kiln Booking",
            idea = "Kiln firing schedules for a community pottery studio.",
            stackPreference = (string?)null,
            repositoryUrl = (string?)null,
            budgetUsd = 10m,
        });
        Assert.Equal(HttpStatusCode.Created, submitted.StatusCode);
        var projectId = (await HewnClient.ReadJsonAsync(submitted)).GetProperty("projectId").GetGuid();
        var directionId = (await ProjectAsync(owner, projectId)).GetProperty("directions")[0].GetProperty("id").GetGuid();

        var worker = await _factory.RegisterWorkerAsync();
        var run = await worker.LeaseAsync();
        Assert.Equal(HttpStatusCode.OK, (await worker.CheckpointAsync(run!, 1)).StatusCode);
        var stop = await CallAsync(worker, run!, "c1", 3_000_000); // $12.00 on Opus: over the $10 budget
        Assert.Equal("Stop", (await HewnClient.ReadJsonAsync(stop)).GetProperty("verdict").GetString());
        return new Paused(owner, worker, projectId, directionId, run!);
    }

    private static Task<HttpResponseMessage> CallAsync(WorkerClient worker, LeasedRun run, string callId, long inputTokens) =>
        worker.Http.PostAsJsonAsync($"/api/worker/runs/{run.RunId}/model-calls", new
        {
            workerId = worker.WorkerId,
            epoch = run.Epoch,
            callId,
            model = "claude-opus-5-5",
            inputTokens,
            outputTokens = 0L,
        });

    private static Task<HttpResponseMessage> RaiseAsync(HewnClient client, Guid projectId, Guid directionId, decimal budgetUsd, decimal currentBudgetUsd = 10m) =>
        client.PostAsync($"/api/projects/{projectId}/directions/{directionId}/raise-and-resume", new { budgetUsd, currentBudgetUsd });

    private static async Task<JsonElement> ProjectAsync(HewnClient client, Guid projectId) =>
        await HewnClient.ReadJsonAsync(await client.GetAsync($"/api/projects/{projectId}"));

    private static async Task<List<JsonElement>> EventsAsync(HewnClient client, Guid projectId, long after = 0) =>
        (await HewnClient.ReadJsonAsync(await client.GetAsync($"/api/projects/{projectId}/events?after={after}"))).EnumerateArray().ToList();

    private async Task AssertStillPausedAsync(Paused paused)
    {
        var direction = (await ProjectAsync(paused.Owner, paused.ProjectId)).GetProperty("directions")[0];
        Assert.Equal("Paused", direction.GetProperty("status").GetString());
        Assert.Equal("Budget reached", direction.GetProperty("pauseReason").GetString());
        Assert.Equal(10m, direction.GetProperty("budgetUsd").GetDecimal());
        Assert.Null(await paused.Worker.LeaseAsync());
    }

    [Fact]
    public async Task Raising_the_budget_above_the_spend_resumes_the_direction_from_its_next_step_in_one_action()
    {
        var paused = await PausedAtBudgetAsync();
        var before = (await EventsAsync(paused.Owner, paused.ProjectId)).Count;

        var response = await RaiseAsync(paused.Owner, paused.ProjectId, paused.DirectionId, 20m);

        Assert.Equal(HttpStatusCode.OK, response.StatusCode);
        var body = await HewnClient.ReadJsonAsync(response);
        Assert.Equal(20m, body.GetProperty("budgetUsd").GetDecimal());
        Assert.Equal("Running", body.GetProperty("status").GetString());

        var project = await ProjectAsync(paused.Owner, paused.ProjectId);
        Assert.Equal("Running", project.GetProperty("status").GetString());
        var direction = project.GetProperty("directions")[0];
        Assert.Equal("Running", direction.GetProperty("status").GetString());
        Assert.Equal(JsonValueKind.Null, direction.GetProperty("pauseReason").ValueKind);
        Assert.Equal(20m, direction.GetProperty("budgetUsd").GetDecimal());
        Assert.Equal(12m, direction.GetProperty("spendUsd").GetDecimal());
        Assert.False(direction.GetProperty("budgetWarned").GetBoolean());
        Assert.Equal("Running", direction.GetProperty("stages")[0].GetProperty("status").GetString());

        // The same run is leased again and carries on after its last checkpoint.
        var resumed = await paused.Worker.LeaseAsync();
        Assert.Equal(paused.Run.RunId, resumed!.RunId);
        Assert.Equal(1, resumed.CheckpointStep);
        Assert.True(resumed.Epoch > paused.Run.Epoch);

        // Spend continues on top of what was spent, and warns again at 80% of the new budget.
        var call = await HewnClient.ReadJsonAsync(await CallAsync(paused.Worker, resumed, "c2", 1_000_000)); // +$4.00
        Assert.Equal("Warn", call.GetProperty("verdict").GetString());
        Assert.Equal(16m, call.GetProperty("directionSpendUsd").GetDecimal());

        var events = (await EventsAsync(paused.Owner, paused.ProjectId, before)).Select(e => e.GetProperty("type").GetString()).ToList();
        Assert.Equal(["BudgetRaised", "StageChanged", "DirectionChanged", "ProjectChanged"], events.Take(4));
        var raised = (await EventsAsync(paused.Owner, paused.ProjectId, before))[0].GetProperty("payload");
        Assert.Equal(paused.DirectionId, raised.GetProperty("directionId").GetGuid());
        Assert.Equal(20m, raised.GetProperty("budgetUsd").GetDecimal());
        Assert.Equal(12m, raised.GetProperty("spendUsd").GetDecimal());
        Assert.Equal("quinntynebrown", raised.GetProperty("raisedBy").GetString());
    }

    [Theory]
    [InlineData(12)]
    [InlineData(11.99)]
    public async Task A_budget_at_or_below_the_spend_so_far_is_refused_and_nothing_changes(decimal budgetUsd)
    {
        var paused = await PausedAtBudgetAsync();

        var response = await RaiseAsync(paused.Owner, paused.ProjectId, paused.DirectionId, budgetUsd);

        Assert.Equal(HttpStatusCode.BadRequest, response.StatusCode);
        var problem = await HewnClient.ReadJsonAsync(response);
        Assert.Equal("validation_failed", problem.GetProperty("code").GetString());
        Assert.Equal("New budget must be more than the $12.00 already spent.", problem.GetProperty("errors").GetProperty("budgetUsd")[0].GetString());
        Assert.Equal("New budget must be more than the spend so far", problem.GetProperty("summary").GetProperty("budgetUsd").GetString());
        await AssertStillPausedAsync(paused);
    }

    [Fact]
    public async Task A_Viewer_gets_403_and_nothing_changes()
    {
        var paused = await PausedAtBudgetAsync();
        var viewer = await _factory.SignInAsync("ada", Role.Viewer);

        var response = await RaiseAsync(viewer, paused.ProjectId, paused.DirectionId, 20m);

        Assert.Equal(HttpStatusCode.Forbidden, response.StatusCode);
        await AssertStillPausedAsync(paused);
    }

    [Fact]
    public async Task A_budget_changed_by_another_session_is_refused_with_409()
    {
        var paused = await PausedAtBudgetAsync();
        Assert.Equal(HttpStatusCode.OK, (await RaiseAsync(paused.Owner, paused.ProjectId, paused.DirectionId, 20m)).StatusCode);

        // A second session still showing the old $10 budget.
        var response = await RaiseAsync(paused.Owner, paused.ProjectId, paused.DirectionId, 30m, currentBudgetUsd: 10m);

        Assert.Equal(HttpStatusCode.Conflict, response.StatusCode);
        Assert.Equal("budget_changed", (await HewnClient.ReadJsonAsync(response)).GetProperty("code").GetString());
        Assert.Equal(20m, (await ProjectAsync(paused.Owner, paused.ProjectId)).GetProperty("directions")[0].GetProperty("budgetUsd").GetDecimal());
    }

    [Fact]
    public async Task A_direction_that_is_not_paused_at_its_budget_is_refused_with_409()
    {
        var owner = await _factory.SignInAsync("quinntynebrown", Role.Owner);
        var submitted = await owner.PostAsync("/api/projects", new
        {
            name = "Glaze Library",
            idea = "A shared library of glaze recipes for a pottery studio.",
            stackPreference = (string?)null,
            repositoryUrl = (string?)null,
            budgetUsd = 10m,
        });
        var projectId = (await HewnClient.ReadJsonAsync(submitted)).GetProperty("projectId").GetGuid();
        var directionId = (await ProjectAsync(owner, projectId)).GetProperty("directions")[0].GetProperty("id").GetGuid();

        var response = await RaiseAsync(owner, projectId, directionId, 20m);

        Assert.Equal(HttpStatusCode.Conflict, response.StatusCode);
        Assert.Equal("not_budget_paused", (await HewnClient.ReadJsonAsync(response)).GetProperty("code").GetString());
    }

    [Fact]
    public async Task Resume_alone_does_not_continue_a_direction_paused_at_its_budget()
    {
        var paused = await PausedAtBudgetAsync();

        var response = await paused.Owner.PostAsync($"/api/projects/{paused.ProjectId}/directions/{paused.DirectionId}/resume", new { });

        Assert.Equal(HttpStatusCode.Conflict, response.StatusCode);
        Assert.Equal("budget_reached", (await HewnClient.ReadJsonAsync(response)).GetProperty("code").GetString());
        await AssertStillPausedAsync(paused);
    }

    [Fact]
    public async Task Another_projects_direction_is_404()
    {
        var paused = await PausedAtBudgetAsync();

        var response = await RaiseAsync(paused.Owner, Guid.NewGuid(), paused.DirectionId, 20m);

        Assert.Equal(HttpStatusCode.NotFound, response.StatusCode);
        Assert.Equal(1, await _factory.QueryAsync(db => db.Directions.CountAsync(d => d.BudgetUsd == 10m)));
    }
}

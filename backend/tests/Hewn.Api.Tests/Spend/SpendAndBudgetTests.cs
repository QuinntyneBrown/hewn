// Acceptance Test
// Traces to: L2-052, L2-053
// Description: Every model call is recorded with its tokens, model and cost against its run, stage, direction and project; spend shows live; 80% of the budget sends one warning and 100% pauses the direction with "Budget reached" after the current call

using System.Net;
using System.Net.Http.Json;
using System.Text.Json;
using Hewn.Api.Tests.Support;
using Hewn.Domain;
using Microsoft.EntityFrameworkCore;

namespace Hewn.Api.Tests.Spend;

public sealed class SpendAndBudgetTests : IAsyncLifetime
{
    private readonly HewnApiFactory _factory = new();

    public Task InitializeAsync() => Task.CompletedTask;

    public async Task DisposeAsync() => await _factory.DisposeAsync();

    private async Task<(HewnClient Owner, Guid ProjectId, Guid DirectionId)> SubmitAsync(decimal budgetUsd = 100m) =>
        await SubmitAsync(_factory, budgetUsd);

    private static async Task<(HewnClient Owner, Guid ProjectId, Guid DirectionId)> SubmitAsync(HewnApiFactory factory, decimal budgetUsd)
    {
        var owner = await factory.SignInAsync("quinntynebrown", Role.Owner);
        var response = await owner.PostAsync("/api/projects", new
        {
            name = "Kiln Booking",
            idea = "Kiln firing schedules for a community pottery studio.",
            stackPreference = (string?)null,
            repositoryUrl = (string?)null,
            budgetUsd,
        });
        Assert.Equal(HttpStatusCode.Created, response.StatusCode);
        var projectId = (await HewnClient.ReadJsonAsync(response)).GetProperty("projectId").GetGuid();
        var project = await HewnClient.ReadJsonAsync(await owner.GetAsync($"/api/projects/{projectId}"));
        return (owner, projectId, project.GetProperty("directions")[0].GetProperty("id").GetGuid());
    }

    private static Task<HttpResponseMessage> CallAsync(
        WorkerClient worker, LeasedRun run, string callId, long inputTokens, long outputTokens, string model = "claude-opus-5-5", long? epoch = null) =>
        worker.Http.PostAsJsonAsync($"/api/worker/runs/{run.RunId}/model-calls", new
        {
            workerId = worker.WorkerId,
            epoch = epoch ?? run.Epoch,
            callId,
            model,
            inputTokens,
            outputTokens,
        });

    private static async Task<string> VerdictAsync(HttpResponseMessage response)
    {
        Assert.Equal(HttpStatusCode.OK, response.StatusCode);
        return (await HewnClient.ReadJsonAsync(response)).GetProperty("verdict").GetString()!;
    }

    private static async Task<List<JsonElement>> EventsAsync(HewnClient client, Guid projectId, string type) =>
        (await HewnClient.ReadJsonAsync(await client.GetAsync($"/api/projects/{projectId}/events?after=0")))
            .EnumerateArray().Where(e => e.GetProperty("type").GetString() == type).Select(e => e.GetProperty("payload")).ToList();

    private static async Task<JsonElement> ProjectAsync(HewnClient client, Guid projectId) =>
        await HewnClient.ReadJsonAsync(await client.GetAsync($"/api/projects/{projectId}"));

    [Fact]
    public async Task Model_calls_and_log_lines_arriving_together_all_succeed_with_gapless_sequence_numbers()
    {
        // A database file, so each request has its own connection, as in production.
        await using var factory = new HewnApiFactory(databaseFile: true);
        var (owner, projectId, _) = await SubmitAsync(factory, 1_000m);
        var worker = await factory.RegisterWorkerAsync();
        var run = await worker.LeaseAsync();

        // The worker's log batcher sends on its own timer, so a batch and a model call often arrive at once.
        var writes = Enumerable.Range(0, 20).SelectMany(i => new[]
        {
            CallAsync(worker, run!, $"c{i}", 1_000, 100),
            worker.Http.PostAsJsonAsync($"/api/worker/runs/{run!.RunId}/logs", new
            {
                workerId = worker.WorkerId,
                epoch = run.Epoch,
                lines = new[] { new { level = "info", text = $"line {i}" } },
            }),
        });
        var responses = await Task.WhenAll(writes);

        Assert.All(responses, r => Assert.True(r.IsSuccessStatusCode, $"{r.RequestMessage!.RequestUri}: {(int)r.StatusCode}"));
        var sequences = (await HewnClient.ReadJsonAsync(await owner.GetAsync($"/api/projects/{projectId}/events?after=0")))
            .EnumerateArray().Select(e => e.GetProperty("sequence").GetInt64()).ToList();
        Assert.Equal(Enumerable.Range(1, sequences.Count).Select(n => (long)n), sequences);
        Assert.Equal(20, (await EventsAsync(owner, projectId, "SpendUpdated")).Count);
    }

    [Fact]
    public async Task A_model_call_is_recorded_with_its_tokens_model_and_cost_against_its_run_stage_direction_and_project()
    {
        var (owner, projectId, directionId) = await SubmitAsync();
        var worker = await _factory.RegisterWorkerAsync();
        var run = await worker.LeaseAsync();

        // Opus 5.5: $4 per million input tokens, $20 per million output tokens.
        Assert.Equal("Continue", await VerdictAsync(await CallAsync(worker, run!, "c1", 1_000_000, 100_000)));

        var call = await _factory.QueryAsync(db => db.ModelCalls.SingleAsync());
        Assert.Equal((run!.RunId, 0, directionId, projectId), (call.RunId, call.Stage, call.DirectionId, call.ProjectId));
        Assert.Equal(("claude-opus-5-5", 1_000_000L, 100_000L, 6.00m), (call.Model, call.InputTokens, call.OutputTokens, call.CostUsd));

        var project = await ProjectAsync(owner, projectId);
        Assert.Equal(6.00m, project.GetProperty("spendUsd").GetDecimal());
        Assert.Equal(6.00m, project.GetProperty("directions")[0].GetProperty("spendUsd").GetDecimal());

        var updated = Assert.Single(await EventsAsync(owner, projectId, "SpendUpdated"));
        Assert.Equal(directionId, updated.GetProperty("directionId").GetGuid());
        Assert.Equal(0, updated.GetProperty("stage").GetInt32());
        Assert.Equal(run.RunId, updated.GetProperty("runId").GetGuid());
        Assert.Equal("claude-opus-5-5", updated.GetProperty("model").GetString());
        Assert.Equal(6.00m, updated.GetProperty("costUsd").GetDecimal());
        Assert.Equal(6.00m, updated.GetProperty("directionSpendUsd").GetDecimal());
        Assert.Equal(6.00m, updated.GetProperty("projectSpendUsd").GetDecimal());
        Assert.Equal(100m, updated.GetProperty("budgetUsd").GetDecimal());
    }

    [Fact]
    public async Task A_model_missing_from_the_price_table_is_priced_at_the_highest_rate()
    {
        var (owner, projectId, _) = await SubmitAsync();
        var worker = await _factory.RegisterWorkerAsync();
        var run = await worker.LeaseAsync();

        await VerdictAsync(await CallAsync(worker, run!, "c1", 1_000_000, 0, model: "claude-unknown-9"));

        // The dearest model in the table is $10 per million input tokens.
        Assert.Equal(10.00m, (await ProjectAsync(owner, projectId)).GetProperty("spendUsd").GetDecimal());
    }

    [Fact]
    public async Task A_call_reported_twice_is_counted_once()
    {
        var (owner, projectId, _) = await SubmitAsync();
        var worker = await _factory.RegisterWorkerAsync();
        var run = await worker.LeaseAsync();

        await VerdictAsync(await CallAsync(worker, run!, "c1", 1_000_000, 0));
        await VerdictAsync(await CallAsync(worker, run!, "c1", 1_000_000, 0));

        Assert.Equal(4.00m, (await ProjectAsync(owner, projectId)).GetProperty("spendUsd").GetDecimal());
        Assert.Equal(1, await _factory.QueryAsync(db => db.ModelCalls.CountAsync()));
    }

    [Fact]
    public async Task Crossing_80_percent_of_the_budget_sends_one_warning()
    {
        var (owner, projectId, directionId) = await SubmitAsync(budgetUsd: 10m);
        var worker = await _factory.RegisterWorkerAsync();
        var run = await worker.LeaseAsync();

        Assert.Equal("Continue", await VerdictAsync(await CallAsync(worker, run!, "c1", 1_500_000, 0))); // $6.00, 60%
        Assert.Equal("Warn", await VerdictAsync(await CallAsync(worker, run!, "c2", 500_000, 0)));       // $8.00, 80%
        Assert.Equal("Continue", await VerdictAsync(await CallAsync(worker, run!, "c3", 250_000, 0)));   // $9.00, 90%

        var warning = Assert.Single(await EventsAsync(owner, projectId, "BudgetWarning"));
        Assert.Equal(directionId, warning.GetProperty("directionId").GetGuid());
        Assert.Equal(8.00m, warning.GetProperty("spendUsd").GetDecimal());
        Assert.Equal(10m, warning.GetProperty("budgetUsd").GetDecimal());
        var direction = (await ProjectAsync(owner, projectId)).GetProperty("directions")[0];
        Assert.True(direction.GetProperty("budgetWarned").GetBoolean());
        Assert.Equal("Running", direction.GetProperty("status").GetString());
    }

    [Fact]
    public async Task Reaching_the_budget_pauses_the_direction_with_Budget_reached_after_the_current_call()
    {
        var (owner, projectId, directionId) = await SubmitAsync(budgetUsd: 10m);
        var worker = await _factory.RegisterWorkerAsync();
        var run = await worker.LeaseAsync();
        await VerdictAsync(await CallAsync(worker, run!, "c1", 1_000_000, 0)); // $4.00

        Assert.Equal("Stop", await VerdictAsync(await CallAsync(worker, run!, "c2", 2_000_000, 0))); // $12.00

        // The call that crossed the line is still recorded.
        Assert.Equal(2, await _factory.QueryAsync(db => db.ModelCalls.CountAsync()));
        var project = await ProjectAsync(owner, projectId);
        Assert.Equal("Paused", project.GetProperty("status").GetString());
        Assert.Equal(12.00m, project.GetProperty("spendUsd").GetDecimal());
        var direction = project.GetProperty("directions")[0];
        Assert.Equal("Paused", direction.GetProperty("status").GetString());
        Assert.Equal("Budget reached", direction.GetProperty("pauseReason").GetString());
        Assert.Equal("Paused", direction.GetProperty("stages")[0].GetProperty("status").GetString());
        Assert.Equal(RunStatus.Paused, await _factory.QueryAsync(db => db.Runs.Where(r => r.Id == run!.RunId).Select(r => r.Status).SingleAsync()));

        var changed = (await EventsAsync(owner, projectId, "DirectionChanged")).Last();
        Assert.Equal(directionId, changed.GetProperty("directionId").GetGuid());
        Assert.Equal("Paused", changed.GetProperty("status").GetString());
        Assert.Equal("Budget reached", changed.GetProperty("pauseReason").GetString());
        Assert.Equal("Paused", (await EventsAsync(owner, projectId, "StageChanged")).Last().GetProperty("status").GetString());
        Assert.Equal("Paused", (await EventsAsync(owner, projectId, "ProjectChanged")).Last().GetProperty("status").GetString());

        // Nothing more runs: the lease is released and no run of the paused direction is offered again.
        Assert.Equal(HttpStatusCode.Conflict, (await worker.CheckpointAsync(run!, 1)).StatusCode);
        Assert.Null(await worker.LeaseAsync());
    }

    [Fact]
    public async Task A_model_call_from_a_stale_lease_is_refused()
    {
        await SubmitAsync();
        var worker = await _factory.RegisterWorkerAsync();
        var run = await worker.LeaseAsync();

        var response = await CallAsync(worker, run!, "c1", 10, 10, epoch: run!.Epoch + 1);

        Assert.Equal(HttpStatusCode.Conflict, response.StatusCode);
    }

    [Theory]
    [InlineData("", 10, 10)]
    [InlineData("claude-opus-5-5", -1, 10)]
    [InlineData("claude-opus-5-5", 10, -1)]
    public async Task A_model_call_with_no_model_or_negative_tokens_is_refused(string model, long inputTokens, long outputTokens)
    {
        await SubmitAsync();
        var worker = await _factory.RegisterWorkerAsync();
        var run = await worker.LeaseAsync();

        var response = await CallAsync(worker, run!, "c1", inputTokens, outputTokens, model);

        Assert.Equal(HttpStatusCode.BadRequest, response.StatusCode);
    }

    [Fact]
    public async Task A_Viewer_sees_the_spend_to_date()
    {
        var (_, projectId, _) = await SubmitAsync();
        var worker = await _factory.RegisterWorkerAsync();
        var run = await worker.LeaseAsync();
        await VerdictAsync(await CallAsync(worker, run!, "c1", 500_000, 0));
        var viewer = await _factory.SignInAsync("ada", Role.Viewer);

        var project = await ProjectAsync(viewer, projectId);

        Assert.Equal(2.00m, project.GetProperty("spendUsd").GetDecimal());
    }
}

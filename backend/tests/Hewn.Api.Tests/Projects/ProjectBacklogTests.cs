// Acceptance Test
// Traces to: L2-020, L2-019, L2-018, L2-025
// Description: GET /api/projects/{id}/backlog gives the current direction's increments in order with status, estimate and pull request link, the deferred designs apart with their reasons, and the merged and estimated totals with percent complete, which move with every merge

using System.Net;
using System.Net.Http.Json;
using System.Text.Json;
using Hewn.Api.Tests.Support;
using Hewn.Domain;

namespace Hewn.Api.Tests.Projects;

public sealed class ProjectBacklogTests : IAsyncLifetime
{
    private readonly HewnApiFactory _factory = new();

    public Task InitializeAsync() => Task.CompletedTask;

    public async Task DisposeAsync() => await _factory.DisposeAsync();

    private async Task<(HewnClient Owner, Guid ProjectId)> SubmitAsync()
    {
        var owner = await _factory.SignInAsync("quinntynebrown", Role.Owner);
        var submitted = await owner.PostAsync("/api/projects", new
        {
            name = "Ledgerline",
            idea = "A web app for small accounting teams to reconcile statements.",
            stackPreference = (string?)null,
            repositoryUrl = "https://github.com/hewn-builds/ledgerline",
            budgetUsd = 300m,
        });
        submitted.EnsureSuccessStatusCode();
        return (owner, (await HewnClient.ReadJsonAsync(submitted)).GetProperty("projectId").GetGuid());
    }

    /// <summary>Runs stages 0 to 9, recording a backlog of three increments and one deferred design, and leases stage 10.</summary>
    private async Task<(WorkerClient Worker, LeasedRun Run)> PlanAsync()
    {
        var worker = await _factory.RegisterWorkerAsync();
        while (true)
        {
            var run = await worker.LeaseAsync() ?? throw new InvalidOperationException("Stage 10 was never offered.");
            if (run.Stage == 10)
            {
                return (worker, run);
            }

            if (run.Stage == 9)
            {
                (await worker.Http.PutAsJsonAsync($"/api/worker/runs/{run.RunId}/backlog", new
                {
                    workerId = worker.WorkerId,
                    epoch = run.Epoch,
                    increments = new object[]
                    {
                        new { number = 1, title = "Sign in", journey = 1, l2Ids = new[] { "L2-001", "L2-002" }, estimateDays = 1.5m, dependsOn = Array.Empty<int>() },
                        new { number = 2, title = "Reconcile a statement", journey = 2, l2Ids = new[] { "L2-003" }, estimateDays = 2.5m, dependsOn = new[] { 1 } },
                        new { number = 3, title = "Close a period", journey = 3, l2Ids = new[] { "L2-004" }, estimateDays = 2m, dependsOn = Array.Empty<int>() },
                    },
                    deferred = new object[]
                    {
                        new { title = "Receipt OCR confidence tuning", l2Ids = new[] { "L2-005" }, estimateDays = 2m, reason = "Its requirements appear in no journey's main path" },
                    },
                })).EnsureSuccessStatusCode();
            }

            (await worker.SucceedAsync(run)).EnsureSuccessStatusCode();
        }
    }

    private static async Task UpdateAsync(WorkerClient worker, LeasedRun run, int number, object fields)
    {
        var body = JsonSerializer.SerializeToElement(fields).EnumerateObject().ToDictionary(p => p.Name, p => (object?)p.Value);
        body["workerId"] = worker.WorkerId;
        body["epoch"] = run.Epoch;
        (await worker.Http.PutAsJsonAsync($"/api/worker/runs/{run.RunId}/increments/{number}", body)).EnsureSuccessStatusCode();
    }

    private static async Task<JsonElement> BacklogAsync(HewnClient client, Guid projectId)
    {
        var response = await client.GetAsync($"/api/projects/{projectId}/backlog");
        response.EnsureSuccessStatusCode();
        return await HewnClient.ReadJsonAsync(response);
    }

    [Fact]
    public async Task Increments_come_in_order_with_status_estimate_and_pull_request_and_deferred_designs_apart_with_reasons()
    {
        var (_, projectId) = await SubmitAsync();
        var viewer = await _factory.SignInAsync("ada", Role.Viewer);
        var (worker, run) = await PlanAsync();
        await UpdateAsync(worker, run, 1, new { status = "InProgress" });
        await UpdateAsync(worker, run, 1, new { status = "Merged", pullRequestNumber = 14 });
        await UpdateAsync(worker, run, 2, new { status = "InProgress", pullRequestNumber = 17 });

        var backlog = await BacklogAsync(viewer, projectId);

        var increments = backlog.GetProperty("increments").EnumerateArray().ToList();
        Assert.Equal([1, 2, 3], increments.Select(i => i.GetProperty("number").GetInt32()));
        Assert.Equal(["Merged", "InProgress", "Queued"], increments.Select(i => i.GetProperty("status").GetString()));
        Assert.Equal([1.5m, 2.5m, 2m], increments.Select(i => i.GetProperty("estimateDays").GetDecimal()));
        Assert.Equal("Sign in", increments[0].GetProperty("title").GetString());
        Assert.Equal(1, increments[0].GetProperty("journey").GetInt32());
        Assert.Equal(["L2-001", "L2-002"], increments[0].GetProperty("l2Ids").EnumerateArray().Select(e => e.GetString()));
        Assert.Equal([1], increments[1].GetProperty("dependsOn").EnumerateArray().Select(e => e.GetInt32()));
        Assert.Equal(14, increments[0].GetProperty("pullRequestNumber").GetInt32());
        Assert.Equal("https://github.com/hewn-builds/ledgerline/pull/14", increments[0].GetProperty("pullRequestUrl").GetString());
        Assert.Equal("https://github.com/hewn-builds/ledgerline/pull/17", increments[1].GetProperty("pullRequestUrl").GetString());
        Assert.Equal(JsonValueKind.Null, increments[2].GetProperty("pullRequestUrl").ValueKind);

        var deferred = Assert.Single(backlog.GetProperty("deferred").EnumerateArray());
        Assert.Equal("Receipt OCR confidence tuning", deferred.GetProperty("title").GetString());
        Assert.Equal(["L2-005"], deferred.GetProperty("l2Ids").EnumerateArray().Select(e => e.GetString()));
        Assert.Equal(2m, deferred.GetProperty("estimateDays").GetDecimal());
        Assert.Equal("Its requirements appear in no journey's main path", deferred.GetProperty("reason").GetString());
    }

    [Fact]
    public async Task The_totals_and_percent_complete_move_with_each_merge()
    {
        var (owner, projectId) = await SubmitAsync();
        var (worker, run) = await PlanAsync();

        var before = await BacklogAsync(owner, projectId);
        Assert.Equal(0, before.GetProperty("merged").GetInt32());
        Assert.Equal(3, before.GetProperty("total").GetInt32());
        Assert.Equal(0m, before.GetProperty("mergedDays").GetDecimal());
        Assert.Equal(6m, before.GetProperty("totalDays").GetDecimal());
        // Stages 0 to 9 succeeded: 10 of 11.
        Assert.Equal(90, before.GetProperty("percentComplete").GetInt32());

        await UpdateAsync(worker, run, 1, new { status = "InProgress" });
        await UpdateAsync(worker, run, 1, new { status = "Merged", pullRequestNumber = 14 });

        var after = await BacklogAsync(owner, projectId);
        Assert.Equal(1, after.GetProperty("merged").GetInt32());
        Assert.Equal(1.5m, after.GetProperty("mergedDays").GetDecimal());
        // 10 stages and a third of stage 10, of 11.
        Assert.Equal(93, after.GetProperty("percentComplete").GetInt32());
    }

    [Fact]
    public async Task A_blocked_increment_says_how_many_iterations_it_used_and_which_tests_still_fail()
    {
        var (owner, projectId) = await SubmitAsync();
        var (worker, run) = await PlanAsync();
        await UpdateAsync(worker, run, 1, new { status = "InProgress" });
        await UpdateAsync(worker, run, 1, new
        {
            status = "Blocked",
            iterations = 10,
            failingTests = new[] { "e2e: ✘ e2e/tests/sign-in.spec.ts" },
        });

        var increment = (await BacklogAsync(owner, projectId)).GetProperty("increments")[0];

        Assert.Equal("Blocked", increment.GetProperty("status").GetString());
        Assert.Equal(10, increment.GetProperty("iterations").GetInt32());
        Assert.Equal(["e2e: ✘ e2e/tests/sign-in.spec.ts"], increment.GetProperty("failingTests").EnumerateArray().Select(e => e.GetString()));
    }

    [Fact]
    public async Task Before_stage_9_the_backlog_is_empty_and_an_unknown_project_is_not_found()
    {
        var (owner, projectId) = await SubmitAsync();

        var backlog = await BacklogAsync(owner, projectId);

        Assert.Empty(backlog.GetProperty("increments").EnumerateArray());
        Assert.Empty(backlog.GetProperty("deferred").EnumerateArray());
        Assert.Equal(0, backlog.GetProperty("total").GetInt32());
        Assert.Equal(HttpStatusCode.NotFound, (await owner.GetAsync($"/api/projects/{Guid.NewGuid()}/backlog")).StatusCode);
    }
}

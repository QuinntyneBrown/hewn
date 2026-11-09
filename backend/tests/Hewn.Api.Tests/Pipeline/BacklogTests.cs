// Acceptance Test
// Traces to: L2-019, L2-020
// Description: Stage 9 is told the descope threshold and records the ordered backlog and its deferred designs, which only stage 9 may do

using System.Net;
using System.Net.Http.Json;
using Hewn.Api.Tests.Support;
using Hewn.Domain;
using Microsoft.EntityFrameworkCore;

namespace Hewn.Api.Tests.Pipeline;

public sealed class BacklogTests : IAsyncLifetime
{
    private readonly HewnApiFactory _factory = new();

    public Task InitializeAsync() => Task.CompletedTask;

    public async Task DisposeAsync() => await _factory.DisposeAsync();

    private async Task<(HewnClient Owner, Guid ProjectId, WorkerClient Worker, LeasedRun Run)> LeaseStageAsync(int stage)
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
        var projectId = (await HewnClient.ReadJsonAsync(submitted)).GetProperty("projectId").GetGuid();
        var worker = await _factory.RegisterWorkerAsync();
        while (true)
        {
            var run = await worker.LeaseAsync() ?? throw new InvalidOperationException($"Stage {stage} was never offered.");
            if (run.Stage == stage)
            {
                return (owner, projectId, worker, run);
            }

            (await worker.SucceedAsync(run)).EnsureSuccessStatusCode();
        }
    }

    private static object Backlog(params object[] increments) => new
    {
        increments,
        deferred = new[]
        {
            new { title = "Export to CSV", l2Ids = new[] { "L2-009" }, estimateDays = 4.5m, reason = "Estimated at 4.5 days, above the 3-day threshold, and could not be split" },
        },
    };

    private static object Increment(int number, int journey, string title, int[]? dependsOn = null) =>
        new { number, title, journey, l2Ids = new[] { $"L2-00{number}" }, estimateDays = 2m, dependsOn = dependsOn ?? [] };

    private static Task<HttpResponseMessage> ReportAsync(WorkerClient worker, LeasedRun run, object backlog)
    {
        var body = System.Text.Json.JsonSerializer.SerializeToElement(backlog).EnumerateObject().ToDictionary(p => p.Name, p => (object)p.Value);
        body["workerId"] = worker.WorkerId;
        body["epoch"] = run.Epoch;
        return worker.Http.PutAsJsonAsync($"/api/worker/runs/{run.RunId}/backlog", body);
    }

    [Fact]
    public async Task Stage_9_is_told_the_descope_threshold()
    {
        var (_, _, _, run) = await LeaseStageAsync(9);

        Assert.Equal(3m, run.Body.GetProperty("descopeThresholdDays").GetDecimal());
    }

    [Fact]
    public async Task Stage_9_records_the_ordered_backlog_and_the_deferred_designs_with_reasons()
    {
        var (owner, projectId, worker, run) = await LeaseStageAsync(9);

        var response = await ReportAsync(worker, run, Backlog(Increment(1, 1, "Sign in"), Increment(2, 2, "Book a slot", [1])));

        Assert.Equal(HttpStatusCode.NoContent, response.StatusCode);
        var stored = await _factory.QueryAsync(db => db.Increments.OrderBy(i => i.Number == null).ThenBy(i => i.Number).ToListAsync());
        Assert.Equal(["Sign in", "Book a slot", "Export to CSV"], stored.Select(i => i.Title));
        Assert.Equal([IncrementStatus.Queued, IncrementStatus.Queued, IncrementStatus.Deferred], stored.Select(i => i.Status));
        Assert.Equal("1", stored[1].DependsOn);
        Assert.StartsWith("Estimated at 4.5 days", stored[2].Reason);
        var events = await HewnClient.ReadJsonAsync(await owner.GetAsync($"/api/projects/{projectId}/events?after=0"));
        var planned = events.EnumerateArray().Single(e => e.GetProperty("type").GetString() == "BacklogPlanned").GetProperty("payload");
        Assert.Equal(2, planned.GetProperty("increments").GetInt32());
        Assert.Equal(1, planned.GetProperty("deferred").GetInt32());
    }

    [Fact]
    public async Task Reporting_again_replaces_the_backlog()
    {
        var (_, _, worker, run) = await LeaseStageAsync(9);
        (await ReportAsync(worker, run, Backlog(Increment(1, 1, "Sign in"), Increment(2, 2, "Book a slot")))).EnsureSuccessStatusCode();

        (await ReportAsync(worker, run, Backlog(Increment(1, 1, "Sign in")))).EnsureSuccessStatusCode();

        Assert.Equal(2, await _factory.QueryAsync(db => db.Increments.CountAsync()));
    }

    [Theory]
    [InlineData(1, 2)] // a later increment
    [InlineData(1, 1)] // itself
    [InlineData(2, 9)] // one that does not exist
    public async Task An_increment_may_depend_only_on_an_earlier_one(int dependent, int dependency)
    {
        var (_, _, worker, run) = await LeaseStageAsync(9);
        var increments = new[] { 1, 2 }.Select(n => Increment(n, n, $"Increment {n}", n == dependent ? [dependency] : null)).ToArray();

        var response = await ReportAsync(worker, run, Backlog(increments));

        Assert.Equal(HttpStatusCode.BadRequest, response.StatusCode);
        Assert.Equal("validation_failed", (await HewnClient.ReadJsonAsync(response)).GetProperty("code").GetString());
    }

    [Fact]
    public async Task Only_stage_9_may_record_the_backlog()
    {
        var (_, _, worker, run) = await LeaseStageAsync(8);

        var response = await ReportAsync(worker, run, Backlog(Increment(1, 1, "Sign in")));

        Assert.Equal("mutation_not_allowed", (await HewnClient.ReadJsonAsync(response)).GetProperty("code").GetString());
    }
}

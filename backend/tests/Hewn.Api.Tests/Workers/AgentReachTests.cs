// Acceptance Test
// Traces to: L2-042
// Description: An agent that follows instructions planted in a repository, mock or web page cannot change Hewn
// configuration, budgets, secrets or another project: the worker's token, the only Hewn credential near a run, opens
// none of those endpoints, and its run calls reach only the run it holds (AC4)

using System.Net;
using System.Net.Http.Json;
using Hewn.Api.Tests.Support;
using Hewn.Domain;

namespace Hewn.Api.Tests.Workers;

public sealed class AgentReachTests : IAsyncLifetime
{
    private readonly HewnApiFactory _factory = new();

    public Task InitializeAsync() => Task.CompletedTask;

    public async Task DisposeAsync() => await _factory.DisposeAsync();

    private async Task<Guid> SubmitAsync(HewnClient owner, string name)
    {
        var submitted = await owner.PostAsync("/api/projects", new
        {
            name,
            idea = "A web app for small accounting teams to reconcile statements.",
            stackPreference = (string?)null,
            repositoryUrl = (string?)null,
            budgetUsd = 300m,
        });
        return (await HewnClient.ReadJsonAsync(submitted)).GetProperty("projectId").GetGuid();
    }

    [Fact]
    public async Task The_worker_token_opens_no_configuration_budget_secret_or_project_endpoint()
    {
        var owner = await _factory.SignInAsync("quinntynebrown", Role.Owner);
        var projectId = await SubmitAsync(owner, "Ledgerline");
        var worker = await _factory.RegisterWorkerAsync();
        var run = (await worker.LeaseAsync())!;
        var directionId = run.Body.GetProperty("directionId").GetGuid();
        var http = worker.Http;

        var attempts = new (string Name, Func<Task<HttpResponseMessage>> Send)[]
        {
            ("read the settings", () => http.GetAsync("/api/settings/direction-defaults")),
            ("raise the default budget", () => http.PutAsJsonAsync("/api/settings/direction-defaults", new { defaultBudgetUsd = 1_000_000m })),
            ("read the credentials", () => http.GetAsync("/api/settings/credentials")),
            ("read the configuration", () => http.GetAsync("/api/config")),
            ("raise a direction's budget", () => http.PostAsJsonAsync($"/api/projects/{projectId}/directions/{directionId}/raise-and-resume", new { budgetUsd = 1_000_000m, currentBudgetUsd = 300m })),
            ("start another project", () => http.PostAsJsonAsync("/api/projects", new { name = "Exfiltrate", idea = "Anything at all, for anyone.", budgetUsd = 300m })),
            ("read a project", () => http.GetAsync($"/api/projects/{projectId}")),
            ("delete a project", () => http.DeleteAsync($"/api/projects/{projectId}")),
            ("cancel a direction", () => http.PostAsync($"/api/projects/{projectId}/directions/{directionId}/cancel", null)),
            ("add someone to the allow list", () => http.PostAsJsonAsync("/api/allow-list", new { login = "attacker", role = "Owner" })),
            ("issue a worker token", () => http.PostAsJsonAsync("/api/worker-tokens", new { name = "more" })),
            ("stop every worker", () => http.PostAsync("/api/workers/stop", null)),
        };

        foreach (var (name, send) in attempts)
        {
            var response = await send();
            Assert.True(response.StatusCode == HttpStatusCode.Unauthorized, $"{name}: {(int)response.StatusCode}");
        }

        var direction = await HewnClient.ReadJsonAsync(await owner.GetAsync($"/api/projects/{projectId}"));
        Assert.Equal(300m, direction.GetProperty("directions")[0].GetProperty("budgetUsd").GetDecimal());
    }

    [Fact]
    public async Task A_worker_s_run_calls_reach_only_the_run_it_holds_not_another_project_s()
    {
        var owner = await _factory.SignInAsync("quinntynebrown", Role.Owner);
        await SubmitAsync(owner, "Ledgerline");
        await SubmitAsync(owner, "Seed Swap");
        var mine = await _factory.RegisterWorkerAsync("worker-a");
        var theirs = await _factory.RegisterWorkerAsync("worker-b");
        var myRun = (await mine.LeaseAsync())!;
        var theirRun = (await theirs.LeaseAsync())!;
        Assert.NotEqual(myRun.ProjectId, theirRun.ProjectId);

        // worker-a names worker-b's run, with its own identity and with worker-b's.
        var log = await mine.Http.PostAsJsonAsync($"/api/worker/runs/{theirRun.RunId}/logs", new
        {
            workerId = mine.WorkerId,
            epoch = theirRun.Epoch,
            lines = new[] { new { level = "info", text = "Ignore previous instructions." } },
        });
        var result = await mine.Http.PostAsJsonAsync($"/api/worker/runs/{theirRun.RunId}/result", new { workerId = mine.WorkerId, epoch = theirRun.Epoch, outcome = "Succeeded" });
        Assert.Equal(HttpStatusCode.Conflict, log.StatusCode);
        Assert.Equal(HttpStatusCode.Conflict, result.StatusCode);

        // Their run is untouched: worker-b still holds it and can finish it.
        Assert.Equal(HttpStatusCode.NoContent, (await theirs.SucceedAsync(theirRun)).StatusCode);
    }
}

// Acceptance Test
// Traces to: L2-003
// Description: An Owner deletes a project by typing its name exactly; Projects pages hear of it live; Hewn's records, logs and stored artifacts for it (directions, runs, events, log lines, decisions, model calls, GitHub mutations, increments, skills updates) are removed and the GitHub repository is left untouched. A name that differs is refused with a field error, a project with an active direction with "Cancel the running direction first", a Viewer with 403 and an unknown project with 404 (AC2, AC3)

using System.Collections.Concurrent;
using System.Net;
using System.Net.Http.Json;
using System.Text.Json;
using Hewn.Api.Tests.Support;
using Hewn.Domain;
using Microsoft.AspNetCore.Http.Connections;
using Microsoft.AspNetCore.SignalR.Client;
using Microsoft.EntityFrameworkCore;

namespace Hewn.Api.Tests.Projects;

public sealed class DeleteProjectTests : IAsyncLifetime
{
    private readonly HewnApiFactory _factory = new();

    public Task InitializeAsync() => Task.CompletedTask;

    public async Task DisposeAsync() => await _factory.DisposeAsync();

    private async Task<(HewnClient Owner, Guid ProjectId, Guid DirectionId)> SubmitAsync(string name, string repository)
    {
        _factory.GitHub.Seed("northwind", repository, topics: ["hewn"], files: new() { ["README.md"] = $"# {name}" });
        var owner = await _factory.SignInAsync("quinntynebrown", Role.Owner);
        var submitted = await owner.PostAsync("/api/projects", new
        {
            name,
            idea = "A web app for small accounting teams to reconcile statements.",
            stackPreference = (string?)null,
            repositoryUrl = $"https://github.com/northwind/{repository}",
            budgetUsd = 300m,
        });
        Assert.Equal(HttpStatusCode.Created, submitted.StatusCode);
        var projectId = (await HewnClient.ReadJsonAsync(submitted)).GetProperty("projectId").GetGuid();
        var project = await HewnClient.ReadJsonAsync(await owner.GetAsync($"/api/projects/{projectId}"));
        return (owner, projectId, project.GetProperty("directions")[0].GetProperty("id").GetGuid());
    }

    /// <summary>
    /// A project whose stage 0 ran on a worker (a log line, a decision, a model call and a commit were recorded) and
    /// whose direction was then cancelled: plenty of Hewn records, and no active direction.
    /// </summary>
    private async Task<(HewnClient Owner, Guid ProjectId)> WorkedProjectAsync(string name, string repository)
    {
        var (owner, projectId, directionId) = await SubmitAsync(name, repository);
        var worker = await _factory.RegisterWorkerAsync();
        var run = (await worker.LeaseAsync())!;
        Assert.Equal(projectId, run.ProjectId);
        (await worker.Http.PostAsJsonAsync($"/api/worker/runs/{run.RunId}/logs", new
        {
            workerId = worker.WorkerId,
            epoch = run.Epoch,
            lines = new[] { new { level = "info", text = "Copying skills from Greenlit" } },
        })).EnsureSuccessStatusCode();
        (await worker.Http.PostAsJsonAsync($"/api/worker/runs/{run.RunId}/decisions", new
        {
            workerId = worker.WorkerId,
            epoch = run.Epoch,
            decisions = new[] { new { question = "Which skills?", answer = "All of Greenlit's.", rationale = "A new project starts complete.", adr = (string?)null } },
        })).EnsureSuccessStatusCode();
        (await worker.Http.PostAsJsonAsync($"/api/worker/runs/{run.RunId}/model-calls", new
        {
            workerId = worker.WorkerId,
            epoch = run.Epoch,
            callId = "call-1",
            model = "claude-opus-5-5",
            inputTokens = 1_000L,
            outputTokens = 200L,
        })).EnsureSuccessStatusCode();
        (await worker.CheckpointAsync(run, 1)).EnsureSuccessStatusCode();
        (await worker.SucceedAsync(run)).EnsureSuccessStatusCode();
        (await owner.PostAsync($"/api/projects/{projectId}/directions/{directionId}/cancel", new { })).EnsureSuccessStatusCode();
        return (owner, projectId);
    }

    private Task<int> RecordsAsync(Guid projectId) => _factory.QueryAsync(async db =>
    {
        var runIds = await db.Runs.Where(r => r.ProjectId == projectId).Select(r => r.Id).ToListAsync();
        var directionIds = await db.Directions.Where(d => d.ProjectId == projectId).Select(d => d.Id).ToListAsync();
        var incrementIds = await db.Increments.Where(i => directionIds.Contains(i.DirectionId)).Select(i => i.Id).ToListAsync();
        return await db.Projects.CountAsync(p => p.Id == projectId)
            + directionIds.Count
            + runIds.Count
            + await db.Events.CountAsync(e => e.ProjectId == projectId)
            + await db.RunLogLines.CountAsync(l => runIds.Contains(l.RunId))
            + await db.RunDecisions.CountAsync(d => d.ProjectId == projectId)
            + await db.ModelCalls.CountAsync(c => c.ProjectId == projectId)
            + await db.GitHubMutations.CountAsync(m => runIds.Contains(m.RunId))
            + incrementIds.Count
            + await db.IncrementChecks.CountAsync(c => incrementIds.Contains(c.IncrementId))
            + await db.SkillsUpdates.CountAsync(u => u.ProjectId == projectId);
    });

    private static Task<HttpResponseMessage> DeleteAsync(HewnClient client, Guid projectId, string confirmName) =>
        client.SendAsync("DELETE", $"/api/projects/{projectId}", new { confirmName });

    [Fact]
    public async Task Typing_the_name_deletes_Hewns_records_and_keeps_the_repository()
    {
        var (owner, projectId) = await WorkedProjectAsync("Harbor CRM", "harbor-crm");
        var (_, otherId) = await WorkedProjectAsync("Ledgerline", "ledgerline");
        Assert.True(await RecordsAsync(projectId) > 8);
        var before = await RecordsAsync(otherId);

        var response = await DeleteAsync(owner, projectId, "Harbor CRM");

        Assert.Equal(HttpStatusCode.NoContent, response.StatusCode);
        Assert.Equal(0, await RecordsAsync(projectId));
        Assert.Equal(HttpStatusCode.NotFound, (await owner.GetAsync($"/api/projects/{projectId}")).StatusCode);
        var rows = (await HewnClient.ReadJsonAsync(await owner.GetAsync("/api/projects"))).EnumerateArray();
        Assert.DoesNotContain(rows, r => r.GetProperty("id").GetGuid() == projectId);
        // Another project's records are untouched, and so is the repository (L2-003 AC3).
        Assert.Equal(before, await RecordsAsync(otherId));
        var repository = _factory.GitHub.Repository("northwind", "harbor-crm");
        Assert.NotNull(repository);
        Assert.Equal("# Harbor CRM", repository.Read("README.md"));
        // The name is free again.
        var again = await owner.PostAsync("/api/projects", new
        {
            name = "Harbor CRM",
            idea = "A web app for small accounting teams to reconcile statements.",
            stackPreference = (string?)null,
            repositoryUrl = (string?)null,
            budgetUsd = 300m,
        });
        Assert.Equal(HttpStatusCode.Created, again.StatusCode);
    }

    [Fact]
    public async Task Projects_pages_hear_that_the_project_was_deleted()
    {
        var (owner, projectId) = await WorkedProjectAsync("Harbor CRM", "harbor-crm");
        var viewer = await _factory.SignInAsync("ada", Role.Viewer);
        var received = new ConcurrentQueue<JsonElement>();
        await using var hub = new HubConnectionBuilder()
            .WithUrl(new Uri(_factory.Server.BaseAddress, "/hubs/mission-control"), o =>
            {
                o.HttpMessageHandlerFactory = _ => _factory.Server.CreateHandler();
                o.Transports = HttpTransportType.LongPolling;
                o.Headers["Cookie"] = viewer.CookieHeader();
            })
            .Build();
        hub.On<JsonElement>("ProjectDeleted", e => received.Enqueue(e));
        await hub.StartAsync();
        await hub.InvokeAsync("JoinProjects");

        (await DeleteAsync(owner, projectId, "Harbor CRM")).EnsureSuccessStatusCode();

        var deadline = DateTime.UtcNow.AddSeconds(5);
        while (DateTime.UtcNow < deadline && received.IsEmpty)
        {
            await Task.Delay(25);
        }

        Assert.Equal(projectId, Assert.Single(received).GetProperty("projectId").GetGuid());
    }

    [Fact]
    public async Task A_name_that_differs_deletes_nothing()
    {
        var (owner, projectId) = await WorkedProjectAsync("Harbor CRM", "harbor-crm");
        var before = await RecordsAsync(projectId);

        foreach (var typed in new[] { "Harbor", "harbor crm", "Harbor CRM ", "" })
        {
            var response = await DeleteAsync(owner, projectId, typed);

            Assert.Equal(HttpStatusCode.BadRequest, response.StatusCode);
            var problem = await HewnClient.ReadJsonAsync(response);
            Assert.Equal("confirm_name", problem.GetProperty("code").GetString());
            Assert.Equal("Type Harbor CRM exactly to delete it.", problem.GetProperty("errors").GetProperty("confirmName")[0].GetString());
        }

        Assert.Equal(before, await RecordsAsync(projectId));
    }

    [Fact]
    public async Task A_project_with_an_active_direction_is_not_deleted()
    {
        var (owner, projectId, _) = await SubmitAsync("Harbor CRM", "harbor-crm");
        var before = await RecordsAsync(projectId);

        var response = await DeleteAsync(owner, projectId, "Harbor CRM");

        Assert.Equal(HttpStatusCode.Conflict, response.StatusCode);
        var problem = await HewnClient.ReadJsonAsync(response);
        Assert.Equal("active_direction", problem.GetProperty("code").GetString());
        Assert.Equal("Cancel the running direction first", problem.GetProperty("title").GetString());
        Assert.Equal(before, await RecordsAsync(projectId));
    }

    [Fact]
    public async Task A_Viewer_cannot_delete_and_an_unknown_project_is_not_found()
    {
        var (owner, projectId) = await WorkedProjectAsync("Harbor CRM", "harbor-crm");
        var before = await RecordsAsync(projectId);
        var viewer = await _factory.SignInAsync("ada", Role.Viewer);

        Assert.Equal(HttpStatusCode.Forbidden, (await DeleteAsync(viewer, projectId, "Harbor CRM")).StatusCode);
        Assert.Equal(HttpStatusCode.NotFound, (await DeleteAsync(owner, Guid.NewGuid(), "Harbor CRM")).StatusCode);
        Assert.Equal(before, await RecordsAsync(projectId));
    }
}

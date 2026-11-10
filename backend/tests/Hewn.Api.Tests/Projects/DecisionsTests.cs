// Acceptance Test
// Traces to: L2-054
// Description: GET /api/projects/{id}/decisions lists the decisions a project's runs recorded in docs/decisions.md, newest first, each with its stage, question, answer, rationale, the commit that recorded it and any ADR (AC2), and filters them by stage (AC3)

using System.Net;
using System.Net.Http.Json;
using System.Text;
using System.Text.Json;
using Hewn.Api.Tests.Support;
using Hewn.Domain;

namespace Hewn.Api.Tests.Projects;

public sealed class DecisionsTests : IAsyncLifetime
{
    private readonly HewnApiFactory _factory = new();

    public Task InitializeAsync() => Task.CompletedTask;

    public async Task DisposeAsync() => await _factory.DisposeAsync();

    private async Task<(HewnClient Owner, Guid ProjectId)> SubmitAsync()
    {
        var owner = await _factory.SignInAsync("quinntynebrown", Role.Owner);
        var response = await owner.PostAsync("/api/projects", new
        {
            name = "Ledgerline",
            idea = "A web app for small accounting teams to reconcile statements.",
            stackPreference = (string?)null,
            repositoryUrl = (string?)null,
            budgetUsd = 300m,
        });
        Assert.Equal(HttpStatusCode.Created, response.StatusCode);
        return (owner, (await HewnClient.ReadJsonAsync(response)).GetProperty("projectId").GetGuid());
    }

    /// <summary>Leases runs until one of <paramref name="stage"/>, succeeding the ones before it.</summary>
    private static async Task<LeasedRun> RunOfStageAsync(WorkerClient worker, int stage)
    {
        LeasedRun run;
        while ((run = (await worker.LeaseAsync())!).Stage != stage)
        {
            (await worker.SucceedAsync(run)).EnsureSuccessStatusCode();
        }

        return run;
    }

    private static async Task<string> CommitAsync(WorkerClient worker, LeasedRun run, string step, params string[] paths)
    {
        var response = await worker.Http.PostAsJsonAsync($"/api/worker/runs/{run.RunId}/github/mutations", new
        {
            workerId = worker.WorkerId,
            epoch = run.Epoch,
            kind = "commit",
            idempotencyKey = $"{run.RunId}/{step}",
            message = $"Commit {step}",
            files = paths.Select(p => new { path = p, contentBase64 = Convert.ToBase64String(Encoding.UTF8.GetBytes($"# {p}\n")) }),
        });
        response.EnsureSuccessStatusCode();
        return (await HewnClient.ReadJsonAsync(response)).GetProperty("sha").GetString()!;
    }

    private static async Task DecideAsync(WorkerClient worker, LeasedRun run, params object[] decisions) =>
        (await worker.Http.PostAsJsonAsync($"/api/worker/runs/{run.RunId}/decisions", new { workerId = worker.WorkerId, epoch = run.Epoch, decisions }))
            .EnsureSuccessStatusCode();

    private static async Task<JsonElement> DecisionsAsync(HewnClient client, Guid projectId, string query = "")
    {
        var response = await client.GetAsync($"/api/projects/{projectId}/decisions{query}");
        Assert.Equal(HttpStatusCode.OK, response.StatusCode);
        return await HewnClient.ReadJsonAsync(response);
    }

    private static List<string?> Questions(JsonElement decisions) =>
        decisions.GetProperty("decisions").EnumerateArray().Select(d => d.GetProperty("question").GetString()).ToList();

    /// <summary>Stage 1 decides one question and stage 4 (Stack) two, the second an ADR, each committed before it is reported.</summary>
    private async Task<(HewnClient Owner, Guid ProjectId, string IdeaSha, string StackSha)> DecidedAsync()
    {
        var (owner, projectId) = await SubmitAsync();
        var worker = await _factory.RegisterWorkerAsync();

        var idea = await RunOfStageAsync(worker, 1);
        var ideaSha = await CommitAsync(worker, idea, "brief", "docs/brief.md", "docs/decisions.md");
        await DecideAsync(worker, idea, new { question = "Who approves a reconciled period?", answer = "A second person with the Reviewer role.", rationale = "Four-eyes review is standard practice." });
        (await worker.SucceedAsync(idea)).EnsureSuccessStatusCode();
        _factory.Clock.Advance(TimeSpan.FromHours(3));

        var stack = await RunOfStageAsync(worker, 4);
        await CommitAsync(worker, stack, "draft", "docs/adr/0001-stack.md");
        var stackSha = await CommitAsync(worker, stack, "record", "docs/adr/0001-stack.md", "docs/adr/0002-keep-the-default-stack.md", "docs/decisions.md");
        await DecideAsync(
            worker,
            stack,
            new { question = "Add a PWA layer for offline site visits?", answer = "No. Keep the default stack.", rationale = "Offline is out of scope in the brief.", adr = "docs/adr/0002-keep-the-default-stack.md" },
            new { question = "Which database?", answer = "PostgreSQL.", rationale = "The default stack's choice." });
        return (owner, projectId, ideaSha, stackSha);
    }

    [Fact]
    public async Task Decisions_are_listed_newest_first_with_stage_rationale_and_the_commit_that_recorded_them()
    {
        var (owner, projectId, ideaSha, stackSha) = await DecidedAsync();

        var decisions = await DecisionsAsync(owner, projectId);

        Assert.Equal("hewn-builds/ledgerline", decisions.GetProperty("repository").GetString());
        Assert.Equal(["Which database?", "Add a PWA layer for offline site visits?", "Who approves a reconciled period?"], Questions(decisions));
        var oldest = decisions.GetProperty("decisions")[2];
        Assert.Equal(1, oldest.GetProperty("stage").GetInt32());
        Assert.Equal("Idea", oldest.GetProperty("stageName").GetString());
        Assert.Equal("A second person with the Reviewer role.", oldest.GetProperty("answer").GetString());
        Assert.Equal("Four-eyes review is standard practice.", oldest.GetProperty("rationale").GetString());
        Assert.Equal(ideaSha, oldest.GetProperty("commit").GetString());
        Assert.Equal($"https://github.com/hewn-builds/ledgerline/commit/{ideaSha}", oldest.GetProperty("commitUrl").GetString());
        Assert.Equal(JsonValueKind.Null, oldest.GetProperty("adr").ValueKind);

        // The commit is the run's last one that wrote docs/decisions.md, not merely its last one.
        var pwa = decisions.GetProperty("decisions")[1];
        Assert.Equal("Stack", pwa.GetProperty("stageName").GetString());
        Assert.Equal(stackSha, pwa.GetProperty("commit").GetString());
        Assert.Equal("docs/adr/0002-keep-the-default-stack.md", pwa.GetProperty("adr").GetProperty("path").GetString());
        Assert.Equal("ADR 0002", pwa.GetProperty("adr").GetProperty("title").GetString());
        Assert.Equal($"https://github.com/hewn-builds/ledgerline/blob/{stackSha}/docs/adr/0002-keep-the-default-stack.md", pwa.GetProperty("adr").GetProperty("url").GetString());
        Assert.True(pwa.GetProperty("recordedAt").GetDateTimeOffset() > oldest.GetProperty("recordedAt").GetDateTimeOffset());
    }

    [Fact]
    public async Task A_stage_filter_lists_only_that_stages_decisions()
    {
        var (owner, projectId, _, _) = await DecidedAsync();

        Assert.Equal(["Which database?", "Add a PWA layer for offline site visits?"], Questions(await DecisionsAsync(owner, projectId, "?stage=4")));
        Assert.Equal(["Who approves a reconciled period?"], Questions(await DecisionsAsync(owner, projectId, "?stage=1")));
        Assert.Empty(Questions(await DecisionsAsync(owner, projectId, "?stage=3")));

        var invalid = await owner.GetAsync($"/api/projects/{projectId}/decisions?stage=11");
        Assert.Equal(HttpStatusCode.BadRequest, invalid.StatusCode);
    }

    [Fact]
    public async Task A_decision_reported_before_any_commit_of_the_decision_log_has_no_commit()
    {
        var (owner, projectId) = await SubmitAsync();
        var worker = await _factory.RegisterWorkerAsync();
        var idea = await RunOfStageAsync(worker, 1);
        await CommitAsync(worker, idea, "brief", "docs/brief.md");

        await DecideAsync(worker, idea, new { question = "Who approves a reconciled period?", answer = "A second person.", rationale = "Four eyes." });

        var decision = Assert.Single((await DecisionsAsync(owner, projectId)).GetProperty("decisions").EnumerateArray());
        Assert.Equal(JsonValueKind.Null, decision.GetProperty("commit").ValueKind);
        Assert.Equal(JsonValueKind.Null, decision.GetProperty("commitUrl").ValueKind);
    }

    [Fact]
    public async Task An_ADR_outside_docs_adr_is_rejected()
    {
        await SubmitAsync();
        var worker = await _factory.RegisterWorkerAsync();
        var idea = await RunOfStageAsync(worker, 1);

        var response = await worker.Http.PostAsJsonAsync($"/api/worker/runs/{idea.RunId}/decisions", new
        {
            workerId = worker.WorkerId,
            epoch = idea.Epoch,
            decisions = new[] { new { question = "Which stack?", answer = "The default.", rationale = "None needed.", adr = "../secrets.md" } },
        });

        Assert.Equal(HttpStatusCode.BadRequest, response.StatusCode);
    }

    [Fact]
    public async Task A_project_with_no_decisions_lists_none()
    {
        var (owner, projectId) = await SubmitAsync();

        Assert.Empty(Questions(await DecisionsAsync(owner, projectId)));
    }

    [Fact]
    public async Task Viewers_read_decisions_and_an_unknown_project_is_404()
    {
        var (_, projectId, _, _) = await DecidedAsync();
        var viewer = await _factory.SignInAsync("ada", Role.Viewer);

        Assert.Equal(3, (await DecisionsAsync(viewer, projectId)).GetProperty("decisions").GetArrayLength());
        Assert.Equal(HttpStatusCode.NotFound, (await viewer.GetAsync($"/api/projects/{Guid.NewGuid()}/decisions")).StatusCode);
        using var anonymous = _factory.CreateAnonymousClient();
        Assert.Equal(HttpStatusCode.Unauthorized, (await anonymous.GetAsync($"/api/projects/{projectId}/decisions")).StatusCode);
    }
}

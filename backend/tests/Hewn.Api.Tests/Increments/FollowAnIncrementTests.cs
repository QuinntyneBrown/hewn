// Acceptance Test
// Traces to: L2-021, L2-022, L2-024, L2-025, L2-037
// Description: GET /api/projects/{id}/increments/{n} follows an increment to merge: red recorded or green first, each iteration, Blocked with failing tests and what Hewn moved on to, the pull request with its body and required checks, and the squash-merge; check changes arrive through a signed webhook or 60-second polling and are recorded as CheckChanged events, and unsigned or invalid webhooks get 401

using System.Net;
using System.Net.Http.Json;
using System.Security.Cryptography;
using System.Text;
using System.Text.Json;
using Hewn.Api.Tests.Support;
using Hewn.Application.Pipeline;
using Hewn.Domain;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.DependencyInjection;

namespace Hewn.Api.Tests.Increments;

public sealed class FollowAnIncrementTests : IAsyncLifetime
{
    private const string Secret = "test-webhook-secret-0123456789";

    private const string Branch = "feature/sign-in";

    private const string Workflow = "name: CI\non: [pull_request]\njobs:\n  backend:\n    runs-on: ubuntu-latest\n  frontend:\n    runs-on: ubuntu-latest\n";

    private readonly HewnApiFactory _factory = new HewnApiFactory().WithSettings(("HEWN_GITHUB_WEBHOOK_SECRET", Secret));

    public Task InitializeAsync() => Task.CompletedTask;

    public async Task DisposeAsync() => await _factory.DisposeAsync();

    /// <summary>Runs stages 0 to 9 with a backlog of 1 Sign in, 2 Reconcile (needs 1) and 3 Reports, and leases stage 10.</summary>
    private async Task<(HewnClient Owner, Guid ProjectId, WorkerClient Worker, LeasedRun Run)> LeaseIncrementsAsync()
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
            var run = await worker.LeaseAsync() ?? throw new InvalidOperationException("Stage 10 was never offered.");
            if (run.Stage == 10)
            {
                return (owner, projectId, worker, run);
            }

            if (run.Stage == 9)
            {
                (await worker.Http.PutAsJsonAsync($"/api/worker/runs/{run.RunId}/backlog", new
                {
                    workerId = worker.WorkerId,
                    epoch = run.Epoch,
                    increments = new object[]
                    {
                        new { number = 1, title = "Sign in", journey = 1, l2Ids = new[] { "L2-001" }, estimateDays = 1m, dependsOn = Array.Empty<int>() },
                        new { number = 2, title = "Reconcile", journey = 2, l2Ids = new[] { "L2-002" }, estimateDays = 2m, dependsOn = new[] { 1 } },
                        new { number = 3, title = "Reports", journey = 3, l2Ids = new[] { "L2-003" }, estimateDays = 2m, dependsOn = Array.Empty<int>() },
                    },
                    deferred = Array.Empty<object>(),
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

    private static Task<HttpResponseMessage> MutateAsync(WorkerClient worker, LeasedRun run, string kind, string key, object fields)
    {
        var body = JsonSerializer.SerializeToElement(fields).EnumerateObject().ToDictionary(p => p.Name, p => (object?)p.Value);
        body["workerId"] = worker.WorkerId;
        body["epoch"] = run.Epoch;
        body["kind"] = kind;
        body["idempotencyKey"] = $"{run.RunId}/{key}";
        return worker.Http.PostAsJsonAsync($"/api/worker/runs/{run.RunId}/github/mutations", body);
    }

    private static object Files(params (string Path, string Content)[] files) =>
        files.Select(f => new { path = f.Path, contentBase64 = Convert.ToBase64String(Encoding.UTF8.GetBytes(f.Content)) }).ToArray();

    /// <summary>Records red, an iteration, green and the video, then commits and opens the pull request as stage 10 does.</summary>
    private async Task<int> OpenAsync(WorkerClient worker, LeasedRun run)
    {
        _factory.GitHub.Repository("hewn-builds", "ledgerline")!.Write(".github/workflows/ci.yml", Workflow);
        await UpdateAsync(worker, run, 1, new { status = "InProgress" });
        (await MutateAsync(worker, run, "commit", "i1/tests", new { message = "Add acceptance tests for sign in", branch = Branch, files = Files(("e2e/tests/sign-in.spec.ts", "// Traces to: L2-001\n")) })).EnsureSuccessStatusCode();
        await UpdateAsync(worker, run, 1, new { status = "InProgress", testCount = 1, redFailing = 1, redPassing = 0 });
        await UpdateAsync(worker, run, 1, new { status = "InProgress", iterations = 1 });
        (await MutateAsync(worker, run, "commit", "i1/implement-1", new { message = "Implement sign in", branch = Branch, files = Files(("frontend/src/sign-in.ts", "export const signIn = 1;\nexport const out = 2;\n")) })).EnsureSuccessStatusCode();
        await UpdateAsync(worker, run, 1, new { status = "InProgress", iterations = 1, greenAfter = 1 });
        await UpdateAsync(worker, run, 1, new { status = "InProgress", video = "Failed", videoNote = "The recording timed out" });
        var opened = await MutateAsync(worker, run, "open_pull_request", "i1/pull-request", new
        {
            head = Branch,
            title = "Sign in (journey 1, L2-001)",
            body = "## What\nSign in with GitHub.\n\n## Design and decisions\nNone.\n\n## API\nNone\n\n## Tests\n`npx playwright test` 1 passed\n\n## Deferred\nNothing.\n\n## Notes\nRed recorded before implementation.\n\nBuilt by Hewn · direction 1a2b3c4d · run-5e6f7a8b",
        });
        opened.EnsureSuccessStatusCode();
        var number = (await HewnClient.ReadJsonAsync(opened)).GetProperty("number").GetInt32();
        await UpdateAsync(worker, run, 1, new { status = "InProgress", pullRequestNumber = number });
        return number;
    }

    private static async Task<JsonElement> IncrementAsync(HewnClient client, Guid projectId, int number)
    {
        var response = await client.GetAsync($"/api/projects/{projectId}/increments/{number}");
        Assert.Equal(HttpStatusCode.OK, response.StatusCode);
        return await HewnClient.ReadJsonAsync(response);
    }

    private Task<List<JsonElement>> EventsAsync(Guid projectId, string type) =>
        _factory.QueryAsync(async db => (await db.Events.AsNoTracking().Where(e => e.ProjectId == projectId && e.Type == type).OrderBy(e => e.Sequence).ToListAsync())
            .Select(e => JsonDocument.Parse(e.Payload).RootElement.Clone()).ToList());

    private HttpRequestMessage Webhook(string body, string? signature, string type = "check_run")
    {
        var request = new HttpRequestMessage(HttpMethod.Post, "/api/github/webhook") { Content = new StringContent(body, Encoding.UTF8, "application/json") };
        request.Headers.Add("X-GitHub-Event", type);
        request.Headers.Add("X-GitHub-Delivery", Guid.NewGuid().ToString());
        if (signature is not null)
        {
            request.Headers.Add("X-Hub-Signature-256", signature);
        }

        return request;
    }

    private static string Sign(string body, string secret = Secret) =>
        "sha256=" + Convert.ToHexStringLower(HMACSHA256.HashData(Encoding.UTF8.GetBytes(secret), Encoding.UTF8.GetBytes(body)));

    private static string CheckRun(int number, string name, string status, string? conclusion) => JsonSerializer.Serialize(new
    {
        action = status == "completed" ? "completed" : "created",
        check_run = new
        {
            name,
            status,
            conclusion,
            started_at = "2026-11-09T14:37:05Z",
            completed_at = status == "completed" ? "2026-11-09T14:38:53Z" : null,
            pull_requests = new[] { new { number } },
        },
        repository = new { full_name = "hewn-builds/ledgerline" },
    });

    [Fact]
    public async Task An_increment_shows_red_recorded_each_iteration_and_green()
    {
        var (owner, projectId, worker, run) = await LeaseIncrementsAsync();
        await UpdateAsync(worker, run, 1, new { status = "InProgress" });
        await UpdateAsync(worker, run, 1, new { status = "InProgress", testCount = 4, redFailing = 4, redPassing = 0 });
        await UpdateAsync(worker, run, 1, new { status = "InProgress", iterations = 3 });

        var implementing = await IncrementAsync(owner, projectId, 1);

        Assert.Equal("Sign in", implementing.GetProperty("title").GetString());
        Assert.Equal(Branch, implementing.GetProperty("branch").GetString());
        Assert.Equal(1, implementing.GetProperty("journey").GetInt32());
        Assert.Equal(["L2-001"], implementing.GetProperty("l2Ids").EnumerateArray().Select(e => e.GetString()));
        Assert.Equal("InProgress", implementing.GetProperty("status").GetString());
        Assert.Equal(4, implementing.GetProperty("testCount").GetInt32());
        Assert.Equal(4, implementing.GetProperty("redFailing").GetInt32());
        Assert.Equal(0, implementing.GetProperty("redPassing").GetInt32());
        Assert.False(implementing.GetProperty("testsPassedEarly").GetBoolean());
        Assert.NotEqual(JsonValueKind.Null, implementing.GetProperty("testsCommittedAt").ValueKind);
        Assert.Equal(3, implementing.GetProperty("iterations").GetInt32());
        Assert.Equal(10, implementing.GetProperty("maxIterations").GetInt32());
        Assert.Equal(JsonValueKind.Null, implementing.GetProperty("greenAfter").ValueKind);
        Assert.Equal(JsonValueKind.Null, implementing.GetProperty("pullRequest").ValueKind);
        Assert.Empty(implementing.GetProperty("checks").EnumerateArray());

        await UpdateAsync(worker, run, 1, new { status = "InProgress", iterations = 3, greenAfter = 3 });
        await UpdateAsync(worker, run, 1, new { status = "InProgress", video = "Recorded", videoNote = "docs/videos/sign-in/" });

        var green = await IncrementAsync(owner, projectId, 1);
        Assert.Equal(3, green.GetProperty("greenAfter").GetInt32());
        Assert.NotEqual(JsonValueKind.Null, green.GetProperty("greenAt").ValueKind);
        Assert.Equal("Recorded", green.GetProperty("video").GetString());
        Assert.Equal("docs/videos/sign-in/", green.GetProperty("videoNote").GetString());
        Assert.Contains(await EventsAsync(projectId, "IncrementChanged"), e => e.GetProperty("greenAfter").ValueKind == JsonValueKind.Number);
    }

    [Fact]
    public async Task Tests_that_pass_on_the_test_commit_are_flagged_green_first()
    {
        var (owner, projectId, worker, run) = await LeaseIncrementsAsync();
        await UpdateAsync(worker, run, 1, new { status = "InProgress" });
        await UpdateAsync(worker, run, 1, new { status = "InProgress", testCount = 4, redFailing = 0, redPassing = 4 });

        var increment = await IncrementAsync(owner, projectId, 1);

        Assert.True(increment.GetProperty("testsPassedEarly").GetBoolean());
        Assert.Equal(4, increment.GetProperty("redPassing").GetInt32());
    }

    [Fact]
    public async Task A_blocked_increment_lists_its_failing_tests_and_the_increment_Hewn_moved_on_to()
    {
        var (owner, projectId, worker, run) = await LeaseIncrementsAsync();
        await UpdateAsync(worker, run, 1, new { status = "InProgress" });
        await UpdateAsync(worker, run, 1, new { status = "InProgress", testCount = 4, redFailing = 4, redPassing = 0 });
        await UpdateAsync(worker, run, 1, new { status = "Blocked", iterations = 10, failingTests = new[] { "e2e: ✘ matches-across-midnight", "e2e: ✘ matches-a-refund" } });

        var increment = await IncrementAsync(owner, projectId, 1);

        Assert.Equal("Blocked", increment.GetProperty("status").GetString());
        Assert.Equal(10, increment.GetProperty("iterations").GetInt32());
        Assert.Equal(["e2e: ✘ matches-across-midnight", "e2e: ✘ matches-a-refund"], increment.GetProperty("failingTests").EnumerateArray().Select(e => e.GetString()));
        Assert.NotEqual(JsonValueKind.Null, increment.GetProperty("finishedAt").ValueKind);
        // Increment 2 needs 1, so Hewn moved on to 3.
        Assert.Equal(3, increment.GetProperty("movedOnTo").GetInt32());
    }

    [Fact]
    public async Task The_pull_request_shows_its_link_body_and_required_checks_then_the_squash_merge()
    {
        var (owner, projectId, worker, run) = await LeaseIncrementsAsync();
        var number = await OpenAsync(worker, run);

        // The worker reads the checks while it waits; each change is recorded as CheckChanged (L2-037 AC1).
        var checks = await worker.Http.GetAsync($"/api/worker/runs/{run.RunId}/pull-requests/{number}/checks?workerId={worker.WorkerId}&epoch={run.Epoch}");
        checks.EnsureSuccessStatusCode();
        var open = await IncrementAsync(owner, projectId, 1);

        var pull = open.GetProperty("pullRequest");
        Assert.Equal(number, pull.GetProperty("number").GetInt32());
        Assert.Equal($"https://github.com/hewn-builds/ledgerline/pull/{number}", pull.GetProperty("url").GetString());
        Assert.Equal("Sign in (journey 1, L2-001)", pull.GetProperty("title").GetString());
        Assert.Equal("open", pull.GetProperty("state").GetString());
        Assert.Equal(2, pull.GetProperty("changedFiles").GetInt32());
        Assert.Equal(3, pull.GetProperty("additions").GetInt32());
        var sections = pull.GetProperty("sections").EnumerateArray().Select(s => s.GetProperty("heading").GetString()).ToList();
        Assert.Equal(["What", "Design and decisions", "API", "Tests", "Deferred", "Notes"], sections);
        Assert.Equal("Built by Hewn · direction 1a2b3c4d · run-5e6f7a8b", pull.GetProperty("attribution").GetString());
        Assert.NotEqual(JsonValueKind.Null, open.GetProperty("pullRequestOpenedAt").ValueKind);
        Assert.Equal(["backend", "frontend"], open.GetProperty("checks").EnumerateArray().Select(c => c.GetProperty("name").GetString()));
        Assert.All(open.GetProperty("checks").EnumerateArray(), c => Assert.Equal("success", c.GetProperty("conclusion").GetString()));
        Assert.Equal(["backend", "frontend"], (await EventsAsync(projectId, "CheckChanged")).Select(e => e.GetProperty("name").GetString()));
        Assert.All(await EventsAsync(projectId, "CheckChanged"), e => Assert.Equal(1, e.GetProperty("number").GetInt32()));

        // Reading unchanged checks again records nothing new.
        (await worker.Http.GetAsync($"/api/worker/runs/{run.RunId}/pull-requests/{number}/checks?workerId={worker.WorkerId}&epoch={run.Epoch}")).EnsureSuccessStatusCode();
        Assert.Equal(2, (await EventsAsync(projectId, "CheckChanged")).Count);

        (await MutateAsync(worker, run, "merge_pull_request", "i1/merge-1", new { number })).EnsureSuccessStatusCode();
        await UpdateAsync(worker, run, 1, new { status = "Merged", pullRequestNumber = number, iterations = 1 });

        var merged = await IncrementAsync(owner, projectId, 1);
        Assert.Equal("Merged", merged.GetProperty("status").GetString());
        Assert.Equal("merged", merged.GetProperty("pullRequest").GetProperty("state").GetString());
        Assert.NotEqual(JsonValueKind.Null, merged.GetProperty("finishedAt").ValueKind);
        Assert.Equal("Failed", merged.GetProperty("video").GetString());
    }

    [Fact]
    public async Task A_signed_check_run_webhook_updates_the_check_and_emits_CheckChanged()
    {
        var (owner, projectId, worker, run) = await LeaseIncrementsAsync();
        var number = await OpenAsync(worker, run);
        var client = _factory.CreateClient();

        var running = CheckRun(number, "e2e", "in_progress", null);
        Assert.Equal(HttpStatusCode.Accepted, (await client.SendAsync(Webhook(running, Sign(running)))).StatusCode);
        var passed = CheckRun(number, "e2e", "completed", "success");
        Assert.Equal(HttpStatusCode.Accepted, (await client.SendAsync(Webhook(passed, Sign(passed)))).StatusCode);

        var check = Assert.Single((await IncrementAsync(owner, projectId, 1)).GetProperty("checks").EnumerateArray());
        Assert.Equal("e2e", check.GetProperty("name").GetString());
        Assert.Equal("completed", check.GetProperty("status").GetString());
        Assert.Equal("success", check.GetProperty("conclusion").GetString());
        Assert.Equal(108, check.GetProperty("durationSeconds").GetInt32());
        var events = await EventsAsync(projectId, "CheckChanged");
        Assert.Equal(["in_progress", "completed"], events.Select(e => e.GetProperty("status").GetString()));
        Assert.All(events, e => Assert.Equal(number, e.GetProperty("pullRequestNumber").GetInt32()));
    }

    [Fact]
    public async Task Unsigned_or_invalid_webhooks_get_401_and_change_nothing()
    {
        var (owner, projectId, worker, run) = await LeaseIncrementsAsync();
        var number = await OpenAsync(worker, run);
        var client = _factory.CreateClient();
        var body = CheckRun(number, "e2e", "completed", "failure");

        Assert.Equal(HttpStatusCode.Unauthorized, (await client.SendAsync(Webhook(body, null))).StatusCode);
        Assert.Equal(HttpStatusCode.Unauthorized, (await client.SendAsync(Webhook(body, Sign(body, "another-secret")))).StatusCode);
        Assert.Equal(HttpStatusCode.Unauthorized, (await client.SendAsync(Webhook(body, "sha256=not-hex"))).StatusCode);
        // A body changed after signing fails too.
        Assert.Equal(HttpStatusCode.Unauthorized, (await client.SendAsync(Webhook(body.Replace("failure", "success"), Sign(body)))).StatusCode);

        Assert.Empty((await IncrementAsync(owner, projectId, 1)).GetProperty("checks").EnumerateArray());
        Assert.Empty(await EventsAsync(projectId, "CheckChanged"));
        // Other events are accepted and ignored; a ping answers.
        const string ping = "{\"zen\":\"Keep it logically awesome.\"}";
        Assert.Equal(HttpStatusCode.Accepted, (await client.SendAsync(Webhook(ping, Sign(ping), "ping"))).StatusCode);
    }

    [Fact]
    public async Task With_no_webhook_for_60_seconds_the_poller_reads_the_checks()
    {
        var (owner, projectId, worker, run) = await LeaseIncrementsAsync();
        var number = await OpenAsync(worker, run);
        var poller = _factory.Services.GetRequiredService<CheckPoller>();

        // Just opened: nothing is due yet.
        Assert.Equal(0, await poller.PollAsync(CancellationToken.None));
        Assert.Empty(await EventsAsync(projectId, "CheckChanged"));

        _factory.Clock.Advance(TimeSpan.FromSeconds(61));
        Assert.Equal(1, await poller.PollAsync(CancellationToken.None));

        Assert.Equal(["backend", "frontend"], (await EventsAsync(projectId, "CheckChanged")).Select(e => e.GetProperty("name").GetString()));
        Assert.Equal(2, (await IncrementAsync(owner, projectId, 1)).GetProperty("checks").GetArrayLength());

        // A webhook counts as hearing from GitHub, so the poller waits another 60 seconds.
        _factory.Clock.Advance(TimeSpan.FromSeconds(61));
        var body = CheckRun(number, "backend", "completed", "success");
        (await _factory.CreateClient().SendAsync(Webhook(body, Sign(body)))).EnsureSuccessStatusCode();
        Assert.Equal(0, await poller.PollAsync(CancellationToken.None));
    }

    [Fact]
    public async Task An_unknown_increment_or_project_is_not_found_and_Viewers_can_follow_one()
    {
        var (_, projectId, worker, run) = await LeaseIncrementsAsync();
        await UpdateAsync(worker, run, 1, new { status = "InProgress" });
        var viewer = await _factory.SignInAsync("grace", Role.Viewer);

        Assert.Equal(1, (await IncrementAsync(viewer, projectId, 1)).GetProperty("number").GetInt32());
        Assert.Equal(HttpStatusCode.NotFound, (await viewer.GetAsync($"/api/projects/{projectId}/increments/9")).StatusCode);
        Assert.Equal(HttpStatusCode.NotFound, (await viewer.GetAsync($"/api/projects/{Guid.NewGuid()}/increments/1")).StatusCode);
    }
}

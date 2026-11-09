// Acceptance Test
// Traces to: L2-021, L2-022, L2-024, L2-025
// Description: Stage 10 works through the backlog: it is offered the next runnable increment, records red, blocks or merges it, commits to its own feature branch, and merges through a pull request that is rebased when the default branch moved

using System.Net;
using System.Net.Http.Json;
using System.Text;
using System.Text.Json;
using Hewn.Api.Tests.Support;
using Hewn.Domain;
using Microsoft.EntityFrameworkCore;

namespace Hewn.Api.Tests.Pipeline;

public sealed class IncrementStageTests : IAsyncLifetime
{
    private const string Branch = "feature/sign-in";

    private readonly HewnApiFactory _factory = new();

    public Task InitializeAsync() => Task.CompletedTask;

    public async Task DisposeAsync() => await _factory.DisposeAsync();

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
                // 1 Sign in; 2 Reconcile (needs 1); 3 Reports (independent).
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

    private static async Task<JsonElement?> NextAsync(WorkerClient worker, LeasedRun run)
    {
        var response = await worker.Http.GetAsync($"/api/worker/runs/{run.RunId}/increments/next?workerId={worker.WorkerId}&epoch={run.Epoch}");
        response.EnsureSuccessStatusCode();
        return response.StatusCode == HttpStatusCode.NoContent ? null : await HewnClient.ReadJsonAsync(response);
    }

    private static Task<HttpResponseMessage> UpdateAsync(WorkerClient worker, LeasedRun run, int number, object fields)
    {
        var body = JsonSerializer.SerializeToElement(fields).EnumerateObject().ToDictionary(p => p.Name, p => (object?)p.Value);
        body["workerId"] = worker.WorkerId;
        body["epoch"] = run.Epoch;
        return worker.Http.PutAsJsonAsync($"/api/worker/runs/{run.RunId}/increments/{number}", body);
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

    private static async Task<string?> CodeAsync(HttpResponseMessage response) =>
        (await HewnClient.ReadJsonAsync(response)).GetProperty("code").GetString();

    private static async Task<int> OpenAsync(WorkerClient worker, LeasedRun run, string key = "i1")
    {
        (await MutateAsync(worker, run, "commit", $"{key}/tests", new { message = "Add acceptance tests for sign in", branch = Branch, files = Files(("e2e/tests/sign-in.spec.ts", "// Traces to: L2-001\n")) })).EnsureSuccessStatusCode();
        (await MutateAsync(worker, run, "commit", $"{key}/implement-1", new { message = "Implement sign in", branch = Branch, files = Files(("frontend/src/sign-in.ts", "export const signIn = 1;\n")) })).EnsureSuccessStatusCode();
        var opened = await MutateAsync(worker, run, "open_pull_request", $"{key}/pull-request", new { head = Branch, title = "Sign in (journey 1, L2-001)", body = "## What\n" });
        opened.EnsureSuccessStatusCode();
        return (await HewnClient.ReadJsonAsync(opened)).GetProperty("number").GetInt32();
    }

    [Fact]
    public async Task Stage_10_is_told_the_iteration_cap()
    {
        var (_, _, _, run) = await LeaseIncrementsAsync();

        Assert.Equal(10, run.Body.GetProperty("maxIterations").GetInt32());
    }

    [Fact]
    public async Task Increments_are_offered_in_order_until_none_is_left()
    {
        var (_, _, worker, run) = await LeaseIncrementsAsync();
        var offered = new List<string>();

        while (await NextAsync(worker, run) is { } next)
        {
            offered.Add(next.GetProperty("title").GetString()!);
            var number = next.GetProperty("number").GetInt32();
            (await UpdateAsync(worker, run, number, new { status = "InProgress" })).EnsureSuccessStatusCode();
            (await UpdateAsync(worker, run, number, new { status = "Merged", pullRequestNumber = number })).EnsureSuccessStatusCode();
        }

        Assert.Equal(["Sign in", "Reconcile", "Reports"], offered);
    }

    [Fact]
    public async Task An_increment_in_progress_is_offered_again_after_a_resume()
    {
        var (_, _, worker, run) = await LeaseIncrementsAsync();
        (await UpdateAsync(worker, run, 1, new { status = "InProgress" })).EnsureSuccessStatusCode();

        Assert.Equal(1, (await NextAsync(worker, run))!.Value.GetProperty("number").GetInt32());
    }

    [Fact]
    public async Task A_blocked_increment_is_recorded_with_its_failing_tests_and_its_dependents_are_skipped()
    {
        var (owner, projectId, worker, run) = await LeaseIncrementsAsync();
        (await UpdateAsync(worker, run, 1, new { status = "InProgress" })).EnsureSuccessStatusCode();
        (await UpdateAsync(worker, run, 1, new { status = "InProgress", redFailing = 2, redPassing = 0 })).EnsureSuccessStatusCode();

        var blocked = await UpdateAsync(worker, run, 1, new { status = "Blocked", iterations = 10, failingTests = new[] { "e2e: sign-in.spec.ts › signs in", "backend: SignInTests.Rejects_a_bad_password" } });

        blocked.EnsureSuccessStatusCode();
        Assert.Equal(3, (await NextAsync(worker, run))!.Value.GetProperty("number").GetInt32());
        var stored = await _factory.QueryAsync(db => db.Increments.SingleAsync(i => i.Number == 1));
        Assert.Equal(IncrementStatus.Blocked, stored.Status);
        Assert.Equal(2, stored.RedFailing);
        Assert.Equal(10, stored.Iterations);
        Assert.Contains("signs in", stored.FailingTests);
        var events = await HewnClient.ReadJsonAsync(await owner.GetAsync($"/api/projects/{projectId}/events?after=0"));
        var last = events.EnumerateArray().Last(e => e.GetProperty("type").GetString() == "IncrementChanged").GetProperty("payload");
        Assert.Equal("Blocked", last.GetProperty("status").GetString());
        Assert.Equal(1, last.GetProperty("number").GetInt32());
    }

    [Fact]
    public async Task Tests_that_pass_before_implementation_are_flagged()
    {
        var (_, _, worker, run) = await LeaseIncrementsAsync();
        (await UpdateAsync(worker, run, 1, new { status = "InProgress" })).EnsureSuccessStatusCode();

        (await UpdateAsync(worker, run, 1, new { status = "InProgress", redFailing = 0, redPassing = 3 })).EnsureSuccessStatusCode();

        Assert.True(await _factory.QueryAsync(db => db.Increments.Where(i => i.Number == 1).Select(i => i.TestsPassedEarly).SingleAsync()));
    }

    [Theory]
    [InlineData("Merged")] // a queued increment cannot merge
    [InlineData("Blocked")]
    public async Task Only_an_increment_in_progress_may_block_or_merge(string status)
    {
        var (_, _, worker, run) = await LeaseIncrementsAsync();

        var response = await UpdateAsync(worker, run, 1, new { status });

        Assert.Equal(HttpStatusCode.BadRequest, response.StatusCode);
        Assert.Equal("invalid_transition", await CodeAsync(response));
    }

    [Theory]
    [InlineData(Branch, "backend/src/SignIn.cs", null)]
    [InlineData(Branch, "e2e/tests/sign-in.spec.ts", null)]
    [InlineData(null, "docs/estimates/README.md", null)]
    [InlineData(null, "backend/src/SignIn.cs", "path_not_allowed")]
    [InlineData(Branch, ".github/workflows/ci.yml", "path_not_allowed")]
    [InlineData(Branch, ".claude/skills/grilling/SKILL.md", "path_not_allowed")]
    [InlineData(Branch, "docs/specs/L2.md", "path_not_allowed")]
    [InlineData("hewn/scaffold", "README.md", "branch_not_allowed")]
    [InlineData("feature/../main", "README.md", "branch_not_allowed")]
    public async Task Increments_write_code_on_feature_branches_and_only_progress_on_the_default_branch(string? branch, string path, string? code)
    {
        var (_, _, worker, run) = await LeaseIncrementsAsync();

        var response = await MutateAsync(worker, run, "commit", "i1/commit", new { message = "x", branch, files = Files((path, "x")) });

        if (code is null)
        {
            response.EnsureSuccessStatusCode();
        }
        else
        {
            Assert.Equal(code, await CodeAsync(response));
        }
    }

    [Fact]
    public async Task The_pull_request_squash_merges_and_its_branch_is_deleted()
    {
        var (_, _, worker, run) = await LeaseIncrementsAsync();
        var repository = _factory.GitHub.Repository("hewn-builds", "ledgerline")!;
        var number = await OpenAsync(worker, run);

        var merged = await MutateAsync(worker, run, "merge_pull_request", "i1/merge-1", new { number });

        merged.EnsureSuccessStatusCode();
        Assert.Equal("export const signIn = 1;\n", repository.Read("frontend/src/sign-in.ts"));
        Assert.Equal("Sign in (journey 1, L2-001) (#1)", repository.Commits[^1].Message);
        Assert.False(repository.Branches.ContainsKey(Branch));
    }

    [Fact]
    public async Task A_branch_behind_the_default_branch_is_refused_until_it_is_rebased()
    {
        var (_, _, worker, run) = await LeaseIncrementsAsync();
        var repository = _factory.GitHub.Repository("hewn-builds", "ledgerline")!;
        var number = await OpenAsync(worker, run);
        repository.Write("docs/notes.md", "Someone else's change\n");

        var behind = await MutateAsync(worker, run, "merge_pull_request", "i1/merge-1", new { number });
        Assert.Equal("branch_behind", await CodeAsync(behind));

        (await MutateAsync(worker, run, "commit", "i1/rebase-1", new
        {
            message = "Rebase sign in",
            branch = Branch,
            rebase = true,
            files = Files(("e2e/tests/sign-in.spec.ts", "// Traces to: L2-001\n"), ("frontend/src/sign-in.ts", "export const signIn = 1;\n")),
        })).EnsureSuccessStatusCode();
        (await MutateAsync(worker, run, "merge_pull_request", "i1/merge-2", new { number })).EnsureSuccessStatusCode();

        Assert.Equal("Someone else's change\n", repository.Read("docs/notes.md"));
        Assert.Equal("export const signIn = 1;\n", repository.Read("frontend/src/sign-in.ts"));
    }

    [Fact]
    public async Task Increments_touch_only_their_own_pull_requests_and_never_branch_protection()
    {
        var (_, _, worker, run) = await LeaseIncrementsAsync();
        var repository = _factory.GitHub.Repository("hewn-builds", "ledgerline")!;
        repository.CommitToBranch("hewn/scaffold", "Scaffold", [new("README.md", "x"u8.ToArray())]);

        var open = await MutateAsync(worker, run, "open_pull_request", "i1/pr", new { head = "hewn/scaffold", title = "x", body = "x" });
        var protect = await MutateAsync(worker, run, "protect_branch", "i1/protect", new { checks = new[] { "backend" } });

        Assert.Equal("branch_not_allowed", await CodeAsync(open));
        Assert.Equal("mutation_not_allowed", await CodeAsync(protect));
    }

    [Fact]
    public async Task Only_stage_10_may_read_or_update_increments()
    {
        var owner = await _factory.SignInAsync("quinntynebrown", Role.Owner);
        (await owner.PostAsync("/api/projects", new { name = "Ledgerline", idea = "A web app for small accounting teams.", stackPreference = (string?)null, repositoryUrl = (string?)null, budgetUsd = 300m })).EnsureSuccessStatusCode();
        var worker = await _factory.RegisterWorkerAsync();
        var run = (await worker.LeaseAsync())!;

        var next = await worker.Http.GetAsync($"/api/worker/runs/{run.RunId}/increments/next?workerId={worker.WorkerId}&epoch={run.Epoch}");
        var update = await UpdateAsync(worker, run, 1, new { status = "InProgress" });

        Assert.Equal("mutation_not_allowed", await CodeAsync(next));
        Assert.Equal("mutation_not_allowed", await CodeAsync(update));
    }
}

// Acceptance Test
// Traces to: L2-007, L2-036
// Description: Stage 0 creates the private repository and commits Greenlit's skills through the API, with no GitHub credential on the worker

using System.Net;
using System.Net.Http.Json;
using System.Text;
using Hewn.Api.Tests.Support;
using Hewn.Domain;
using Microsoft.EntityFrameworkCore;

namespace Hewn.Api.Tests.Pipeline;

public sealed class BootstrapStageTests : IAsyncLifetime
{
    private readonly HewnApiFactory _factory = new();

    public Task InitializeAsync() => Task.CompletedTask;

    public async Task DisposeAsync() => await _factory.DisposeAsync();

    private async Task<(HewnClient Owner, Guid ProjectId)> SubmitAsync(string name = "Kiln Booking & Co.", string? repositoryUrl = null)
    {
        var owner = await _factory.SignInAsync("quinntynebrown", Role.Owner);
        var response = await owner.PostAsync("/api/projects", new
        {
            name,
            idea = "Booking firing slots for a shared pottery kiln.",
            stackPreference = (string?)null,
            repositoryUrl,
            budgetUsd = 300m,
        });
        Assert.Equal(HttpStatusCode.Created, response.StatusCode);
        return (owner, (await HewnClient.ReadJsonAsync(response)).GetProperty("projectId").GetGuid());
    }

    private static object File(string path, string content) =>
        new { path, contentBase64 = Convert.ToBase64String(Encoding.UTF8.GetBytes(content)) };

    [Fact]
    public async Task Leasing_stage_0_creates_a_private_repository_named_in_kebab_case_under_the_configured_owner()
    {
        var (owner, projectId) = await SubmitAsync();
        var worker = await _factory.RegisterWorkerAsync();

        var run = await worker.LeaseAsync();

        var repo = _factory.GitHub.Repository("hewn-builds", "kiln-booking-co");
        Assert.NotNull(repo);
        Assert.True(repo.IsPrivate);
        Assert.Contains("hewn", repo.Topics);
        Assert.Equal("hewn-builds/kiln-booking-co", run!.Body.GetProperty("project").GetProperty("repository").GetString());
        var project = await HewnClient.ReadJsonAsync(await owner.GetAsync($"/api/projects/{projectId}"));
        Assert.Equal("hewn-builds/kiln-booking-co", project.GetProperty("repository").GetString());
        var events = await HewnClient.ReadJsonAsync(await owner.GetAsync($"/api/projects/{projectId}/events?after=0"));
        Assert.Contains(events.EnumerateArray(), e =>
            e.GetProperty("type").GetString() == "ProjectChanged" &&
            e.GetProperty("payload").GetProperty("repository").GetString() == "hewn-builds/kiln-booking-co");
    }

    [Fact]
    public async Task The_lease_names_the_skills_source_to_copy_from()
    {
        await SubmitAsync();
        var worker = await _factory.RegisterWorkerAsync();

        var run = await worker.LeaseAsync();

        Assert.Equal(HewnApiFactory.SkillsSource, run!.Body.GetProperty("skillsSource").GetString());
    }

    [Fact]
    public async Task A_project_with_an_existing_repository_gets_no_new_repository()
    {
        await SubmitAsync("Handover", "https://github.com/northwind/handover-app");
        var worker = await _factory.RegisterWorkerAsync();

        var run = await worker.LeaseAsync();

        Assert.Equal("northwind/handover-app", run!.Body.GetProperty("project").GetProperty("repository").GetString());
        Assert.Null(_factory.GitHub.Repository("hewn-builds", "handover"));
    }

    [Fact]
    public async Task A_fresh_repository_left_by_a_crashed_attempt_is_adopted()
    {
        _factory.GitHub.Seed("hewn-builds", "kiln-booking-co", topics: ["hewn"]);
        await SubmitAsync();
        var worker = await _factory.RegisterWorkerAsync();

        var run = await worker.LeaseAsync();

        Assert.Equal("hewn-builds/kiln-booking-co", run!.Body.GetProperty("project").GetProperty("repository").GetString());
    }

    [Fact]
    public async Task A_name_taken_by_another_repository_fails_the_run_with_the_reason_and_blocks_the_project()
    {
        _factory.GitHub.Seed("hewn-builds", "kiln-booking-co", topics: []);
        var (owner, projectId) = await SubmitAsync();
        var worker = await _factory.RegisterWorkerAsync();

        // Each attempt fails as it is leased; the stage blocks once the three retries (L2-006 AC1) have failed too.
        Assert.Null(await worker.LeaseAsync());
        foreach (var wait in new[] { 30, 120, 600 })
        {
            _factory.Clock.Advance(TimeSpan.FromSeconds(wait));
            Assert.Null(await worker.LeaseAsync());
        }

        var stored = await _factory.QueryAsync(db => db.Runs.OrderByDescending(r => r.Attempt).FirstAsync(r => r.ProjectId == projectId));
        Assert.Equal("hewn-builds/kiln-booking-co already exists and was not created by Hewn.", stored.Error);
        var project = await HewnClient.ReadJsonAsync(await owner.GetAsync($"/api/projects/{projectId}"));
        Assert.Equal("Blocked", project.GetProperty("status").GetString());
        Assert.Equal("Failed", project.GetProperty("directions")[0].GetProperty("stages")[0].GetProperty("status").GetString());
    }

    [Fact]
    public async Task The_worker_can_list_skill_folders_that_already_exist_in_the_repository()
    {
        _factory.GitHub.Seed("northwind", "handover-app", topics: [], files: new()
        {
            [".claude/skills/grilling/SKILL.md"] = "custom",
            [".agents/skills/estimating-designs/SKILL.md"] = "custom",
        });
        await SubmitAsync("Handover", "https://github.com/northwind/handover-app");
        var worker = await _factory.RegisterWorkerAsync();
        var run = await worker.LeaseAsync();

        var response = await worker.Http.GetAsync($"/api/worker/runs/{run!.RunId}/repository/skill-folders?workerId={worker.WorkerId}&epoch={run.Epoch}");

        response.EnsureSuccessStatusCode();
        var folders = await HewnClient.ReadJsonAsync(response);
        Assert.Equal(["grilling"], folders.GetProperty(".claude/skills").EnumerateArray().Select(e => e.GetString()));
        Assert.Equal(["estimating-designs"], folders.GetProperty(".agents/skills").EnumerateArray().Select(e => e.GetString()));
    }

    [Fact]
    public async Task A_commit_mutation_writes_the_files_to_the_default_branch_once_per_idempotency_key()
    {
        await SubmitAsync();
        var worker = await _factory.RegisterWorkerAsync();
        var run = await worker.LeaseAsync();
        var body = new
        {
            workerId = worker.WorkerId,
            epoch = run!.Epoch,
            kind = "commit",
            idempotencyKey = $"{run.RunId}/2/commit",
            message = "Bootstrap skills from greenlit@0e0d25a",
            files = new[] { File(".claude/skills/grilling/SKILL.md", "# Grilling"), File(".hewn/skills.lock", "{}") },
        };

        var first = await worker.Http.PostAsJsonAsync($"/api/worker/runs/{run.RunId}/github/mutations", body);
        var second = await worker.Http.PostAsJsonAsync($"/api/worker/runs/{run.RunId}/github/mutations", body);

        first.EnsureSuccessStatusCode();
        second.EnsureSuccessStatusCode();
        var sha = (await HewnClient.ReadJsonAsync(first)).GetProperty("sha").GetString();
        Assert.Equal(sha, (await HewnClient.ReadJsonAsync(second)).GetProperty("sha").GetString());
        var repo = _factory.GitHub.Repository("hewn-builds", "kiln-booking-co")!;
        Assert.Equal("# Grilling", repo.Read(".claude/skills/grilling/SKILL.md"));
        Assert.Equal("Bootstrap skills from greenlit@0e0d25a", repo.Commits[^1].Message);
        Assert.Equal(2, repo.Commits.Count);
    }

    [Theory]
    [InlineData(".github/workflows/ci.yml")]
    [InlineData("../escape.txt")]
    [InlineData(".claude/skills/../../src/app.ts")]
    [InlineData("/etc/passwd")]
    public async Task Stage_0_may_only_write_skill_folders_and_the_skills_lock(string path)
    {
        await SubmitAsync();
        var worker = await _factory.RegisterWorkerAsync();
        var run = await worker.LeaseAsync();

        var response = await worker.Http.PostAsJsonAsync($"/api/worker/runs/{run!.RunId}/github/mutations", new
        {
            workerId = worker.WorkerId,
            epoch = run.Epoch,
            kind = "commit",
            idempotencyKey = $"{run.RunId}/2/commit",
            message = "Sneaky",
            files = new[] { File(path, "x") },
        });

        Assert.Equal(HttpStatusCode.BadRequest, response.StatusCode);
        Assert.Equal("path_not_allowed", (await HewnClient.ReadJsonAsync(response)).GetProperty("code").GetString());
        Assert.Single(_factory.GitHub.Repository("hewn-builds", "kiln-booking-co")!.Commits);
    }

    [Fact]
    public async Task A_mutation_with_a_stale_epoch_is_refused_and_reaches_no_repository()
    {
        await SubmitAsync();
        var worker = await _factory.RegisterWorkerAsync();
        var run = await worker.LeaseAsync();

        var response = await worker.Http.PostAsJsonAsync($"/api/worker/runs/{run!.RunId}/github/mutations", new
        {
            workerId = worker.WorkerId,
            epoch = run.Epoch + 1,
            kind = "commit",
            idempotencyKey = $"{run.RunId}/2/commit",
            message = "Late",
            files = new[] { File(".hewn/skills.lock", "{}") },
        });

        Assert.Equal(HttpStatusCode.Conflict, response.StatusCode);
        Assert.Single(_factory.GitHub.Repository("hewn-builds", "kiln-booking-co")!.Commits);
    }

    [Fact]
    public async Task Run_log_lines_are_stored_in_order_with_credentials_redacted()
    {
        await SubmitAsync();
        var worker = await _factory.RegisterWorkerAsync();
        var run = await worker.LeaseAsync();

        var response = await worker.Http.PostAsJsonAsync($"/api/worker/runs/{run!.RunId}/logs", new
        {
            workerId = worker.WorkerId,
            epoch = run.Epoch,
            lines = new[]
            {
                new { level = "info", text = "Copied 14 skills from greenlit@0e0d25a" },
                new { level = "info", text = "kept existing: .claude/skills/grilling" },
                new { level = "warn", text = "token=ghp_abcdefghijklmnopqrstuvwxyz0123456789" },
            },
        });

        Assert.Equal(HttpStatusCode.NoContent, response.StatusCode);
        var lines = await _factory.QueryAsync(db => db.RunLogLines.Where(l => l.RunId == run.RunId).OrderBy(l => l.Sequence).ToListAsync());
        Assert.Equal(["Copied 14 skills from greenlit@0e0d25a", "kept existing: .claude/skills/grilling", "token=***"], lines.Select(l => l.Text));
        Assert.Equal([1L, 2L, 3L], lines.Select(l => l.Sequence));
    }
}

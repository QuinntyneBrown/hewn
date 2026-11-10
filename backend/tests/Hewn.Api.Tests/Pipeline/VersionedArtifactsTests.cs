// Acceptance Test
// Traces to: L2-034
// Description: When a stage that wrote files succeeds, each file's version is the commit SHA that holds it (AC1); GET /api/projects/{id}/artifacts lists each stage's artifacts, newest stage first, with path, SHA, time and a link to GitHub at that SHA (AC2)

using System.Net;
using System.Net.Http.Json;
using System.Text;
using System.Text.Json;
using Hewn.Api.Tests.Support;
using Hewn.Domain;

namespace Hewn.Api.Tests.Pipeline;

public sealed class VersionedArtifactsTests : IAsyncLifetime
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

    private static async Task<string> CommitAsync(WorkerClient worker, LeasedRun run, string step, string[] paths, string? branch = null)
    {
        var response = await worker.Http.PostAsJsonAsync($"/api/worker/runs/{run.RunId}/github/mutations", new
        {
            workerId = worker.WorkerId,
            epoch = run.Epoch,
            kind = "commit",
            idempotencyKey = $"{run.RunId}/{step}/commit",
            message = "Write the stage's files",
            branch,
            files = paths.Select(p => new { path = p, contentBase64 = Convert.ToBase64String(Encoding.UTF8.GetBytes($"# {p}\n")) }),
        });
        response.EnsureSuccessStatusCode();
        return (await HewnClient.ReadJsonAsync(response)).GetProperty("sha").GetString()!;
    }

    /// <summary>Succeeds runs until the worker leases the given stage.</summary>
    private static async Task<LeasedRun> LeaseStageAsync(WorkerClient worker, int stage)
    {
        LeasedRun run;
        while ((run = (await worker.LeaseAsync())!).Stage != stage)
        {
            (await worker.SucceedAsync(run)).EnsureSuccessStatusCode();
        }

        return run;
    }

    private static async Task<JsonElement> ArtifactsAsync(HewnClient client, Guid projectId)
    {
        var response = await client.GetAsync($"/api/projects/{projectId}/artifacts");
        Assert.Equal(HttpStatusCode.OK, response.StatusCode);
        return await HewnClient.ReadJsonAsync(response);
    }

    private static List<JsonElement> Stage(JsonElement artifacts, int stage) =>
        artifacts.GetProperty("stages").EnumerateArray().Single(s => s.GetProperty("stage").GetInt32() == stage)
            .GetProperty("artifacts").EnumerateArray().ToList();

    [Fact]
    public async Task Each_stage_lists_its_artifacts_newest_stage_first_with_the_commit_and_a_link_at_that_commit()
    {
        var (owner, projectId) = await SubmitAsync();
        var worker = await _factory.RegisterWorkerAsync();
        var bootstrap = await worker.LeaseAsync();
        var skills = await CommitAsync(worker, bootstrap!, "2", [".claude/skills/writing-html-mocks/SKILL.md", ".claude/skills/writing-html-mocks/scripts/check_mocks.py", ".claude/skills/grilling/SKILL.md", ".hewn/skills.lock"]);
        (await worker.SucceedAsync(bootstrap!)).EnsureSuccessStatusCode();
        var idea = await worker.LeaseAsync();
        _factory.Clock.Advance(TimeSpan.FromMinutes(7));
        var brief = await CommitAsync(worker, idea!, "2", ["docs/brief.md", "docs/decisions.md"]);
        (await worker.SucceedAsync(idea!)).EnsureSuccessStatusCode();

        var artifacts = await ArtifactsAsync(owner, projectId);

        Assert.Equal("hewn-builds/ledgerline", artifacts.GetProperty("repository").GetString());
        var stages = artifacts.GetProperty("stages").EnumerateArray().ToList();
        Assert.Equal([1, 0], stages.Select(s => s.GetProperty("stage").GetInt32()));
        Assert.Equal(["Idea", "Bootstrap"], stages.Select(s => s.GetProperty("name").GetString()));

        // The decision log every stage appends to has its own tab; it is not one stage's artifact.
        var briefRow = Assert.Single(Stage(artifacts, 1));
        Assert.Equal("docs/brief.md", briefRow.GetProperty("path").GetString());
        Assert.False(briefRow.GetProperty("folder").GetBoolean());
        Assert.Equal(brief, briefRow.GetProperty("sha").GetString());
        Assert.Equal(_factory.Clock.GetUtcNow(), briefRow.GetProperty("committedAt").GetDateTimeOffset());
        Assert.Equal($"https://github.com/hewn-builds/ledgerline/blob/{brief}/docs/brief.md", briefRow.GetProperty("url").GetString());

        // Files in a subfolder of the stage's output fold into that folder, linked as a tree.
        var bootstrapRows = Stage(artifacts, 0);
        Assert.Equal([".claude/skills/grilling/", ".claude/skills/writing-html-mocks/", ".hewn/skills.lock"], bootstrapRows.Select(r => r.GetProperty("path").GetString()));
        Assert.Equal([true, true, false], bootstrapRows.Select(r => r.GetProperty("folder").GetBoolean()));
        Assert.Equal($"https://github.com/hewn-builds/ledgerline/tree/{skills}/.claude/skills/grilling/", bootstrapRows[0].GetProperty("url").GetString());
        Assert.All(bootstrapRows, r => Assert.Equal(skills, r.GetProperty("sha").GetString()));
    }

    [Fact]
    public async Task Only_a_run_that_succeeded_versions_its_files_and_a_retry_s_commit_is_the_version()
    {
        var (owner, projectId) = await SubmitAsync();
        var worker = await _factory.RegisterWorkerAsync();
        var first = await LeaseStageAsync(worker, 1);
        await CommitAsync(worker, first, "2", ["docs/brief.md"]);

        Assert.DoesNotContain((await ArtifactsAsync(owner, projectId)).GetProperty("stages").EnumerateArray(), s => s.GetProperty("stage").GetInt32() == 1);

        (await worker.FailAsync(first, "The brief left out the audience")).EnsureSuccessStatusCode();
        _factory.Clock.Advance(TimeSpan.FromMinutes(10));
        var retry = (await worker.LeaseAsync())!;
        Assert.Equal(1, retry.Stage);
        var second = await CommitAsync(worker, retry, "2", ["docs/brief.md"]);
        (await worker.SucceedAsync(retry)).EnsureSuccessStatusCode();

        var row = Assert.Single(Stage(await ArtifactsAsync(owner, projectId), 1));
        Assert.Equal(second, row.GetProperty("sha").GetString());
    }

    [Fact]
    public async Task Commits_to_a_branch_are_not_artifacts_of_the_default_branch()
    {
        var (owner, projectId) = await SubmitAsync();
        var worker = await _factory.RegisterWorkerAsync();
        var scaffold = await LeaseStageAsync(worker, 6);

        await CommitAsync(worker, scaffold, "2", ["src/app.ts"], branch: "hewn/scaffold");
        (await worker.SucceedAsync(scaffold)).EnsureSuccessStatusCode();

        Assert.DoesNotContain(
            (await ArtifactsAsync(owner, projectId)).GetProperty("stages").EnumerateArray(),
            s => s.GetProperty("stage").GetInt32() == 6);
    }

    [Fact]
    public async Task A_new_project_has_no_artifacts_Viewers_can_read_them_and_an_unknown_project_is_404()
    {
        var (_, projectId) = await SubmitAsync();
        var viewer = await _factory.SignInAsync("ada", Role.Viewer);

        var artifacts = await ArtifactsAsync(viewer, projectId);

        Assert.Empty(artifacts.GetProperty("stages").EnumerateArray());
        Assert.Equal(HttpStatusCode.NotFound, (await viewer.GetAsync($"/api/projects/{Guid.NewGuid()}/artifacts")).StatusCode);
        using var anonymous = _factory.CreateClient();
        Assert.Equal(HttpStatusCode.Unauthorized, (await anonymous.GetAsync($"/api/projects/{projectId}/artifacts")).StatusCode);
    }
}

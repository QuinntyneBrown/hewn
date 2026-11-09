// Acceptance Test
// Traces to: L2-009, L2-010, L2-012, L2-013, L2-014, L2-016, L2-017, L2-018, L2-019
// Description: Document stages read the repository as an archive and may write only their own documents and the decision log

using System.Formats.Tar;
using System.IO.Compression;
using System.Net;
using System.Net.Http.Json;
using System.Text;
using Hewn.Api.Tests.Support;
using Hewn.Domain;

namespace Hewn.Api.Tests.Pipeline;

public sealed class DocumentStageTests : IAsyncLifetime
{
    private readonly HewnApiFactory _factory = new();

    public Task InitializeAsync() => Task.CompletedTask;

    public async Task DisposeAsync() => await _factory.DisposeAsync();

    /// <summary>Submits a direction and completes runs until the given stage is leased.</summary>
    private async Task<(WorkerClient Worker, LeasedRun Run)> LeaseStageAsync(int stage)
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
        var worker = await _factory.RegisterWorkerAsync();
        while (true)
        {
            var run = await worker.LeaseAsync() ?? throw new InvalidOperationException($"Stage {stage} was never offered.");
            if (run.Stage == stage)
            {
                return (worker, run);
            }

            (await worker.SucceedAsync(run)).EnsureSuccessStatusCode();
        }
    }

    private static Task<HttpResponseMessage> CommitAsync(WorkerClient worker, LeasedRun run, params string[] paths) =>
        worker.Http.PostAsJsonAsync($"/api/worker/runs/{run.RunId}/github/mutations", new
        {
            workerId = worker.WorkerId,
            epoch = run.Epoch,
            kind = "commit",
            idempotencyKey = $"{run.RunId}/1/commit",
            message = $"Write stage {run.Stage} documents",
            files = paths.Select(p => new { path = p, contentBase64 = Convert.ToBase64String(Encoding.UTF8.GetBytes("# Doc\n")) }),
        });

    [Fact]
    public async Task The_repository_archive_holds_the_default_branch_under_one_top_level_folder()
    {
        var (worker, run) = await LeaseStageAsync(1);
        _factory.GitHub.Repository("hewn-builds", "ledgerline")!.Write(".claude/skills/grilling/SKILL.md", "# Grilling");

        var response = await worker.Http.GetAsync($"/api/worker/runs/{run.RunId}/repository/archive?workerId={worker.WorkerId}&epoch={run.Epoch}");

        response.EnsureSuccessStatusCode();
        Assert.Equal("application/gzip", response.Content.Headers.ContentType?.MediaType);
        var entries = await ReadArchiveAsync(await response.Content.ReadAsStreamAsync());
        var top = entries.Keys.Select(k => k.Split('/')[0]).Distinct().Single();
        Assert.StartsWith("ledgerline-", top);
        Assert.Equal("# Grilling", entries[$"{top}/.claude/skills/grilling/SKILL.md"]);
        Assert.True(entries.ContainsKey($"{top}/README.md"));
    }

    [Fact]
    public async Task The_archive_is_fenced_by_the_lease()
    {
        var (worker, run) = await LeaseStageAsync(1);

        var response = await worker.Http.GetAsync($"/api/worker/runs/{run.RunId}/repository/archive?workerId={worker.WorkerId}&epoch={run.Epoch + 1}");

        Assert.Equal(HttpStatusCode.Conflict, response.StatusCode);
    }

    [Theory]
    [InlineData(1, "docs/brief.md")]
    [InlineData(2, "docs/mocks/manifest.json")]
    [InlineData(2, "docs/mocks/sign-in/default.html")]
    [InlineData(3, "docs/design-system/tokens.json")]
    [InlineData(3, "docs/design-system/components/button.html")]
    [InlineData(4, "docs/adr/0001-stack.md")]
    [InlineData(5, "docs/specs/L1.md")]
    [InlineData(5, "docs/specs/L2.md")]
    [InlineData(7, "docs/detailed-designs/ledger/import-statements/README.md")]
    [InlineData(7, "docs/detailed-designs/ledger/import-statements/diagrams/class.puml")]
    [InlineData(8, "docs/journeys.md")]
    [InlineData(9, "docs/estimates/README.md")]
    [InlineData(9, "docs/estimates/ledger.md")]
    [InlineData(9, "docs/specs/L2.md")]
    [InlineData(9, "docs/detailed-designs/ledger/import-csv/README.md")]
    public async Task Each_document_stage_may_write_its_own_documents_and_the_decision_log(int stage, string path)
    {
        var (worker, run) = await LeaseStageAsync(stage);

        var response = await CommitAsync(worker, run, path, "docs/decisions.md");

        response.EnsureSuccessStatusCode();
        Assert.Equal("# Doc\n", _factory.GitHub.Repository("hewn-builds", "ledgerline")!.Read(path));
    }

    [Theory]
    [InlineData(1, "docs/specs/L1.md")]
    [InlineData(2, "docs/design-system/tokens.json")]
    [InlineData(3, "docs/mocks/sign-in/default.html")]
    [InlineData(4, "docs/brief.md")]
    [InlineData(5, "src/app.ts")]
    [InlineData(7, "docs/journeys.md")]
    [InlineData(8, ".claude/skills/grilling/SKILL.md")]
    [InlineData(9, "docs/specs/L1.md")]
    [InlineData(9, "docs/journeys.md")]
    public async Task A_document_stage_may_not_write_another_stages_documents(int stage, string path)
    {
        var (worker, run) = await LeaseStageAsync(stage);

        var response = await CommitAsync(worker, run, path);

        Assert.Equal(HttpStatusCode.BadRequest, response.StatusCode);
        Assert.Equal("path_not_allowed", (await HewnClient.ReadJsonAsync(response)).GetProperty("code").GetString());
    }

    private static async Task<Dictionary<string, string>> ReadArchiveAsync(Stream body)
    {
        var entries = new Dictionary<string, string>();
        await using var gzip = new GZipStream(body, CompressionMode.Decompress);
        await using var tar = new TarReader(gzip);
        while (await tar.GetNextEntryAsync() is { } entry)
        {
            if (entry.EntryType is TarEntryType.RegularFile or TarEntryType.V7RegularFile && entry.DataStream is not null)
            {
                using var reader = new StreamReader(entry.DataStream);
                entries[entry.Name] = await reader.ReadToEndAsync();
            }
        }

        return entries;
    }
}

// Acceptance Test
// Traces to: L2-040
// Description: A log line, event or pull request body holding a stored credential's value or a GitHub, Anthropic or
// Azure token has it replaced with *** before it is stored or sent (AC2)

using System.Net;
using System.Net.Http.Json;
using System.Text;
using System.Text.Json;
using Hewn.Api.Logging;
using Hewn.Api.Tests.Support;
using Hewn.Application.Abstractions;
using Hewn.Domain;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.DependencyInjection;
using Microsoft.Extensions.DependencyInjection.Extensions;

namespace Hewn.Api.Tests.Settings;

public sealed class RedactSecretsTests : IAsyncLifetime
{
    private const string Stored = "plain-credential-value-with-no-pattern-7c1e5b";
    private const string GitHubToken = "ghp_0123456789abcdefghijklmnopqrstuvwxyzAB";
    private const string AnthropicKey = "sk-ant-api03-AbCdEf0123456789xyzXYZ-abcdefgh";
    private const string AzureKey = "Zm9vYmFyYmF6cXV4MDEyMzQ1Njc4OWFiY2RlZg==";
    private const string AzureSignature = "AbCdEf0123456789%2Bxyz%3D";
    private const string AzureClientSecret = "abc8Q~0123456789abcdefghijklmnopqrstuvw";

    private static readonly string[] Secrets = [Stored, GitHubToken, AnthropicKey, AzureKey, AzureSignature, AzureClientSecret];

    private readonly StringWriter _output = new();
    private readonly HewnApiFactory _factory;

    public RedactSecretsTests()
    {
        _factory = new HewnApiFactory().WithServices(services =>
        {
            services.RemoveAll<LogSink>();
            services.AddSingleton(new LogSink(TextWriter.Synchronized(_output)));
        });
    }

    public async Task InitializeAsync() =>
        await _factory.Services.GetRequiredService<ISecretStore>().SetAsync("model-api-key", Stored, CancellationToken.None);

    public async Task DisposeAsync() => await _factory.DisposeAsync();

    /// <summary>Text an agent might write, with every kind of secret in it.</summary>
    private const string Leaky =
        $"calling the model with {AnthropicKey} and {Stored}; " +
        $"git push https://x:{GitHubToken}@github.com; " +
        $"storage DefaultEndpointsProtocol=https;AccountName=hewn;AccountKey={AzureKey};EndpointSuffix=core.windows.net; " +
        $"blob ?sv=2024-01-01&sig={AzureSignature}&se=2026; client secret {AzureClientSecret}";

    private const string Masked =
        "calling the model with *** and ***; " +
        "git push https://x:***@github.com; " +
        "storage DefaultEndpointsProtocol=https;AccountName=hewn;AccountKey=***;EndpointSuffix=core.windows.net; " +
        "blob ?sv=2024-01-01&sig=***&se=2026; client secret ***";

    private async Task<(WorkerClient Worker, LeasedRun Run)> LeaseStageAsync(int stage)
    {
        var owner = await _factory.SignInAsync("quinntynebrown", Role.Owner);
        (await owner.PostAsync("/api/projects", new
        {
            name = "Ledgerline",
            idea = "A web app for small accounting teams to reconcile statements.",
            stackPreference = (string?)null,
            repositoryUrl = (string?)null,
            budgetUsd = 300m,
        })).EnsureSuccessStatusCode();
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

    private static Task<HttpResponseMessage> MutateAsync(WorkerClient worker, LeasedRun run, string kind, string key, object fields)
    {
        var body = JsonSerializer.SerializeToElement(fields).EnumerateObject().ToDictionary(p => p.Name, p => (object?)p.Value);
        body["workerId"] = worker.WorkerId;
        body["epoch"] = run.Epoch;
        body["kind"] = kind;
        body["idempotencyKey"] = $"{run.RunId}/{key}";
        return worker.Http.PostAsJsonAsync($"/api/worker/runs/{run.RunId}/github/mutations", body);
    }

    [Fact]
    public async Task A_log_line_and_its_event_hold_three_stars_where_a_secret_was()
    {
        var (worker, run) = await LeaseStageAsync(0);
        var sent = await worker.Http.PostAsJsonAsync($"/api/worker/runs/{run.RunId}/logs", new
        {
            workerId = worker.WorkerId,
            epoch = run.Epoch,
            lines = new[] { new { level = "info", text = Leaky } },
        });
        Assert.Equal(HttpStatusCode.NoContent, sent.StatusCode);
        Assert.Equal(HttpStatusCode.NoContent, (await worker.FailAsync(run, $"model call refused: {Leaky}")).StatusCode);

        var (lines, events) = await _factory.QueryAsync(async db => (
            await db.RunLogLines.AsNoTracking().Where(l => l.RunId == run.RunId).OrderBy(l => l.Sequence).Select(l => l.Text).ToListAsync(),
            await db.Events.AsNoTracking().Where(e => e.ProjectId == run.ProjectId).Select(e => e.Payload).ToListAsync()));
        Assert.Equal(Masked, lines[0]);
        Assert.All(lines, line => Assert.DoesNotContain("sk-ant", line));
        Assert.Contains(events, e => e.Contains(JsonEncodedText.Encode(Masked).ToString()));
        foreach (var secret in Secrets)
        {
            Assert.DoesNotContain(events, e => e.Contains(secret) || e.Contains(JsonEncodedText.Encode(secret).ToString()));
            Assert.DoesNotContain(secret, _output.ToString());
        }

        // The server's own log of the failure is redacted the same way.
        Assert.Contains(_output.ToString().Split('\n'), l => l.Contains("Run failed: model call refused: calling the model with *** and ***"));
    }

    [Fact]
    public async Task A_pull_request_s_title_and_body_reach_GitHub_with_three_stars_where_a_secret_was()
    {
        var (worker, run) = await LeaseStageAsync(6);
        (await MutateAsync(worker, run, "commit", "2/commit", new
        {
            message = "Scaffold the solution",
            branch = "hewn/scaffold",
            files = new[] { new { path = "README.md", contentBase64 = Convert.ToBase64String(Encoding.UTF8.GetBytes("# Ledgerline\n")) } },
        })).EnsureSuccessStatusCode();

        var opened = await MutateAsync(worker, run, "open_pull_request", "2/pull-request", new
        {
            head = "hewn/scaffold",
            title = $"Scaffold with {GitHubToken}",
            body = $"## Notes\n{Leaky}\n",
        });

        Assert.Equal(HttpStatusCode.OK, opened.StatusCode);
        var pull = Assert.Single(_factory.GitHub.Repository("hewn-builds", "ledgerline")!.PullRequests);
        Assert.Equal("Scaffold with ***", pull.Title);
        Assert.Equal($"## Notes\n{Masked}\n", pull.Body);
    }
}

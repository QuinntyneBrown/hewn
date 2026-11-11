// Acceptance Test
// Traces to: L2-049
// Description: A scrape of /metrics, with the metrics token, exports stage duration, stage outcomes (the success
// rate), queue depth, active workers, event latency, tokens and spend (AC3); without the token it is refused

using System.Net;
using System.Net.Http.Headers;
using System.Net.Http.Json;
using System.Text.RegularExpressions;
using Hewn.Api.Tests.Support;
using Hewn.Domain;

namespace Hewn.Api.Tests.Operations;

/// <summary>Meter listeners are process-wide, so these run alone: no other test's host adds to the numbers.</summary>
[CollectionDefinition(nameof(MetricsCollection), DisableParallelization = true)]
public sealed class MetricsCollection;

[Collection(nameof(MetricsCollection))]
public sealed class MetricsTests : IAsyncLifetime
{
    private const string ScrapeToken = "metrics-scrape-token-for-tests";
    private readonly HewnApiFactory _factory = new HewnApiFactory().WithSettings(("HEWN_METRICS_TOKEN", ScrapeToken));

    public Task InitializeAsync() => Task.CompletedTask;

    public async Task DisposeAsync() => await _factory.DisposeAsync();

    private async Task<HttpResponseMessage> ScrapeAsync(string? token)
    {
        var request = new HttpRequestMessage(HttpMethod.Get, "/metrics");
        if (token is not null)
        {
            request.Headers.Authorization = new AuthenticationHeaderValue("Bearer", token);
        }

        return await _factory.CreateClient().SendAsync(request);
    }

    private static double Value(string scrape, string metric, params string[] labels)
    {
        var line = scrape.Split('\n').FirstOrDefault(l =>
            Regex.IsMatch(l, $"^{Regex.Escape(metric)}(\\{{|\\s)") && labels.All(label => l.Contains(label)));
        Assert.True(line is not null, $"No {metric} {string.Join(",", labels)} in:\n{scrape}");
        return double.Parse(Regex.Match(line!, @"\}?\s+([-+0-9.eE]+)(\s+\d+)?\s*$").Groups[1].Value, System.Globalization.CultureInfo.InvariantCulture);
    }

    [Fact]
    public async Task A_scrape_without_the_metrics_token_is_refused()
    {
        Assert.Equal(HttpStatusCode.Unauthorized, (await ScrapeAsync(null)).StatusCode);
        Assert.Equal(HttpStatusCode.Unauthorized, (await ScrapeAsync("not-the-token")).StatusCode);
    }

    [Fact]
    public async Task With_no_metrics_token_configured_there_is_no_metrics_endpoint()
    {
        await using var bare = new HewnApiFactory();
        var response = await bare.CreateClient().GetAsync("/metrics");
        Assert.Equal(HttpStatusCode.NotFound, response.StatusCode);
    }

    [Fact]
    public async Task A_scrape_exports_stage_duration_and_outcomes_queue_depth_active_workers_event_latency_tokens_and_spend()
    {
        var owner = await _factory.SignInAsync("quinntynebrown", Role.Owner);
        var submitted = await owner.PostAsync("/api/projects", new
        {
            name = "Seed Swap",
            idea = "A seed swap register for a community garden.",
            stackPreference = (string?)null,
            repositoryUrl = (string?)null,
            budgetUsd = 300m,
        });
        Assert.Equal(HttpStatusCode.Created, submitted.StatusCode);
        var worker = await _factory.RegisterWorkerAsync("worker-a");
        var run = (await worker.LeaseAsync())!;
        var call = await worker.Http.PostAsJsonAsync($"/api/worker/runs/{run.RunId}/model-calls", new
        {
            workerId = worker.WorkerId,
            epoch = run.Epoch,
            callId = "call-1",
            model = "claude-opus-5-5",
            inputTokens = 1200,
            outputTokens = 300,
        });
        call.EnsureSuccessStatusCode();
        _factory.Clock.Advance(TimeSpan.FromSeconds(42));
        Assert.Equal(HttpStatusCode.NoContent, (await worker.SucceedAsync(run)).StatusCode);

        var response = await ScrapeAsync(ScrapeToken);
        Assert.Equal(HttpStatusCode.OK, response.StatusCode);
        var scrape = await response.Content.ReadAsStringAsync();

        // Stage 0 took 42 s and succeeded; stage 1 is now queued for the one worker that is online.
        Assert.Equal(1, Value(scrape, "hewn_stage_duration_seconds_count", "stage=\"0\"", "outcome=\"Succeeded\""));
        Assert.Equal(42, Value(scrape, "hewn_stage_duration_seconds_sum", "stage=\"0\""), 1);
        Assert.Equal(1, Value(scrape, "hewn_stage_runs_total", "stage=\"0\"", "outcome=\"Succeeded\""));
        Assert.Equal(1, Value(scrape, "hewn_queue_depth"));
        Assert.Equal(1, Value(scrape, "hewn_workers_active"));
        Assert.True(Value(scrape, "hewn_event_latency_seconds_count") > 0);
        Assert.Equal(1200, Value(scrape, "hewn_model_tokens_total", "kind=\"input\"", "model=\"claude-opus-5-5\""));
        Assert.Equal(300, Value(scrape, "hewn_model_tokens_total", "kind=\"output\"", "model=\"claude-opus-5-5\""));
        Assert.True(Value(scrape, "hewn_spend_usd_total", "model=\"claude-opus-5-5\"") > 0);
    }
}

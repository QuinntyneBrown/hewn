// Acceptance Test
// Traces to: L2-049
// Description: A run's trace starts with the request that queued it, records the time it waited in the queue, and is
// handed to the worker with the lease, so the worker's calls back to the API and its model calls join the same trace
// ID (AC2); the lease is logged with that trace ID (AC1)

using System.Diagnostics;
using System.Net;
using System.Net.Http.Json;
using System.Text.Json;
using Hewn.Api.Logging;
using Hewn.Api.Tests.Support;
using Hewn.Domain;
using Microsoft.Extensions.DependencyInjection;
using Microsoft.Extensions.DependencyInjection.Extensions;
using OpenTelemetry.Trace;

namespace Hewn.Api.Tests.Operations;

public sealed class RunTraceTests : IAsyncLifetime
{
    private readonly List<Activity> _spans = [];
    private readonly StringWriter _logs = new();
    private readonly HewnApiFactory _factory;

    public RunTraceTests()
    {
        _factory = new HewnApiFactory().WithServices(services =>
        {
            services.AddOpenTelemetry().WithTracing(tracing => tracing.AddInMemoryExporter(_spans));
            services.RemoveAll<LogSink>();
            services.AddSingleton(new LogSink(TextWriter.Synchronized(_logs)));
        });
    }

    public Task InitializeAsync() => Task.CompletedTask;

    public async Task DisposeAsync() => await _factory.DisposeAsync();

    private static HttpRequestMessage Traced(HttpMethod method, string url, string traceParent, object body) =>
        new(method, url) { Content = JsonContent.Create(body), Headers = { { "traceparent", traceParent } } };

    [Fact]
    public async Task A_run_is_one_trace_from_the_request_that_queued_it_through_the_queue_the_worker_and_its_model_calls()
    {
        var traceId = ActivityTraceId.CreateRandom().ToHexString();
        var owner = await _factory.SignInAsync("quinntynebrown", Role.Owner);
        var submitted = await owner.SendAsync("POST", "/api/projects", new
        {
            name = "Seed Swap",
            idea = "A seed swap register for a community garden.",
            stackPreference = (string?)null,
            repositoryUrl = (string?)null,
            budgetUsd = 300m,
        }, new Dictionary<string, string> { ["traceparent"] = $"00-{traceId}-{ActivitySpanId.CreateRandom().ToHexString()}-01" });
        Assert.Equal(HttpStatusCode.Created, submitted.StatusCode);

        var worker = await _factory.RegisterWorkerAsync("worker-a");
        _factory.Clock.Advance(TimeSpan.FromSeconds(3));
        var run = (await worker.LeaseAsync())!;

        // The lease hands the worker the trace to continue.
        var leaseParent = run.Body.GetProperty("traceParent").GetString()!;
        Assert.Matches($"^00-{traceId}-[0-9a-f]{{16}}-01$", leaseParent);
        // Listeners are process-wide, so other tests' spans arrive here too: look only at this trace.
        var queued = Assert.Single(_spans, s => s.DisplayName == "Run queued" && s.TraceId.ToHexString() == traceId);
        Assert.Equal(traceId, queued.TraceId.ToHexString());
        Assert.Equal(leaseParent.Split('-')[2], queued.SpanId.ToHexString());
        Assert.InRange(queued.Duration.TotalSeconds, 2.5, 3.5);
        Assert.Equal(run.RunId.ToString(), queued.GetTagItem("hewn.run.id"));

        // The worker's calls carry it: a model call and the result join the trace as children of the worker's span.
        var workerSpan = $"00-{traceId}-{ActivitySpanId.CreateRandom().ToHexString()}-01";
        var modelCall = await worker.Http.SendAsync(Traced(HttpMethod.Post, $"/api/worker/runs/{run.RunId}/model-calls", workerSpan, new
        {
            workerId = worker.WorkerId,
            epoch = run.Epoch,
            callId = "call-1",
            model = "claude-opus-5-5",
            inputTokens = 1200,
            outputTokens = 300,
        }));
        modelCall.EnsureSuccessStatusCode();
        var result = await worker.Http.SendAsync(Traced(HttpMethod.Post, $"/api/worker/runs/{run.RunId}/result", workerSpan, new
        {
            workerId = worker.WorkerId,
            epoch = run.Epoch,
            outcome = "Succeeded",
        }));
        Assert.Equal(HttpStatusCode.NoContent, result.StatusCode);
        foreach (var path in new[] { "model-calls", "result" })
        {
            var server = Assert.Single(_spans, s => s.Kind == ActivityKind.Server && s.TraceId.ToHexString() == traceId && s.GetTagItem("url.path") is string p && p.EndsWith(path));
            Assert.Equal(traceId, server.TraceId.ToHexString());
            Assert.Equal(workerSpan.Split('-')[2], server.ParentSpanId.ToHexString());
        }

        // The lease's log line carries the run's trace, not the idle worker's.
        var leased = _logs.ToString().Split('\n', StringSplitOptions.RemoveEmptyEntries)
            .Select(l => JsonDocument.Parse(l).RootElement)
            .Single(l => l.GetProperty("message").GetString()!.StartsWith("Leased run"));
        Assert.Equal(traceId, leased.GetProperty("traceId").GetString());
    }
}

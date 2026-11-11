// Acceptance Test
// Traces to: L2-049
// Description: Every server log entry is one line of JSON with timestamp, level and message, and carries the project,
// direction, stage, run and trace IDs where they apply (AC1); secrets in a message are redacted (L2-040)

using System.Net;
using System.Text.Json;
using Hewn.Api.Logging;
using Hewn.Api.Tests.Support;
using Hewn.Domain;
using Microsoft.Extensions.DependencyInjection;
using Microsoft.Extensions.DependencyInjection.Extensions;

namespace Hewn.Api.Tests.Operations;

public sealed class StructuredLogTests : IAsyncLifetime
{
    private const string Token = "ghp_0123456789abcdefghijklmnopqrstuvwxyzAB";
    private readonly StringWriter _output = new();
    private readonly HewnApiFactory _factory;

    public StructuredLogTests()
    {
        _factory = new HewnApiFactory().WithServices(services =>
        {
            services.RemoveAll<LogSink>();
            services.AddSingleton(new LogSink(TextWriter.Synchronized(_output)));
        });
    }

    public Task InitializeAsync() => Task.CompletedTask;

    public async Task DisposeAsync() => await _factory.DisposeAsync();

    private List<JsonElement> Lines() =>
        _output.ToString().Split('\n', StringSplitOptions.RemoveEmptyEntries).Select(l => JsonDocument.Parse(l).RootElement).ToList();

    [Fact]
    public async Task A_runs_log_entries_are_JSON_with_its_project_direction_stage_run_and_trace_IDs_and_no_secrets()
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
        var directionId = run.Body.GetProperty("directionId").GetGuid();
        Assert.Equal(HttpStatusCode.NoContent, (await worker.FailAsync(run, $"git push failed: remote rejected {Token}")).StatusCode);
        _factory.Clock.Advance(TimeSpan.FromMinutes(5));
        var retry = (await worker.LeaseAsync())!;
        Assert.Equal(HttpStatusCode.NoContent, (await worker.SucceedAsync(retry)).StatusCode);

        var lines = Lines();
        Assert.NotEmpty(lines);
        foreach (var line in lines)
        {
            Assert.True(DateTimeOffset.TryParse(line.GetProperty("timestamp").GetString(), out _), line.ToString());
            Assert.Contains(line.GetProperty("level").GetString(), new[] { "Trace", "Debug", "Information", "Warning", "Error", "Critical" });
            Assert.False(string.IsNullOrWhiteSpace(line.GetProperty("message").GetString()));
        }

        foreach (var (message, id) in new[] { ("Leased run", run.RunId), ("Run failed", run.RunId), ("Leased run", retry.RunId), ("Run succeeded", retry.RunId) })
        {
            var entry = lines.Single(l => l.GetProperty("message").GetString()!.StartsWith(message) && l.TryGetProperty("runId", out var r) && r.GetString() == id.ToString());
            Assert.Equal(run.ProjectId.ToString(), entry.GetProperty("projectId").GetString());
            Assert.Equal(directionId.ToString(), entry.GetProperty("directionId").GetString());
            Assert.Equal(0, entry.GetProperty("stage").GetInt32());
            Assert.Matches("^[0-9a-f]{32}$", entry.GetProperty("traceId").GetString());
        }

        Assert.DoesNotContain(Token, _output.ToString());
        Assert.Contains("[redacted]", lines.Single(l => l.GetProperty("message").GetString()!.StartsWith("Run failed")).GetProperty("message").GetString());
    }
}

using System.Net;
using System.Net.Http.Headers;
using System.Net.Http.Json;
using System.Text.Json;

namespace Hewn.Api.Tests.Support;

/// <summary>Speaks the worker protocol over HTTP with the worker token, the way the TypeScript worker does.</summary>
public sealed class WorkerClient
{
    private readonly HttpClient _http;

    private WorkerClient(HttpClient http, string workerId)
    {
        _http = http;
        WorkerId = workerId;
    }

    public string WorkerId { get; }

    /// <summary>The worker-token client, for protocol calls the helpers don't wrap.</summary>
    public HttpClient Http => _http;

    public static async Task<WorkerClient> RegisterAsync(HttpClient http, string token, string name = "test-worker", string location = "Local")
    {
        http.DefaultRequestHeaders.Authorization = new AuthenticationHeaderValue("Bearer", token);
        var response = await http.PostAsJsonAsync("/api/worker/register", new { name, location, host = "test-host", version = "0.0.0-test" });
        response.EnsureSuccessStatusCode();
        var body = await HewnClient.ReadJsonAsync(response);
        return new WorkerClient(http, body.GetProperty("workerId").GetString()!);
    }

    /// <summary>Returns the leased run, or null when there is no work.</summary>
    /// <summary>Asks for a run; with <paramref name="waitSeconds"/>, the API holds the request until work is queued or the wait ends.</summary>
    public async Task<LeasedRun?> LeaseAsync(int waitSeconds = 0)
    {
        var path = waitSeconds > 0 ? $"/api/worker/lease?waitSeconds={waitSeconds}" : "/api/worker/lease";
        var response = await _http.PostAsJsonAsync(path, new { workerId = WorkerId });
        if (response.StatusCode == HttpStatusCode.NoContent)
        {
            return null;
        }

        response.EnsureSuccessStatusCode();
        var body = await HewnClient.ReadJsonAsync(response);
        return new LeasedRun(
            body.GetProperty("runId").GetGuid(),
            body.GetProperty("epoch").GetInt64(),
            body.GetProperty("projectId").GetGuid(),
            body.GetProperty("stage").GetInt32(),
            body.GetProperty("checkpointStep").GetInt32(),
            body);
    }

    public Task<HttpResponseMessage> HeartbeatAsync(LeasedRun run, long? epoch = null) =>
        _http.PostAsJsonAsync($"/api/worker/runs/{run.RunId}/heartbeat", new { workerId = WorkerId, epoch = epoch ?? run.Epoch });

    public Task<HttpResponseMessage> CheckpointAsync(LeasedRun run, int step, long? epoch = null) =>
        _http.PostAsJsonAsync($"/api/worker/runs/{run.RunId}/checkpoints", new { workerId = WorkerId, epoch = epoch ?? run.Epoch, step, sha = (string?)null });

    public Task<HttpResponseMessage> SucceedAsync(LeasedRun run, long? epoch = null) =>
        _http.PostAsJsonAsync($"/api/worker/runs/{run.RunId}/result", new { workerId = WorkerId, epoch = epoch ?? run.Epoch, outcome = "Succeeded" });

    public Task<HttpResponseMessage> FailAsync(LeasedRun run, string error) =>
        _http.PostAsJsonAsync($"/api/worker/runs/{run.RunId}/result", new { workerId = WorkerId, epoch = run.Epoch, outcome = "Failed", error });

    /// <summary>Leases and completes runs until there is no work left. Returns the stages in the order they ran.</summary>
    public async Task<List<int>> RunUntilIdleAsync(int maxRuns = 50)
    {
        var stages = new List<int>();
        for (var i = 0; i < maxRuns; i++)
        {
            var run = await LeaseAsync();
            if (run is null)
            {
                return stages;
            }

            stages.Add(run.Stage);
            (await HeartbeatAsync(run)).EnsureSuccessStatusCode();
            (await CheckpointAsync(run, 1)).EnsureSuccessStatusCode();
            (await SucceedAsync(run)).EnsureSuccessStatusCode();
        }

        throw new InvalidOperationException("Work never ran out.");
    }
}

public sealed record LeasedRun(Guid RunId, long Epoch, Guid ProjectId, int Stage, int CheckpointStep, JsonElement Body);

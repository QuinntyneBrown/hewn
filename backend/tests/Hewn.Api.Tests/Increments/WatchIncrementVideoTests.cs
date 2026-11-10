// Acceptance Test
// Traces to: L2-023
// Description: A recorded increment video is played in Mission Control: GET /api/projects/{id}/increments/{n} links the MP4 and its captions, which are served from the commit that recorded them, with byte ranges for seeking (AC2); a failed video has no player, only its reason (AC3)

using System.Net;
using System.Net.Http.Headers;
using System.Net.Http.Json;
using System.Text;
using System.Text.Json;
using Hewn.Api.Tests.Support;
using Hewn.Domain;

namespace Hewn.Api.Tests.Increments;

public sealed class WatchIncrementVideoTests : IAsyncLifetime
{
    private const string Branch = "feature/sign-in";
    private const string Folder = "docs/videos/sign-in/";

    private static readonly byte[] Mp4 = [.. Enumerable.Range(0, 4096).Select(i => (byte)(i % 251))];
    private const string Vtt = "WEBVTT\n\n00:00.000 --> 00:03.000\nSign in with GitHub\n";

    private readonly HewnApiFactory _factory = new();

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

    /// <summary>Commits the video to the increment's branch as stage 10 does, then a later fix, and reports it Recorded.</summary>
    private async Task<(HewnClient Owner, Guid ProjectId)> RecordedAsync()
    {
        var (owner, projectId, worker, run) = await LeaseIncrementsAsync();
        await UpdateAsync(worker, run, 1, new { status = "InProgress" });
        (await MutateAsync(worker, run, "commit", "i1/video", new
        {
            message = "Record the video for Sign in",
            branch = Branch,
            files = new object[]
            {
                new { path = $"{Folder}sign-in.mp4", contentBase64 = Convert.ToBase64String(Mp4) },
                new { path = $"{Folder}sign-in.vtt", contentBase64 = Convert.ToBase64String(Encoding.UTF8.GetBytes(Vtt)) },
                new { path = $"{Folder}script.md", contentBase64 = Convert.ToBase64String(Encoding.UTF8.GetBytes("# Sign in\n")) },
            },
        })).EnsureSuccessStatusCode();
        await UpdateAsync(worker, run, 1, new { status = "InProgress", video = "Recorded", videoNote = Folder });
        return (owner, projectId);
    }

    private static async Task<JsonElement> IncrementAsync(HewnClient client, Guid projectId)
    {
        var response = await client.GetAsync($"/api/projects/{projectId}/increments/1");
        Assert.Equal(HttpStatusCode.OK, response.StatusCode);
        return await HewnClient.ReadJsonAsync(response);
    }

    [Fact]
    public async Task A_recorded_video_and_its_captions_are_served_from_the_commit_that_recorded_them()
    {
        var (owner, projectId) = await RecordedAsync();

        var increment = await IncrementAsync(owner, projectId);
        var video = increment.GetProperty("videoUrl").GetString();
        var captions = increment.GetProperty("captionsUrl").GetString();
        Assert.Equal($"/api/projects/{projectId}/increments/1/video", video);
        Assert.Equal($"/api/projects/{projectId}/increments/1/video/captions", captions);

        var mp4 = await owner.GetAsync(video!);
        Assert.Equal(HttpStatusCode.OK, mp4.StatusCode);
        Assert.Equal("video/mp4", mp4.Content.Headers.ContentType!.MediaType);
        Assert.Equal(Mp4, await mp4.Content.ReadAsByteArrayAsync());

        var vtt = await owner.GetAsync(captions!);
        Assert.Equal(HttpStatusCode.OK, vtt.StatusCode);
        Assert.Equal("text/vtt", vtt.Content.Headers.ContentType!.MediaType);
        Assert.Equal(Vtt, await vtt.Content.ReadAsStringAsync());
    }

    [Fact]
    public async Task The_video_answers_a_byte_range_so_the_player_can_seek()
    {
        var (owner, projectId) = await RecordedAsync();
        using var request = new HttpRequestMessage(HttpMethod.Get, $"/api/projects/{projectId}/increments/1/video");
        request.Headers.Range = new RangeHeaderValue(1000, 1099);

        var response = await owner.SendAsync(request);

        Assert.Equal(HttpStatusCode.PartialContent, response.StatusCode);
        Assert.Equal(Mp4[1000..1100], await response.Content.ReadAsByteArrayAsync());
        Assert.Equal(4096, response.Content.Headers.ContentRange!.Length);
    }

    [Fact]
    public async Task A_failed_video_has_no_player_and_its_reason_is_kept()
    {
        var (owner, projectId, worker, run) = await LeaseIncrementsAsync();
        await UpdateAsync(worker, run, 1, new { status = "InProgress", video = "Failed", videoNote = "browser crashed during capture" });

        var increment = await IncrementAsync(owner, projectId);

        Assert.Equal("Failed", increment.GetProperty("video").GetString());
        Assert.Equal("browser crashed during capture", increment.GetProperty("videoNote").GetString());
        Assert.Equal(JsonValueKind.Null, increment.GetProperty("videoUrl").ValueKind);
        var response = await owner.GetAsync($"/api/projects/{projectId}/increments/1/video");
        Assert.Equal(HttpStatusCode.NotFound, response.StatusCode);
        Assert.Equal("no_video", (await HewnClient.ReadJsonAsync(response)).GetProperty("code").GetString());
    }

    [Fact]
    public async Task Viewers_watch_the_video_and_others_cannot()
    {
        var (_, projectId) = await RecordedAsync();
        var viewer = await _factory.SignInAsync("ada", Role.Viewer);

        Assert.Equal(HttpStatusCode.OK, (await viewer.GetAsync($"/api/projects/{projectId}/increments/1/video")).StatusCode);
        Assert.Equal(HttpStatusCode.NotFound, (await viewer.GetAsync($"/api/projects/{Guid.NewGuid()}/increments/1/video")).StatusCode);
        Assert.Equal(HttpStatusCode.NotFound, (await viewer.GetAsync($"/api/projects/{projectId}/increments/9/video")).StatusCode);
        using var anonymous = _factory.CreateAnonymousClient();
        Assert.Equal(HttpStatusCode.Unauthorized, (await anonymous.GetAsync($"/api/projects/{projectId}/increments/1/video")).StatusCode);
    }
}

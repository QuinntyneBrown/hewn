// Acceptance Test
// Traces to: L2-041
// Description: An Owner creates a worker token that is shown once while only its hash is stored (AC1); a token stops working at its chosen expiry of 30 days, 90 days or 1 year (AC3); revoking a connected worker's token disconnects it within 10 seconds and releases its lease (AC2). Viewers can't create or revoke tokens.

using System.Diagnostics;
using System.Net;
using System.Net.Http.Headers;
using System.Net.Http.Json;
using System.Security.Cryptography;
using System.Text;
using System.Text.Json;
using Hewn.Api.Tests.Support;
using Hewn.Domain;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.DependencyInjection;

namespace Hewn.Api.Tests.Workers;

public sealed class WorkerTokenTests : IAsyncLifetime
{
    private readonly HewnApiFactory _factory = new();

    public Task InitializeAsync() => Task.CompletedTask;

    public async Task DisposeAsync() => await _factory.DisposeAsync();

    private static string Sha256Hex(string token) => Convert.ToHexStringLower(SHA256.HashData(Encoding.UTF8.GetBytes(token)));

    private async Task<JsonElement> CreateAsync(HewnClient owner, string name, int expiresInDays = 90, string location = "Cloud")
    {
        var response = await owner.PostAsync("/api/worker-tokens", new { name, location, expiresInDays });
        Assert.Equal(HttpStatusCode.Created, response.StatusCode);
        return await HewnClient.ReadJsonAsync(response);
    }

    private HttpClient WorkerHttp(string token)
    {
        var http = _factory.CreateAnonymousClient();
        http.DefaultRequestHeaders.Authorization = new AuthenticationHeaderValue("Bearer", token);
        return http;
    }

    [Fact]
    public async Task An_Owner_creates_a_token_that_is_shown_once_and_only_its_hash_is_stored()
    {
        var owner = await _factory.SignInAsync("quinntynebrown", Role.Owner);

        var created = await CreateAsync(owner, "hewn-cloud-eus-03");

        var token = created.GetProperty("token").GetString()!;
        Assert.Matches("^hwt_[A-Za-z0-9_-]{43}$", token);
        Assert.Equal("hewn-cloud-eus-03", created.GetProperty("name").GetString());
        Assert.Equal("Cloud", created.GetProperty("location").GetString());
        Assert.Equal(_factory.Clock.GetUtcNow().AddDays(90), created.GetProperty("expiresAt").GetDateTimeOffset());

        await using var scope = _factory.Services.CreateAsyncScope();
        var stored = await scope.ServiceProvider.GetRequiredService<Hewn.Infrastructure.Persistence.HewnDbContext>()
            .WorkerTokens.AsNoTracking().SingleAsync();
        Assert.Equal(Sha256Hex(token), stored.Hash);
        Assert.DoesNotContain(token, JsonSerializer.Serialize(stored));

        // The token works: a worker registers with it and is named and placed by the token, whatever it calls itself.
        var worker = await WorkerClient.RegisterAsync(_factory.CreateAnonymousClient(), token, "ip-10-0-3-17", "Local");
        Assert.NotNull(worker.WorkerId);

        // No API returns it again.
        var workers = await (await owner.GetAsync("/api/workers")).Content.ReadAsStringAsync();
        var row = (await HewnClient.ReadJsonAsync(await owner.GetAsync("/api/workers"))).GetProperty("workers")[0];
        Assert.Equal("hewn-cloud-eus-03", row.GetProperty("name").GetString());
        Assert.Equal("Cloud", row.GetProperty("location").GetString());
        Assert.Equal("test-host", row.GetProperty("host").GetString());
        Assert.DoesNotContain(token, workers);
        Assert.DoesNotContain(token[4..], workers);
    }

    [Theory]
    [InlineData("", "name")]
    [InlineData("Build Box", "name")]
    [InlineData("ab", "name")]
    public async Task A_name_must_be_3_to_40_lowercase_letters_digits_or_hyphens(string name, string field)
    {
        var owner = await _factory.SignInAsync("quinntynebrown", Role.Owner);

        var response = await owner.PostAsync("/api/worker-tokens", new { name, location = "Local", expiresInDays = 90 });

        Assert.Equal(HttpStatusCode.BadRequest, response.StatusCode);
        var problem = await HewnClient.ReadJsonAsync(response);
        Assert.Equal("Worker name must be 3–40 lowercase letters, digits or hyphens.", problem.GetProperty("errors").GetProperty(field)[0].GetString());
    }

    [Fact]
    public async Task Only_30_days_90_days_or_1_year_may_be_chosen_and_Viewers_get_403()
    {
        var owner = await _factory.SignInAsync("quinntynebrown", Role.Owner);
        var viewer = await _factory.SignInAsync("ada", Role.Viewer);

        var odd = await owner.PostAsync("/api/worker-tokens", new { name = "build-box-02", location = "Local", expiresInDays = 7 });
        var byViewer = await viewer.PostAsync("/api/worker-tokens", new { name = "build-box-02", location = "Local", expiresInDays = 30 });

        Assert.Equal(HttpStatusCode.BadRequest, odd.StatusCode);
        Assert.Equal(HttpStatusCode.Forbidden, byViewer.StatusCode);
    }

    [Theory]
    [InlineData(30)]
    [InlineData(90)]
    [InlineData(365)]
    public async Task A_token_stops_working_at_its_expiry(int days)
    {
        var owner = await _factory.SignInAsync("quinntynebrown", Role.Owner);
        var token = (await CreateAsync(owner, "build-box-02", days)).GetProperty("token").GetString()!;
        var worker = await WorkerClient.RegisterAsync(_factory.CreateAnonymousClient(), token, "build-box-02");

        _factory.Clock.Advance(TimeSpan.FromDays(days) - TimeSpan.FromMinutes(1));
        Assert.Null(await worker.LeaseAsync());

        _factory.Clock.Advance(TimeSpan.FromMinutes(2));
        var expired = await worker.Http.PostAsJsonAsync("/api/worker/lease", new { workerId = worker.WorkerId });
        Assert.Equal(HttpStatusCode.Unauthorized, expired.StatusCode);
    }

    [Fact]
    public async Task Revoking_a_connected_worker_disconnects_it_within_10_seconds_and_releases_its_lease()
    {
        var owner = await _factory.SignInAsync("quinntynebrown", Role.Owner);
        var viewer = await _factory.SignInAsync("ada", Role.Viewer);
        var token = (await CreateAsync(owner, "build-box-02")).GetProperty("token").GetString()!;
        var worker = await WorkerClient.RegisterAsync(_factory.CreateAnonymousClient(), token, "build-box-02");
        await owner.PostAsync("/api/projects", new { name = "Ledgerline", idea = "A web app for small accounting teams.", budgetUsd = 300m });
        var run = await worker.LeaseAsync();
        Assert.NotNull(run);
        (await worker.CheckpointAsync(run, 1)).EnsureSuccessStatusCode();
        var control = worker.Http.GetAsync($"/api/worker/runs/{run.RunId}/control?workerId={worker.WorkerId}&epoch={run.Epoch}&waitSeconds=30");
        await Task.Delay(300);

        Assert.Equal(HttpStatusCode.Forbidden, (await viewer.PostAsync($"/api/workers/{worker.WorkerId}/revoke", new { })).StatusCode);
        var clock = Stopwatch.StartNew();
        var revoked = await owner.PostAsync($"/api/workers/{worker.WorkerId}/revoke", new { });

        Assert.Equal(HttpStatusCode.NoContent, revoked.StatusCode);
        // The held control poll ends: the run is no longer this worker's.
        Assert.Equal(HttpStatusCode.Conflict, (await control).StatusCode);
        Assert.True(clock.Elapsed < TimeSpan.FromSeconds(10), $"disconnected after {clock.Elapsed}");
        // Every further call is refused.
        Assert.Equal(HttpStatusCode.Unauthorized, (await worker.HeartbeatAsync(run)).StatusCode);
        // The lease is released: another worker resumes the run after its checkpoint.
        var other = await _factory.RegisterWorkerAsync("hewn-cloud-eus-01");
        var resumed = await other.LeaseAsync();
        Assert.NotNull(resumed);
        Assert.Equal(run.RunId, resumed.RunId);
        Assert.Equal(1, resumed.CheckpointStep);
        // And it is gone from Workers.
        var workers = await HewnClient.ReadJsonAsync(await owner.GetAsync("/api/workers"));
        Assert.DoesNotContain(workers.GetProperty("workers").EnumerateArray(), w => w.GetProperty("id").GetString() == worker.WorkerId);
    }

    [Fact]
    public async Task A_worker_on_the_configured_development_token_cannot_be_revoked_from_Workers()
    {
        var owner = await _factory.SignInAsync("quinntynebrown", Role.Owner);
        var worker = await _factory.RegisterWorkerAsync();

        var response = await owner.PostAsync($"/api/workers/{worker.WorkerId}/revoke", new { });

        Assert.Equal(HttpStatusCode.Conflict, response.StatusCode);
        Assert.Equal("configured_token", (await HewnClient.ReadJsonAsync(response)).GetProperty("code").GetString());
    }

    [Fact]
    public async Task Revoking_an_unknown_worker_is_404()
    {
        var owner = await _factory.SignInAsync("quinntynebrown", Role.Owner);

        Assert.Equal(HttpStatusCode.NotFound, (await owner.PostAsync("/api/workers/wkr_missing/revoke", new { })).StatusCode);
    }
}

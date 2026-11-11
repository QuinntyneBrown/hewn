// Acceptance Test
// Traces to: L2-051
// Description: /health/live answers 200 while the process runs (AC1); /health/ready answers 200 only when the
// database and the SignalR backplane are reachable, and 503 naming the one that isn't otherwise (AC2). Neither needs
// a session, and neither body carries error text.

using System.Net;
using System.Net.Http.Json;
using System.Text.Json;
using Hewn.Api.Hubs;
using Hewn.Api.Tests.Support;
using Hewn.Infrastructure.Persistence;
using Microsoft.AspNetCore.SignalR;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.DependencyInjection;
using Microsoft.Extensions.DependencyInjection.Extensions;
using Microsoft.Extensions.Logging.Abstractions;

namespace Hewn.Api.Tests.Operations;

public sealed class HealthTests : IAsyncDisposable
{
    private readonly List<HewnApiFactory> _factories = [];

    private HttpClient Anonymous(HewnApiFactory factory)
    {
        _factories.Add(factory);
        return factory.CreateClient();
    }

    private static async Task<Dictionary<string, string>> ChecksOf(HttpResponseMessage response)
    {
        var body = await response.Content.ReadFromJsonAsync<JsonElement>();
        return body.GetProperty("checks").EnumerateArray()
            .ToDictionary(c => c.GetProperty("name").GetString()!, c => c.GetProperty("status").GetString()!);
    }

    [Fact]
    public async Task Live_answers_200_without_a_session()
    {
        var response = await Anonymous(new HewnApiFactory()).GetAsync("/health/live");

        Assert.Equal(HttpStatusCode.OK, response.StatusCode);
    }

    [Fact]
    public async Task Ready_answers_200_when_the_database_and_the_backplane_are_reachable()
    {
        var factory = new HewnApiFactory();
        await factory.SeedAsync(_ => { });

        var response = await Anonymous(factory).GetAsync("/health/ready");

        Assert.Equal(HttpStatusCode.OK, response.StatusCode);
        Assert.Equal(new Dictionary<string, string> { ["database"] = "Healthy", ["backplane"] = "Healthy" }, await ChecksOf(response));
    }

    [Fact]
    public async Task Ready_answers_503_naming_the_database_when_it_cannot_be_reached()
    {
        var missing = Path.Combine(Path.GetTempPath(), $"hewn-missing-{Guid.NewGuid():N}", "hewn.db");
        var factory = new HewnApiFactory().WithServices(services =>
        {
            services.RemoveAll<DbContextOptions<HewnDbContext>>();
            services.AddDbContext<HewnDbContext>(o => o.UseSqlite($"DataSource={missing}"));
        });

        var response = await Anonymous(factory).GetAsync("/health/ready");

        Assert.Equal(HttpStatusCode.ServiceUnavailable, response.StatusCode);
        Assert.Equal(new Dictionary<string, string> { ["database"] = "Unhealthy", ["backplane"] = "Healthy" }, await ChecksOf(response));
        var text = await response.Content.ReadAsStringAsync();
        Assert.DoesNotContain(missing, text);
        Assert.DoesNotContain("SQLite", text, StringComparison.OrdinalIgnoreCase);
    }

    [Fact]
    public async Task Ready_answers_503_naming_the_backplane_when_messages_cannot_go_through_it()
    {
        var factory = new HewnApiFactory().WithServices(services =>
        {
            services.RemoveAll<HubLifetimeManager<MissionControlHub>>();
            services.AddSingleton<HubLifetimeManager<MissionControlHub>, UnreachableBackplane>();
        });
        await factory.SeedAsync(_ => { });

        var response = await Anonymous(factory).GetAsync("/health/ready");

        Assert.Equal(HttpStatusCode.ServiceUnavailable, response.StatusCode);
        Assert.Equal(new Dictionary<string, string> { ["database"] = "Healthy", ["backplane"] = "Unhealthy" }, await ChecksOf(response));
        Assert.DoesNotContain("redis:6379", await response.Content.ReadAsStringAsync());
    }

    public async ValueTask DisposeAsync()
    {
        foreach (var factory in _factories)
        {
            await factory.DisposeAsync();
        }
    }

    /// <summary>A scale-out backplane that is down: every send through it fails, as a lost Redis connection would.</summary>
    private sealed class UnreachableBackplane() : DefaultHubLifetimeManager<MissionControlHub>(NullLogger<DefaultHubLifetimeManager<MissionControlHub>>.Instance)
    {
        public override Task SendGroupAsync(string groupName, string methodName, object?[] args, CancellationToken cancellationToken = default) =>
            throw new InvalidOperationException("No connection to redis:6379");
    }
}

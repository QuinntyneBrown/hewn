using System.Net.Http.Json;
using Hewn.Application.Abstractions;
using Hewn.Domain;
using Hewn.Infrastructure.Persistence;
using Microsoft.AspNetCore.Hosting;
using Microsoft.AspNetCore.Mvc.Testing;
using Microsoft.Data.Sqlite;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.DependencyInjection;
using Microsoft.Extensions.DependencyInjection.Extensions;
using Microsoft.Extensions.Time.Testing;

namespace Hewn.Api.Tests.Support;

/// <summary>
/// Hosts the real API on a per-fixture in-memory SQLite database, with GitHub replaced by a fake. A test of
/// concurrent requests asks for a database file instead, where each request opens its own connection as in production.
/// </summary>
public sealed class HewnApiFactory : WebApplicationFactory<Program>
{
    private readonly SqliteConnection _connection = new("DataSource=:memory:");

    private readonly string? _databaseFile;

    private readonly List<(string Key, string Value)> _settings = [];

    public const string WorkerToken = "test-worker-token-0123456789";

    public const string SkillsSource = "https://github.com/QuinntyneBrown/greenlit.git";

    public FakeGitHub GitHub { get; } = new();

    /// <summary>Test clock; advance it to expire leases.</summary>
    public FakeTimeProvider Clock { get; } = new(DateTimeOffset.UtcNow);

    /// <summary>Adds configuration settings. Call before the first request.</summary>
    public HewnApiFactory WithSettings(params (string Key, string Value)[] settings)
    {
        _settings.AddRange(settings);
        return this;
    }

    public HewnApiFactory(bool databaseFile = false)
    {
        if (databaseFile)
        {
            _databaseFile = Path.Combine(Path.GetTempPath(), $"hewn-test-{Guid.NewGuid():N}.db");
            return;
        }

        _connection.Open();
    }

    protected override void ConfigureWebHost(IWebHostBuilder builder)
    {
        builder.UseEnvironment("Testing");
        builder.UseSetting("Hewn:Auth:DevSignIn", "true");
        builder.UseSetting("HEWN_WORKER_TOKEN", WorkerToken);
        builder.UseSetting("HEWN_GITHUB_OWNER", "hewn-builds");
        builder.UseSetting("HEWN_SKILLS_SOURCE", SkillsSource);
        builder.UseSetting("Hewn:Leases:ReaperEnabled", "false");
        builder.UseSetting("ConnectionStrings:Hewn", "DataSource=:memory:");
        foreach (var (key, value) in _settings)
        {
            builder.UseSetting(key, value);
        }

        builder.ConfigureServices(services =>
        {
            services.RemoveAll<DbContextOptions<HewnDbContext>>();
            services.AddDbContext<HewnDbContext>(o =>
            {
                if (_databaseFile is null)
                {
                    o.UseSqlite(_connection, s => s.UseQuerySplittingBehavior(QuerySplittingBehavior.SplitQuery));
                }
                else
                {
                    o.UseSqlite($"DataSource={_databaseFile}", s => s.UseQuerySplittingBehavior(QuerySplittingBehavior.SplitQuery));
                }
            });
            services.RemoveAll<IGitHubRepositoryProbe>();
            services.AddSingleton<IGitHubRepositoryProbe>(GitHub);
            services.AddSingleton<IGitHubRepositories>(GitHub);
            services.RemoveAll<TimeProvider>();
            services.AddSingleton<TimeProvider>(Clock);
        });
    }

    public async Task SeedAsync(Action<HewnDbContext> seed)
    {
        using var scope = Services.CreateScope();
        var db = scope.ServiceProvider.GetRequiredService<HewnDbContext>();
        await db.Database.MigrateAsync();
        seed(db);
        await db.SaveChangesAsync();
    }

    public async Task<T> QueryAsync<T>(Func<HewnDbContext, Task<T>> query)
    {
        using var scope = Services.CreateScope();
        var db = scope.ServiceProvider.GetRequiredService<HewnDbContext>();
        return await query(db);
    }

    /// <summary>Creates a client signed in as an allow-listed user with the given role.</summary>
    public async Task<HewnClient> SignInAsync(string login, Role role)
    {
        await SeedAsync(db =>
        {
            if (!db.AllowList.Any(a => a.Login == login))
            {
                db.AllowList.Add(new AllowListEntry(login, role));
            }
        });

        var client = CreateClient(new WebApplicationFactoryClientOptions
        {
            HandleCookies = true,
            BaseAddress = new Uri("https://localhost"),
        });
        var response = await client.PostAsJsonAsync("/api/auth/dev/sign-in", new { login });
        response.EnsureSuccessStatusCode();
        var session = response.Headers.GetValues("Set-Cookie").First(c => c.StartsWith("hewn.session=", StringComparison.Ordinal));
        return await HewnClient.CreateAsync(client, session.Split(';')[0]);
    }

    public async Task<WorkerClient> RegisterWorkerAsync(string name = "test-worker")
    {
        await SeedAsync(_ => { });
        return await WorkerClient.RegisterAsync(CreateAnonymousClient(), WorkerToken, name);
    }

    /// <summary>Runs the expiry sweep the LeaseReaper runs every 10 seconds.</summary>
    public async Task ExpireStaleLeasesAsync()
    {
        using var scope = Services.CreateScope();
        await scope.ServiceProvider.GetRequiredService<Hewn.Application.Pipeline.LeaseService>().ExpireStaleAsync(CancellationToken.None);
    }

    public HttpClient CreateAnonymousClient() =>
        CreateClient(new WebApplicationFactoryClientOptions { BaseAddress = new Uri("https://localhost") });

    protected override void Dispose(bool disposing)
    {
        base.Dispose(disposing);
        _connection.Dispose();
        if (_databaseFile is not null)
        {
            SqliteConnection.ClearAllPools();
            foreach (var file in new[] { _databaseFile, $"{_databaseFile}-wal", $"{_databaseFile}-shm" })
            {
                File.Delete(file);
            }
        }
    }
}

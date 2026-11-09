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

namespace Hewn.Api.Tests.Support;

/// <summary>
/// Hosts the real API on a per-fixture in-memory SQLite database, with GitHub replaced by a fake.
/// </summary>
public sealed class HewnApiFactory : WebApplicationFactory<Program>
{
    private readonly SqliteConnection _connection = new("DataSource=:memory:");

    public FakeGitHub GitHub { get; } = new();

    public HewnApiFactory()
    {
        _connection.Open();
    }

    protected override void ConfigureWebHost(IWebHostBuilder builder)
    {
        builder.UseEnvironment("Testing");
        builder.UseSetting("Hewn:Auth:DevSignIn", "true");
        builder.UseSetting("ConnectionStrings:Hewn", "DataSource=:memory:");
        builder.ConfigureServices(services =>
        {
            services.RemoveAll<DbContextOptions<HewnDbContext>>();
            services.AddDbContext<HewnDbContext>(o => o.UseSqlite(_connection, s => s.UseQuerySplittingBehavior(QuerySplittingBehavior.SplitQuery)));
            services.RemoveAll<IGitHubRepositoryProbe>();
            services.AddSingleton<IGitHubRepositoryProbe>(GitHub);
        });
    }

    protected override void ConfigureClient(HttpClient client)
    {
        base.ConfigureClient(client);
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
        return await HewnClient.CreateAsync(client);
    }

    public HttpClient CreateAnonymousClient() =>
        CreateClient(new WebApplicationFactoryClientOptions { BaseAddress = new Uri("https://localhost") });

    protected override void Dispose(bool disposing)
    {
        base.Dispose(disposing);
        _connection.Dispose();
    }
}

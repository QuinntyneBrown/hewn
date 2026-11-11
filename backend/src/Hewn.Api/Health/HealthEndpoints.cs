using System.Text.Json;
using Hewn.Api.Hubs;
using Hewn.Infrastructure.Persistence;
using Microsoft.AspNetCore.Diagnostics.HealthChecks;
using Microsoft.AspNetCore.SignalR;
using Microsoft.Data.Sqlite;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Diagnostics.HealthChecks;

namespace Hewn.Api.Health;

/// <summary>
/// Liveness and readiness for load balancers and orchestrators (L2-051). Both are anonymous (L2-038 AC1), and their
/// bodies name each check and its status only: a failure's exception (a connection string, a host) is never written.
/// </summary>
public static class HealthEndpoints
{
    private const string Ready = "ready";

    public static IServiceCollection AddHewnHealthChecks(this IServiceCollection services)
    {
        services.AddHealthChecks()
            .AddCheck<DatabaseReadinessCheck>("database", tags: [Ready])
            .AddCheck<BackplaneReadinessCheck>("backplane", tags: [Ready]);
        return services;
    }

    public static void MapHewnHealthChecks(this IEndpointRouteBuilder app)
    {
        // AC1: 200 while the process runs. No checks: a slow database must not make an orchestrator restart it.
        app.MapHealthChecks("/health/live", new HealthCheckOptions { Predicate = _ => false, ResponseWriter = Write })
            .AllowAnonymous();
        // AC2: 200 only when the database and the backplane are reachable; 503 (the default for Unhealthy) otherwise.
        app.MapHealthChecks("/health/ready", new HealthCheckOptions { Predicate = c => c.Tags.Contains(Ready), ResponseWriter = Write })
            .AllowAnonymous();
    }

    private static Task Write(HttpContext context, HealthReport report)
    {
        context.Response.ContentType = "application/json";
        context.Response.Headers.CacheControl = "no-store";
        return context.Response.WriteAsync(JsonSerializer.Serialize(new
        {
            status = report.Status.ToString(),
            checks = report.Entries.Select(e => new { name = e.Key, status = e.Value.Status.ToString() }),
        }));
    }
}

/// <summary>
/// The database is reachable: a new connection opens and answers a query. It is opened outside the pool and never
/// creates the file, so a database that has gone away fails here instead of passing on a pooled handle or an empty
/// file made on the spot.
/// </summary>
public sealed class DatabaseReadinessCheck(HewnDbContext db) : IHealthCheck
{
    public async Task<HealthCheckResult> CheckHealthAsync(HealthCheckContext context, CancellationToken cancellationToken = default)
    {
        try
        {
            var builder = new SqliteConnectionStringBuilder(db.Database.GetConnectionString());
            if (builder.DataSource is ":memory:" || builder.Mode == SqliteOpenMode.Memory)
            {
                // An in-memory database lives on the context's own connection; a new one would be a different database.
                return await db.Database.CanConnectAsync(cancellationToken) ? HealthCheckResult.Healthy() : HealthCheckResult.Unhealthy();
            }

            builder.Mode = SqliteOpenMode.ReadWrite;
            builder.Pooling = false;
            await using var connection = new SqliteConnection(builder.ToString());
            await connection.OpenAsync(cancellationToken);
            await using var command = connection.CreateCommand();
            command.CommandText = "SELECT 1";
            await command.ExecuteScalarAsync(cancellationToken);
            return HealthCheckResult.Healthy();
        }
        catch (Exception exception) when (exception is not OperationCanceledException)
        {
            return HealthCheckResult.Unhealthy("The database can't be reached.", exception);
        }
    }
}

/// <summary>
/// The SignalR backplane carries a message: one is sent to a group no client joins, through the same lifetime
/// manager that publishes project events. In-process it always succeeds; with a scale-out backplane it fails when
/// that backplane can't be reached.
/// </summary>
public sealed class BackplaneReadinessCheck(IHubContext<MissionControlHub> hub) : IHealthCheck
{
    public async Task<HealthCheckResult> CheckHealthAsync(HealthCheckContext context, CancellationToken cancellationToken = default)
    {
        try
        {
            await hub.Clients.Group("health-probe").SendAsync("Probe", cancellationToken);
            return HealthCheckResult.Healthy();
        }
        catch (Exception exception) when (exception is not OperationCanceledException)
        {
            return HealthCheckResult.Unhealthy("The SignalR backplane can't be reached.", exception);
        }
    }
}

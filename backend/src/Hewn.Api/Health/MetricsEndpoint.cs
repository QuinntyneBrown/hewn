using System.Security.Cryptography;
using System.Text;
using Hewn.Application.Common;
using OpenTelemetry.Metrics;

namespace Hewn.Api.Health;

/// <summary>
/// The Prometheus scrape at <c>/metrics</c> (L2-049 AC3), for a scraper holding HEWN_METRICS_TOKEN as a bearer token.
/// With no token configured there is no endpoint: metrics name projects' stages and models, so they are not public
/// the way the health checks are (ADR 0036).
/// </summary>
public static class MetricsEndpoint
{
    public const string Path = "/metrics";

    public const string TokenSetting = "HEWN_METRICS_TOKEN";

    public static void AddHewnMetrics(this OpenTelemetry.OpenTelemetryBuilder telemetry) =>
        telemetry.WithMetrics(metrics => metrics
            .AddMeter(HewnMetrics.MeterName)
            .AddPrometheusExporter(o => o.ScrapeResponseCacheDurationMilliseconds = 0));

    public static void UseHewnMetrics(this WebApplication app)
    {
        var token = app.Configuration[TokenSetting];
        if (string.IsNullOrEmpty(token))
        {
            return;
        }

        var expected = Encoding.UTF8.GetBytes($"Bearer {token}");
        app.UseOpenTelemetryPrometheusScrapingEndpoint(
            meterProvider: null,
            predicate: context => context.Request.Path == Path,
            path: null,
            configureBranchedPipeline: branch => branch.Use(async (context, next) =>
            {
                var given = Encoding.UTF8.GetBytes(context.Request.Headers.Authorization.ToString());
                if (!CryptographicOperations.FixedTimeEquals(given, expected))
                {
                    context.Response.StatusCode = StatusCodes.Status401Unauthorized;
                    context.Response.Headers.WWWAuthenticate = "Bearer";
                    return;
                }

                context.Response.Headers.CacheControl = "no-store";
                await next(context);
            }),
            optionsName: null);
    }
}

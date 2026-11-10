using System.Security.Cryptography;
using System.Text;
using Hewn.Application.Designs;
using Microsoft.AspNetCore.Authorization;
using Microsoft.Extensions.FileProviders;
using Microsoft.Extensions.Options;

namespace Hewn.Api.MissionControl;

/// <summary>
/// Mission Control's pages (ADR 0022). The API serves the built Angular app from Hewn:MissionControl:Root: its files
/// need no session, /sign-in needs none, and every other page needs one, so a page without a session redirects to
/// sign-in (L2-038 AC1). Every response is marked nosniff, and every HTML response carries the Content-Security-Policy
/// (L2-043 AC2).
/// </summary>
public static class MissionControlPages
{
    /// <summary>
    /// Angular's build loads its stylesheet with this one inline handler (critical CSS inlining). CSP allows exactly
    /// that handler by hash; no other inline script runs.
    /// </summary>
    private const string StylesheetLoader = "this.media='all'";

    private static readonly string[] NotPages = ["/api", "/hubs", "/preview", "/health"];

    public static string ContentSecurityPolicy(string previewOrigin) => string.Join("; ",
        "default-src 'self'",
        $"script-src 'self' 'unsafe-hashes' 'sha256-{Convert.ToBase64String(SHA256.HashData(Encoding.UTF8.GetBytes(StylesheetLoader)))}'",
        "style-src 'self' 'unsafe-inline'",
        "img-src 'self' data: https://avatars.githubusercontent.com",
        "font-src 'self' data:",
        "connect-src 'self'",
        $"frame-src {previewOrigin}",
        "frame-ancestors 'self'",
        "base-uri 'self'",
        "form-action 'self'",
        "object-src 'none'");

    /// <summary>Marks every response nosniff and gives HTML responses the policy, unless they set their own (previews do).</summary>
    public static IApplicationBuilder UseSecurityHeaders(this WebApplication app)
    {
        var policy = ContentSecurityPolicy(app.Services.GetRequiredService<IOptions<PreviewOptions>>().Value.Origin);
        return app.Use(async (context, next) =>
        {
            context.Response.OnStarting(() =>
            {
                var headers = context.Response.Headers;
                headers.XContentTypeOptions = "nosniff";
                if (context.Response.ContentType?.StartsWith("text/html", StringComparison.OrdinalIgnoreCase) == true
                    && !headers.ContainsKey("Content-Security-Policy"))
                {
                    headers.ContentSecurityPolicy = policy;
                    headers["Referrer-Policy"] = "same-origin";
                }

                return Task.CompletedTask;
            });
            await next(context);
        });
    }

    /// <summary>The built app's files, before authentication: the sign-in page needs them too.</summary>
    public static IApplicationBuilder UseMissionControlFiles(this WebApplication app)
    {
        if (Root(app) is { } root)
        {
            app.UseStaticFiles(new StaticFileOptions { FileProvider = new PhysicalFileProvider(root) });
        }

        return app;
    }

    /// <summary>/sign-in without a session; every other page behind the fallback policy, so it redirects to sign-in.</summary>
    public static void MapMissionControl(this WebApplication app)
    {
        if (Root(app) is not { } root)
        {
            // No built app here (ng serve serves it): any other path is simply not found, never a sign-in redirect.
            app.MapFallback(context =>
            {
                context.Response.StatusCode = StatusCodes.Status404NotFound;
                return Task.CompletedTask;
            }).AllowAnonymous();
            return;
        }

        var index = Path.Combine(root, "index.html");
        app.MapGet("/sign-in", () => Results.File(index, "text/html")).AllowAnonymous();
        app.MapFallback(context =>
        {
            if (NotPages.Any(p => context.Request.Path.StartsWithSegments(p, StringComparison.OrdinalIgnoreCase)))
            {
                context.Response.StatusCode = StatusCodes.Status404NotFound;
                return Task.CompletedTask;
            }

            context.Response.ContentType = "text/html";
            return context.Response.SendFileAsync(index);
        }).RequireAuthorization(new AuthorizeAttribute());
    }

    private static string? Root(WebApplication app) =>
        app.Configuration["Hewn:MissionControl:Root"] is { Length: > 0 } root && File.Exists(Path.Combine(root, "index.html"))
            ? Path.GetFullPath(root)
            : null;
}

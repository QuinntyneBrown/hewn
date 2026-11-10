using Hewn.Application.Designs;
using MediatR;
using Microsoft.Extensions.Options;

namespace Hewn.Api.Designs;

/// <summary>
/// The preview host (L2-011 AC2; ADR 0018): project HTML is served only on the preview origin's host, never on Mission
/// Control's, with a CSP sandbox so the page runs in an opaque origin even if it is opened outside the iframe. The
/// signed token is the only credential; nothing here reads or sets a cookie.
/// </summary>
public static class PreviewEndpoint
{
    public static void MapPreview(this WebApplication app)
    {
        var origin = new Uri(app.Services.GetRequiredService<IOptions<PreviewOptions>>().Value.Origin);
        app.MapGet("/preview/{token}/{**path}", async (string token, string path, string? theme, IMediator mediator, HttpResponse response, CancellationToken cancellationToken) =>
            {
                var file = await mediator.Send(new ServePreviewQuery(token, path, theme), cancellationToken);
                response.Headers.ContentSecurityPolicy = "sandbox allow-scripts";
                response.Headers.XContentTypeOptions = "nosniff";
                response.Headers["Referrer-Policy"] = "no-referrer";
                response.Headers.CacheControl = "private, max-age=300";
                return Results.Bytes(file.Content, file.ContentType);
            })
            .RequireHost(origin.Authority)
            .AllowAnonymous();
    }
}

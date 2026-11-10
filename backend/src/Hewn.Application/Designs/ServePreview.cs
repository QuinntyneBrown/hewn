using System.Collections.Concurrent;
using System.Text;
using System.Text.RegularExpressions;
using Hewn.Application.Abstractions;
using Hewn.Application.Common;
using MediatR;
using Microsoft.EntityFrameworkCore;

namespace Hewn.Application.Designs;

/// <param name="Theme">light or dark: set on the page's <c>&lt;html data-theme&gt;</c>, which the mocks theme by.</param>
public sealed record ServePreviewQuery(string Token, string Path, string? Theme) : IRequest<PreviewFile>;

public sealed record PreviewFile(byte[] Content, string ContentType);

/// <summary>
/// The preview host (L2-011 AC2): a file under <c>docs/mocks/</c> or <c>docs/design-system/</c> at the token's commit.
/// Anything else, and any token that doesn't verify, is not found. The host adds the sandbox; see the API's endpoint.
/// </summary>
public sealed partial class ServePreviewHandler(IAppDbContext db, IGitHubRepositories gitHub, PreviewTokens tokens, PreviewFileCache cache)
    : IRequestHandler<ServePreviewQuery, PreviewFile>
{
    public async Task<PreviewFile> Handle(ServePreviewQuery query, CancellationToken cancellationToken)
    {
        var grant = tokens.Read(query.Token) ?? throw new NotFoundException();
        var path = query.Path;
        if (!PreviewOptions.AllowedRoots.Any(r => path.StartsWith(r, StringComparison.Ordinal))
            || path.Split('/').Any(segment => segment is "" or "." or ".." || segment.Contains('\\')))
        {
            throw new NotFoundException();
        }

        var content = await cache.GetOrAddAsync((grant.ProjectId, grant.Sha, path), async () =>
        {
            var project = await db.Projects.AsNoTracking().SingleOrDefaultAsync(p => p.Id == grant.ProjectId, cancellationToken);
            return project is { RepositoryOwner: { } owner, RepositoryName: { } name }
                ? (await gitHub.ReadFileAsync(owner, name, path, grant.Sha, cancellationToken))?.Content
                : null;
        }) ?? throw new NotFoundException();

        var type = ContentType(path);
        if (type == "text/html" && query.Theme is "light" or "dark")
        {
            content = Encoding.UTF8.GetBytes(HtmlTag().Replace(Encoding.UTF8.GetString(content), $"<html data-theme=\"{query.Theme}\"", 1));
        }

        return new PreviewFile(content, type);
    }

    private static string ContentType(string path) => Path.GetExtension(path).ToLowerInvariant() switch
    {
        ".html" or ".htm" => "text/html",
        ".css" => "text/css",
        ".js" or ".mjs" => "text/javascript",
        ".json" => "application/json",
        ".svg" => "image/svg+xml",
        ".png" => "image/png",
        ".jpg" or ".jpeg" => "image/jpeg",
        ".webp" => "image/webp",
        ".woff2" => "font/woff2",
        ".woff" => "font/woff",
        _ => "application/octet-stream",
    };

    [GeneratedRegex("<html(?=[\\s>])", RegexOptions.IgnoreCase)]
    private static partial Regex HtmlTag();
}

/// <summary>Preview files by project, commit and path. A file at a commit never changes, so entries never go stale.</summary>
public sealed class PreviewFileCache
{
    private const int Capacity = 512;

    private readonly ConcurrentDictionary<(Guid, string, string), byte[]> _files = new();

    public async Task<byte[]?> GetOrAddAsync((Guid ProjectId, string Sha, string Path) key, Func<Task<byte[]?>> read)
    {
        if (_files.TryGetValue(key, out var cached))
        {
            return cached;
        }

        var content = await read();
        if (content is not null)
        {
            if (_files.Count >= Capacity)
            {
                _files.Clear();
            }

            _files[key] = content;
        }

        return content;
    }
}

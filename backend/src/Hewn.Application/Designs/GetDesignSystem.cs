using System.Text.Json;
using Hewn.Application.Abstractions;
using Hewn.Application.Common;
using MediatR;
using Microsoft.EntityFrameworkCore;

namespace Hewn.Application.Designs;

public sealed record GetDesignSystemQuery(Guid ProjectId) : IRequest<DesignSystemDto>;

/// <summary>
/// The token and component pages stage 3 wrote to <c>docs/design-system/</c>, read at the default branch's head
/// (L2-012 AC4). They open in the same signed, sandboxed preview as the designs.
/// </summary>
/// <param name="Sha">The commit <c>tokens.json</c> and every page were read at; null before stage 3.</param>
/// <param name="Foundations">The token pages under <c>foundations/</c>, in the order of the token groups.</param>
/// <param name="Components">One page per component under <c>components/</c>, by name.</param>
public sealed record DesignSystemDto(string? Sha, IReadOnlyList<DesignSystemPageDto> Foundations, IReadOnlyList<DesignSystemPageDto> Components);

/// <param name="Page">The file's name without <c>.html</c>, such as <c>status-badge</c>.</param>
/// <param name="TokenCount">For a token page, how many tokens its group in <c>tokens.json</c> holds (one theme's for colour).</param>
/// <param name="LightAndDark">The group has light and dark values.</param>
public sealed record DesignSystemPageDto(string Page, string Title, string Path, string PreviewUrl, int? TokenCount, bool LightAndDark);

public sealed class GetDesignSystemHandler(IAppDbContext db, IGitHubRepositories gitHub, PreviewTokens tokens)
    : IRequestHandler<GetDesignSystemQuery, DesignSystemDto>
{
    private const string Root = "docs/design-system/";

    /// <summary>The token groups L2-012 AC1 names, in the order the pages are listed, with the names a page may use.</summary>
    private static readonly (string Group, string[] Pages)[] Groups =
    [
        ("color", ["color", "colour", "colors", "colours"]),
        ("typography", ["typography", "type"]),
        ("spacing", ["spacing", "space"]),
        ("radius", ["radius", "radii", "shape"]),
        ("elevation", ["elevation", "shadow", "shadows"]),
        ("motion", ["motion"]),
    ];

    public async Task<DesignSystemDto> Handle(GetDesignSystemQuery query, CancellationToken cancellationToken)
    {
        var project = await db.Projects.AsNoTracking().SingleOrDefaultAsync(p => p.Id == query.ProjectId, cancellationToken)
            ?? throw new NotFoundException();
        if (project.RepositoryOwner is not { } owner || project.RepositoryName is not { } name)
        {
            return new DesignSystemDto(null, [], []);
        }

        RepositoryContent? tokensFile;
        try
        {
            tokensFile = await gitHub.ReadFileAsync(owner, name, $"{Root}tokens.json", null, cancellationToken);
        }
        catch (GitHubException)
        {
            throw new GitHubException($"{Root} couldn’t be read");
        }

        if (tokensFile is null)
        {
            return new DesignSystemDto(null, [], []);
        }

        var sha = tokensFile.Sha;
        JsonElement tokenGroups;
        IReadOnlyList<string> foundationFiles, componentFiles;
        try
        {
            using var document = JsonDocument.Parse(tokensFile.Content);
            tokenGroups = document.RootElement.Clone();
            foundationFiles = await gitHub.ListFilesAsync(owner, name, $"{Root}foundations", sha, cancellationToken);
            componentFiles = await gitHub.ListFilesAsync(owner, name, $"{Root}components", sha, cancellationToken);
        }
        catch (Exception e) when (e is JsonException or GitHubException)
        {
            throw new GitHubException($"{Root} couldn’t be read at {sha[..7]}");
        }

        var token = tokens.Sign(project.Id, sha);
        DesignSystemPageDto Page(string folder, string file, string? group)
        {
            var page = file[..^".html".Length];
            var path = $"{Root}{folder}/{file}";
            var (count, lightAndDark) = group is null ? (null, false) : Count(tokenGroups, group);
            return new DesignSystemPageDto(page, Label(page), path, tokens.Url(token, path), count, lightAndDark);
        }

        var foundations = Html(foundationFiles)
            .Select(file => (File: file, Group: GroupOf(file[..^".html".Length])))
            .OrderBy(f => f.Group is null ? Groups.Length : Array.FindIndex(Groups, g => g.Group == f.Group))
            .ThenBy(f => f.File, StringComparer.Ordinal)
            .Select(f => Page("foundations", f.File, f.Group))
            .ToList();
        var components = Html(componentFiles).Select(file => Page("components", file, null)).ToList();
        return new DesignSystemDto(sha, foundations, components);
    }

    private static IEnumerable<string> Html(IEnumerable<string> files) =>
        files.Where(f => f.EndsWith(".html", StringComparison.OrdinalIgnoreCase) && f.Length > ".html".Length).Order(StringComparer.Ordinal);

    private static string? GroupOf(string page) =>
        Groups.FirstOrDefault(g => g.Pages.Contains(page, StringComparer.OrdinalIgnoreCase)).Group;

    /// <summary>Tokens are DTCG leaves (objects with a <c>$value</c>); colour counts one theme's when it has light and dark.</summary>
    private static (int? Count, bool LightAndDark) Count(JsonElement root, string group)
    {
        if (root.ValueKind != JsonValueKind.Object || !root.TryGetProperty(group, out var tokensOf))
        {
            return (null, false);
        }

        var themed = tokensOf.ValueKind == JsonValueKind.Object
            && tokensOf.TryGetProperty("light", out var light) && light.ValueKind == JsonValueKind.Object
            && tokensOf.TryGetProperty("dark", out var dark) && dark.ValueKind == JsonValueKind.Object;
        return themed ? (Leaves(tokensOf.GetProperty("light")), true) : (Leaves(tokensOf), false);
    }

    private static int Leaves(JsonElement element) =>
        element.ValueKind != JsonValueKind.Object ? 0
        : element.TryGetProperty("$value", out _) ? 1
        : element.EnumerateObject().Where(p => !p.Name.StartsWith('$')).Sum(p => Leaves(p.Value));

    /// <summary>"status-badge" reads "Status badge"; "color" reads "Colour", as Mission Control spells it.</summary>
    private static string Label(string slug)
    {
        if (slug.Equals("color", StringComparison.OrdinalIgnoreCase))
        {
            return "Colour";
        }

        var words = slug.Replace('-', ' ').Replace('_', ' ').Trim();
        return words.Length == 0 ? slug : char.ToUpperInvariant(words[0]) + words[1..];
    }
}

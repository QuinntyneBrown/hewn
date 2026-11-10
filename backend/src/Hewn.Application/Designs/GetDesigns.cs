using System.Text.Json;
using Hewn.Application.Abstractions;
using Hewn.Application.Common;
using MediatR;
using Microsoft.EntityFrameworkCore;

namespace Hewn.Application.Designs;

public sealed record GetDesignsQuery(Guid ProjectId) : IRequest<DesignsDto>;

/// <summary>Each screen and state stage 2 exported to <c>docs/mocks/</c>, read at the default branch's head (L2-011 AC1).</summary>
/// <param name="Sha">The commit the manifest and every preview URL were read at; null before stage 2.</param>
public sealed record DesignsDto(string? Sha, int StateCount, IReadOnlyList<DesignScreenDto> Screens);

/// <param name="Screen">The manifest's slug, the folder under <c>docs/mocks/</c>.</param>
/// <param name="Title">The brief's feature the screen serves.</param>
public sealed record DesignScreenDto(string Screen, string Title, string? MagicPatternsUrl, IReadOnlyList<DesignStateDto> States);

/// <param name="PreviewUrl">A signed URL on the preview origin; the same page serves as the state's thumbnail.</param>
public sealed record DesignStateDto(string State, string Label, string Path, string PreviewUrl);

public sealed class GetDesignsHandler(IAppDbContext db, IGitHubRepositories gitHub, PreviewTokens tokens)
    : IRequestHandler<GetDesignsQuery, DesignsDto>
{
    private const string Manifest = "docs/mocks/manifest.json";

    public async Task<DesignsDto> Handle(GetDesignsQuery query, CancellationToken cancellationToken)
    {
        var project = await db.Projects.AsNoTracking().SingleOrDefaultAsync(p => p.Id == query.ProjectId, cancellationToken)
            ?? throw new NotFoundException();
        if (project.RepositoryOwner is not { } owner || project.RepositoryName is not { } name)
        {
            return new DesignsDto(null, 0, []);
        }

        RepositoryContent? manifest;
        try
        {
            manifest = await gitHub.ReadFileAsync(owner, name, Manifest, null, cancellationToken);
        }
        catch (GitHubException)
        {
            throw new GitHubException($"{Manifest} couldn't be read");
        }

        if (manifest is null)
        {
            return new DesignsDto(null, 0, []);
        }

        IReadOnlyList<ManifestScreen> screens;
        try
        {
            screens = JsonSerializer.Deserialize<ManifestFile>(manifest.Content, Json)?.Screens ?? [];
        }
        catch (JsonException)
        {
            throw new GitHubException($"{Manifest} couldn't be read at {manifest.Sha[..7]}");
        }

        var token = tokens.Sign(project.Id, manifest.Sha);
        var listed = screens
            .Where(s => !string.IsNullOrWhiteSpace(s.Screen))
            .Select(s => new DesignScreenDto(
                s.Screen!,
                string.IsNullOrWhiteSpace(s.Feature) ? Label(s.Screen!) : s.Feature!,
                string.IsNullOrWhiteSpace(s.MagicPatternsUrl) ? null : s.MagicPatternsUrl,
                (s.States ?? []).Select(state =>
                {
                    var path = $"docs/mocks/{s.Screen}/{state}.html";
                    return new DesignStateDto(state, Label(state), path, tokens.Url(token, path));
                }).ToList()))
            .ToList();
        return new DesignsDto(manifest.Sha, listed.Sum(s => s.States.Count), listed);
    }

    /// <summary>"upload-error" reads "Upload error".</summary>
    private static string Label(string slug)
    {
        var words = slug.Replace('-', ' ').Replace('_', ' ').Trim();
        return words.Length == 0 ? slug : char.ToUpperInvariant(words[0]) + words[1..];
    }

    private static readonly JsonSerializerOptions Json = new(JsonSerializerDefaults.Web);

    private sealed record ManifestFile(IReadOnlyList<ManifestScreen>? Screens);

    private sealed record ManifestScreen(string? Screen, string? Feature, string? MagicPatternsUrl, IReadOnlyList<string>? States);
}

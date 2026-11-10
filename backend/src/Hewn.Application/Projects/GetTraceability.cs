using System.Formats.Tar;
using System.IO.Compression;
using System.Text;
using System.Text.RegularExpressions;
using Hewn.Application.Abstractions;
using Hewn.Application.Common;
using MediatR;
using Microsoft.EntityFrameworkCore;

namespace Hewn.Application.Projects;

public sealed record GetTraceabilityQuery(Guid ProjectId) : IRequest<TraceabilityDto>;

/// <summary>L2-035: every L2 in <c>docs/specs/L2.md</c> with its trace, read at the default branch's head.</summary>
/// <param name="Commit">The short SHA of the head the repository was read at; null before there is a repository.</param>
public sealed record TraceabilityDto(string? Repository, string? Commit, IReadOnlyList<RequirementTraceDto> Requirements);

/// <param name="Deferred">The reason on the L2's <c>**Status:** Deferred (…)</c> line; null when it is not deferred.</param>
/// <param name="NoAcceptanceTest">No test file names it and it is not deferred (AC2).</param>
public sealed record RequirementTraceDto(
    string Id,
    string Title,
    ParentRequirementDto? L1,
    string? Deferred,
    bool NoAcceptanceTest,
    IReadOnlyList<TracedDesignDto> Designs,
    IReadOnlyList<TracedJourneyDto> Journeys,
    IReadOnlyList<string> Tests,
    IReadOnlyList<TracedPullRequestDto> PullRequests);

public sealed record ParentRequirementDto(string Id, string Title);

public sealed record TracedDesignDto(string Title, string Path);

public sealed record TracedJourneyDto(int Number, string Title);

public sealed record TracedPullRequestDto(int Number, string Title, string Url, bool Merged);

/// <summary>
/// Builds the trace on read from one archive of the repository at its head and one list of its pull requests, so it
/// always reflects a real commit and needs no index to keep in step (see the artifacts-and-traceability design).
/// </summary>
public sealed partial class GetTraceabilityHandler(IAppDbContext db, IGitHubRepositories gitHub) : IRequestHandler<GetTraceabilityQuery, TraceabilityDto>
{
    private const string L2Path = "docs/specs/L2.md";

    /// <summary>A test's header is its first lines; a later "Traces to:" is not one.</summary>
    private const int HeaderLines = 20;

    private const int MaxFileBytes = 512 * 1024;

    /// <summary>Folders that hold documents, skills or dependencies rather than tests.</summary>
    private static readonly string[] NotTests = ["docs/", ".claude/", ".agents/", ".hewn/", ".github/"];

    public async Task<TraceabilityDto> Handle(GetTraceabilityQuery query, CancellationToken cancellationToken)
    {
        var project = await db.Projects.AsNoTracking().SingleOrDefaultAsync(p => p.Id == query.ProjectId, cancellationToken)
            ?? throw new NotFoundException();
        if (project.RepositoryOwner is not { } owner || project.RepositoryName is not { } name)
        {
            return new TraceabilityDto(null, null, []);
        }

        Snapshot snapshot;
        IReadOnlyList<PullRequestInfo> pulls;
        try
        {
            await using var archive = await gitHub.DownloadArchiveAsync(owner, name, cancellationToken);
            snapshot = await ReadAsync(archive, cancellationToken);
            pulls = snapshot.Files.ContainsKey(L2Path) ? await gitHub.ListPullRequestsAsync(owner, name, cancellationToken) : [];
        }
        catch (Exception e) when (e is GitHubException or InvalidDataException or FormatException)
        {
            throw new GitHubException($"{owner}/{name} couldn’t be read from GitHub");
        }

        var repository = $"{owner}/{name}";
        if (!snapshot.Files.TryGetValue(L2Path, out var l2Text))
        {
            return new TraceabilityDto(repository, snapshot.Commit, []);
        }

        var l2s = ParseL2(l2Text, snapshot.Commit);
        var l1s = snapshot.Files.TryGetValue("docs/specs/L1.md", out var l1Text)
            ? Headings(l1Text, L1Heading()).ToDictionary(h => h.Id, h => h.Title)
            : [];
        var designs = snapshot.Files
            .Where(f => DesignReadme().IsMatch(f.Key))
            .Select(f => (Title: FirstHeading(f.Value) ?? f.Key.Split('/')[^2], Path: f.Key, f.Value))
            .OrderBy(d => d.Title, StringComparer.Ordinal)
            .ToList();
        var journeys = snapshot.Files.TryGetValue("docs/journeys.md", out var journeysText) ? Journeys(journeysText) : [];
        var tests = snapshot.Files
            .Where(f => !NotTests.Any(p => f.Key.StartsWith(p, StringComparison.Ordinal)) && !f.Key.Contains("node_modules/", StringComparison.Ordinal))
            .Select(f => (Path: f.Key, Ids: TracedIds(f.Value)))
            .Where(t => t.Ids.Count > 0)
            .OrderBy(t => t.Path, StringComparer.Ordinal)
            .ToList();

        var requirements = l2s.Select(l2 =>
        {
            var named = NamesId(l2.Id);
            var tested = tests.Where(t => t.Ids.Contains(l2.Id)).Select(t => t.Path).ToList();
            return new RequirementTraceDto(
                l2.Id,
                l2.Title,
                l2.L1 is { } l1 ? new ParentRequirementDto(l1, l1s.GetValueOrDefault(l1, string.Empty)) : null,
                l2.Deferred,
                tested.Count == 0 && l2.Deferred is null,
                [.. designs.Where(d => named.IsMatch(d.Value)).Select(d => new TracedDesignDto(d.Title, d.Path))],
                [.. journeys.Where(j => named.IsMatch(j.Text)).Select(j => new TracedJourneyDto(j.Number, j.Title))],
                tested,
                [.. pulls.Where(p => named.IsMatch(p.Title)).OrderBy(p => p.Number).Select(p => new TracedPullRequestDto(p.Number, p.Title, p.Url, p.Merged))]);
        }).ToList();
        return new TraceabilityDto(repository, snapshot.Commit, requirements);
    }

    private sealed record Snapshot(string? Commit, Dictionary<string, string> Files);

    private sealed record L2Entry(string Id, string Title, string? L1, string? Deferred);

    /// <summary>
    /// Reads the text files of a GitHub tarball, whose entries sit under <c>{owner}-{name}-{sha7}/</c>; binary and
    /// oversized files are skipped.
    /// </summary>
    private static async Task<Snapshot> ReadAsync(Stream archive, CancellationToken cancellationToken)
    {
        string? commit = null;
        var files = new Dictionary<string, string>(StringComparer.Ordinal);
        await using var gzip = new GZipStream(archive, CompressionMode.Decompress);
        await using var tar = new TarReader(gzip);
        while (await tar.GetNextEntryAsync(copyData: false, cancellationToken) is { } entry)
        {
            var slash = entry.Name.IndexOf('/');
            if (slash < 0)
            {
                continue;
            }

            commit ??= CommitOf(entry.Name[..slash]);
            if (entry.EntryType is not (TarEntryType.RegularFile or TarEntryType.V7RegularFile) || entry.Length > MaxFileBytes || entry.DataStream is null)
            {
                continue;
            }

            using var buffer = new MemoryStream();
            await entry.DataStream.CopyToAsync(buffer, cancellationToken);
            var bytes = buffer.ToArray();
            if (Array.IndexOf(bytes, (byte)0) >= 0)
            {
                continue;
            }

            files[entry.Name[(slash + 1)..]] = Encoding.UTF8.GetString(bytes);
        }

        return new Snapshot(commit, files);
    }

    /// <summary>"ledgerline-7be0d13" or "northwind-ledgerline-7be0d13" ends in the short SHA.</summary>
    private static string? CommitOf(string top)
    {
        var sha = top[(top.LastIndexOf('-') + 1)..];
        return ShortSha().IsMatch(sha) ? sha[..7] : null;
    }

    private static List<L2Entry> ParseL2(string text, string? commit)
    {
        var entries = new List<L2Entry>();
        var lines = text.Split('\n');
        for (var i = 0; i < lines.Length; i++)
        {
            var line = lines[i].TrimEnd('\r');
            if (!line.StartsWith("## L2-", StringComparison.Ordinal))
            {
                continue;
            }

            var heading = L2Heading().Match(line);
            if (!heading.Success || entries.Any(e => e.Id == heading.Groups["id"].Value))
            {
                var why = heading.Success ? $"{heading.Groups["id"].Value} appears twice" : "unexpected heading";
                throw new GitHubException($"{L2Path} couldn’t be parsed at {commit ?? "the head"} ({why} on line {i + 1})");
            }

            string? l1 = null, deferred = null;
            for (var j = i + 1; j < lines.Length && !lines[j].StartsWith("## ", StringComparison.Ordinal); j++)
            {
                if (TracesTo().Match(lines[j]) is { Success: true } traces && l1 is null)
                {
                    l1 = traces.Groups["id"].Value;
                }
                else if (DeferredStatus().Match(lines[j]) is { Success: true } status)
                {
                    deferred = status.Groups["reason"].Value.Trim();
                }
            }

            entries.Add(new L2Entry(heading.Groups["id"].Value, heading.Groups["title"].Value.Trim(), l1, deferred));
        }

        return entries;
    }

    private static IEnumerable<(string Id, string Title)> Headings(string text, Regex pattern) =>
        text.Split('\n').Select(l => pattern.Match(l.TrimEnd('\r'))).Where(m => m.Success).Select(m => (m.Groups["id"].Value, m.Groups["title"].Value.Trim()));

    private static string? FirstHeading(string text) =>
        text.Split('\n').Select(l => l.TrimEnd('\r')).FirstOrDefault(l => l.StartsWith("# ", StringComparison.Ordinal))?[2..].Trim();

    /// <summary>Each <c>## N. Title</c> section of <c>docs/journeys.md</c>, with its text up to the next section.</summary>
    private static List<(int Number, string Title, string Text)> Journeys(string text)
    {
        var sections = new List<(int, string, string)>();
        var matches = JourneyHeading().Matches(text);
        for (var i = 0; i < matches.Count; i++)
        {
            var end = i + 1 < matches.Count ? matches[i + 1].Index : text.Length;
            sections.Add((int.Parse(matches[i].Groups["n"].Value, System.Globalization.CultureInfo.InvariantCulture), matches[i].Groups["title"].Value.Trim(), text[matches[i].Index..end]));
        }

        return sections;
    }

    /// <summary>The IDs a <c>Traces to:</c> comment in the file's first lines names.</summary>
    private static HashSet<string> TracedIds(string text)
    {
        var ids = new HashSet<string>(StringComparer.Ordinal);
        foreach (var line in text.Split('\n').Take(HeaderLines))
        {
            if (TestHeader().Match(line) is { Success: true } header)
            {
                ids.UnionWith(L2Id().Matches(header.Groups["ids"].Value).Select(m => m.Value));
            }
        }

        return ids;
    }

    /// <summary>An ID matched whole, so L2-001 is not found in L2-0010.</summary>
    private static Regex NamesId(string id) => new($@"(?<![\w-]){Regex.Escape(id)}(?!\d)", RegexOptions.CultureInvariant);

    [GeneratedRegex(@"^## (?<id>L2-\d+):\s*(?<title>\S.*)$")]
    private static partial Regex L2Heading();

    [GeneratedRegex(@"^## (?<id>L1-\d+):\s*(?<title>\S.*)$")]
    private static partial Regex L1Heading();

    [GeneratedRegex(@"^\*\*Traces to:\*\*\s*(?<id>L1-\d+)")]
    private static partial Regex TracesTo();

    [GeneratedRegex(@"^\*\*Status:\*\*\s*Deferred\s*\((?<reason>.*)\)\s*$")]
    private static partial Regex DeferredStatus();

    [GeneratedRegex(@"^##\s+(?<n>\d+)\.\s*(?<title>.+?)\s*$", RegexOptions.Multiline)]
    private static partial Regex JourneyHeading();

    [GeneratedRegex(@"^\s*(//|#|--|\*|/\*|<!--)\s*Traces to:\s*(?<ids>.+)$")]
    private static partial Regex TestHeader();

    [GeneratedRegex(@"\bL2-\d+\b")]
    private static partial Regex L2Id();

    [GeneratedRegex(@"^docs/detailed-designs/[^/]+/[^/]+/README\.md$")]
    private static partial Regex DesignReadme();

    [GeneratedRegex("^[0-9a-f]{7,40}$")]
    private static partial Regex ShortSha();
}

using System.Text.RegularExpressions;
using Hewn.Application.Abstractions;
using Hewn.Application.Common;
using Hewn.Application.Pipeline;
using Hewn.Domain;
using MediatR;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Options;

namespace Hewn.Application.Increments;

public sealed record GetIncrementQuery(Guid ProjectId, int Number) : IRequest<IncrementDetailDto>;

/// <summary>
/// One increment followed to merge (L2-021 AC3, L2-022 AC2, L2-024 AC3, L2-025): the test commit and red result,
/// iterations, green, the video, the pull request read from GitHub and its required checks as last reported.
/// </summary>
/// <param name="Branch">The increment's branch, <c>feature/{slug}</c>, as stage 10 names it.</param>
/// <param name="MovedOnTo">For a Blocked increment, the next one that doesn't depend on it, directly or through another.</param>
public sealed record IncrementDetailDto(
    Guid DirectionId,
    int Number,
    string Title,
    int? Journey,
    IReadOnlyList<string> L2Ids,
    decimal EstimateDays,
    string Branch,
    string Status,
    DateTimeOffset? StartedAt,
    int? TestCount,
    int? RedFailing,
    int? RedPassing,
    bool TestsPassedEarly,
    DateTimeOffset? TestsCommittedAt,
    int Iterations,
    int MaxIterations,
    int? GreenAfter,
    DateTimeOffset? GreenAt,
    string? Video,
    string? VideoNote,
    DateTimeOffset? VideoAt,
    IReadOnlyList<string> FailingTests,
    int? MovedOnTo,
    DateTimeOffset? PullRequestOpenedAt,
    DateTimeOffset? FinishedAt,
    PullRequestDetailDto? PullRequest,
    IReadOnlyList<IncrementCheckDto> Checks);

/// <param name="State">open or merged.</param>
/// <param name="Sections">The body's "## " sections in order; the Hewn attribution line apart.</param>
public sealed record PullRequestDetailDto(
    int Number,
    string Url,
    string Title,
    string State,
    int Additions,
    int Deletions,
    int ChangedFiles,
    IReadOnlyList<PullRequestSectionDto> Sections,
    string? Attribution);

public sealed record PullRequestSectionDto(string Heading, string Text);

/// <param name="Status">queued, in_progress or completed.</param>
/// <param name="Conclusion">success, failure and so on once completed.</param>
public sealed record IncrementCheckDto(string Name, string Status, string? Conclusion, DateTimeOffset? StartedAt, DateTimeOffset? CompletedAt, int? DurationSeconds);

public sealed partial class GetIncrementHandler(IAppDbContext db, IGitHubRepositories gitHub, IOptions<PipelineOptions> options)
    : IRequestHandler<GetIncrementQuery, IncrementDetailDto>
{
    public async Task<IncrementDetailDto> Handle(GetIncrementQuery query, CancellationToken cancellationToken)
    {
        var project = await db.Projects.AsNoTracking()
            .Include(p => p.Directions)
            .SingleOrDefaultAsync(p => p.Id == query.ProjectId, cancellationToken)
            ?? throw new NotFoundException();
        // The direction Projects and Backlog describe: the active one, else the latest.
        var direction = project.ActiveDirection ?? project.Directions.OrderByDescending(d => d.SubmittedAt).FirstOrDefault()
            ?? throw new NotFoundException();
        var backlog = await db.Increments.AsNoTracking()
            .Where(i => i.DirectionId == direction.Id && i.Number != null)
            .ToListAsync(cancellationToken);
        var increment = backlog.SingleOrDefault(i => i.Number == query.Number) ?? throw new NotFoundException();
        var checks = increment.PullRequestNumber is { } number
            ? await db.IncrementChecks.AsNoTracking()
                .Where(c => c.IncrementId == increment.Id && c.PullRequestNumber == number)
                .ToListAsync(cancellationToken)
            : [];

        // The pull request is read from GitHub each time; a GitHub failure is a 502 the page explains.
        var pull = increment.PullRequestNumber is { } n && project.RepositoryOwner is { } owner && project.RepositoryName is { } name
            ? await gitHub.GetPullRequestAsync(owner, name, n, cancellationToken)
            : null;

        return new IncrementDetailDto(
            direction.Id,
            increment.Number!.Value,
            increment.Title,
            increment.Journey,
            Split(increment.L2Ids, ','),
            increment.EstimateDays,
            $"feature/{Slug(increment.Title)}",
            increment.Status.ToString(),
            increment.StartedAt,
            increment.TestCount,
            increment.RedFailing,
            increment.RedPassing,
            increment.TestsPassedEarly,
            increment.TestsCommittedAt,
            increment.Iterations,
            options.Value.MaxIterations,
            increment.GreenAfter,
            increment.GreenAt,
            increment.Video,
            increment.VideoNote,
            increment.VideoAt,
            Split(increment.FailingTests, '\n'),
            increment.Status == IncrementStatus.Blocked ? MovedOnTo(increment, backlog) : null,
            increment.PullRequestOpenedAt,
            increment.FinishedAt,
            pull is null ? null : Describe(pull),
            [.. checks.OrderBy(c => c.Name, StringComparer.Ordinal).Select(c => new IncrementCheckDto(
                c.Name,
                c.Status,
                c.Conclusion,
                c.StartedAt,
                c.CompletedAt,
                c.StartedAt is { } started && c.CompletedAt is { } completed ? (int)(completed - started).TotalSeconds : null))]);
    }

    /// <summary>The first later increment that doesn't depend on the blocked one, directly or through another (L2-022 AC2).</summary>
    private static int? MovedOnTo(Increment blocked, IReadOnlyList<Increment> backlog)
    {
        var unreachable = new HashSet<int> { blocked.Number!.Value };
        foreach (var increment in backlog.OrderBy(i => i.Number))
        {
            if (IncrementRules.DependsOn(increment).Any(unreachable.Contains))
            {
                unreachable.Add(increment.Number!.Value);
            }
        }

        return backlog.Where(i => i.Number > blocked.Number && !unreachable.Contains(i.Number!.Value)).Min(i => i.Number);
    }

    /// <summary>Splits the body into its "## " sections; a last line starting "Built by Hewn" is the attribution (L2-024 AC2).</summary>
    private static PullRequestDetailDto Describe(PullRequestInfo pull)
    {
        var lines = SecretRedactor.Redact(pull.Body).Replace("\r\n", "\n").Split('\n').ToList();
        string? attribution = null;
        var last = lines.FindLastIndex(l => l.Trim().Length > 0);
        if (last >= 0 && lines[last].TrimStart().StartsWith("Built by Hewn", StringComparison.Ordinal))
        {
            attribution = lines[last].Trim();
            lines.RemoveAt(last);
        }

        var sections = new List<PullRequestSectionDto>();
        string? heading = null;
        var text = new List<string>();
        void Close()
        {
            if (heading is not null)
            {
                sections.Add(new PullRequestSectionDto(heading, string.Join('\n', text).Trim()));
            }
        }

        foreach (var line in lines)
        {
            if (line.StartsWith("## ", StringComparison.Ordinal))
            {
                Close();
                heading = line[3..].Trim();
                text.Clear();
            }
            else
            {
                text.Add(line);
            }
        }

        Close();
        return new PullRequestDetailDto(pull.Number, pull.Url, pull.Title, pull.Merged ? "merged" : "open", pull.Additions, pull.Deletions, pull.ChangedFiles, sections, attribution);
    }

    /// <summary>"Reconcile a card statement" becomes "reconcile-a-card-statement", as the worker's kebab does.</summary>
    private static string Slug(string title) => NonAlphanumeric().Replace(title.ToLowerInvariant(), "-").Trim('-');

    private static IReadOnlyList<string> Split(string? value, char separator) =>
        value is null ? [] : value.Split(separator, StringSplitOptions.RemoveEmptyEntries);

    [GeneratedRegex("[^a-z0-9]+")]
    private static partial Regex NonAlphanumeric();
}

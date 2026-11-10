using FluentValidation;
using Hewn.Application.Abstractions;
using Hewn.Application.Common;
using Hewn.Domain;
using MediatR;
using Microsoft.EntityFrameworkCore;

namespace Hewn.Application.Projects;

/// <param name="Stage">Only this stage's decisions; null for every stage.</param>
public sealed record GetDecisionsQuery(Guid ProjectId, int? Stage) : IRequest<DecisionsDto>;

public sealed class GetDecisionsValidator : AbstractValidator<GetDecisionsQuery>
{
    public GetDecisionsValidator()
    {
        RuleFor(q => q.Stage).InclusiveBetween(0, Stages.Count - 1).When(q => q.Stage is not null)
            .WithMessage($"A stage is 0 to {Stages.Count - 1}.");
    }
}

/// <summary>L2-054 AC3: the project's decisions, newest first, in its repository.</summary>
public sealed record DecisionsDto(string? Repository, IReadOnlyList<ProjectDecisionDto> Decisions);

/// <param name="Commit">The commit that recorded the decision in <c>docs/decisions.md</c>; null if none did.</param>
/// <param name="Adr">The ADR the decision also wrote (L2-054 AC2).</param>
public sealed record ProjectDecisionDto(
    long Id,
    int Stage,
    string StageName,
    string Question,
    string Answer,
    string Rationale,
    DateTimeOffset RecordedAt,
    string? Commit,
    string? CommitUrl,
    DecisionAdrDto? Adr);

/// <param name="Title">"ADR 0002", from the file's number.</param>
public sealed record DecisionAdrDto(string Path, string Title, string? Url);

/// <summary>
/// Lists the decisions Hewn kept as runs reported them (ADR 0020). Each was committed to <c>docs/decisions.md</c>
/// before it was reported, so its commit is known without reading the repository.
/// </summary>
public sealed class GetDecisionsHandler(IAppDbContext db) : IRequestHandler<GetDecisionsQuery, DecisionsDto>
{
    public async Task<DecisionsDto> Handle(GetDecisionsQuery query, CancellationToken cancellationToken)
    {
        var repository = await db.Projects.Where(p => p.Id == query.ProjectId).Select(p => new { p.Repository }).SingleOrDefaultAsync(cancellationToken)
            ?? throw new NotFoundException();

        var decisions = db.RunDecisions.AsNoTracking().Where(d => d.ProjectId == query.ProjectId);
        if (query.Stage is { } stage)
        {
            decisions = decisions.Where(d => d.Stage == stage);
        }

        var rows = await decisions.ToListAsync(cancellationToken);
        var repo = repository.Repository;
        return new DecisionsDto(
            repo,
            [.. rows
                .OrderByDescending(d => d.RecordedAt)
                .ThenByDescending(d => d.Id)
                .Select(d => new ProjectDecisionDto(
                    d.Id,
                    d.Stage,
                    d.Stage < Stages.Count ? Stages.Names[d.Stage] : $"Stage {d.Stage}",
                    d.Question,
                    d.Answer,
                    d.Rationale,
                    d.RecordedAt,
                    d.CommitSha,
                    repo is null || d.CommitSha is null ? null : $"https://github.com/{repo}/commit/{d.CommitSha}",
                    d.Adr is null ? null : new DecisionAdrDto(
                        d.Adr,
                        $"ADR {Path.GetFileName(d.Adr)[..4]}",
                        repo is null ? null : $"https://github.com/{repo}/blob/{d.CommitSha ?? "HEAD"}/{d.Adr}")))]);
    }
}

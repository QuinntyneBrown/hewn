using System.Text.RegularExpressions;
using FluentValidation;
using Hewn.Application.Abstractions;
using Hewn.Application.Audit;
using Hewn.Application.Common;
using Hewn.Application.Events;
using Hewn.Application.Pipeline;
using Hewn.Domain;
using MediatR;
using Microsoft.EntityFrameworkCore;

namespace Hewn.Application.Projects;

public sealed record SubmitProductDirectionCommand(
    string? Name,
    string? Idea,
    string? StackPreference,
    string? RepositoryUrl,
    decimal? BudgetUsd) : IRequest<SubmitProductDirectionResult>, IDirectionSubmission;

public sealed record SubmitProductDirectionResult(Guid ProjectId, Guid DirectionId);

public static partial class GitHubRepositoryUrl
{
    [GeneratedRegex(@"^https://github\.com/(?<owner>[A-Za-z0-9](?:[A-Za-z0-9-]{0,38}))/(?<repo>[A-Za-z0-9._-]{1,100})/?$")]
    private static partial Regex Pattern();

    public static bool TryParse(string? url, out RepositoryRef repository)
    {
        repository = new RepositoryRef(string.Empty, string.Empty);
        var match = url is null ? null : Pattern().Match(url.Trim());
        if (match is null || !match.Success)
        {
            return false;
        }

        var repo = match.Groups["repo"].Value;
        if (repo.EndsWith(".git", StringComparison.OrdinalIgnoreCase))
        {
            repo = repo[..^4];
        }

        repository = new RepositoryRef(match.Groups["owner"].Value, repo);
        return repo.Length > 0;
    }
}

public sealed class SubmitProductDirectionValidator : AbstractValidator<SubmitProductDirectionCommand>
{
    public const decimal MaxBudgetUsd = 100_000m;

    public SubmitProductDirectionValidator(IAppDbContext db)
    {
        RuleFor(c => c.Name)
            .Must(n => !string.IsNullOrWhiteSpace(n))
            .WithMessage("Enter a name.")
            .WithState(_ => "Enter a name")
            .DependentRules(() =>
            {
                RuleFor(c => c.Name!)
                    .Must(n => n.Trim().Length <= Project.MaxNameLength)
                    .WithMessage(c => $"Name must be 1 to 100 characters. This one has {c.Name!.Trim().Length:N0}.")
                    .WithState(_ => "Name must be 1 to 100 characters")
                    .DependentRules(() =>
                    {
                        RuleFor(c => c.Name!)
                            .MustAsync(async (n, ct) =>
                            {
                                var normalized = Project.Normalize(n);
                                return !await db.Projects.AnyAsync(p => p.NormalizedName == normalized, ct);
                            })
                            .WithMessage("Name is already used by another project. Pick a different name.")
                            .WithState(_ => "Name is already used by another project");
                    });
            })
            .OverridePropertyName("Name");

        RuleFor(c => c.Idea)
            .Must(i => i is { Length: >= Project.MinIdeaLength and <= Project.MaxIdeaLength })
            .WithMessage(c => $"The idea must be 10 to 20,000 characters. This one has {c.Idea?.Length ?? 0:N0}.")
            .WithState(_ => "The idea must be 10 to 20,000 characters");

        RuleFor(c => c.StackPreference)
            .MaximumLength(200)
            .WithMessage("Stack must be 200 characters or fewer.")
            .WithState(_ => "Stack must be 200 characters or fewer");

        RuleFor(c => c.RepositoryUrl)
            .Must(u => string.IsNullOrWhiteSpace(u) || GitHubRepositoryUrl.TryParse(u, out _))
            .WithMessage("Use a https://github.com/{owner}/{repo} URL.")
            .WithState(_ => "Existing repository must be a GitHub URL");

        // No budget means the default an Owner set in Settings (L2-053 AC1).
        RuleFor(c => c.BudgetUsd)
            .Must(b => b is null || (b > 0 && b <= MaxBudgetUsd))
            .WithMessage("Budget must be more than $0 and at most $100,000.")
            .WithState(_ => "Budget must be more than $0");
    }
}

public sealed class SubmitProductDirectionHandler(
    IAppDbContext db,
    IGitHubRepositoryProbe gitHub,
    ICurrentUser user,
    EventAppender events,
    PipelineOrchestrator pipeline,
    Spend.DirectionDefaultsReader defaults,
    AuditWriter audit,
    TimeProvider clock) : IRequestHandler<SubmitProductDirectionCommand, SubmitProductDirectionResult>
{
    public async Task<SubmitProductDirectionResult> Handle(SubmitProductDirectionCommand command, CancellationToken cancellationToken)
    {
        RepositoryRef? repository = null;
        if (!string.IsNullOrWhiteSpace(command.RepositoryUrl))
        {
            GitHubRepositoryUrl.TryParse(command.RepositoryUrl, out var parsed);
            repository = parsed;
            await EnsureWritableAsync(parsed, cancellationToken);
        }

        var startsWith = await defaults.ReadAsync(cancellationToken);
        var project = Project.CreateWithProductDirection(
            command.Name!,
            command.Idea!,
            string.IsNullOrWhiteSpace(command.StackPreference) ? null : command.StackPreference.Trim(),
            repository,
            command.BudgetUsd ?? startsWith.DefaultBudgetUsd,
            user.Login,
            clock.GetUtcNow());
        var direction = project.Directions[0];
        direction.StartWithDescopeThreshold(startsWith.DescopeThresholdDays);

        db.Projects.Add(project);
        await events.AppendAsync(
            project.Id,
            "DirectionQueued",
            new { directionId = direction.Id, kind = direction.Kind.ToString(), stage = 0, stageStatus = StageStatus.Pending.ToString() },
            cancellationToken);
        pipeline.QueueFirstRun(direction);
        audit.Record(AuditAction.DirectionSubmitted, user.Login, project);

        try
        {
            await db.SaveChangesAsync(cancellationToken);
        }
        catch (DbUpdateException)
        {
            // Another request may have taken the name between validation and commit.
            var normalized = project.NormalizedName;
            if (!await db.Projects.AsNoTracking().AnyAsync(p => p.NormalizedName == normalized, cancellationToken))
            {
                throw;
            }

            throw new FieldValidationException(
            [
                new FieldError("name", "Name is already used by another project. Pick a different name.", "Name is already used by another project"),
            ]);
        }

        await events.PublishAsync(cancellationToken);
        return new SubmitProductDirectionResult(project.Id, direction.Id);
    }

    private async Task EnsureWritableAsync(RepositoryRef repository, CancellationToken cancellationToken)
    {
        var access = await gitHub.ProbeAsync(repository.Owner, repository.Name, cancellationToken);
        var fullName = $"{repository.Owner}/{repository.Name}";
        switch (access)
        {
            case RepositoryAccess.NotFound:
                throw new FieldValidationException(
                    [new FieldError("repositoryUrl", $"Hewn can’t find {fullName} on GitHub. Check the URL, or leave this empty to create one.", "Hewn can’t find this repository")],
                    "repository_not_found");
            case RepositoryAccess.NoAccess:
                throw new FieldValidationException(
                    [new FieldError("repositoryUrl", $"Hewn’s GitHub App can’t write to {fullName}. Install the app on that repository, or leave this empty to create one.", "Hewn can’t write to this repository")],
                    "repository_not_writable");
        }
    }
}

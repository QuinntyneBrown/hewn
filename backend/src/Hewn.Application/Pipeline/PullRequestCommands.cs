using System.Text.Json;
using FluentValidation;
using Hewn.Application.Abstractions;
using Hewn.Application.Common;
using Hewn.Domain;
using MediatR;
using Microsoft.EntityFrameworkCore;

namespace Hewn.Application.Pipeline;

public sealed record PullRequestDto(int Number, string Url);

public sealed record CheckDto(string Name, string Status, string? Conclusion);

public sealed record OpenPullRequestCommand(Guid RunId, string WorkerId, long Epoch, string IdempotencyKey, string Head, string Title, string Body)
    : IRequest<PullRequestDto>;

public sealed record MergePullRequestCommand(Guid RunId, string WorkerId, long Epoch, string IdempotencyKey, int Number) : IRequest<string>;

public sealed record ProtectDefaultBranchCommand(Guid RunId, string WorkerId, long Epoch, string IdempotencyKey, IReadOnlyList<string> Checks) : IRequest;

public sealed record GetPullRequestChecksQuery(Guid RunId, string WorkerId, long Epoch, int Number) : IRequest<IReadOnlyList<CheckDto>>;

public sealed class OpenPullRequestValidator : AbstractValidator<OpenPullRequestCommand>
{
    public OpenPullRequestValidator()
    {
        RuleFor(c => c.IdempotencyKey).MustStartWithRun(c => c.RunId);
        RuleFor(c => c.Title).NotEmpty().MaximumLength(256);
        RuleFor(c => c.Body).NotNull().MaximumLength(65_000);
        RuleFor(c => c.Head).NotEmpty();
    }
}

public sealed class MergePullRequestValidator : AbstractValidator<MergePullRequestCommand>
{
    public MergePullRequestValidator()
    {
        RuleFor(c => c.IdempotencyKey).MustStartWithRun(c => c.RunId);
        RuleFor(c => c.Number).GreaterThan(0);
    }
}

public sealed class ProtectDefaultBranchValidator : AbstractValidator<ProtectDefaultBranchCommand>
{
    public ProtectDefaultBranchValidator()
    {
        RuleFor(c => c.IdempotencyKey).MustStartWithRun(c => c.RunId);
        RuleFor(c => c.Checks).NotEmpty().Must(c => c.Count <= 50);
        RuleForEach(c => c.Checks).NotEmpty().MaximumLength(200);
    }
}

/// <summary>Stage 6 opens its pull request from <c>hewn/scaffold</c>; the key makes a repeated request return the first one.</summary>
public sealed class OpenPullRequestHandler(IAppDbContext db, LeaseService leases, IGitHubRepositories gitHub, TimeProvider clock)
    : IRequestHandler<OpenPullRequestCommand, PullRequestDto>
{
    public async Task<PullRequestDto> Handle(OpenPullRequestCommand command, CancellationToken cancellationToken)
    {
        var run = await leases.FenceAsync(command.RunId, command.WorkerId, command.Epoch, cancellationToken);
        if (await MutationLedger.FindAsync(db, command.IdempotencyKey, cancellationToken) is { } done)
        {
            return JsonSerializer.Deserialize<PullRequestDto>(done, MutationLedger.Json)!;
        }

        CommitPolicy.EnsurePullRequestsAllowed(run.Stage);
        CommitPolicy.EnsureAllowed(run.Stage, command.Head, []);
        var project = await RunProject.RequireRepositoryAsync(db, run, cancellationToken);
        var pull = await gitHub.OpenPullRequestAsync(project.RepositoryOwner!, project.RepositoryName!, command.Head, command.Title, command.Body, cancellationToken);
        var result = new PullRequestDto(pull.Number, pull.Url);
        await MutationLedger.RecordAsync(db, run, command.IdempotencyKey, "open_pull_request", result, clock, cancellationToken);
        return result;
    }
}

public sealed class MergePullRequestHandler(IAppDbContext db, LeaseService leases, IGitHubRepositories gitHub, TimeProvider clock)
    : IRequestHandler<MergePullRequestCommand, string>
{
    public async Task<string> Handle(MergePullRequestCommand command, CancellationToken cancellationToken)
    {
        var run = await leases.FenceAsync(command.RunId, command.WorkerId, command.Epoch, cancellationToken);
        if (await MutationLedger.FindAsync(db, command.IdempotencyKey, cancellationToken) is { } done)
        {
            return JsonDocument.Parse(done).RootElement.GetProperty("sha").GetString()!;
        }

        CommitPolicy.EnsurePullRequestsAllowed(run.Stage);
        var project = await RunProject.RequireRepositoryAsync(db, run, cancellationToken);
        await ScaffoldPullRequest.RequireAsync(gitHub, project, command.Number, cancellationToken);
        var sha = await gitHub.MergePullRequestAsync(project.RepositoryOwner!, project.RepositoryName!, command.Number, "Scaffold the solution", cancellationToken);
        await MutationLedger.RecordAsync(db, run, command.IdempotencyKey, "merge_pull_request", new { sha }, clock, cancellationToken);
        return sha;
    }
}

/// <summary>After the scaffold merges, the default branch requires its CI checks (L2-036 AC2).</summary>
public sealed class ProtectDefaultBranchHandler(IAppDbContext db, LeaseService leases, IGitHubRepositories gitHub, TimeProvider clock)
    : IRequestHandler<ProtectDefaultBranchCommand>
{
    public async Task Handle(ProtectDefaultBranchCommand command, CancellationToken cancellationToken)
    {
        var run = await leases.FenceAsync(command.RunId, command.WorkerId, command.Epoch, cancellationToken);
        if (await MutationLedger.FindAsync(db, command.IdempotencyKey, cancellationToken) is not null)
        {
            return;
        }

        CommitPolicy.EnsurePullRequestsAllowed(run.Stage);
        var project = await RunProject.RequireRepositoryAsync(db, run, cancellationToken);
        await gitHub.ProtectDefaultBranchAsync(project.RepositoryOwner!, project.RepositoryName!, command.Checks, cancellationToken);
        await MutationLedger.RecordAsync(db, run, command.IdempotencyKey, "protect_branch", new { checks = command.Checks }, clock, cancellationToken);
    }
}

public sealed class GetPullRequestChecksHandler(IAppDbContext db, LeaseService leases, IGitHubRepositories gitHub)
    : IRequestHandler<GetPullRequestChecksQuery, IReadOnlyList<CheckDto>>
{
    public async Task<IReadOnlyList<CheckDto>> Handle(GetPullRequestChecksQuery query, CancellationToken cancellationToken)
    {
        var run = await leases.FenceAsync(query.RunId, query.WorkerId, query.Epoch, cancellationToken);
        CommitPolicy.EnsurePullRequestsAllowed(run.Stage);
        var project = await RunProject.RequireRepositoryAsync(db, run, cancellationToken);
        await ScaffoldPullRequest.RequireAsync(gitHub, project, query.Number, cancellationToken);
        var checks = await gitHub.ListChecksAsync(project.RepositoryOwner!, project.RepositoryName!, query.Number, cancellationToken);
        return [.. checks.Select(c => new CheckDto(c.Name, c.Status, c.Conclusion))];
    }
}

internal static class ScaffoldPullRequest
{
    /// <summary>Stage 6 touches only the pull request from its own branch.</summary>
    public static async Task RequireAsync(IGitHubRepositories gitHub, Project project, int number, CancellationToken cancellationToken)
    {
        var pull = await gitHub.GetPullRequestAsync(project.RepositoryOwner!, project.RepositoryName!, number, cancellationToken);
        if (pull is null || pull.Head != CommitPolicy.ScaffoldBranch)
        {
            throw new FieldValidationException(
                [new FieldError("number", $"Pull request #{number} is not the scaffold pull request.", "Not the scaffold pull request")],
                "mutation_not_allowed");
        }
    }
}

/// <summary>The record of GitHub mutations by idempotency key, so a resumed worker never repeats one.</summary>
internal static class MutationLedger
{
    public static readonly JsonSerializerOptions Json = new(JsonSerializerDefaults.Web);

    public static async Task<string?> FindAsync(IAppDbContext db, string key, CancellationToken cancellationToken) =>
        (await db.GitHubMutations.AsNoTracking().SingleOrDefaultAsync(m => m.IdempotencyKey == key, cancellationToken))?.Result;

    public static async Task RecordAsync(IAppDbContext db, Run run, string key, string kind, object result, TimeProvider clock, CancellationToken cancellationToken)
    {
        db.GitHubMutations.Add(new GitHubMutation(run.Id, key, kind, JsonSerializer.Serialize(result, Json), clock.GetUtcNow()));
        await FencedSave.SaveAsync(db, cancellationToken);
    }
}

internal static class IdempotencyKeyRules
{
    public static IRuleBuilderOptions<T, string> MustStartWithRun<T>(this IRuleBuilder<T, string> rule, Func<T, Guid> runId) =>
        rule.NotEmpty().MaximumLength(200)
            .Must((c, key) => key.StartsWith($"{runId(c)}/", StringComparison.Ordinal))
            .WithMessage("The idempotency key must start with the run ID.");
}

using System.Text.Json;
using FluentValidation;
using Hewn.Application.Abstractions;
using Hewn.Application.Common;
using Hewn.Application.Events;
using Hewn.Domain;
using MediatR;
using Microsoft.EntityFrameworkCore;

namespace Hewn.Application.Pipeline;

public sealed record ListSkillFoldersQuery(Guid RunId, string WorkerId, long Epoch) : IRequest<IReadOnlyDictionary<string, IReadOnlyList<string>>>;

public sealed class ListSkillFoldersHandler(IAppDbContext db, LeaseService leases, IGitHubRepositories gitHub)
    : IRequestHandler<ListSkillFoldersQuery, IReadOnlyDictionary<string, IReadOnlyList<string>>>
{
    public static readonly string[] SkillRoots = [".claude/skills", ".agents/skills"];

    public async Task<IReadOnlyDictionary<string, IReadOnlyList<string>>> Handle(ListSkillFoldersQuery query, CancellationToken cancellationToken)
    {
        var run = await leases.FenceAsync(query.RunId, query.WorkerId, query.Epoch, cancellationToken);
        var project = await RunProject.RequireRepositoryAsync(db, run, cancellationToken);
        var result = new Dictionary<string, IReadOnlyList<string>>();
        foreach (var root in SkillRoots)
        {
            result[root] = await gitHub.ListDirectoriesAsync(project.RepositoryOwner!, project.RepositoryName!, root, cancellationToken);
        }

        return result;
    }
}

public sealed record GetRepositoryArchiveQuery(Guid RunId, string WorkerId, long Epoch) : IRequest<Stream>;

/// <summary>The product repository's default branch, so a stage can work on the files earlier stages wrote.</summary>
public sealed class GetRepositoryArchiveHandler(IAppDbContext db, LeaseService leases, IGitHubRepositories gitHub)
    : IRequestHandler<GetRepositoryArchiveQuery, Stream>
{
    public async Task<Stream> Handle(GetRepositoryArchiveQuery query, CancellationToken cancellationToken)
    {
        var run = await leases.FenceAsync(query.RunId, query.WorkerId, query.Epoch, cancellationToken);
        var project = await RunProject.RequireRepositoryAsync(db, run, cancellationToken);
        return await gitHub.DownloadArchiveAsync(project.RepositoryOwner!, project.RepositoryName!, cancellationToken);
    }
}

public sealed record CommitFile(string Path, string ContentBase64);

/// <param name="Branch">Null for the default branch; only stage 6 commits to a branch, and only to <c>hewn/scaffold</c>.</param>
public sealed record CommitFilesCommand(Guid RunId, string WorkerId, long Epoch, string IdempotencyKey, string Message, IReadOnlyList<CommitFile> Files, string? Branch = null, bool Rebase = false)
    : IRequest<string>;

public sealed class CommitFilesValidator : AbstractValidator<CommitFilesCommand>
{
    public CommitFilesValidator()
    {
        RuleFor(c => c.Message).NotEmpty().MaximumLength(500);
        RuleFor(c => c.IdempotencyKey).NotEmpty().MaximumLength(200)
            .Must((c, key) => key.StartsWith($"{c.RunId}/", StringComparison.Ordinal))
            .WithMessage("The idempotency key must start with the run ID.");
        RuleFor(c => c.Files).NotEmpty().Must(f => f.Count <= 5000);
        RuleForEach(c => c.Files).Must(f => IsBase64(f.ContentBase64)).WithMessage("File content must be base64.");
    }

    private static bool IsBase64(string value) => Convert.TryFromBase64String(value, new byte[value.Length], out _);
}

/// <summary>
/// The broker's commit mutation: fenced by lease, restricted by stage, and idempotent by key, so a resumed
/// worker that repeats a request gets the first commit's SHA instead of a second commit.
/// </summary>
public sealed class CommitFilesHandler(IAppDbContext db, LeaseService leases, IGitHubRepositories gitHub, TimeProvider clock)
    : IRequestHandler<CommitFilesCommand, string>
{
    private const string Kind = "commit";

    public async Task<string> Handle(CommitFilesCommand command, CancellationToken cancellationToken)
    {
        var run = await leases.FenceAsync(command.RunId, command.WorkerId, command.Epoch, cancellationToken);
        var done = await db.GitHubMutations.AsNoTracking()
            .SingleOrDefaultAsync(m => m.IdempotencyKey == command.IdempotencyKey, cancellationToken);
        if (done is not null)
        {
            return Sha(done.Result);
        }

        CommitPolicy.EnsureAllowed(run.Stage, command.Branch, command.Files.Select(f => f.Path));
        var project = await RunProject.RequireRepositoryAsync(db, run, cancellationToken);
        var files = command.Files.Select(f => new RepositoryFile(f.Path, Convert.FromBase64String(f.ContentBase64))).ToList();
        var sha = command.Branch is null
            ? await gitHub.CommitAsync(project.RepositoryOwner!, project.RepositoryName!, command.Message, files, cancellationToken)
            : await gitHub.CommitToBranchAsync(project.RepositoryOwner!, project.RepositoryName!, command.Branch, command.Message, files, command.Rebase, cancellationToken);

        db.GitHubMutations.Add(new GitHubMutation(run.Id, command.IdempotencyKey, Kind, JsonSerializer.Serialize(new { sha, paths = files.Select(f => f.Path) }), clock.GetUtcNow()));
        await FencedSave.SaveAsync(db, cancellationToken);
        return sha;
    }

    private static string Sha(string result) => JsonDocument.Parse(result).RootElement.GetProperty("sha").GetString()!;
}

public sealed record RunLogEntry(string Level, string Text);

public sealed record AppendRunLogCommand(Guid RunId, string WorkerId, long Epoch, IReadOnlyList<RunLogEntry> Lines) : IRequest;

public sealed class AppendRunLogValidator : AbstractValidator<AppendRunLogCommand>
{
    public AppendRunLogValidator()
    {
        RuleFor(c => c.Lines).NotEmpty().Must(l => l.Count <= 500);
        RuleForEach(c => c.Lines).Must(l => l.Level is "info" or "warn" or "error").WithMessage("Level must be info, warn or error.");
    }
}

/// <summary>
/// Stores a batch of log lines, numbered per run and redacted, and sends them as one <c>LogLines</c> event so an
/// open log and the running stage's latest line update live (L2-031, L2-033).
/// </summary>
public sealed class AppendRunLogHandler(IAppDbContext db, LeaseService leases, EventAppender events, TimeProvider clock) : IRequestHandler<AppendRunLogCommand>
{
    public async Task Handle(AppendRunLogCommand command, CancellationToken cancellationToken)
    {
        var run = await leases.FenceAsync(command.RunId, command.WorkerId, command.Epoch, cancellationToken);
        await events.LockAsync(run.ProjectId, cancellationToken);
        var last = await db.RunLogLines.Where(l => l.RunId == run.Id).Select(l => (long?)l.Sequence).MaxAsync(cancellationToken) ?? 0;
        var now = clock.GetUtcNow();
        var lines = command.Lines.Select(line => new RunLogLine(run.Id, ++last, line.Level, SecretRedactor.Redact(line.Text), now)).ToList();
        db.RunLogLines.AddRange(lines);
        await events.AppendAsync(
            run.ProjectId,
            "LogLines",
            new
            {
                directionId = run.DirectionId,
                stage = run.Stage,
                runId = run.Id,
                lines = lines.Select(l => new { line = l.Sequence, at = l.At, level = l.Level, text = l.Text }),
            },
            cancellationToken);
        await FencedSave.SaveAsync(db, cancellationToken);
        await events.PublishAsync(cancellationToken);
    }
}

internal static class RunProject
{
    public static async Task<Project> RequireRepositoryAsync(IAppDbContext db, Run run, CancellationToken cancellationToken)
    {
        var project = await db.Projects.AsNoTracking().SingleAsync(p => p.Id == run.ProjectId, cancellationToken);
        return project.Repository is null
            ? throw new GitHubException("The project has no repository yet.")
            : project;
    }
}

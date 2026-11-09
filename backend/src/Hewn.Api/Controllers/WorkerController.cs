using Hewn.Api.Auth;
using Hewn.Application.Pipeline;
using Hewn.Domain;
using MediatR;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;

namespace Hewn.Api.Controllers;

/// <summary>The worker protocol. Every call that names a run carries the worker ID and the lease epoch.</summary>
[ApiController]
[Route("api/worker")]
[Authorize(AuthenticationSchemes = WorkerTokenAuthenticationHandler.SchemeName)]
[IgnoreAntiforgeryToken]
public sealed class WorkerController(IMediator mediator) : ControllerBase
{
    public sealed record RegisterRequest(string Name, string Location, string Host, string Version);

    public sealed record WorkerRequest(string WorkerId);

    public sealed record FencedRequest(string WorkerId, long Epoch);

    public sealed record CheckpointRequest(string WorkerId, long Epoch, int Step, string? Sha);

    public sealed record ResultRequest(string WorkerId, long Epoch, string Outcome, string? Error);

    /// <summary>One broker mutation; which fields apply depends on the kind.</summary>
    public sealed record MutationRequest(
        string WorkerId,
        long Epoch,
        string Kind,
        string IdempotencyKey,
        string? Message = null,
        IReadOnlyList<CommitFile>? Files = null,
        string? Branch = null,
        string? Head = null,
        string? Title = null,
        string? Body = null,
        int? Number = null,
        IReadOnlyList<string>? Checks = null,
        bool Rebase = false);

    public sealed record LogRequest(string WorkerId, long Epoch, IReadOnlyList<RunLogEntry> Lines);

    public sealed record IncrementRequest(
        string WorkerId,
        long Epoch,
        IncrementStatus Status,
        int? RedFailing = null,
        int? RedPassing = null,
        int? Iterations = null,
        IReadOnlyList<string>? FailingTests = null,
        int? PullRequestNumber = null);

    public sealed record BacklogRequest(string WorkerId, long Epoch, IReadOnlyList<PlannedIncrement> Increments, IReadOnlyList<DeferredDesign> Deferred);

    [HttpPost("register")]
    public async Task<IActionResult> Register(RegisterRequest request, CancellationToken cancellationToken) =>
        Ok(new { workerId = await mediator.Send(new RegisterWorkerCommand(request.Name, request.Location, request.Host, request.Version), cancellationToken) });

    /// <summary>200 with the leased run, or 204 when there is no work.</summary>
    [HttpPost("lease")]
    public async Task<IActionResult> Lease(WorkerRequest request, CancellationToken cancellationToken)
    {
        var run = await mediator.Send(new LeaseRunCommand(request.WorkerId), cancellationToken);
        return run is null ? NoContent() : Ok(run);
    }

    [HttpPost("runs/{runId:guid}/heartbeat")]
    public async Task<IActionResult> Heartbeat(Guid runId, FencedRequest request, CancellationToken cancellationToken)
    {
        await mediator.Send(new HeartbeatCommand(runId, request.WorkerId, request.Epoch), cancellationToken);
        return NoContent();
    }

    [HttpPost("runs/{runId:guid}/checkpoints")]
    public async Task<IActionResult> Checkpoint(Guid runId, CheckpointRequest request, CancellationToken cancellationToken)
    {
        await mediator.Send(new ReportCheckpointCommand(runId, request.WorkerId, request.Epoch, request.Step, request.Sha), cancellationToken);
        return NoContent();
    }

    [HttpPost("runs/{runId:guid}/result")]
    public async Task<IActionResult> Result(Guid runId, ResultRequest request, CancellationToken cancellationToken)
    {
        await mediator.Send(new ReportResultCommand(runId, request.WorkerId, request.Epoch, request.Outcome, request.Error), cancellationToken);
        return NoContent();
    }

    /// <summary>Skill folder names already in the product repository, under each skill root.</summary>
    [HttpGet("runs/{runId:guid}/repository/skill-folders")]
    public Task<IReadOnlyDictionary<string, IReadOnlyList<string>>> SkillFolders(Guid runId, [FromQuery] string workerId, [FromQuery] long epoch, CancellationToken cancellationToken) =>
        mediator.Send(new ListSkillFoldersQuery(runId, workerId, epoch), cancellationToken);

    /// <summary>The default branch as a gzipped tarball with one top-level folder.</summary>
    [HttpGet("runs/{runId:guid}/repository/archive")]
    public async Task<IActionResult> Archive(Guid runId, [FromQuery] string workerId, [FromQuery] long epoch, CancellationToken cancellationToken) =>
        File(await mediator.Send(new GetRepositoryArchiveQuery(runId, workerId, epoch), cancellationToken), "application/gzip");

    /// <summary>The GitHub write broker. Only `commit` exists so far; workers never hold a GitHub credential.</summary>
    [HttpPost("runs/{runId:guid}/github/mutations")]
    public async Task<IActionResult> Mutate(Guid runId, MutationRequest request, CancellationToken cancellationToken)
    {
        var (worker, epoch, key) = (request.WorkerId, request.Epoch, request.IdempotencyKey);
        switch (request.Kind)
        {
            case "commit":
                var sha = await mediator.Send(new CommitFilesCommand(runId, worker, epoch, key, request.Message ?? string.Empty, request.Files ?? [], request.Branch, request.Rebase), cancellationToken);
                return Ok(new { sha });
            case "open_pull_request":
                return Ok(await mediator.Send(new OpenPullRequestCommand(runId, worker, epoch, key, request.Head ?? string.Empty, request.Title ?? string.Empty, request.Body ?? string.Empty), cancellationToken));
            case "merge_pull_request":
                return Ok(new { sha = await mediator.Send(new MergePullRequestCommand(runId, worker, epoch, key, request.Number ?? 0), cancellationToken) });
            case "protect_branch":
                await mediator.Send(new ProtectDefaultBranchCommand(runId, worker, epoch, key, request.Checks ?? []), cancellationToken);
                return Ok(new { });
            default:
                return Problem(statusCode: StatusCodes.Status400BadRequest, title: $"Unknown mutation kind {request.Kind}.");
        }
    }

    /// <summary>Checks on a pull request's head commit, for the scaffold stage's CI wait.</summary>
    [HttpGet("runs/{runId:guid}/pull-requests/{number:int}/checks")]
    public async Task<IActionResult> Checks(Guid runId, int number, [FromQuery] string workerId, [FromQuery] long epoch, CancellationToken cancellationToken) =>
        Ok(new { checks = await mediator.Send(new GetPullRequestChecksQuery(runId, workerId, epoch, number), cancellationToken) });

    /// <summary>Stage 9's backlog: the ordered increments and the descoped designs with reasons.</summary>
    [HttpPut("runs/{runId:guid}/backlog")]
    public async Task<IActionResult> Backlog(Guid runId, BacklogRequest request, CancellationToken cancellationToken)
    {
        await mediator.Send(new RecordBacklogCommand(runId, request.WorkerId, request.Epoch, request.Increments ?? [], request.Deferred ?? []), cancellationToken);
        return NoContent();
    }

    /// <summary>Stage 10: the next runnable increment, or 204 when none is left.</summary>
    [HttpGet("runs/{runId:guid}/increments/next")]
    public async Task<IActionResult> NextIncrement(Guid runId, [FromQuery] string workerId, [FromQuery] long epoch, CancellationToken cancellationToken)
    {
        var next = await mediator.Send(new GetNextIncrementQuery(runId, workerId, epoch), cancellationToken);
        return next is null ? NoContent() : Ok(next);
    }

    /// <summary>Stage 10's progress on one increment: started, red recorded, Blocked or Merged.</summary>
    [HttpPut("runs/{runId:guid}/increments/{number:int}")]
    public async Task<IActionResult> UpdateIncrement(Guid runId, int number, IncrementRequest request, CancellationToken cancellationToken)
    {
        await mediator.Send(new UpdateIncrementCommand(runId, request.WorkerId, request.Epoch, number, request.Status, request.RedFailing, request.RedPassing, request.Iterations, request.FailingTests, request.PullRequestNumber), cancellationToken);
        return NoContent();
    }

    [HttpPost("runs/{runId:guid}/logs")]
    public async Task<IActionResult> Logs(Guid runId, LogRequest request, CancellationToken cancellationToken)
    {
        await mediator.Send(new AppendRunLogCommand(runId, request.WorkerId, request.Epoch, request.Lines), cancellationToken);
        return NoContent();
    }
}

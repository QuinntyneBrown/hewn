using Hewn.Api.Auth;
using Hewn.Api.Logging;
using Hewn.Application.Pipeline;
using Hewn.Application.Spend;
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
[TypeFilter<RunLogScopeFilter>]
public sealed class WorkerController(IMediator mediator, ILogger<WorkerController> logger) : ControllerBase
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

    public sealed record StepRequest(string WorkerId, long Epoch, int Step, string Name);

    public sealed record ModelCallRequest(string WorkerId, long Epoch, string CallId, string Model, long InputTokens, long OutputTokens);

    public sealed record DecisionsRequest(string WorkerId, long Epoch, IReadOnlyList<ReportedDecision> Decisions);

    public sealed record IncrementRequest(
        string WorkerId,
        long Epoch,
        IncrementStatus Status,
        int? RedFailing = null,
        int? RedPassing = null,
        int? Iterations = null,
        IReadOnlyList<string>? FailingTests = null,
        int? PullRequestNumber = null,
        int? TestCount = null,
        int? GreenAfter = null,
        string? Video = null,
        string? VideoNote = null);

    public sealed record ScopeRequest(string WorkerId, long Epoch, bool HasUiChange, string? Rationale);

    public sealed record BacklogRequest(string WorkerId, long Epoch, IReadOnlyList<PlannedIncrement> Increments, IReadOnlyList<DeferredDesign> Deferred);

    [HttpPost("register")]
    public async Task<IActionResult> Register(RegisterRequest request, CancellationToken cancellationToken) =>
        Ok(new
        {
            workerId = await mediator.Send(
                new RegisterWorkerCommand(request.Name, request.Location, request.Host, request.Version, User.FindFirst(WorkerTokenAuthenticationHandler.TokenIdClaim)?.Value),
                cancellationToken),
        });

    /// <summary>
    /// 200 with the leased run, or 204 when there is no work. With <paramref name="waitSeconds"/> (at most 30), an idle
    /// worker's request is held until work is queued or the wait ends: the server's push (L2-026 AC5).
    /// </summary>
    [HttpPost("lease")]
    public async Task<IActionResult> Lease(WorkerRequest request, [FromQuery] int waitSeconds, [FromServices] HeldLease held, CancellationToken cancellationToken)
    {
        var run = await held.LeaseAsync(request.WorkerId, waitSeconds, cancellationToken);
        if (run is null)
        {
            return NoContent();
        }

        // Logged in the run's trace, not the idle worker's poll (L2-049 AC1).
        using (RunTracing.Start("Run leased", run.TraceParent))
        using (logger.BeginRunScope(new RunCorrelation(run.ProjectId, run.DirectionId, run.Stage, run.RunId)))
        {
            logger.LogInformation("Leased run {RunId} at stage {Stage} to worker {WorkerId}, attempt {Attempt}", run.RunId, run.Stage, request.WorkerId, run.Attempt);
        }

        return Ok(run);
    }

    [HttpPost("runs/{runId:guid}/heartbeat")]
    public async Task<IActionResult> Heartbeat(Guid runId, FencedRequest request, CancellationToken cancellationToken)
    {
        await mediator.Send(new HeartbeatCommand(runId, request.WorkerId, request.Epoch), cancellationToken);
        return NoContent();
    }

    [HttpPost("runs/{runId:guid}/checkpoints")]
    public Task<CheckpointVerdict> Checkpoint(Guid runId, CheckpointRequest request, CancellationToken cancellationToken) =>
        mediator.Send(new ReportCheckpointCommand(runId, request.WorkerId, request.Epoch, request.Step, request.Sha), cancellationToken);

    /// <summary>
    /// The control poll, held open up to waitSeconds while the run executes: 200 {control: "Cancel"} the moment the
    /// run is cancelled (L2-029 AC3), else 204 and the worker polls again.
    /// </summary>
    [HttpGet("runs/{runId:guid}/control")]
    public async Task<IActionResult> Control(Guid runId, [FromQuery] string workerId, [FromQuery] long epoch, [FromQuery] int waitSeconds, CancellationToken cancellationToken) =>
        await mediator.Send(new PollRunControlQuery(runId, workerId, epoch, waitSeconds), cancellationToken) is { } control
            ? Ok(new { control })
            : NoContent();

    [HttpPost("runs/{runId:guid}/result")]
    public async Task<IActionResult> Result(Guid runId, ResultRequest request, CancellationToken cancellationToken)
    {
        await mediator.Send(new ReportResultCommand(runId, request.WorkerId, request.Epoch, request.Outcome, request.Error), cancellationToken);
        if (request.Outcome == "Succeeded")
        {
            logger.LogInformation("Run succeeded");
        }
        else
        {
            logger.LogWarning("Run failed: {Error}", request.Error);
        }

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

    /// <summary>The step the worker starts, shown live on the running stage (L2-030 AC2).</summary>
    [HttpPut("runs/{runId:guid}/step")]
    public async Task<IActionResult> Step(Guid runId, StepRequest request, CancellationToken cancellationToken)
    {
        await mediator.Send(new StartStepCommand(runId, request.WorkerId, request.Epoch, request.Step, request.Name), cancellationToken);
        return NoContent();
    }

    /// <summary>
    /// A model call the run made (L2-052 AC1). The answer is the budget verdict: Continue, Warn, or Stop, which
    /// means the direction is Paused with "Budget reached" and the worker ends the run after this call (L2-053).
    /// </summary>
    [HttpPost("runs/{runId:guid}/model-calls")]
    public Task<ModelCallVerdict> ModelCall(Guid runId, ModelCallRequest request, CancellationToken cancellationToken) =>
        mediator.Send(
            new RecordModelCallCommand(runId, request.WorkerId, request.Epoch, request.CallId, request.Model, request.InputTokens, request.OutputTokens),
            cancellationToken);

    /// <summary>The decisions the run recorded in docs/decisions.md (L2-054), for the stage's Decisions tab.</summary>
    [HttpPost("runs/{runId:guid}/decisions")]
    public async Task<IActionResult> Decisions(Guid runId, DecisionsRequest request, CancellationToken cancellationToken)
    {
        await mediator.Send(new RecordDecisionsCommand(runId, request.WorkerId, request.Epoch, request.Decisions), cancellationToken);
        return NoContent();
    }

    /// <summary>Stage 1 of a feature direction: the recorded decision on whether the feature changes the UI.</summary>
    [HttpPut("runs/{runId:guid}/scope")]
    public async Task<IActionResult> Scope(Guid runId, ScopeRequest request, CancellationToken cancellationToken)
    {
        await mediator.Send(new ReportScopeCommand(runId, request.WorkerId, request.Epoch, request.HasUiChange, request.Rationale), cancellationToken);
        return NoContent();
    }

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

    /// <summary>Stage 10's progress on one increment: started, red recorded, each iteration, green, the video, the pull request, Blocked or Merged.</summary>
    [HttpPut("runs/{runId:guid}/increments/{number:int}")]
    public async Task<IActionResult> UpdateIncrement(Guid runId, int number, IncrementRequest request, CancellationToken cancellationToken)
    {
        await mediator.Send(new UpdateIncrementCommand(runId, request.WorkerId, request.Epoch, number, new IncrementProgress(request.Status, request.RedFailing, request.RedPassing, request.Iterations, request.FailingTests, request.PullRequestNumber, request.TestCount, request.GreenAfter, request.Video, request.VideoNote)), cancellationToken);
        return NoContent();
    }

    [HttpPost("runs/{runId:guid}/logs")]
    public async Task<IActionResult> Logs(Guid runId, LogRequest request, CancellationToken cancellationToken)
    {
        await mediator.Send(new AppendRunLogCommand(runId, request.WorkerId, request.Epoch, request.Lines), cancellationToken);
        return NoContent();
    }
}

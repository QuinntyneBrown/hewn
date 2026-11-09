using Hewn.Api.Auth;
using Hewn.Application.Pipeline;
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

    public sealed record MutationRequest(string WorkerId, long Epoch, string Kind, string IdempotencyKey, string Message, IReadOnlyList<CommitFile> Files);

    public sealed record LogRequest(string WorkerId, long Epoch, IReadOnlyList<RunLogEntry> Lines);

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

    /// <summary>The GitHub write broker. Only `commit` exists so far; workers never hold a GitHub credential.</summary>
    [HttpPost("runs/{runId:guid}/github/mutations")]
    public async Task<IActionResult> Mutate(Guid runId, MutationRequest request, CancellationToken cancellationToken)
    {
        if (request.Kind != "commit")
        {
            return Problem(statusCode: StatusCodes.Status400BadRequest, title: $"Unknown mutation kind {request.Kind}.");
        }

        var sha = await mediator.Send(new CommitFilesCommand(runId, request.WorkerId, request.Epoch, request.IdempotencyKey, request.Message, request.Files), cancellationToken);
        return Ok(new { sha });
    }

    [HttpPost("runs/{runId:guid}/logs")]
    public async Task<IActionResult> Logs(Guid runId, LogRequest request, CancellationToken cancellationToken)
    {
        await mediator.Send(new AppendRunLogCommand(runId, request.WorkerId, request.Epoch, request.Lines), cancellationToken);
        return NoContent();
    }
}

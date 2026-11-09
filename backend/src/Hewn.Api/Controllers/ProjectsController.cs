using Hewn.Api.Auth;
using Hewn.Application.Pipeline;
using Hewn.Application.Projects;
using Hewn.Application.Spend;
using MediatR;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;

namespace Hewn.Api.Controllers;

[ApiController]
[Route("api/projects")]
public sealed class ProjectsController(IMediator mediator) : ControllerBase
{
    public sealed record SubmitProductDirectionRequest(
        string? Name,
        string? Idea,
        string? StackPreference,
        string? RepositoryUrl,
        decimal? BudgetUsd);

    [HttpPost]
    [Authorize(Policy = AuthSetup.OwnerPolicy)]
    [ProducesResponseType<SubmitProductDirectionResult>(StatusCodes.Status201Created)]
    public async Task<IActionResult> Submit(SubmitProductDirectionRequest request, CancellationToken cancellationToken)
    {
        var result = await mediator.Send(
            new SubmitProductDirectionCommand(request.Name, request.Idea, request.StackPreference, request.RepositoryUrl, request.BudgetUsd),
            cancellationToken);
        return Created($"/api/projects/{result.ProjectId}", result);
    }

    public sealed record SubmitFeatureDirectionRequest(string? Idea, decimal? BudgetUsd);

    [HttpGet]
    public Task<IReadOnlyList<ProjectSummaryDto>> List(CancellationToken cancellationToken) =>
        mediator.Send(new ListProjectsQuery(), cancellationToken);

    /// <summary>L2-005: adds a feature direction to an existing product.</summary>
    [HttpPost("{projectId:guid}/directions")]
    [Authorize(Policy = AuthSetup.OwnerPolicy)]
    [ProducesResponseType<SubmitProductDirectionResult>(StatusCodes.Status201Created)]
    public async Task<IActionResult> SubmitFeature(Guid projectId, SubmitFeatureDirectionRequest request, CancellationToken cancellationToken)
    {
        var result = await mediator.Send(new SubmitFeatureDirectionCommand(projectId, request.Idea, request.BudgetUsd), cancellationToken);
        return Created($"/api/projects/{result.ProjectId}", result);
    }

    public sealed record RaiseAndResumeRequest(decimal BudgetUsd, decimal CurrentBudgetUsd);

    /// <summary>L2-053 AC3: raises a budget-reached direction's budget above its spend and resumes it, in one action.</summary>
    [HttpPost("{projectId:guid}/directions/{directionId:guid}/raise-and-resume")]
    [Authorize(Policy = AuthSetup.OwnerPolicy)]
    public Task<RaiseAndResumeResult> RaiseAndResume(Guid projectId, Guid directionId, RaiseAndResumeRequest request, CancellationToken cancellationToken) =>
        mediator.Send(new RaiseAndResumeCommand(projectId, directionId, request.BudgetUsd, request.CurrentBudgetUsd), cancellationToken);

    /// <summary>L2-006 AC3: a Blocked direction's failed stage runs again from its start with its retry counter reset.</summary>
    [HttpPost("{projectId:guid}/directions/{directionId:guid}/retry-stage")]
    [Authorize(Policy = AuthSetup.OwnerPolicy)]
    public Task<DirectionControlResult> RetryStage(Guid projectId, Guid directionId, CancellationToken cancellationToken) =>
        mediator.Send(new RetryStageCommand(projectId, directionId), cancellationToken);

    /// <summary>L2-029 AC1: the step in progress finishes, then the direction is Paused and nothing new starts.</summary>
    [HttpPost("{projectId:guid}/directions/{directionId:guid}/pause")]
    [Authorize(Policy = AuthSetup.OwnerPolicy)]
    public Task<DirectionControlResult> Pause(Guid projectId, Guid directionId, CancellationToken cancellationToken) =>
        mediator.Send(new PauseDirectionCommand(projectId, directionId), cancellationToken);

    /// <summary>
    /// L2-029 AC3: the direction is Cancelled, its run stops within 10 seconds, open pull requests are labelled
    /// hewn:cancelled, and the next queued direction starts (L2-004 AC4). Answers once the worker stopped or the
    /// deadline passed.
    /// </summary>
    [HttpPost("{projectId:guid}/directions/{directionId:guid}/cancel")]
    [Authorize(Policy = AuthSetup.OwnerPolicy)]
    public Task<CancelDirectionResult> Cancel(Guid projectId, Guid directionId, CancellationToken cancellationToken) =>
        mediator.Send(new CancelDirectionCommand(projectId, directionId), cancellationToken);

    /// <summary>L2-029 AC2: a paused direction continues from its next step.</summary>
    [HttpPost("{projectId:guid}/directions/{directionId:guid}/resume")]
    [Authorize(Policy = AuthSetup.OwnerPolicy)]
    public Task<DirectionControlResult> Resume(Guid projectId, Guid directionId, CancellationToken cancellationToken) =>
        mediator.Send(new ResumeDirectionCommand(projectId, directionId), cancellationToken);

    [HttpGet("{projectId:guid}")]
    public Task<ProjectDto> Get(Guid projectId, CancellationToken cancellationToken) =>
        mediator.Send(new GetProjectQuery(projectId), cancellationToken);

    /// <summary>L2-030 AC3: a stage's runs, the files they committed and the decisions they recorded.</summary>
    [HttpGet("{projectId:guid}/directions/{directionId:guid}/stages/{stage:int}")]
    public Task<StageDetailDto> Stage(Guid projectId, Guid directionId, int stage, CancellationToken cancellationToken) =>
        mediator.Send(new GetStageDetailQuery(projectId, directionId, stage), cancellationToken);

    /// <summary>L2-033: a run's log lines after a line number, oldest first.</summary>
    [HttpGet("{projectId:guid}/runs/{runId:guid}/logs")]
    public Task<IReadOnlyList<LogLineDto>> Logs(Guid projectId, Guid runId, [FromQuery] long after, [FromQuery] int? limit, CancellationToken cancellationToken) =>
        mediator.Send(new GetRunLogQuery(projectId, runId, after, limit ?? GetRunLogHandler.MaxPage), cancellationToken);

    [HttpGet("{projectId:guid}/events")]
    public Task<IReadOnlyList<ProjectEventDto>> Events(Guid projectId, [FromQuery] long after, CancellationToken cancellationToken) =>
        mediator.Send(new GetProjectEventsQuery(projectId, after), cancellationToken);
}

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

    /// <summary>L2-020 AC2, L2-019 AC4: the current direction's increments, deferred designs and totals.</summary>
    /// <summary>One increment of the current direction, followed to merge (journey 13).</summary>
    [HttpGet("{projectId:guid}/increments/{number:int}")]
    public async Task<IActionResult> Increment(Guid projectId, int number, CancellationToken cancellationToken) =>
        Ok(await mediator.Send(new Hewn.Application.Increments.GetIncrementQuery(projectId, number), cancellationToken));

    /// <summary>L2-023 AC2: the increment's recorded MP4, with byte ranges so the player can seek.</summary>
    [HttpGet("{projectId:guid}/increments/{number:int}/video")]
    public async Task<IActionResult> IncrementVideo(Guid projectId, int number, CancellationToken cancellationToken)
    {
        var video = await mediator.Send(new Hewn.Application.Increments.GetIncrementVideoQuery(projectId, number, Captions: false), cancellationToken);
        Response.Headers.CacheControl = "private, max-age=300";
        return File(video.Content, video.ContentType, enableRangeProcessing: true);
    }

    /// <summary>L2-023 AC2: the video's WebVTT captions, for the player's caption track.</summary>
    [HttpGet("{projectId:guid}/increments/{number:int}/video/captions")]
    public async Task<IActionResult> IncrementCaptions(Guid projectId, int number, CancellationToken cancellationToken)
    {
        var captions = await mediator.Send(new Hewn.Application.Increments.GetIncrementVideoQuery(projectId, number, Captions: true), cancellationToken);
        Response.Headers.CacheControl = "private, max-age=300";
        return File(captions.Content, captions.ContentType);
    }

    /// <summary>L2-011 AC1: each exported screen and state, with its Magic Patterns link and a signed preview URL.</summary>
    [HttpGet("{projectId:guid}/designs")]
    public Task<Hewn.Application.Designs.DesignsDto> Designs(Guid projectId, CancellationToken cancellationToken) =>
        mediator.Send(new Hewn.Application.Designs.GetDesignsQuery(projectId), cancellationToken);

    /// <summary>L2-012 AC4: the design system's token and component pages, each with a signed preview URL.</summary>
    [HttpGet("{projectId:guid}/design-system")]
    public Task<Hewn.Application.Designs.DesignSystemDto> DesignSystem(Guid projectId, CancellationToken cancellationToken) =>
        mediator.Send(new Hewn.Application.Designs.GetDesignSystemQuery(projectId), cancellationToken);

    /// <summary>L2-008 AC1: how many commits Greenlit's default branch is ahead of the project's skills lock.</summary>
    [HttpGet("{projectId:guid}/skills-update")]
    public Task<Hewn.Application.Skills.SkillsUpdateDto> SkillsUpdate(Guid projectId, CancellationToken cancellationToken) =>
        mediator.Send(new Hewn.Application.Skills.GetSkillsUpdateQuery(projectId), cancellationToken);

    /// <summary>L2-008 AC2: opens the pull request that updates the skills; it merges when checks pass.</summary>
    [HttpPost("{projectId:guid}/skills-update")]
    [Authorize(Policy = AuthSetup.OwnerPolicy)]
    public Task<Hewn.Application.Skills.UpdateSkillsResult> UpdateSkills(Guid projectId, CancellationToken cancellationToken) =>
        mediator.Send(new Hewn.Application.Skills.UpdateSkillsCommand(projectId), cancellationToken);

    /// <summary>L2-003 AC1, AC2: moves a project with no active direction under the Archived filter.</summary>
    [HttpPost("{projectId:guid}/archive")]
    [Authorize(Policy = AuthSetup.OwnerPolicy)]
    public async Task<IActionResult> Archive(Guid projectId, CancellationToken cancellationToken)
    {
        await mediator.Send(new ArchiveProjectCommand(projectId), cancellationToken);
        return NoContent();
    }

    /// <summary>L2-003 AC1: returns an archived project to the default list.</summary>
    [HttpPost("{projectId:guid}/restore")]
    [Authorize(Policy = AuthSetup.OwnerPolicy)]
    public async Task<IActionResult> Restore(Guid projectId, CancellationToken cancellationToken)
    {
        await mediator.Send(new RestoreProjectCommand(projectId), cancellationToken);
        return NoContent();
    }

    /// <summary>L2-035: every L2 with its L1, designs, journeys, tests and pull requests, read at the head.</summary>
    [HttpGet("{projectId:guid}/traceability")]
    public Task<TraceabilityDto> Traceability(Guid projectId, CancellationToken cancellationToken) =>
        mediator.Send(new GetTraceabilityQuery(projectId), cancellationToken);

    /// <summary>L2-054 AC3: the project's decisions, newest first, optionally of one stage, with the commit that recorded each.</summary>
    [HttpGet("{projectId:guid}/decisions")]
    public Task<DecisionsDto> Decisions(Guid projectId, [FromQuery] int? stage, CancellationToken cancellationToken) =>
        mediator.Send(new GetDecisionsQuery(projectId, stage), cancellationToken);

    /// <summary>L2-034 AC2: each stage's artifacts with path, version (commit SHA), time and a GitHub link at that SHA.</summary>
    [HttpGet("{projectId:guid}/artifacts")]
    public Task<ArtifactsDto> Artifacts(Guid projectId, CancellationToken cancellationToken) =>
        mediator.Send(new GetArtifactsQuery(projectId), cancellationToken);

    [HttpGet("{projectId:guid}/backlog")]
    public Task<BacklogDto> Backlog(Guid projectId, CancellationToken cancellationToken) =>
        mediator.Send(new GetProjectBacklogQuery(projectId), cancellationToken);

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

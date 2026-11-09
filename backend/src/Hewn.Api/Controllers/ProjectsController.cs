using Hewn.Api.Auth;
using Hewn.Application.Projects;
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
        decimal BudgetUsd);

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

    public sealed record SubmitFeatureDirectionRequest(string? Idea, decimal BudgetUsd);

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

    [HttpGet("{projectId:guid}")]
    public Task<ProjectDto> Get(Guid projectId, CancellationToken cancellationToken) =>
        mediator.Send(new GetProjectQuery(projectId), cancellationToken);

    [HttpGet("{projectId:guid}/events")]
    public Task<IReadOnlyList<ProjectEventDto>> Events(Guid projectId, [FromQuery] long after, CancellationToken cancellationToken) =>
        mediator.Send(new GetProjectEventsQuery(projectId, after), cancellationToken);
}

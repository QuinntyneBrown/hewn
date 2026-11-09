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

    [HttpGet("{projectId:guid}")]
    public Task<ProjectDto> Get(Guid projectId, CancellationToken cancellationToken) =>
        mediator.Send(new GetProjectQuery(projectId), cancellationToken);
}

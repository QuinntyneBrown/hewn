using Hewn.Api.Auth;
using Hewn.Application.Abstractions;
using Hewn.Application.Workers;
using MediatR;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;

namespace Hewn.Api.Controllers;

/// <summary>Worker tokens (L2-041). Only an Owner creates one; the response is the only time the token is returned.</summary>
[ApiController]
[Route("api/worker-tokens")]
public sealed class WorkerTokensController(IMediator mediator, ICurrentUser user) : ControllerBase
{
    public sealed record CreateRequest(string? Name, string? Location, int ExpiresInDays);

    [HttpPost]
    [Authorize(Policy = AuthSetup.OwnerPolicy)]
    public async Task<IActionResult> Create(CreateRequest request, CancellationToken cancellationToken)
    {
        var created = await mediator.Send(new CreateWorkerTokenCommand(request.Name ?? "", request.Location ?? "", request.ExpiresInDays, user.Login), cancellationToken);
        // Never cached anywhere on the way back.
        Response.Headers.CacheControl = "no-store";
        return Created($"/api/worker-tokens/{created.Id}", created);
    }
}

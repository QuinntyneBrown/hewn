using Hewn.Api.Auth;
using Hewn.Application.Abstractions;
using Hewn.Application.Auth;
using Hewn.Domain;
using MediatR;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;

namespace Hewn.Api.Controllers;

/// <summary>Who can sign in (L2-038 AC5). Anyone signed in reads the list; only an Owner adds or removes a login.</summary>
[ApiController]
[Route("api/allow-list")]
public sealed class AllowListController(IMediator mediator, ICurrentUser user) : ControllerBase
{
    public sealed record AddRequest(string? Login, Role Role);

    [HttpGet]
    public Task<IReadOnlyList<AllowListEntryDto>> List(CancellationToken cancellationToken) =>
        mediator.Send(new ListAllowListQuery(), cancellationToken);

    [HttpPost]
    [Authorize(Policy = AuthSetup.OwnerPolicy)]
    public async Task<IActionResult> Add(AddRequest request, CancellationToken cancellationToken)
    {
        var entry = await mediator.Send(new AddToAllowListCommand(request.Login ?? "", request.Role, user.Login), cancellationToken);
        return Created($"/api/allow-list/{entry.Login}", entry);
    }

    [HttpDelete("{login}")]
    [Authorize(Policy = AuthSetup.OwnerPolicy)]
    public async Task<IActionResult> Remove(string login, CancellationToken cancellationToken)
    {
        await mediator.Send(new RemoveFromAllowListCommand(login, user.Login), cancellationToken);
        return NoContent();
    }
}

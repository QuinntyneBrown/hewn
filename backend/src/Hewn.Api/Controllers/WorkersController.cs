using Hewn.Api.Auth;
using Hewn.Application.Abstractions;
using Hewn.Application.Workers;
using MediatR;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;

namespace Hewn.Api.Controllers;

/// <summary>Mission Control's view of the workers. Anyone signed in reads it; only an Owner stops or starts them.</summary>
[ApiController]
[Route("api/workers")]
public sealed class WorkersController(IMediator mediator, ICurrentUser user) : ControllerBase
{
    [HttpGet]
    public Task<WorkersDto> List(CancellationToken cancellationToken) =>
        mediator.Send(new GetWorkersQuery(), cancellationToken);

    /// <summary>L2-029 AC4: every worker halts its active run within 10 seconds and leases nothing until Start workers.</summary>
    [HttpPost("stop")]
    [Authorize(Policy = AuthSetup.OwnerPolicy)]
    public Task<StopWorkersResult> Stop(CancellationToken cancellationToken) =>
        mediator.Send(new StopWorkersCommand(), cancellationToken);

    /// <summary>Leasing comes back on and each halted run resumes from its last checkpoint.</summary>
    [HttpPost("start")]
    [Authorize(Policy = AuthSetup.OwnerPolicy)]
    public Task<LeasingDto> Start(CancellationToken cancellationToken) =>
        mediator.Send(new StartWorkersCommand(), cancellationToken);

    /// <summary>L2-041 AC2: the worker's token stops working, it is disconnected within 10 seconds and its lease released.</summary>
    [HttpPost("{workerId}/revoke")]
    [Authorize(Policy = AuthSetup.OwnerPolicy)]
    public async Task<IActionResult> Revoke(string workerId, CancellationToken cancellationToken)
    {
        await mediator.Send(new RevokeWorkerCommand(workerId, user.Login), cancellationToken);
        return NoContent();
    }
}

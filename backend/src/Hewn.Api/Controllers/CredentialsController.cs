using Hewn.Application.Secrets;
using MediatR;
using Microsoft.AspNetCore.Mvc;

namespace Hewn.Api.Controllers;

/// <summary>
/// The credentials Hewn holds, as references with their last-updated times; never a value (L2-040 AC1). An operator
/// supplies them with <c>hewn secret set</c>, straight into the secret store.
/// </summary>
[ApiController]
[Route("api/settings/credentials")]
public sealed class CredentialsController(IMediator mediator) : ControllerBase
{
    [HttpGet]
    public Task<IReadOnlyList<CredentialRefDto>> List(CancellationToken cancellationToken) =>
        mediator.Send(new ListCredentialsQuery(), cancellationToken);
}

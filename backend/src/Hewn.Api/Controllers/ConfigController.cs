using Hewn.Application.Spend;
using MediatR;
using Microsoft.AspNetCore.Mvc;

namespace Hewn.Api.Controllers;

/// <summary>Non-secret settings Mission Control shows: where new repositories go and the default budget.</summary>
[ApiController]
[Route("api/config")]
public sealed class ConfigController(IConfiguration configuration, IMediator mediator) : ControllerBase
{
    public sealed record PublicConfig(string? GithubOwner, decimal DefaultBudgetUsd);

    [HttpGet]
    public async Task<PublicConfig> Get(CancellationToken cancellationToken) => new(
        configuration["HEWN_GITHUB_OWNER"],
        (await mediator.Send(new GetDirectionDefaultsQuery(), cancellationToken)).DefaultBudgetUsd);
}

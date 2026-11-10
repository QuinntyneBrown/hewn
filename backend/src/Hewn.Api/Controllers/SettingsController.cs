using Hewn.Api.Auth;
using Hewn.Application.Spend;
using MediatR;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;

namespace Hewn.Api.Controllers;

/// <summary>Settings every direction starts with. Anyone signed in reads them; only an Owner changes them.</summary>
[ApiController]
[Route("api/settings")]
public sealed class SettingsController(IMediator mediator) : ControllerBase
{
    public sealed record DirectionDefaultsRequest(decimal DefaultBudgetUsd, decimal? DescopeThresholdDays);

    [HttpGet("direction-defaults")]
    public Task<DirectionDefaultsDto> GetDirectionDefaults(CancellationToken cancellationToken) =>
        mediator.Send(new GetDirectionDefaultsQuery(), cancellationToken);

    /// <summary>
    /// L2-053 AC1: the default budget per direction; new directions start with it, running ones keep theirs. L2-019 AC1: the
    /// descope threshold new directions start with; leaving it out keeps the saved one.
    /// </summary>
    [HttpPut("direction-defaults")]
    [Authorize(Policy = AuthSetup.OwnerPolicy)]
    public Task<DirectionDefaultsDto> UpdateDirectionDefaults(DirectionDefaultsRequest request, CancellationToken cancellationToken) =>
        mediator.Send(new UpdateDirectionDefaultsCommand(request.DefaultBudgetUsd, request.DescopeThresholdDays), cancellationToken);
}

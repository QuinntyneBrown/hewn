using Microsoft.AspNetCore.Mvc;

namespace Hewn.Api.Controllers;

/// <summary>Non-secret settings Mission Control shows: where new repositories go and the default budget.</summary>
[ApiController]
[Route("api/config")]
public sealed class ConfigController(IConfiguration configuration) : ControllerBase
{
    public const decimal FallbackBudgetUsd = 300m;

    public sealed record PublicConfig(string? GithubOwner, decimal DefaultBudgetUsd);

    [HttpGet]
    public PublicConfig Get() => new(
        configuration["HEWN_GITHUB_OWNER"],
        configuration.GetValue<decimal?>("HEWN_DEFAULT_BUDGET_USD") ?? FallbackBudgetUsd);
}

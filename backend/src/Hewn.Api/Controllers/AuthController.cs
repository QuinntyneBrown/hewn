using Hewn.Api.Auth;
using Hewn.Application.Abstractions;
using Hewn.Application.Auth;
using MediatR;
using Microsoft.AspNetCore.Antiforgery;
using Microsoft.AspNetCore.Authentication;
using Microsoft.AspNetCore.Authentication.Cookies;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;

namespace Hewn.Api.Controllers;

[ApiController]
[Route("api")]
public sealed class AuthController(IMediator mediator, IConfiguration configuration, TimeProvider clock) : ControllerBase
{
    public sealed record DevSignInRequest(string Login);

    public sealed record MeResponse(string Login, string Role);

    /// <summary>
    /// Development and test sign-in for an allow-listed login. Enabled only when Hewn:Auth:DevSignIn is true;
    /// GitHub OAuth replaces it in production (journey 20).
    /// </summary>
    [AllowAnonymous]
    [IgnoreAntiforgeryToken]
    [HttpPost("auth/dev/sign-in")]
    public async Task<IActionResult> DevSignIn(DevSignInRequest request, CancellationToken cancellationToken)
    {
        if (!configuration.GetValue<bool>("Hewn:Auth:DevSignIn"))
        {
            return NotFound();
        }

        var entry = await mediator.Send(new FindAllowListEntryQuery(request.Login), cancellationToken);
        if (entry is null)
        {
            return Problem(statusCode: StatusCodes.Status403Forbidden, title: "This account doesn't have access");
        }

        await HttpContext.SignInAsync(
            CookieAuthenticationDefaults.AuthenticationScheme,
            AuthSetup.Principal(entry),
            AuthSetup.SessionProperties(clock));
        return NoContent();
    }

    [HttpPost("auth/sign-out")]
    public async Task<IActionResult> SignOutAsync()
    {
        await HttpContext.SignOutAsync(CookieAuthenticationDefaults.AuthenticationScheme);
        return NoContent();
    }

    /// <summary>The signed-in user. Also issues the XSRF-TOKEN cookie that Angular echoes on writes.</summary>
    [HttpGet("me")]
    public MeResponse Me([FromServices] ICurrentUser user, [FromServices] IAntiforgery antiforgery)
    {
        var tokens = antiforgery.GetAndStoreTokens(HttpContext);
        Response.Cookies.Append("XSRF-TOKEN", tokens.RequestToken!, new CookieOptions
        {
            HttpOnly = false,
            Secure = true,
            SameSite = SameSiteMode.Strict,
        });
        return new MeResponse(user.Login, user.Role.ToString());
    }
}

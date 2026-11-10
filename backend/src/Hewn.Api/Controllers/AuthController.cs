using System.Security.Claims;
using System.Security.Cryptography;
using System.Text;
using Hewn.Api.Auth;
using Hewn.Application.Abstractions;
using Hewn.Application.Auth;
using MediatR;
using Microsoft.AspNetCore.Antiforgery;
using Microsoft.AspNetCore.Authentication;
using Microsoft.AspNetCore.Authentication.Cookies;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.DataProtection;
using Microsoft.AspNetCore.Mvc;
using Microsoft.AspNetCore.WebUtilities;

namespace Hewn.Api.Controllers;

[ApiController]
[Route("api")]
public sealed class AuthController(IMediator mediator, IConfiguration configuration, TimeProvider clock, IDataProtectionProvider protection) : ControllerBase
{
    private const string StateCookie = "hewn.oauth";
    private const string StatePath = "/api/auth/github";
    private static readonly TimeSpan StateLifetime = TimeSpan.FromMinutes(10);

    private IDataProtector StateProtector => protection.CreateProtector("Hewn.Auth.GitHubSignIn");

    /// <summary>
    /// L2-038 AC2: starts GitHub sign-in. A one-time state, with where to return, rides in a short-lived protected
    /// cookie, and the browser goes to GitHub's authorize page.
    /// </summary>
    [AllowAnonymous]
    [HttpGet("auth/github")]
    public IActionResult SignInWithGitHub(string? returnUrl)
    {
        var state = WebEncoders.Base64UrlEncode(RandomNumberGenerator.GetBytes(32));
        var payload = string.Join('\n', state, LocalOrRoot(returnUrl), clock.GetUtcNow().Add(StateLifetime).ToUnixTimeSeconds());
        Response.Cookies.Append(StateCookie, StateProtector.Protect(payload), new CookieOptions
        {
            HttpOnly = true,
            Secure = true,
            SameSite = SameSiteMode.Lax,
            Path = StatePath,
            MaxAge = StateLifetime,
        });

        var authorize = configuration["Hewn:GitHub:OAuth:AuthorizeUrl"] ?? "https://github.com/login/oauth/authorize";
        return Redirect(QueryHelpers.AddQueryString(authorize, new Dictionary<string, string?>
        {
            ["client_id"] = configuration["HEWN_GITHUB_CLIENT_ID"],
            ["redirect_uri"] = CallbackUrl,
            ["scope"] = "read:user",
            ["state"] = state,
        }));
    }

    /// <summary>
    /// L2-038 AC2, AC4: GitHub's callback. An allow-listed login gets the session cookie and returns where it
    /// started; any other login, a forged or stale state, or a GitHub failure goes back to the sign-in page.
    /// </summary>
    [AllowAnonymous]
    [HttpGet("auth/github/callback")]
    public async Task<IActionResult> GitHubCallback(string? code, string? state, string? error, CancellationToken cancellationToken)
    {
        var started = ReadState();
        Response.Cookies.Delete(StateCookie, new CookieOptions { Path = StatePath, Secure = true, SameSite = SameSiteMode.Lax });
        if (error == "access_denied")
        {
            // The user cancelled on GitHub: back to sign-in, nothing to explain.
            return Redirect("/sign-in");
        }
        if (started is null || state is null || string.IsNullOrEmpty(code)
            || !CryptographicOperations.FixedTimeEquals(Encoding.UTF8.GetBytes(started.Value.State), Encoding.UTF8.GetBytes(state)))
        {
            return Redirect("/sign-in?error=github");
        }

        GitHubSignIn signIn;
        try
        {
            signIn = await mediator.Send(new SignInWithGitHubCommand(code, CallbackUrl), cancellationToken);
        }
        catch (GitHubException)
        {
            return Redirect("/sign-in?error=github");
        }

        if (signIn.Entry is null)
        {
            return Redirect(QueryHelpers.AddQueryString("/sign-in", new Dictionary<string, string?> { ["error"] = "denied", ["login"] = signIn.Login }));
        }

        await HttpContext.SignInAsync(CookieAuthenticationDefaults.AuthenticationScheme, AuthSetup.Principal(signIn.Entry), AuthSetup.SessionProperties(clock));
        return Redirect(started.Value.ReturnUrl);
    }

    /// <summary>Where GitHub sends the user back: Mission Control's origin (Hewn:Auth:PublicOrigin), else this request's.</summary>
    private string CallbackUrl =>
        $"{(configuration["Hewn:Auth:PublicOrigin"] is { Length: > 0 } origin ? origin.TrimEnd('/') : $"{Request.Scheme}://{Request.Host}")}{StatePath}/callback";

    private (string State, string ReturnUrl)? ReadState()
    {
        if (!Request.Cookies.TryGetValue(StateCookie, out var cookie))
        {
            return null;
        }

        try
        {
            var parts = StateProtector.Unprotect(cookie).Split('\n');
            return parts.Length == 3 && long.TryParse(parts[2], out var expires) && clock.GetUtcNow().ToUnixTimeSeconds() <= expires
                ? (parts[0], parts[1])
                : null;
        }
        catch (CryptographicException)
        {
            return null;
        }
    }

    /// <summary>Only a path on this site: "//host" and "/\\host" would leave it.</summary>
    private static string LocalOrRoot(string? returnUrl) =>
        returnUrl is { Length: > 0 } url && url[0] == '/' && (url.Length == 1 || (url[1] != '/' && url[1] != '\\')) && !url.Contains('\n')
            ? url
            : "/";

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

    /// <summary>L2-038 AC3: ends the session; its cookie is refused from now on, even if replayed.</summary>
    [HttpPost("auth/sign-out")]
    public async Task<IActionResult> SignOutAsync(CancellationToken cancellationToken)
    {
        var session = await HttpContext.AuthenticateAsync(CookieAuthenticationDefaults.AuthenticationScheme);
        if (Guid.TryParse(User.FindFirstValue(AuthSetup.SessionIdClaim), out var id))
        {
            var expires = session.Properties?.ExpiresUtc ?? clock.GetUtcNow().AddHours(8);
            await mediator.Send(new SignOutCommand(id, expires), cancellationToken);
        }

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

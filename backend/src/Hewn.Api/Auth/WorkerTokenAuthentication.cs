using System.Security.Claims;
using System.Security.Cryptography;
using System.Text;
using System.Text.Encodings.Web;
using Microsoft.AspNetCore.Authentication;
using Microsoft.Extensions.Options;

namespace Hewn.Api.Auth;

/// <summary>
/// Authenticates workers by the bearer worker token (HEWN_WORKER_TOKEN). Worker endpoints accept only this
/// scheme, so a signed-in browser session cannot call them and a worker token cannot call user endpoints.
/// </summary>
public sealed class WorkerTokenAuthenticationHandler(
    IOptionsMonitor<AuthenticationSchemeOptions> options,
    ILoggerFactory logger,
    UrlEncoder encoder,
    IConfiguration configuration) : AuthenticationHandler<AuthenticationSchemeOptions>(options, logger, encoder)
{
    public const string SchemeName = "WorkerToken";

    protected override Task<AuthenticateResult> HandleAuthenticateAsync()
    {
        var expected = configuration["HEWN_WORKER_TOKEN"];
        var header = Request.Headers.Authorization.ToString();
        if (string.IsNullOrEmpty(expected) || !header.StartsWith("Bearer ", StringComparison.Ordinal))
        {
            return Task.FromResult(AuthenticateResult.NoResult());
        }

        // Compare digests so the comparison takes the same time whatever the presented length.
        var presented = SHA256.HashData(Encoding.UTF8.GetBytes(header["Bearer ".Length..].Trim()));
        if (!CryptographicOperations.FixedTimeEquals(presented, SHA256.HashData(Encoding.UTF8.GetBytes(expected))))
        {
            return Task.FromResult(AuthenticateResult.Fail("Invalid worker token."));
        }

        var identity = new ClaimsIdentity([new Claim(ClaimTypes.Name, "worker"), new Claim(ClaimTypes.Role, "Worker")], SchemeName);
        return Task.FromResult(AuthenticateResult.Success(new AuthenticationTicket(new ClaimsPrincipal(identity), SchemeName)));
    }
}

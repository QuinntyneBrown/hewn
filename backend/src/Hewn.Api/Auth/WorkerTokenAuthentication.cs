using System.Security.Claims;
using System.Security.Cryptography;
using System.Text;
using System.Text.Encodings.Web;
using Microsoft.AspNetCore.Authentication;
using Hewn.Application.Abstractions;
using Hewn.Application.Workers;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Options;

namespace Hewn.Api.Auth;

/// <summary>
/// Authenticates workers by the bearer worker token. An issued token (L2-041) is found by its SHA-256 hash and must be
/// neither revoked nor expired; HEWN_WORKER_TOKEN, when the API is configured with one, is a development token that
/// can't be revoked. Worker endpoints accept only this scheme, so a signed-in browser session cannot call them and a
/// worker token cannot call user endpoints.
/// </summary>
public sealed class WorkerTokenAuthenticationHandler(
    IOptionsMonitor<AuthenticationSchemeOptions> options,
    ILoggerFactory logger,
    UrlEncoder encoder,
    IConfiguration configuration,
    IAppDbContext db,
    TimeProvider clock) : AuthenticationHandler<AuthenticationSchemeOptions>(options, logger, encoder)
{
    public const string SchemeName = "WorkerToken";

    /// <summary>The claim carrying the issued token's id; absent for the configured development token.</summary>
    public const string TokenIdClaim = "hewn:worker_token";

    protected override async Task<AuthenticateResult> HandleAuthenticateAsync()
    {
        var header = Request.Headers.Authorization.ToString();
        if (!header.StartsWith("Bearer ", StringComparison.Ordinal))
        {
            return AuthenticateResult.NoResult();
        }

        var presented = header["Bearer ".Length..].Trim();
        if (presented.StartsWith(WorkerTokenHash.Prefix, StringComparison.Ordinal))
        {
            // Looked up by hash: the token itself is never stored, compared or logged.
            var hash = WorkerTokenHash.Of(presented);
            var token = await db.WorkerTokens.AsNoTracking()
                .Where(t => t.Hash == hash)
                .Select(t => new { t.Id, t.RevokedAt, t.ExpiresAt })
                .SingleOrDefaultAsync(Context.RequestAborted);
            if (token is null || token.RevokedAt is not null || clock.GetUtcNow() >= token.ExpiresAt)
            {
                return AuthenticateResult.Fail("Invalid worker token.");
            }

            return Success(new Claim(TokenIdClaim, token.Id));
        }

        var expected = configuration["HEWN_WORKER_TOKEN"];
        if (string.IsNullOrEmpty(expected))
        {
            return AuthenticateResult.Fail("Invalid worker token.");
        }

        // Compare digests so the comparison takes the same time whatever the presented length.
        if (!CryptographicOperations.FixedTimeEquals(SHA256.HashData(Encoding.UTF8.GetBytes(presented)), SHA256.HashData(Encoding.UTF8.GetBytes(expected))))
        {
            return AuthenticateResult.Fail("Invalid worker token.");
        }

        return Success();
    }

    private static AuthenticateResult Success(params Claim[] extra)
    {
        var identity = new ClaimsIdentity([new Claim(ClaimTypes.Name, "worker"), new Claim(ClaimTypes.Role, "Worker"), .. extra], SchemeName);
        return AuthenticateResult.Success(new AuthenticationTicket(new ClaimsPrincipal(identity), SchemeName));
    }
}

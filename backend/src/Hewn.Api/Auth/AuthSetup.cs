using System.Security.Claims;
using Hewn.Domain;
using Microsoft.AspNetCore.Authentication;
using Microsoft.AspNetCore.Authentication.Cookies;
using Microsoft.AspNetCore.Authorization;

namespace Hewn.Api.Auth;

public static class AuthSetup
{
    public const string OwnerPolicy = "Owner";

    public static IServiceCollection AddHewnAuth(this IServiceCollection services)
    {
        services.AddAuthentication(CookieAuthenticationDefaults.AuthenticationScheme)
            .AddCookie(o =>
            {
                o.Cookie.Name = "hewn.session";
                o.Cookie.HttpOnly = true;
                o.Cookie.SecurePolicy = CookieSecurePolicy.Always;
                o.Cookie.SameSite = SameSiteMode.Lax;
                o.ExpireTimeSpan = TimeSpan.FromHours(8);
                o.SlidingExpiration = false;
                o.LoginPath = "/sign-in";
                o.Events.OnRedirectToLogin = ctx => Challenge(ctx, StatusCodes.Status401Unauthorized);
                o.Events.OnRedirectToAccessDenied = ctx => Challenge(ctx, StatusCodes.Status403Forbidden);
                o.Events.OnValidatePrincipal = RefuseSignedOutSessions;
            })
            .AddScheme<AuthenticationSchemeOptions, WorkerTokenAuthenticationHandler>(WorkerTokenAuthenticationHandler.SchemeName, null);

        services.AddAuthorizationBuilder()
            .SetFallbackPolicy(new AuthorizationPolicyBuilder().RequireAuthenticatedUser().Build())
            .AddPolicy(OwnerPolicy, p => p.RequireAuthenticatedUser().RequireRole(nameof(Role.Owner)));

        return services;
    }

    /// <summary>The session's id, so signing out can refuse the cookie if it is replayed (L2-038 AC3).</summary>
    public const string SessionIdClaim = "hewn:sid";

    public static ClaimsPrincipal Principal(AllowListEntry entry) =>
        new(new ClaimsIdentity(
            [
                new Claim(ClaimTypes.Name, entry.Login),
                new Claim(ClaimTypes.Role, entry.Role.ToString()),
                new Claim(SessionIdClaim, Guid.NewGuid().ToString()),
            ],
            CookieAuthenticationDefaults.AuthenticationScheme));

    private static async Task RefuseSignedOutSessions(CookieValidatePrincipalContext ctx)
    {
        var sid = ctx.Principal?.FindFirstValue(SessionIdClaim);
        var mediator = ctx.HttpContext.RequestServices.GetRequiredService<MediatR.IMediator>();
        if (!Guid.TryParse(sid, out var id) || await mediator.Send(new Hewn.Application.Auth.IsSessionRevokedQuery(id), ctx.HttpContext.RequestAborted))
        {
            ctx.RejectPrincipal();
        }
    }

    public static AuthenticationProperties SessionProperties(TimeProvider clock) => new()
    {
        IsPersistent = true,
        IssuedUtc = clock.GetUtcNow(),
        ExpiresUtc = clock.GetUtcNow().AddHours(8),
        AllowRefresh = false,
    };

    private static Task Challenge(RedirectContext<CookieAuthenticationOptions> ctx, int status)
    {
        // APIs and hubs answer with a status code; pages are served by the Angular app, which routes to sign-in.
        if (ctx.Request.Path.StartsWithSegments("/api") || ctx.Request.Path.StartsWithSegments("/hubs"))
        {
            ctx.Response.StatusCode = status;
            return Task.CompletedTask;
        }

        ctx.Response.Redirect(ctx.RedirectUri);
        return Task.CompletedTask;
    }
}

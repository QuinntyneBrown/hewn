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
            });

        services.AddAuthorizationBuilder()
            .SetFallbackPolicy(new AuthorizationPolicyBuilder().RequireAuthenticatedUser().Build())
            .AddPolicy(OwnerPolicy, p => p.RequireAuthenticatedUser().RequireRole(nameof(Role.Owner)));

        return services;
    }

    public static ClaimsPrincipal Principal(AllowListEntry entry) =>
        new(new ClaimsIdentity(
            [new Claim(ClaimTypes.Name, entry.Login), new Claim(ClaimTypes.Role, entry.Role.ToString())],
            CookieAuthenticationDefaults.AuthenticationScheme));

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

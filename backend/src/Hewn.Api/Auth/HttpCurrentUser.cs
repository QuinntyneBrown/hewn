using System.Security.Claims;
using Hewn.Application.Abstractions;
using Hewn.Domain;

namespace Hewn.Api.Auth;

public sealed class HttpCurrentUser(IHttpContextAccessor accessor) : ICurrentUser
{
    private ClaimsPrincipal Principal =>
        accessor.HttpContext?.User ?? throw new InvalidOperationException("No signed-in user.");

    public string Login => Principal.Identity?.Name ?? throw new InvalidOperationException("No signed-in user.");

    public Role Role => Principal.IsInRole(nameof(Role.Owner)) ? Role.Owner : Role.Viewer;
}

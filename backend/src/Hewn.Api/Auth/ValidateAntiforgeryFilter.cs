using Microsoft.AspNetCore.Antiforgery;
using Microsoft.AspNetCore.Mvc;
using Microsoft.AspNetCore.Mvc.Filters;

namespace Hewn.Api.Auth;

/// <summary>
/// Validates the anti-forgery token on POST, PUT, PATCH and DELETE (400 on failure), unless the action opts out
/// with [IgnoreAntiforgeryToken]. Runs after authentication, so anonymous callers still get 401 first.
/// </summary>
public sealed class ValidateAntiforgeryFilter(IAntiforgery antiforgery) : IAsyncAuthorizationFilter, IOrderedFilter
{
    // Run after the authorization filter (order 0) so 401 and 403 win over a missing token.
    public int Order => 1000;

    public async Task OnAuthorizationAsync(AuthorizationFilterContext context)
    {
        var method = context.HttpContext.Request.Method;
        if (HttpMethods.IsGet(method) || HttpMethods.IsHead(method) || HttpMethods.IsOptions(method))
        {
            return;
        }

        if (context.ActionDescriptor.EndpointMetadata.OfType<IgnoreAntiforgeryTokenAttribute>().Any())
        {
            return;
        }

        if (!await antiforgery.IsRequestValidAsync(context.HttpContext))
        {
            context.Result = new ObjectResult(new ProblemDetails
            {
                Status = StatusCodes.Status400BadRequest,
                Title = "The anti-forgery token is missing or invalid.",
                Extensions = { ["code"] = "antiforgery_failed" },
            })
            { StatusCode = StatusCodes.Status400BadRequest };
        }
    }
}

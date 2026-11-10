using Hewn.Application.Abstractions;
using Hewn.Application.Common;
using Hewn.Application.Pipeline;
using Microsoft.AspNetCore.Diagnostics;
using Microsoft.AspNetCore.Mvc;

namespace Hewn.Api.Errors;

/// <summary>Maps application exceptions to ProblemDetails with a `code` where clients branch.</summary>
public sealed class ApplicationExceptionHandler(IProblemDetailsService problems) : IExceptionHandler
{
    public async ValueTask<bool> TryHandleAsync(HttpContext httpContext, Exception exception, CancellationToken cancellationToken)
    {
        ProblemDetails? problem = exception switch
        {
            FieldValidationException e => FieldProblem(e),
            NotFoundException e => new ProblemDetails { Status = StatusCodes.Status404NotFound, Title = e.Title, Extensions = { ["code"] = e.Code } },
            GitHubException e => new ProblemDetails { Status = StatusCodes.Status502BadGateway, Title = e.Message, Extensions = { ["code"] = "github_failed" } },
            ConflictException e => new ProblemDetails { Status = StatusCodes.Status409Conflict, Title = e.Message, Extensions = { ["code"] = e.Code } },
            LeaseLostException => new ProblemDetails { Status = StatusCodes.Status409Conflict, Title = "Lease lost", Extensions = { ["code"] = "lease_lost" } },
            TooManyRequestsException e => TooMany(httpContext, e),
            _ => null,
        };

        if (problem is null)
        {
            return false;
        }

        httpContext.Response.StatusCode = problem.Status!.Value;
        return await problems.TryWriteAsync(new ProblemDetailsContext { HttpContext = httpContext, ProblemDetails = problem });
    }

    private static ProblemDetails TooMany(HttpContext httpContext, TooManyRequestsException e)
    {
        httpContext.Response.Headers.RetryAfter = e.RetryAfterSeconds.ToString(System.Globalization.CultureInfo.InvariantCulture);
        return new ProblemDetails
        {
            Status = StatusCodes.Status429TooManyRequests,
            Title = e.Message,
            Extensions = { ["code"] = e.Code, ["limit"] = e.Limit, ["retryAfterSeconds"] = e.RetryAfterSeconds },
        };
    }

    private static ValidationProblemDetails FieldProblem(FieldValidationException e)
    {
        var problem = new ValidationProblemDetails(
            e.Errors.GroupBy(f => f.Field).ToDictionary(g => g.Key, g => g.Select(f => f.Message).ToArray()))
        {
            Status = StatusCodes.Status400BadRequest,
            Title = "One or more fields are invalid.",
        };
        problem.Extensions["code"] = e.Code ?? "validation_failed";
        problem.Extensions["summary"] = e.Errors.GroupBy(f => f.Field).ToDictionary(g => g.Key, g => g.First().Summary);
        return problem;
    }
}

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
            NotFoundException => new ProblemDetails { Status = StatusCodes.Status404NotFound, Title = "Not found", Extensions = { ["code"] = "not_found" } },
            LeaseLostException => new ProblemDetails { Status = StatusCodes.Status409Conflict, Title = "Lease lost", Extensions = { ["code"] = "lease_lost" } },
            _ => null,
        };

        if (problem is null)
        {
            return false;
        }

        httpContext.Response.StatusCode = problem.Status!.Value;
        return await problems.TryWriteAsync(new ProblemDetailsContext { HttpContext = httpContext, ProblemDetails = problem });
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

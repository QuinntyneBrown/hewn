using FluentValidation;
using MediatR;

namespace Hewn.Application.Common;

/// <summary>Runs every validator for a request before its handler, so an invalid request changes nothing.</summary>
public sealed class ValidationBehavior<TRequest, TResponse>(IEnumerable<IValidator<TRequest>> validators)
    : IPipelineBehavior<TRequest, TResponse>
    where TRequest : notnull
{
    public async Task<TResponse> Handle(TRequest request, RequestHandlerDelegate<TResponse> next, CancellationToken cancellationToken)
    {
        var failures = new List<FieldError>();
        foreach (var validator in validators)
        {
            var result = await validator.ValidateAsync(request, cancellationToken);
            failures.AddRange(result.Errors.Select(f => new FieldError(
                char.ToLowerInvariant(f.PropertyName[0]) + f.PropertyName[1..],
                f.ErrorMessage,
                f.CustomState as string ?? f.ErrorMessage)));
        }

        if (failures.Count > 0)
        {
            throw new FieldValidationException(failures);
        }

        return await next();
    }
}

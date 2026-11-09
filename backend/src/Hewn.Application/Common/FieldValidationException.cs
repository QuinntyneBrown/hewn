namespace Hewn.Application.Common;

/// <summary>One broken field rule: the inline message and the shorter line for the error summary.</summary>
public sealed record FieldError(string Field, string Message, string Summary);

/// <summary>A request broke one or more field rules. Nothing was changed.</summary>
public sealed class FieldValidationException(IReadOnlyList<FieldError> errors, string? code = null)
    : Exception("One or more fields are invalid.")
{
    public IReadOnlyList<FieldError> Errors { get; } = errors;

    /// <summary>A stable code clients branch on, when a single rule applies.</summary>
    public string? Code { get; } = code;
}

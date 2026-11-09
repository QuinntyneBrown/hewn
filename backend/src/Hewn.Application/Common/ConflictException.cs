namespace Hewn.Application.Common;

/// <summary>The request no longer fits the resource's state. Answers 409 with a `code` clients branch on.</summary>
public sealed class ConflictException(string code, string message) : Exception(message)
{
    public string Code { get; } = code;
}

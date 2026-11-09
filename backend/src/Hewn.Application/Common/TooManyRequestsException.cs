namespace Hewn.Application.Common;

/// <summary>A limit was reached; the caller may try again after <see cref="RetryAfterSeconds"/> (429).</summary>
public sealed class TooManyRequestsException(string code, string message, int limit, int retryAfterSeconds) : Exception(message)
{
    public string Code { get; } = code;

    public int Limit { get; } = limit;

    public int RetryAfterSeconds { get; } = retryAfterSeconds;
}

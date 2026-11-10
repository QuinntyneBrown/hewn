namespace Hewn.Application.Abstractions;

/// <summary>Where the current request came from, for the audit log (L2-044 AC1).</summary>
public interface IRequestOrigin
{
    /// <summary>The client's IP address after forwarded headers from a trusted proxy; null outside a request.</summary>
    string? IpAddress { get; }
}

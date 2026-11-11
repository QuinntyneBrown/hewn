using Hewn.Application.Abstractions;

namespace Hewn.Api.Auth;

/// <summary>The client's address as the forwarded-headers middleware left it; IPv4 shown as IPv4.</summary>
public sealed class HttpRequestOrigin(IHttpContextAccessor accessor) : IRequestOrigin
{
    public string? IpAddress => accessor.HttpContext?.Connection.RemoteIpAddress is { } address
        ? (address.IsIPv4MappedToIPv6 ? address.MapToIPv4() : address).ToString()
        : null;
}

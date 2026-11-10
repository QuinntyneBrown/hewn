namespace Hewn.Application.Common;

/// <summary>The resource does not exist or the caller cannot see it. Both answer 404, with a code clients can branch on.</summary>
public sealed class NotFoundException(string code = "not_found", string title = "Not found") : Exception(title)
{
    public string Code { get; } = code;

    public string Title { get; } = title;
}

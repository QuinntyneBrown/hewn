namespace Hewn.Application.Common;

/// <summary>The resource does not exist or the caller cannot see it. Both answer 404.</summary>
public sealed class NotFoundException() : Exception("Not found.");

using Hewn.Application.Abstractions;

namespace Hewn.Api.Tests.Support;

/// <summary>
/// Stands in for GitHub. Repositories are writable unless the test says otherwise.
/// </summary>
public sealed class FakeGitHub : IGitHubRepositoryProbe
{
    private readonly Dictionary<string, RepositoryAccess> _access = new(StringComparer.OrdinalIgnoreCase);

    public void SetAccess(string owner, string name, RepositoryAccess access) => _access[$"{owner}/{name}"] = access;

    public Task<RepositoryAccess> ProbeAsync(string owner, string name, CancellationToken cancellationToken) =>
        Task.FromResult(_access.TryGetValue($"{owner}/{name}", out var access) ? access : RepositoryAccess.Writable);
}

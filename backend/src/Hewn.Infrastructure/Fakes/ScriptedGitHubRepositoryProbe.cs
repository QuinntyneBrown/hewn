using Hewn.Application.Abstractions;
using Microsoft.Extensions.Configuration;

namespace Hewn.Infrastructure.Fakes;

/// <summary>
/// Deterministic GitHub stand-in for end-to-end runs (Hewn:Fakes:Enabled). Repositories listed under
/// Hewn:Fakes:GitHub:NoAccess or :NotFound answer that way; every other repository is writable.
/// </summary>
public sealed class ScriptedGitHubRepositoryProbe(IConfiguration configuration) : IGitHubRepositoryProbe
{
    public Task<RepositoryAccess> ProbeAsync(string owner, string name, CancellationToken cancellationToken)
    {
        var fullName = $"{owner}/{name}";
        if (Listed("NoAccess", fullName))
        {
            return Task.FromResult(RepositoryAccess.NoAccess);
        }

        return Task.FromResult(Listed("NotFound", fullName) ? RepositoryAccess.NotFound : RepositoryAccess.Writable);
    }

    private bool Listed(string key, string fullName) =>
        (configuration[$"Hewn:Fakes:GitHub:{key}"] ?? string.Empty)
            .Split(',', StringSplitOptions.RemoveEmptyEntries | StringSplitOptions.TrimEntries)
            .Contains(fullName, StringComparer.OrdinalIgnoreCase);
}

using System.Net;
using System.Net.Http.Json;
using System.Text.Json.Serialization;
using Hewn.Application.Abstractions;

namespace Hewn.Infrastructure.GitHub;

/// <summary>Asks GitHub, as the Hewn App, whether it can push to a repository.</summary>
public sealed class GitHubAppRepositoryProbe(GitHubAppClient client) : IGitHubRepositoryProbe
{
    public async Task<RepositoryAccess> ProbeAsync(string owner, string name, CancellationToken cancellationToken)
    {
        var token = await client.GetRepositoryTokenAsync(owner, name, cancellationToken);
        if (token is null)
        {
            // The App is not installed there (or the repository does not exist): it cannot write.
            return RepositoryAccess.NoAccess;
        }

        using var response = await client.SendAsRepositoryAsync(HttpMethod.Get, $"repos/{owner}/{name}", token, cancellationToken);
        if (response.StatusCode == HttpStatusCode.NotFound)
        {
            return RepositoryAccess.NotFound;
        }

        response.EnsureSuccessStatusCode();
        var repository = await response.Content.ReadFromJsonAsync<Repository>(cancellationToken);
        return repository?.Permissions?.Push == true ? RepositoryAccess.Writable : RepositoryAccess.NoAccess;
    }

    private sealed record Repository([property: JsonPropertyName("permissions")] Permissions? Permissions);

    private sealed record Permissions([property: JsonPropertyName("push")] bool Push);
}

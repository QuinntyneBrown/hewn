using System.Net;
using System.Net.Http.Json;
using System.Text.Json;
using Hewn.Application.Abstractions;

namespace Hewn.Infrastructure.GitHub;

/// <summary>
/// Repository operations as the Hewn GitHub App: account tokens to create repositories, repository-scoped
/// tokens for everything else, and the Git Data API for commits. Errors carry GitHub's status and message only.
/// </summary>
public sealed class GitHubAppRepositories(GitHubAppClient client) : IGitHubRepositories
{
    public async Task<GitHubRepositoryInfo?> FindAsync(string owner, string name, CancellationToken cancellationToken)
    {
        var token = await client.GetRepositoryTokenAsync(owner, name, cancellationToken);
        if (token is null)
        {
            // Not installed there. A repository the App cannot see may still exist, so creation decides.
            return null;
        }

        var repository = await GetJsonAsync(token, $"repos/{owner}/{name}", cancellationToken);
        if (repository is null)
        {
            return null;
        }

        var topics = repository.Value.TryGetProperty("topics", out var t) ? t.EnumerateArray().Select(x => x.GetString()!).ToList() : [];
        using var commits = await client.SendAsRepositoryAsync(HttpMethod.Get, $"repos/{owner}/{name}/commits?per_page=2", token, cancellationToken);
        var count = commits.StatusCode == HttpStatusCode.Conflict
            ? 0 // empty repository
            : (await Ensure(commits, "list commits").Content.ReadFromJsonAsync<JsonElement>(cancellationToken)).GetArrayLength();
        return new GitHubRepositoryInfo(owner, name, repository.Value.GetProperty("private").GetBoolean(), topics, count);
    }

    public async Task<GitHubRepositoryInfo> CreatePrivateAsync(string owner, string name, string description, CancellationToken cancellationToken)
    {
        var token = await client.GetAccountTokenAsync(owner, cancellationToken)
            ?? throw new GitHubException($"Hewn's GitHub App is not installed on {owner}, so it cannot create {owner}/{name}.");

        using var created = await client.SendAsRepositoryAsync(
            HttpMethod.Post, $"orgs/{owner}/repos", token, cancellationToken,
            new { name, description, @private = true, auto_init = true });
        Ensure(created, $"create {owner}/{name}");

        using var topics = await client.SendAsRepositoryAsync(
            HttpMethod.Put, $"repos/{owner}/{name}/topics", token, cancellationToken, new { names = new[] { "hewn" } });
        Ensure(topics, $"tag {owner}/{name}");
        return new GitHubRepositoryInfo(owner, name, true, ["hewn"], 1);
    }

    public async Task<IReadOnlyList<string>> ListDirectoriesAsync(string owner, string name, string path, CancellationToken cancellationToken)
    {
        var token = await RepositoryTokenAsync(owner, name, cancellationToken);
        var listing = await GetJsonAsync(token, $"repos/{owner}/{name}/contents/{path}", cancellationToken);
        if (listing is not { ValueKind: JsonValueKind.Array } entries)
        {
            return [];
        }

        return entries.EnumerateArray()
            .Where(e => e.GetProperty("type").GetString() == "dir")
            .Select(e => e.GetProperty("name").GetString()!)
            .Order(StringComparer.Ordinal)
            .ToList();
    }

    public async Task<string> CommitAsync(string owner, string name, string message, IReadOnlyList<RepositoryFile> files, CancellationToken cancellationToken)
    {
        var token = await RepositoryTokenAsync(owner, name, cancellationToken);
        var repo = $"repos/{owner}/{name}";
        var branch = (await GetJsonAsync(token, repo, cancellationToken))!.Value.GetProperty("default_branch").GetString()!;
        var head = (await GetJsonAsync(token, $"{repo}/git/ref/heads/{branch}", cancellationToken))!.Value.GetProperty("object").GetProperty("sha").GetString()!;
        var baseTree = (await GetJsonAsync(token, $"{repo}/git/commits/{head}", cancellationToken))!.Value.GetProperty("tree").GetProperty("sha").GetString()!;

        var entries = new List<object>();
        foreach (var file in files)
        {
            var blob = await PostJsonAsync(token, $"{repo}/git/blobs", new { content = Convert.ToBase64String(file.Content), encoding = "base64" }, cancellationToken);
            entries.Add(new { path = file.Path, mode = "100644", type = "blob", sha = blob.GetProperty("sha").GetString() });
        }

        var tree = await PostJsonAsync(token, $"{repo}/git/trees", new { base_tree = baseTree, tree = entries }, cancellationToken);
        var commit = await PostJsonAsync(token, $"{repo}/git/commits", new { message, tree = tree.GetProperty("sha").GetString(), parents = new[] { head } }, cancellationToken);
        var sha = commit.GetProperty("sha").GetString()!;
        using var update = await client.SendAsRepositoryAsync(HttpMethod.Patch, $"{repo}/git/refs/heads/{branch}", token, cancellationToken, new { sha });
        Ensure(update, $"update {branch}");
        return sha;
    }

    private async Task<string> RepositoryTokenAsync(string owner, string name, CancellationToken cancellationToken) =>
        await client.GetRepositoryTokenAsync(owner, name, cancellationToken)
        ?? throw new GitHubException($"Hewn's GitHub App can't write to {owner}/{name}.");

    private async Task<JsonElement?> GetJsonAsync(string token, string path, CancellationToken cancellationToken)
    {
        using var response = await client.SendAsRepositoryAsync(HttpMethod.Get, path, token, cancellationToken);
        if (response.StatusCode == HttpStatusCode.NotFound)
        {
            return null;
        }

        return await Ensure(response, $"read {path}").Content.ReadFromJsonAsync<JsonElement>(cancellationToken);
    }

    private async Task<JsonElement> PostJsonAsync(string token, string path, object body, CancellationToken cancellationToken)
    {
        using var response = await client.SendAsRepositoryAsync(HttpMethod.Post, path, token, cancellationToken, body);
        return await Ensure(response, $"write {path}").Content.ReadFromJsonAsync<JsonElement>(cancellationToken);
    }

    private static HttpResponseMessage Ensure(HttpResponseMessage response, string action)
    {
        if (response.IsSuccessStatusCode)
        {
            return response;
        }

        // GitHub's error body holds a message and documentation URL, never the token we sent.
        var detail = response.Content.ReadAsStringAsync().GetAwaiter().GetResult();
        var message = TryMessage(detail) ?? response.ReasonPhrase ?? "unknown error";
        throw new GitHubException($"GitHub refused to {action}: {(int)response.StatusCode} {message}");
    }

    private static string? TryMessage(string body)
    {
        try
        {
            return JsonDocument.Parse(body).RootElement.GetProperty("message").GetString();
        }
        catch (Exception e) when (e is JsonException or KeyNotFoundException or InvalidOperationException)
        {
            return null;
        }
    }
}

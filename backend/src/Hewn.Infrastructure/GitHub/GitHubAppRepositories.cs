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

    public async Task<IReadOnlyList<string>> ListFilesAsync(string owner, string name, string path, string sha, CancellationToken cancellationToken)
    {
        var token = await RepositoryTokenAsync(owner, name, cancellationToken);
        var listing = await GetJsonAsync(token, $"repos/{owner}/{name}/contents/{Uri.EscapeDataString(path.TrimEnd('/')).Replace("%2F", "/", StringComparison.Ordinal)}?ref={sha}", cancellationToken);
        if (listing is not { ValueKind: JsonValueKind.Array } entries)
        {
            return [];
        }

        return entries.EnumerateArray()
            .Where(e => e.GetProperty("type").GetString() == "file")
            .Select(e => e.GetProperty("name").GetString()!)
            .Order(StringComparer.Ordinal)
            .ToList();
    }

    public async Task<RepositoryContent?> ReadFileAsync(string owner, string name, string path, string? sha, CancellationToken cancellationToken)
    {
        var token = await RepositoryTokenAsync(owner, name, cancellationToken);
        var at = sha;
        if (at is null)
        {
            var branch = await DefaultBranchAsync(token, owner, name, cancellationToken);
            var head = await GetJsonAsync(token, $"repos/{owner}/{name}/git/ref/heads/{branch}", cancellationToken);
            if (head is null)
            {
                return null;
            }

            at = head.Value.GetProperty("object").GetProperty("sha").GetString()!;
        }

        var file = await GetJsonAsync(token, $"repos/{owner}/{name}/contents/{Uri.EscapeDataString(path).Replace("%2F", "/", StringComparison.Ordinal)}?ref={at}", cancellationToken);
        if (file is not { ValueKind: JsonValueKind.Object } entry || entry.GetProperty("type").GetString() != "file")
        {
            return null;
        }

        // The contents API inlines files up to 1 MB as base64; larger ones come from the blob.
        var encoded = entry.GetProperty("content").GetString();
        if (string.IsNullOrEmpty(encoded))
        {
            var blob = await GetJsonAsync(token, $"repos/{owner}/{name}/git/blobs/{entry.GetProperty("sha").GetString()}", cancellationToken);
            encoded = blob?.GetProperty("content").GetString() ?? string.Empty;
        }

        return new RepositoryContent(Convert.FromBase64String(encoded.Replace("\n", string.Empty, StringComparison.Ordinal)), at);
    }

    public async Task<Stream> DownloadArchiveAsync(string owner, string name, CancellationToken cancellationToken)
    {
        var token = await RepositoryTokenAsync(owner, name, cancellationToken);
        // GitHub answers with a redirect to a short-lived codeload URL; the client follows it without the token.
        var response = await client.SendAsRepositoryAsync(HttpMethod.Get, $"repos/{owner}/{name}/tarball", token, cancellationToken);
        Ensure(response, $"download {owner}/{name}");
        return await response.Content.ReadAsStreamAsync(cancellationToken);
    }

    public async Task<string> CommitAsync(string owner, string name, string message, IReadOnlyList<RepositoryFile> files, CancellationToken cancellationToken)
    {
        var token = await RepositoryTokenAsync(owner, name, cancellationToken);
        var branch = await DefaultBranchAsync(token, owner, name, cancellationToken);
        return await CommitToRefAsync(token, owner, name, branch, message, files, cancellationToken);
    }

    public async Task<string> CommitToBranchAsync(string owner, string name, string branch, string message, IReadOnlyList<RepositoryFile> files, bool rebase, CancellationToken cancellationToken)
    {
        var token = await RepositoryTokenAsync(owner, name, cancellationToken);
        var repo = $"repos/{owner}/{name}";
        var exists = await GetJsonAsync(token, $"{repo}/git/ref/heads/{branch}", cancellationToken) is not null;
        if (!exists || rebase)
        {
            var main = await DefaultBranchAsync(token, owner, name, cancellationToken);
            var from = (await GetJsonAsync(token, $"{repo}/git/ref/heads/{main}", cancellationToken))!.Value.GetProperty("object").GetProperty("sha").GetString()!;
            if (!exists)
            {
                await PostJsonAsync(token, $"{repo}/git/refs", new { @ref = $"refs/heads/{branch}", sha = from }, cancellationToken);
            }
            else
            {
                // A rebase: the new commit sits on the default branch's head and the branch is moved to it.
                return await CommitToRefAsync(token, owner, name, branch, message, files, cancellationToken, parentOverride: from);
            }
        }

        return await CommitToRefAsync(token, owner, name, branch, message, files, cancellationToken);
    }

    public async Task DeleteBranchAsync(string owner, string name, string branch, CancellationToken cancellationToken)
    {
        var token = await RepositoryTokenAsync(owner, name, cancellationToken);
        using var response = await client.SendAsRepositoryAsync(HttpMethod.Delete, $"repos/{owner}/{name}/git/refs/heads/{branch}", token, cancellationToken);
        if (response.StatusCode is not (HttpStatusCode.UnprocessableEntity or HttpStatusCode.NotFound))
        {
            Ensure(response, $"delete {branch}");
        }
    }

    public async Task<PullRequestInfo> OpenPullRequestAsync(string owner, string name, string head, string title, string body, CancellationToken cancellationToken)
    {
        var token = await RepositoryTokenAsync(owner, name, cancellationToken);
        var main = await DefaultBranchAsync(token, owner, name, cancellationToken);
        return ToPullRequest(await PostJsonAsync(token, $"repos/{owner}/{name}/pulls", new { title, body, head, @base = main }, cancellationToken));
    }

    public async Task<PullRequestInfo?> GetPullRequestAsync(string owner, string name, int number, CancellationToken cancellationToken)
    {
        var token = await RepositoryTokenAsync(owner, name, cancellationToken);
        var pull = await GetJsonAsync(token, $"repos/{owner}/{name}/pulls/{number}", cancellationToken);
        return pull is null ? null : ToPullRequest(pull.Value);
    }

    public async Task AddLabelAsync(string owner, string name, int number, string label, CancellationToken cancellationToken)
    {
        var token = await RepositoryTokenAsync(owner, name, cancellationToken);
        await PostJsonAsync(token, $"repos/{owner}/{name}/issues/{number}/labels", new { labels = new[] { label } }, cancellationToken);
    }

    public async Task<IReadOnlyList<CheckRunInfo>> ListChecksAsync(string owner, string name, int number, CancellationToken cancellationToken)
    {
        var token = await RepositoryTokenAsync(owner, name, cancellationToken);
        var pull = await GetJsonAsync(token, $"repos/{owner}/{name}/pulls/{number}", cancellationToken)
            ?? throw new GitHubException($"Pull request #{number} does not exist.");
        var sha = pull.GetProperty("head").GetProperty("sha").GetString();
        var runs = (await GetJsonAsync(token, $"repos/{owner}/{name}/commits/{sha}/check-runs?per_page=100", cancellationToken))!.Value;
        return [.. runs.GetProperty("check_runs").EnumerateArray().Select(r => new CheckRunInfo(
            r.GetProperty("name").GetString()!,
            r.GetProperty("status").GetString()!,
            r.GetProperty("conclusion").ValueKind == JsonValueKind.Null ? null : r.GetProperty("conclusion").GetString(),
            Time(r, "started_at"),
            Time(r, "completed_at")))];
    }

    public async Task<string> MergePullRequestAsync(string owner, string name, int number, string title, CancellationToken cancellationToken)
    {
        var token = await RepositoryTokenAsync(owner, name, cancellationToken);
        using var response = await client.SendAsRepositoryAsync(HttpMethod.Put, $"repos/{owner}/{name}/pulls/{number}/merge", token, cancellationToken, new { merge_method = "squash", commit_title = $"{title} (#{number})" });
        if (response.StatusCode == HttpStatusCode.MethodNotAllowed)
        {
            // Branch protection with strict checks refuses a branch that is behind the default branch.
            var message = TryMessage(await response.Content.ReadAsStringAsync(cancellationToken)) ?? "not mergeable";
            if (message.Contains("out of date", StringComparison.OrdinalIgnoreCase) || message.Contains("modified", StringComparison.OrdinalIgnoreCase))
            {
                throw new GitHubBranchBehindException($"GitHub refused to merge #{number}: {message}");
            }
        }

        var merged = await Ensure(response, $"merge #{number}").Content.ReadFromJsonAsync<JsonElement>(cancellationToken);
        return merged.GetProperty("sha").GetString()!;
    }

    public async Task ProtectDefaultBranchAsync(string owner, string name, IReadOnlyList<string> checks, CancellationToken cancellationToken)
    {
        var token = await RepositoryTokenAsync(owner, name, cancellationToken);
        var main = await DefaultBranchAsync(token, owner, name, cancellationToken);
        using var response = await client.SendAsRepositoryAsync(HttpMethod.Put, $"repos/{owner}/{name}/branches/{main}/protection", token, cancellationToken, new
        {
            required_status_checks = new { strict = true, contexts = checks },
            enforce_admins = false,
            required_pull_request_reviews = (object?)null,
            restrictions = (object?)null,
        });
        Ensure(response, $"protect {main}");
    }

    private static PullRequestInfo ToPullRequest(JsonElement pull) => new(
        pull.GetProperty("number").GetInt32(),
        pull.GetProperty("html_url").GetString()!,
        pull.GetProperty("head").GetProperty("ref").GetString()!,
        pull.TryGetProperty("merged", out var merged) && merged.ValueKind == JsonValueKind.True,
        pull.GetProperty("title").GetString() ?? string.Empty,
        pull.TryGetProperty("body", out var body) && body.ValueKind == JsonValueKind.String ? body.GetString()! : string.Empty,
        pull.TryGetProperty("additions", out var additions) ? additions.GetInt32() : 0,
        pull.TryGetProperty("deletions", out var deletions) ? deletions.GetInt32() : 0,
        pull.TryGetProperty("changed_files", out var changed) ? changed.GetInt32() : 0);

    private static DateTimeOffset? Time(JsonElement element, string name) =>
        element.TryGetProperty(name, out var value) && value.ValueKind == JsonValueKind.String ? value.GetDateTimeOffset() : null;

    private async Task<string> DefaultBranchAsync(string token, string owner, string name, CancellationToken cancellationToken) =>
        (await GetJsonAsync(token, $"repos/{owner}/{name}", cancellationToken))!.Value.GetProperty("default_branch").GetString()!;

    private async Task<string> CommitToRefAsync(string token, string owner, string name, string branch, string message, IReadOnlyList<RepositoryFile> files, CancellationToken cancellationToken, string? parentOverride = null)
    {
        var repo = $"repos/{owner}/{name}";
        var head = parentOverride ?? (await GetJsonAsync(token, $"{repo}/git/ref/heads/{branch}", cancellationToken))!.Value.GetProperty("object").GetProperty("sha").GetString()!;
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
        using var update = await client.SendAsRepositoryAsync(HttpMethod.Patch, $"{repo}/git/refs/heads/{branch}", token, cancellationToken, new { sha, force = parentOverride is not null });
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

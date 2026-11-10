using System.Formats.Tar;
using System.IO.Compression;
using System.Security.Cryptography;
using System.Text;
using Hewn.Application.Abstractions;
using Microsoft.Extensions.Configuration;

namespace Hewn.Infrastructure.Fakes;

/// <summary>
/// Deterministic GitHub for tests and end-to-end runs (Hewn:Fakes:Enabled). Repositories live in memory.
/// Repositories listed under Hewn:Fakes:GitHub:NoAccess or :NotFound answer the probe that way; every other
/// repository is writable, and a repository the probe accepts but nobody created is created on first use.
/// </summary>
public class InMemoryGitHub(IConfiguration? configuration) : IGitHubRepositoryProbe, IGitHubRepositories
{
    private readonly Dictionary<string, RepositoryAccess> _access = new(StringComparer.OrdinalIgnoreCase);
    private readonly Dictionary<string, FakeRepository> _repositories = new(StringComparer.OrdinalIgnoreCase);
    private readonly Lock _lock = new();

    /// <summary>
    /// Seconds each check takes in the fake CI, one after another from the branch's last commit (e2e and videos
    /// watch checks turn green). 0, the default, completes every check at once.
    /// </summary>
    public double CheckSeconds { get; set; } = double.TryParse(configuration?["Hewn:Fakes:GitHub:CheckSeconds"], System.Globalization.CultureInfo.InvariantCulture, out var seconds) ? seconds : 0;

    public TimeProvider Clock { get; set; } = TimeProvider.System;

    public void SetAccess(string owner, string name, RepositoryAccess access)
    {
        lock (_lock)
        {
            _access[$"{owner}/{name}"] = access;
        }
    }

    public FakeRepository? Repository(string owner, string name)
    {
        lock (_lock)
        {
            return _repositories.GetValueOrDefault($"{owner}/{name}");
        }
    }

    /// <summary>Adds a repository with an initial commit holding <paramref name="files"/>.</summary>
    public FakeRepository Seed(string owner, string name, IReadOnlyList<string> topics, Dictionary<string, string>? files = null, bool isPrivate = true)
    {
        lock (_lock)
        {
            var repository = new FakeRepository(owner, name, isPrivate, [.. topics]) { Clock = Clock };
            repository.Commit("Initial commit", (files ?? new() { ["README.md"] = $"# {name}\n" })
                .Select(f => new RepositoryFile(f.Key, Encoding.UTF8.GetBytes(f.Value))).ToList());
            _repositories[$"{owner}/{name}"] = repository;
            return repository;
        }
    }

    public Task<RepositoryAccess> ProbeAsync(string owner, string name, CancellationToken cancellationToken)
    {
        var fullName = $"{owner}/{name}";
        lock (_lock)
        {
            if (_access.TryGetValue(fullName, out var access))
            {
                return Task.FromResult(access);
            }
        }

        if (Listed("NoAccess", fullName))
        {
            return Task.FromResult(RepositoryAccess.NoAccess);
        }

        return Task.FromResult(Listed("NotFound", fullName) ? RepositoryAccess.NotFound : RepositoryAccess.Writable);
    }

    public Task<GitHubRepositoryInfo?> FindAsync(string owner, string name, CancellationToken cancellationToken)
    {
        lock (_lock)
        {
            return Task.FromResult(_repositories.GetValueOrDefault($"{owner}/{name}")?.Info);
        }
    }

    public Task<GitHubRepositoryInfo> CreatePrivateAsync(string owner, string name, string description, CancellationToken cancellationToken)
    {
        lock (_lock)
        {
            if (_repositories.ContainsKey($"{owner}/{name}"))
            {
                throw new GitHubException($"Repository creation failed: name already exists on this account ({owner}/{name}).");
            }

            return Task.FromResult(Seed(owner, name, ["hewn"]).Info);
        }
    }

    public Task<IReadOnlyList<string>> ListDirectoriesAsync(string owner, string name, string path, CancellationToken cancellationToken)
    {
        lock (_lock)
        {
            var prefix = path.TrimEnd('/') + "/";
            IReadOnlyList<string> names = Existing(owner, name).Files.Keys
                .Where(p => p.StartsWith(prefix, StringComparison.Ordinal) && p.IndexOf('/', prefix.Length) > 0)
                .Select(p => p[prefix.Length..p.IndexOf('/', prefix.Length)])
                .Distinct()
                .Order(StringComparer.Ordinal)
                .ToList();
            return Task.FromResult(names);
        }
    }

    public Task<Stream> DownloadArchiveAsync(string owner, string name, CancellationToken cancellationToken)
    {
        lock (_lock)
        {
            var repository = Existing(owner, name);
            var top = $"{name}-{repository.Commits[^1].Sha[..7]}";
            var output = new MemoryStream();
            using (var gzip = new GZipStream(output, CompressionLevel.Fastest, leaveOpen: true))
            using (var tar = new TarWriter(gzip, TarEntryFormat.Pax, leaveOpen: true))
            {
                foreach (var (path, content) in repository.Files.OrderBy(f => f.Key, StringComparer.Ordinal))
                {
                    tar.WriteEntry(new PaxTarEntry(TarEntryType.RegularFile, $"{top}/{path}") { DataStream = new MemoryStream(content) });
                }
            }

            output.Position = 0;
            return Task.FromResult<Stream>(output);
        }
    }

    public Task<string> CommitAsync(string owner, string name, string message, IReadOnlyList<RepositoryFile> files, CancellationToken cancellationToken)
    {
        lock (_lock)
        {
            return Task.FromResult(Existing(owner, name).Commit(message, files));
        }
    }

    /// <summary>Makes the named check fail on every pull request in the repository.</summary>
    public void FailCheck(string owner, string name, string check)
    {
        lock (_lock)
        {
            Existing(owner, name).FailingChecks.Add(check);
        }
    }

    public Task<string> CommitToBranchAsync(string owner, string name, string branch, string message, IReadOnlyList<RepositoryFile> files, bool rebase, CancellationToken cancellationToken)
    {
        lock (_lock)
        {
            return Task.FromResult(Existing(owner, name).CommitToBranch(branch, message, files, rebase));
        }
    }

    public Task DeleteBranchAsync(string owner, string name, string branch, CancellationToken cancellationToken)
    {
        lock (_lock)
        {
            var repository = Existing(owner, name);
            repository.Branches.Remove(branch);
            repository.BranchBases.Remove(branch);
            return Task.CompletedTask;
        }
    }

    public Task<PullRequestInfo> OpenPullRequestAsync(string owner, string name, string head, string title, string body, CancellationToken cancellationToken)
    {
        lock (_lock)
        {
            var repository = Existing(owner, name);
            if (!repository.Branches.ContainsKey(head))
            {
                throw new GitHubException($"GitHub refused to open a pull request: 422 No commits on {head}");
            }

            var pull = new FakePullRequest(repository.PullRequests.Count + 1, head, title, body);
            repository.PullRequests.Add(pull);
            return Task.FromResult(repository.PullRequestInfo(pull));
        }
    }

    public Task<PullRequestInfo?> GetPullRequestAsync(string owner, string name, int number, CancellationToken cancellationToken)
    {
        lock (_lock)
        {
            var repository = Existing(owner, name);
            var pull = repository.PullRequests.SingleOrDefault(p => p.Number == number);
            return Task.FromResult(pull is null ? null : repository.PullRequestInfo(pull));
        }
    }

    public Task AddLabelAsync(string owner, string name, int number, string label, CancellationToken cancellationToken)
    {
        lock (_lock)
        {
            var pull = Existing(owner, name).PullRequests.Single(p => p.Number == number);
            if (!pull.Labels.Contains(label))
            {
                pull.Labels.Add(label);
            }

            return Task.CompletedTask;
        }
    }

    public Task<IReadOnlyList<CheckRunInfo>> ListChecksAsync(string owner, string name, int number, CancellationToken cancellationToken)
    {
        lock (_lock)
        {
            var repository = Existing(owner, name);
            var pull = repository.PullRequests.Single(p => p.Number == number);
            // The fake runs one check per job in the head branch's workflow, each CheckSeconds long, in order from
            // the branch's last commit. A merged pull request's branch is gone; its checks are those of the merge.
            var tree = repository.Branches.GetValueOrDefault(pull.Head) ?? repository.Files;
            var workflow = tree.TryGetValue(".github/workflows/ci.yml", out var bytes) ? Encoding.UTF8.GetString(bytes) : string.Empty;
            var from = repository.BranchTimes.GetValueOrDefault(pull.Head, DateTimeOffset.MinValue);
            var now = Clock.GetUtcNow();
            IReadOnlyList<CheckRunInfo> checks = [.. WorkflowJobs(workflow).Select((job, i) =>
            {
                if (CheckSeconds <= 0 || pull.Merged || from == DateTimeOffset.MinValue)
                {
                    return new CheckRunInfo(job, "completed", repository.FailingChecks.Contains(job) ? "failure" : "success");
                }

                var started = from.AddSeconds(i * CheckSeconds / 2);
                var completed = from.AddSeconds((i + 1) * CheckSeconds);
                return now < started ? new CheckRunInfo(job, "queued", null)
                    : now < completed ? new CheckRunInfo(job, "in_progress", null, started)
                    : new CheckRunInfo(job, "completed", repository.FailingChecks.Contains(job) ? "failure" : "success", started, completed);
            })];
            return Task.FromResult(checks);
        }
    }

    public Task<string> MergePullRequestAsync(string owner, string name, int number, string title, CancellationToken cancellationToken)
    {
        lock (_lock)
        {
            var repository = Existing(owner, name);
            var pull = repository.PullRequests.Single(p => p.Number == number);
            if (pull.Merged)
            {
                throw new GitHubException("GitHub refused to merge: 405 Pull Request is not mergeable");
            }

            if (repository.BranchBases.GetValueOrDefault(pull.Head) != repository.Commits.Count)
            {
                throw new GitHubBranchBehindException("GitHub refused to merge: 405 Head branch is out of date");
            }

            var files = repository.Branches[pull.Head].Select(f => new RepositoryFile(f.Key, f.Value)).ToList();
            pull.Size = repository.Size(pull.Head);
            pull.Merged = true;
            return Task.FromResult(repository.Commit($"{title} (#{number})", files));
        }
    }

    public Task ProtectDefaultBranchAsync(string owner, string name, IReadOnlyList<string> checks, CancellationToken cancellationToken)
    {
        lock (_lock)
        {
            var repository = Existing(owner, name);
            repository.RequiredChecks.Clear();
            repository.RequiredChecks.AddRange(checks);
            return Task.CompletedTask;
        }
    }

    private static IEnumerable<string> WorkflowJobs(string workflow)
    {
        var inJobs = false;
        foreach (var line in workflow.Split('\n'))
        {
            if (line.TrimEnd() == "jobs:")
            {
                inJobs = true;
                continue;
            }

            if (inJobs && line.Length > 0 && !char.IsWhiteSpace(line[0]))
            {
                yield break;
            }

            var match = System.Text.RegularExpressions.Regex.Match(line, @"^  ([A-Za-z0-9_-]+):\s*$");
            if (inJobs && match.Success)
            {
                yield return match.Groups[1].Value;
            }
        }
    }

    // A repository the probe allowed (an Owner's existing repository) exists on first use.
    private FakeRepository Existing(string owner, string name) =>
        _repositories.GetValueOrDefault($"{owner}/{name}") ?? Seed(owner, name, []);

    private bool Listed(string key, string fullName) =>
        (configuration?[$"Hewn:Fakes:GitHub:{key}"] ?? string.Empty)
            .Split(',', StringSplitOptions.RemoveEmptyEntries | StringSplitOptions.TrimEntries)
            .Contains(fullName, StringComparer.OrdinalIgnoreCase);
}

public sealed class FakeRepository(string owner, string name, bool isPrivate, List<string> topics)
{
    public string Owner { get; } = owner;

    public string Name { get; } = name;

    public bool IsPrivate { get; } = isPrivate;

    public List<string> Topics { get; } = topics;

    public Dictionary<string, byte[]> Files { get; } = new(StringComparer.Ordinal);

    public List<FakeCommit> Commits { get; } = [];

    /// <summary>Branches other than the default, each with its full file set.</summary>
    public Dictionary<string, Dictionary<string, byte[]>> Branches { get; } = new(StringComparer.Ordinal);

    /// <summary>How many default-branch commits each branch was made (or last rebased) on.</summary>
    public Dictionary<string, int> BranchBases { get; } = new(StringComparer.Ordinal);

    public List<FakePullRequest> PullRequests { get; } = [];

    public List<string> RequiredChecks { get; } = [];

    public HashSet<string> FailingChecks { get; } = new(StringComparer.Ordinal);

    public GitHubRepositoryInfo Info => new(Owner, Name, IsPrivate, [.. Topics], Commits.Count);

    public string? Read(string path) => Files.TryGetValue(path, out var bytes) ? Encoding.UTF8.GetString(bytes) : null;

    /// <summary>Commits one file, as someone pushing outside Hewn would.</summary>
    public string Write(string path, string content) =>
        Commit($"Update {path}", [new RepositoryFile(path, Encoding.UTF8.GetBytes(content))]);

    /// <summary>Last commit time of each branch, from which the fake CI times its checks.</summary>
    public Dictionary<string, DateTimeOffset> BranchTimes { get; } = new(StringComparer.Ordinal);

    internal TimeProvider Clock { get; set; } = TimeProvider.System;

    internal PullRequestInfo PullRequestInfo(FakePullRequest pull)
    {
        var (additions, deletions, changed) = pull.Size ?? Size(pull.Head);
        return new(pull.Number, $"https://github.com/{Owner}/{Name}/pull/{pull.Number}", pull.Head, pull.Merged, pull.Title, pull.Body, additions, deletions, changed);
    }

    /// <summary>Lines added and deleted, and files changed, between a branch and the default branch.</summary>
    internal (int Additions, int Deletions, int Changed) Size(string branch)
    {
        if (!Branches.TryGetValue(branch, out var tree))
        {
            return (0, 0, 0);
        }

        static int Lines(byte[]? bytes) => bytes is null ? 0 : Encoding.UTF8.GetString(bytes).Split('\n', StringSplitOptions.RemoveEmptyEntries).Length;
        var changed = tree.Where(f => !Files.TryGetValue(f.Key, out var before) || !before.AsSpan().SequenceEqual(f.Value)).ToList();
        return (changed.Sum(f => Lines(f.Value)), changed.Sum(f => Lines(Files.GetValueOrDefault(f.Key))), changed.Count);
    }

    /// <summary>Commits to a branch as the broker does; tests also use it to make a branch Hewn did not.</summary>
    public string CommitToBranch(string branch, string message, IReadOnlyList<RepositoryFile> files, bool rebase = false)
    {
        if (rebase || !Branches.TryGetValue(branch, out var tree))
        {
            tree = new Dictionary<string, byte[]>(Files, StringComparer.Ordinal);
            Branches[branch] = tree;
            BranchBases[branch] = Commits.Count;
        }

        BranchTimes[branch] = Clock.GetUtcNow();

        foreach (var file in files)
        {
            tree[file.Path] = file.Content;
        }

        return Convert.ToHexStringLower(SHA1.HashData(Encoding.UTF8.GetBytes($"{branch}\n{message}\n{string.Join('\n', files.Select(f => f.Path))}")));
    }

    internal string Commit(string message, IReadOnlyList<RepositoryFile> files)
    {
        foreach (var file in files)
        {
            Files[file.Path] = file.Content;
        }

        var parent = Commits.Count == 0 ? string.Empty : Commits[^1].Sha;
        var sha = Convert.ToHexStringLower(SHA1.HashData(Encoding.UTF8.GetBytes($"{parent}\n{message}\n{string.Join('\n', files.Select(f => f.Path))}\n{Commits.Count}")));
        Commits.Add(new FakeCommit(sha, message, [.. files.Select(f => f.Path)]));
        return sha;
    }
}

public sealed record FakeCommit(string Sha, string Message, IReadOnlyList<string> Paths);

public sealed class FakePullRequest(int number, string head, string title, string body)
{
    public int Number { get; } = number;

    public string Head { get; } = head;

    public string Title { get; } = title;

    public string Body { get; } = body;

    public bool Merged { get; set; }

    /// <summary>Open until merged; nothing in Hewn closes a pull request without merging it.</summary>
    public bool Open => !Merged;

    public List<string> Labels { get; } = [];

    /// <summary>The size when merged, after which the branch is gone.</summary>
    public (int Additions, int Deletions, int Changed)? Size { get; set; }
}

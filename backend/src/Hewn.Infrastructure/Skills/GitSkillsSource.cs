using System.Diagnostics;
using System.Security.Cryptography;
using System.Text;
using Hewn.Application.Abstractions;
using Hewn.Application.Pipeline;
using Microsoft.Extensions.Configuration;
using Microsoft.Extensions.Options;

namespace Hewn.Infrastructure.Skills;

/// <summary>
/// Reads Greenlit with git from a bare clone kept under the temp folder, fetched again when the last fetch is older
/// than <c>Hewn:Skills:FetchSeconds</c> (default 60). Errors name git's exit code only: its output can echo the URL.
/// </summary>
public sealed class GitSkillsSource(IOptions<PipelineOptions> options, IConfiguration configuration, TimeProvider clock) : ISkillsSource
{
    private static readonly string[] Roots = [".claude/skills", ".agents/skills"];

    private readonly SemaphoreSlim _gate = new(1, 1);

    private readonly TimeSpan _maxAge = TimeSpan.FromSeconds(configuration.GetValue("Hewn:Skills:FetchSeconds", 60));

    private DateTimeOffset _fetchedAt = DateTimeOffset.MinValue;

    private string Directory => Path.Combine(
        Path.GetTempPath(),
        "hewn-skills",
        Convert.ToHexStringLower(SHA256.HashData(Encoding.UTF8.GetBytes(options.Value.SkillsSource)))[..16]);

    public async Task<string> HeadAsync(CancellationToken cancellationToken)
    {
        await FetchAsync(cancellationToken);
        return (await GitAsync(cancellationToken, "rev-parse", "HEAD")).Text.Trim();
    }

    public async Task<IReadOnlyList<SkillsCommit>> CommitsSinceAsync(string sha, CancellationToken cancellationToken)
    {
        await FetchAsync(cancellationToken);
        if (!IsSha(sha) || !(await RunAsync(Directory, cancellationToken, "cat-file", "-e", $"{sha}^{{commit}}")).Ok)
        {
            return [];
        }

        var log = await GitAsync(cancellationToken, "log", "--format=%H%x1f%s", $"{sha}..HEAD");
        return [.. log.Text.Split('\n', StringSplitOptions.RemoveEmptyEntries)
            .Select(line => line.Split('\u001f', 2))
            .Select(parts => new SkillsCommit(parts[0], parts.ElementAtOrDefault(1) ?? string.Empty))];
    }

    public async Task<IReadOnlyList<RepositoryFile>> SkillFilesAsync(string sha, CancellationToken cancellationToken)
    {
        await FetchAsync(cancellationToken);
        if (!IsSha(sha))
        {
            throw new SkillsSourceException("Greenlit couldn’t be read (not a commit)");
        }

        var listed = await GitAsync(cancellationToken, ["ls-tree", "-r", "--name-only", sha, "--", .. Roots]);
        var files = new List<RepositoryFile>();
        foreach (var path in listed.Text.Split('\n', StringSplitOptions.RemoveEmptyEntries))
        {
            files.Add(new RepositoryFile(path, (await GitAsync(cancellationToken, "show", $"{sha}:{path}")).Bytes));
        }

        return files;
    }

    private static bool IsSha(string sha) => sha.Length == 40 && sha.All(Uri.IsHexDigit);

    private async Task FetchAsync(CancellationToken cancellationToken)
    {
        await _gate.WaitAsync(cancellationToken);
        try
        {
            if (clock.GetUtcNow() - _fetchedAt < _maxAge && System.IO.Directory.Exists(Directory))
            {
                return;
            }

            var fetched = System.IO.Directory.Exists(Path.Combine(Directory, "objects"))
                ? await RunAsync(Directory, cancellationToken, "fetch", "--quiet", "--prune", "origin", "+refs/heads/*:refs/heads/*")
                : await CloneAsync(cancellationToken);
            if (!fetched.Ok)
            {
                throw new SkillsSourceException($"Greenlit couldn’t be fetched (git exited with {fetched.ExitCode})");
            }

            _fetchedAt = clock.GetUtcNow();
        }
        finally
        {
            _gate.Release();
        }
    }

    private async Task<GitResult> CloneAsync(CancellationToken cancellationToken)
    {
        if (System.IO.Directory.Exists(Directory))
        {
            System.IO.Directory.Delete(Directory, recursive: true);
        }

        System.IO.Directory.CreateDirectory(Path.GetDirectoryName(Directory)!);
        return await RunAsync(null, cancellationToken, "clone", "--quiet", "--bare", options.Value.SkillsSource, Directory);
    }

    private async Task<GitResult> GitAsync(CancellationToken cancellationToken, params string[] args)
    {
        var result = await RunAsync(Directory, cancellationToken, args);
        return result.Ok ? result : throw new SkillsSourceException($"Greenlit couldn’t be read (git exited with {result.ExitCode})");
    }

    private async Task<GitResult> RunAsync(string? directory, CancellationToken cancellationToken, params string[] args)
    {
        var start = new ProcessStartInfo("git") { RedirectStandardOutput = true, RedirectStandardError = true };
        if (directory is not null)
        {
            start.ArgumentList.Add("-C");
            start.ArgumentList.Add(directory);
        }

        foreach (var arg in args)
        {
            start.ArgumentList.Add(arg);
        }

        start.Environment["GIT_TERMINAL_PROMPT"] = "0";
        using var process = Process.Start(start) ?? throw new SkillsSourceException("Greenlit couldn’t be fetched (git didn’t start)");
        using var output = new MemoryStream();
        var copy = process.StandardOutput.BaseStream.CopyToAsync(output, cancellationToken);
        var errors = process.StandardError.ReadToEndAsync(cancellationToken);
        await Task.WhenAll(copy, errors, process.WaitForExitAsync(cancellationToken));
        return new GitResult(output.ToArray(), process.ExitCode);
    }

    private sealed record GitResult(byte[] Bytes, int ExitCode)
    {
        public bool Ok => ExitCode == 0;

        public string Text => Encoding.UTF8.GetString(Bytes);
    }
}

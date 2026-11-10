using System.Diagnostics;

namespace Hewn.Api.Tests.Support;

/// <summary>A small Greenlit: a local git repository with skills under <c>.claude/skills/</c> and <c>.agents/skills/</c>.</summary>
public sealed class GreenlitRepository : IDisposable
{
    public GreenlitRepository()
    {
        Directory.CreateDirectory(Path);
        Git("init", "-q", "-b", "main");
    }

    public string Path { get; } = System.IO.Path.Combine(System.IO.Path.GetTempPath(), $"greenlit-{Guid.NewGuid():N}");

    /// <summary>The clone URL Hewn reads it from, as <c>HEWN_SKILLS_SOURCE</c>.</summary>
    public string Url => $"file://{Path}";

    /// <summary>Writes the files and commits them; returns the new commit's SHA.</summary>
    public string Commit(string message, params (string Path, string Content)[] files)
    {
        foreach (var (path, content) in files)
        {
            var full = System.IO.Path.Combine(Path, path);
            Directory.CreateDirectory(System.IO.Path.GetDirectoryName(full)!);
            File.WriteAllText(full, content);
        }

        Git("add", "-A");
        Git("-c", "user.name=Greenlit", "-c", "user.email=greenlit@example.invalid", "commit", "-q", "--allow-empty", "-m", message);
        return Git("rev-parse", "HEAD").Trim();
    }

    /// <summary>The lock stage 0 writes for this SHA.</summary>
    public string Lock(string sha, params string[] skills) =>
        System.Text.Json.JsonSerializer.Serialize(new { source = Url, sha, skills });

    private string Git(params string[] args)
    {
        var start = new ProcessStartInfo("git") { WorkingDirectory = Path, RedirectStandardOutput = true, RedirectStandardError = true };
        foreach (var arg in args)
        {
            start.ArgumentList.Add(arg);
        }

        using var process = Process.Start(start)!;
        var output = process.StandardOutput.ReadToEnd();
        process.WaitForExit();
        if (process.ExitCode != 0)
        {
            throw new InvalidOperationException($"git {string.Join(' ', args)}: {process.StandardError.ReadToEnd()}");
        }

        return output;
    }

    public void Dispose()
    {
        try
        {
            Directory.Delete(Path, recursive: true);
        }
        catch (IOException)
        {
        }
    }
}

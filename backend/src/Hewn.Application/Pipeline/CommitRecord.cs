using System.Text.Json;

namespace Hewn.Application.Pipeline;

/// <summary>A commit a run made, as kept in its <c>commit</c> GitHub mutation's result.</summary>
public sealed record CommitRecord(string Sha, IReadOnlyList<string> Paths, string? Branch)
{
    public static CommitRecord Read(string result)
    {
        var root = JsonDocument.Parse(result).RootElement;
        var paths = root.TryGetProperty("paths", out var p) ? p.EnumerateArray().Select(e => e.GetString()!).ToList() : [];
        var branch = root.TryGetProperty("branch", out var b) && b.ValueKind == JsonValueKind.String ? b.GetString() : null;
        return new CommitRecord(root.GetProperty("sha").GetString()!, paths, branch);
    }
}

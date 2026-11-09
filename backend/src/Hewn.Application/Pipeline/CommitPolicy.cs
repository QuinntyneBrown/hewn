using Hewn.Application.Common;

namespace Hewn.Application.Pipeline;

/// <summary>What each stage may write to the product repository. Stages not listed may not commit yet.</summary>
public static class CommitPolicy
{
    /// <summary>Every agent stage may append to the decision log (L2-054).</summary>
    private const string Decisions = "docs/decisions.md";

    private static readonly Dictionary<int, (string[] Prefixes, string[] Exact)> ByStage = new()
    {
        [0] = ([".claude/skills/", ".agents/skills/"], [".hewn/skills.lock"]),
        [1] = ([], ["docs/brief.md", Decisions]),
        [4] = ([], ["docs/adr/0001-stack.md", Decisions]),
        [5] = ([], ["docs/specs/L1.md", "docs/specs/L2.md", Decisions]),
        [7] = (["docs/detailed-designs/"], [Decisions]),
        [8] = ([], ["docs/journeys.md", Decisions]),
    };

    public static void EnsureAllowed(int stage, IEnumerable<string> paths)
    {
        foreach (var path in paths)
        {
            if (!IsAllowed(stage, path))
            {
                throw new FieldValidationException(
                    [new FieldError("files", $"Stage {stage} may not write {path}.", "A file is outside what this stage may write")],
                    "path_not_allowed");
            }
        }
    }

    private static bool IsAllowed(int stage, string path)
    {
        if (!ByStage.TryGetValue(stage, out var rule) || !IsPlainRelative(path))
        {
            return false;
        }

        return rule.Exact.Contains(path, StringComparer.Ordinal) ||
               rule.Prefixes.Any(p => path.StartsWith(p, StringComparison.Ordinal) && path.Length > p.Length);
    }

    // Relative, forward slashes only, no empty, "." or ".." segments.
    private static bool IsPlainRelative(string path) =>
        path.Length is > 0 and <= 400 &&
        !path.StartsWith('/') &&
        !path.Contains('\\') &&
        !path.Contains(':') &&
        path.Split('/').All(segment => segment.Length > 0 && segment is not "." and not "..");
}

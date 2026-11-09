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
        [2] = (["docs/mocks/"], [Decisions]),
        [3] = (["docs/design-system/"], [Decisions]),
        [4] = ([], ["docs/adr/0001-stack.md", Decisions]),
        [5] = ([], ["docs/specs/L1.md", "docs/specs/L2.md", Decisions]),
        [7] = (["docs/detailed-designs/"], [Decisions]),
        [8] = ([], ["docs/journeys.md", Decisions]),
        // Estimates, splits of oversized designs, and Deferred status lines on descoped L2s (L2-018, L2-019).
        [9] = (["docs/estimates/", "docs/detailed-designs/"], ["docs/specs/L2.md", Decisions]),
    };

    /// <summary>The only branch a stage writes to other than the default; stage 6 merges it through a pull request.</summary>
    public const string ScaffoldBranch = "hewn/scaffold";

    public const int ScaffoldStage = 6;

    /// <summary>Folders that belong to other stages; the scaffold writes everything else.</summary>
    private static readonly string[] NotScaffold = ["docs/", ".claude/", ".agents/", ".hewn/"];

    public static void EnsureAllowed(int stage, string? branch, IEnumerable<string> paths)
    {
        var expected = stage == ScaffoldStage ? ScaffoldBranch : null;
        if (!string.Equals(branch, expected, StringComparison.Ordinal))
        {
            throw new FieldValidationException(
                [new FieldError("branch", expected is null ? $"Stage {stage} commits to the default branch only." : $"Stage {stage} commits to {expected} only.", "The branch is not one this stage may write")],
                "branch_not_allowed");
        }

        EnsureAllowed(stage, paths);
    }

    /// <summary>Only the scaffold stage opens, reads and merges pull requests and protects the default branch.</summary>
    public static void EnsurePullRequestsAllowed(int stage)
    {
        if (stage != ScaffoldStage)
        {
            throw new FieldValidationException(
                [new FieldError("kind", $"Stage {stage} may not manage pull requests or branch protection.", "This stage may not make that change")],
                "mutation_not_allowed");
        }
    }

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
        if (stage == ScaffoldStage)
        {
            return IsPlainRelative(path) && !NotScaffold.Any(p => path.StartsWith(p, StringComparison.Ordinal));
        }

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

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
        // On the default branch, increments only update progress after a merge (L2-025 AC4); code goes on feature branches.
        [10] = (["docs/estimates/"], [Decisions]),
    };

    /// <summary>The folders a stage writes under on the default branch, such as <c>docs/mocks/</c>; empty for a stage that writes only named files.</summary>
    public static IReadOnlyList<string> OutputFolders(int stage) => ByStage.TryGetValue(stage, out var allowed) ? allowed.Prefixes : [];

    /// <summary>The decision log every agent stage appends to (L2-054).</summary>
    public const string DecisionLog = Decisions;

    /// <summary>The only branch a stage writes to other than the default; stage 6 merges it through a pull request.</summary>
    public const string ScaffoldBranch = "hewn/scaffold";

    public const int ScaffoldStage = 6;

    public const int IncrementStage = 10;

    /// <summary>Increments may not change CI, skills, Hewn's own files or the requirements.</summary>
    private static readonly string[] NotIncrementCode = [".github/", ".claude/", ".agents/", ".hewn/", "docs/specs/"];

    /// <summary>`feature/{increment-slug}` (L2-021 AC1).</summary>
    public static bool IsFeatureBranch(string? branch) =>
        branch is not null && branch.Length <= 120 &&
        System.Text.RegularExpressions.Regex.IsMatch(branch, "^feature/[a-z0-9]+(-[a-z0-9]+)*$");

    /// <summary>Folders that belong to other stages; the scaffold writes everything else.</summary>
    private static readonly string[] NotScaffold = ["docs/", ".claude/", ".agents/", ".hewn/"];

    public static void EnsureAllowed(int stage, string? branch, IEnumerable<string> paths)
    {
        if (stage == IncrementStage && branch is not null)
        {
            if (!IsFeatureBranch(branch))
            {
                throw new FieldValidationException(
                    [new FieldError("branch", $"Stage {stage} commits to feature/{{increment-slug}} branches or the default branch.", "The branch is not one this stage may write")],
                    "branch_not_allowed");
            }

            foreach (var path in paths)
            {
                if (!IsPlainRelative(path) || NotIncrementCode.Any(p => path.StartsWith(p, StringComparison.Ordinal)))
                {
                    throw new FieldValidationException(
                        [new FieldError("files", $"Stage {stage} may not write {path}.", "A file is outside what this stage may write")],
                        "path_not_allowed");
                }
            }

            return;
        }

        var expected = stage == ScaffoldStage ? ScaffoldBranch : null;
        if (!string.Equals(branch, expected, StringComparison.Ordinal))
        {
            throw new FieldValidationException(
                [new FieldError("branch", expected is null ? $"Stage {stage} commits to the default branch only." : $"Stage {stage} commits to {expected} only.", "The branch is not one this stage may write")],
                "branch_not_allowed");
        }

        EnsureAllowed(stage, paths);
    }

    /// <summary>The scaffold and the increments open, read and merge pull requests.</summary>
    public static void EnsurePullRequestsAllowed(int stage)
    {
        if (stage is not (ScaffoldStage or IncrementStage))
        {
            throw new FieldValidationException(
                [new FieldError("kind", $"Stage {stage} may not manage pull requests.", "This stage may not make that change")],
                "mutation_not_allowed");
        }
    }

    /// <summary>Only the scaffold protects the default branch.</summary>
    public static void EnsureProtectAllowed(int stage)
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

        // L2-054 AC2: a stage that may log decisions may also record an architecture decision as a numbered ADR.
        if (rule.Exact.Contains(Decisions, StringComparer.Ordinal) && IsAdr(path))
        {
            return true;
        }

        return rule.Exact.Contains(path, StringComparer.Ordinal) ||
               rule.Prefixes.Any(p => path.StartsWith(p, StringComparison.Ordinal) && path.Length > p.Length);
    }

    private static bool IsAdr(string path) =>
        System.Text.RegularExpressions.Regex.IsMatch(path, "^docs/adr/[0-9]{4}-[a-z0-9]+(-[a-z0-9]+)*\\.md$");

    // Relative, forward slashes only, no empty, "." or ".." segments.
    private static bool IsPlainRelative(string path) =>
        path.Length is > 0 and <= 400 &&
        !path.StartsWith('/') &&
        !path.Contains('\\') &&
        !path.Contains(':') &&
        path.Split('/').All(segment => segment.Length > 0 && segment is not "." and not "..");
}

namespace Hewn.Application.Pipeline;

public sealed class PipelineOptions
{
    /// <summary>Account or organization where new product repositories are created (HEWN_GITHUB_OWNER).</summary>
    public string? GitHubOwner { get; set; }

    /// <summary>Clone URL of the skill library stage 0 copies from (HEWN_SKILLS_SOURCE).</summary>
    public string SkillsSource { get; set; } = "https://github.com/QuinntyneBrown/greenlit.git";

    /// <summary>The descope threshold until an Owner saves one in Settings (HEWN_DESCOPE_THRESHOLD_DAYS; L2-019 AC1).</summary>
    public decimal DescopeThresholdDays { get; set; } = 3m;

    /// <summary>Implement-and-test iterations before an increment is Blocked (HEWN_MAX_ITERATIONS; L2-022 AC2).</summary>
    public int MaxIterations { get; set; } = 10;

    /// <summary>How long Cancel waits for the worker to stop its run (Hewn:Control:StopDeadlineSeconds; L2-029 AC3).</summary>
    public int StopDeadlineSeconds { get; set; } = 10;

    /// <summary>
    /// Backoff before each automatic retry of a failed run, in seconds (Hewn:Retry:BackoffSeconds, comma-separated;
    /// L2-006 AC1). Its length is the number of retries.
    /// </summary>
    public IReadOnlyList<int> RetryBackoffSeconds { get; set; } = [30, 120, 600];

    /// <summary>Directions an Owner may submit in any minute (Hewn:RateLimit:DirectionsPerMinute; L2-043 AC4).</summary>
    public int DirectionsPerMinute { get; set; } = 10;
}

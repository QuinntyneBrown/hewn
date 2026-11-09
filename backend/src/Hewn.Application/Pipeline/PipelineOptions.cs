namespace Hewn.Application.Pipeline;

public sealed class PipelineOptions
{
    /// <summary>Account or organization where new product repositories are created (HEWN_GITHUB_OWNER).</summary>
    public string? GitHubOwner { get; set; }

    /// <summary>Clone URL of the skill library stage 0 copies from (HEWN_SKILLS_SOURCE).</summary>
    public string SkillsSource { get; set; } = "https://github.com/QuinntyneBrown/greenlit.git";

    /// <summary>Designs estimated above this many ideal days are split or descoped (HEWN_DESCOPE_THRESHOLD_DAYS; Settings later).</summary>
    public decimal DescopeThresholdDays { get; set; } = 3m;

    /// <summary>Implement-and-test iterations before an increment is Blocked (HEWN_MAX_ITERATIONS; L2-022 AC2).</summary>
    public int MaxIterations { get; set; } = 10;
}

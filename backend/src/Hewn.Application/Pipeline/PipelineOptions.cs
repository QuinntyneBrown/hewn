namespace Hewn.Application.Pipeline;

public sealed class PipelineOptions
{
    /// <summary>Account or organization where new product repositories are created (HEWN_GITHUB_OWNER).</summary>
    public string? GitHubOwner { get; set; }

    /// <summary>Clone URL of the skill library stage 0 copies from (HEWN_SKILLS_SOURCE).</summary>
    public string SkillsSource { get; set; } = "https://github.com/QuinntyneBrown/greenlit.git";
}

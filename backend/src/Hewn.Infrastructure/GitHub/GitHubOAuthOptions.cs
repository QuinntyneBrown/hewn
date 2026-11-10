namespace Hewn.Infrastructure.GitHub;

/// <summary>The GitHub OAuth app users sign in through (L2-038).</summary>
public sealed class GitHubOAuthOptions
{
    public string? ClientId { get; set; }

    /// <summary>A secret: never logged or returned.</summary>
    public string? ClientSecret { get; set; }

    public string TokenUrl { get; set; } = "https://github.com/login/oauth/access_token";

    public string ApiBaseUrl { get; set; } = "https://api.github.com";
}

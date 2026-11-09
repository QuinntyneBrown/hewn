namespace Hewn.Infrastructure.GitHub;

public sealed class GitHubAppOptions
{
    public string? AppId { get; set; }

    /// <summary>PEM-encoded private key. A secret: never logged or returned.</summary>
    public string? PrivateKey { get; set; }

    public string ApiBaseUrl { get; set; } = "https://api.github.com";

    public bool IsConfigured => !string.IsNullOrWhiteSpace(AppId) && !string.IsNullOrWhiteSpace(PrivateKey);
}

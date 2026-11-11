namespace Hewn.Application.Secrets;

/// <summary>A credential Hewn holds: its store name, the configuration key it fills, and what it is for.</summary>
public sealed record Credential(string Name, string ConfigurationKey, string Description);

/// <summary>The credentials an operator supplies (L2-040 AC1). Store names use only letters, digits and dashes, as Key Vault requires.</summary>
public static class Credentials
{
    public static readonly IReadOnlyList<Credential> All =
    [
        new("model-api-key", "ANTHROPIC_API_KEY", "The Anthropic API key workers call the model with"),
        new("magic-patterns-token", "HEWN_MAGIC_PATTERNS_TOKEN", "The Magic Patterns MCP credential the design stages use"),
        new("github-app-private-key", "HEWN_GITHUB_APP_PRIVATE_KEY", "The GitHub App's private key, for repository writes"),
        new("github-client-secret", "HEWN_GITHUB_CLIENT_SECRET", "The GitHub OAuth app's client secret, for sign-in"),
        new("github-webhook-secret", "HEWN_GITHUB_WEBHOOK_SECRET", "The secret GitHub signs webhook deliveries with"),
        new("worker-token", "HEWN_WORKER_TOKEN", "The token workers authenticate to the API with"),
        new("metrics-token", "HEWN_METRICS_TOKEN", "The bearer token a metrics scraper sends"),
    ];

    public static Credential? Find(string name) => All.FirstOrDefault(c => c.Name == name);

    /// <summary>Throws unless <paramref name="name"/> is a known credential and <paramref name="value"/> isn't blank.</summary>
    public static Credential Check(string name, string value)
    {
        var credential = Find(name) ?? throw new ArgumentException(
            $"{name} isn't a credential Hewn holds. Use one of: {string.Join(", ", All.Select(c => c.Name))}.", nameof(name));
        if (string.IsNullOrWhiteSpace(value))
        {
            throw new ArgumentException($"Supply a value for {name}.", nameof(value));
        }

        return credential;
    }
}

namespace Hewn.Application.Abstractions;

/// <summary>
/// GitHub OAuth for sign-in (L2-038 AC2): exchanges the code GitHub returned for the signed-in GitHub login. The
/// access token is used once to read the login and is never stored, logged or returned.
/// </summary>
public interface IGitHubIdentity
{
    /// <summary>The GitHub login the code belongs to; throws <see cref="GitHubException"/> when GitHub refuses or doesn't answer.</summary>
    Task<string> LoginForCodeAsync(string code, string redirectUri, CancellationToken cancellationToken);

    /// <summary>
    /// The account GitHub has under <paramref name="login"/>, or null when there is none (L2-038 AC5); throws
    /// <see cref="GitHubException"/> when GitHub can't say, such as when it rate limits.
    /// </summary>
    Task<string?> FindLoginAsync(string login, CancellationToken cancellationToken);
}

using Hewn.Application.Abstractions;

namespace Hewn.Infrastructure.Fakes;

/// <summary>
/// GitHub sign-in for tests and the e2e stack: the code <c>fake-{login}</c> signs in as that login, and
/// <c>fake-timeout</c> fails as GitHub not answering would. Every login exists except those starting
/// <c>missing-</c>; <c>rate-limited</c> fails as GitHub rate limiting would.
/// </summary>
public sealed class FakeGitHubIdentity : IGitHubIdentity
{
    public const string Prefix = "fake-";

    public Task<string> LoginForCodeAsync(string code, string redirectUri, CancellationToken cancellationToken) =>
        code == $"{Prefix}timeout" ? throw new GitHubException("Sign-in timed out after 30 seconds")
        : code.StartsWith(Prefix, StringComparison.Ordinal) && code.Length > Prefix.Length ? Task.FromResult(code[Prefix.Length..])
        : throw new GitHubException("GitHub refused the sign-in code (bad_verification_code)");

    public Task<string?> FindLoginAsync(string login, CancellationToken cancellationToken) =>
        login == "rate-limited" ? throw new GitHubException("GitHub couldn't confirm the login exists (rate limited)")
        : Task.FromResult(login.StartsWith("missing-", StringComparison.Ordinal) ? null : login);
}

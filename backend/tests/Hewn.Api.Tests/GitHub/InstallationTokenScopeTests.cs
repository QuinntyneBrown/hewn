// Acceptance Test
// Traces to: L2-036
// Description: Every call Hewn makes to GitHub uses a GitHub App installation token limited to the project's repository (AC3); creating a repository uses a token that can only administer repositories, and everything after it, even tagging the new repository, uses one scoped to that repository

using System.Net;
using System.Security.Cryptography;
using System.Text;
using System.Text.Json;
using Hewn.Infrastructure.GitHub;
using Microsoft.Extensions.Options;
using Microsoft.Extensions.Time.Testing;

namespace Hewn.Api.Tests.GitHub;

public sealed class InstallationTokenScopeTests
{
    /// <summary>A GitHub that records each request and which token exchange gave the token it carried.</summary>
    private sealed class RecordingGitHub : HttpMessageHandler
    {
        private int _issued;

        /// <summary>Each token issued, with the body of the exchange that asked for it.</summary>
        public Dictionary<string, string> Scopes { get; } = [];

        /// <summary>Each request: method, path, and the bearer it carried.</summary>
        public List<(string Method, string Path, string Bearer)> Calls { get; } = [];

        protected override async Task<HttpResponseMessage> SendAsync(HttpRequestMessage request, CancellationToken cancellationToken)
        {
            var path = request.RequestUri!.AbsolutePath.TrimStart('/');
            var bearer = request.Headers.Authorization!.Parameter!;
            Calls.Add((request.Method.Method, path, bearer));
            if (path.EndsWith("/access_tokens", StringComparison.Ordinal))
            {
                var token = $"ghs_{++_issued}";
                Scopes[token] = request.Content is null ? "" : await request.Content.ReadAsStringAsync(cancellationToken);
                return Json(new { token });
            }

            return path switch
            {
                _ when path.EndsWith("/installation", StringComparison.Ordinal) => Json(new { id = 7 }),
                "repos/acme/shop" => Json(new { default_branch = "main", @private = true, permissions = new { push = true } }),
                _ => Json(new { }),
            };
        }

        private static HttpResponseMessage Json(object body) =>
            new(HttpStatusCode.OK) { Content = new StringContent(JsonSerializer.Serialize(body), Encoding.UTF8, "application/json") };

        /// <summary>The scope of the token each call to a path that isn't GitHub's App endpoints carried.</summary>
        public IEnumerable<(string Call, string Scope)> RepositoryCalls() =>
            Calls.Where(c => !c.Path.StartsWith("app/", StringComparison.Ordinal) && !c.Path.EndsWith("/installation", StringComparison.Ordinal))
                .Select(c => ($"{c.Method} {c.Path}", Scopes[c.Bearer]));
    }

    private static (GitHubAppRepositories Repositories, GitHubAppRepositoryProbe Probe, RecordingGitHub GitHub) Create()
    {
        using var rsa = RSA.Create(2048);
        var options = Options.Create(new GitHubAppOptions { AppId = "42", PrivateKey = rsa.ExportRSAPrivateKeyPem(), ApiBaseUrl = "https://github.test" });
        var gitHub = new RecordingGitHub();
        var client = new GitHubAppClient(new HttpClient(gitHub), options, new FakeTimeProvider(DateTimeOffset.UtcNow));
        return (new GitHubAppRepositories(client), new GitHubAppRepositoryProbe(client), gitHub);
    }

    private const string OnlyShop = """{"repositories":["shop"]}""";

    [Fact]
    public async Task Calls_for_a_project_carry_a_token_limited_to_its_repository()
    {
        var (repositories, probe, gitHub) = Create();

        await probe.ProbeAsync("acme", "shop", CancellationToken.None);
        await repositories.ProtectDefaultBranchAsync("acme", "shop", ["backend"], CancellationToken.None);

        var calls = gitHub.RepositoryCalls().ToList();
        Assert.Contains(calls, c => c.Call == "PUT repos/acme/shop/branches/main/protection");
        Assert.All(calls, c => Assert.Equal(OnlyShop, c.Scope));
    }

    [Fact]
    public async Task Creating_a_repository_uses_a_token_that_can_only_administer_repositories_and_then_one_for_the_new_repository()
    {
        var (repositories, _, gitHub) = Create();

        await repositories.CreatePrivateAsync("acme", "shop", "A shop", CancellationToken.None);

        var calls = gitHub.RepositoryCalls().ToList();
        Assert.Equal(("POST orgs/acme/repos", """{"permissions":{"administration":"write"}}"""), calls[0]);
        Assert.Equal(("PUT repos/acme/shop/topics", OnlyShop), calls[1]);
        Assert.Equal(2, calls.Count);
    }

    [Fact]
    public async Task No_token_is_ever_issued_for_every_repository_with_every_permission()
    {
        var (repositories, probe, gitHub) = Create();

        await repositories.CreatePrivateAsync("acme", "shop", "A shop", CancellationToken.None);
        await probe.ProbeAsync("acme", "shop", CancellationToken.None);
        await repositories.ProtectDefaultBranchAsync("acme", "shop", ["backend"], CancellationToken.None);

        Assert.DoesNotContain("", gitHub.Scopes.Values);
        Assert.All(gitHub.Scopes.Values, scope => Assert.True(scope.Contains("repositories") || scope.Contains("administration"), scope));
    }
}

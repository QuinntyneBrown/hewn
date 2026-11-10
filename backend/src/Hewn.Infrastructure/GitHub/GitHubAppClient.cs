using System.Net;
using System.Net.Http.Headers;
using System.Net.Http.Json;
using System.Security.Cryptography;
using System.Text;
using System.Text.Json;
using System.Text.Json.Serialization;
using Microsoft.Extensions.Options;

namespace Hewn.Infrastructure.GitHub;

/// <summary>
/// Authenticates as the Hewn GitHub App and exchanges its JWT for repository-scoped installation tokens.
/// No other component sees a token.
/// </summary>
public sealed class GitHubAppClient(HttpClient http, IOptions<GitHubAppOptions> options, TimeProvider clock)
{
    private readonly GitHubAppOptions _options = options.Value;

    /// <summary>Returns an installation token for one repository, or null when the App is not installed on it.</summary>
    public async Task<string?> GetRepositoryTokenAsync(string owner, string repo, CancellationToken cancellationToken)
    {
        if (!_options.IsConfigured)
        {
            return null;
        }

        var jwt = CreateAppJwt();
        using var lookup = Request(HttpMethod.Get, $"repos/{owner}/{repo}/installation", jwt);
        using var installationResponse = await http.SendAsync(lookup, cancellationToken);
        if (installationResponse.StatusCode == HttpStatusCode.NotFound)
        {
            return null;
        }

        installationResponse.EnsureSuccessStatusCode();
        var installation = await installationResponse.Content.ReadFromJsonAsync<Installation>(cancellationToken);

        using var exchange = Request(HttpMethod.Post, $"app/installations/{installation!.Id}/access_tokens", jwt);
        exchange.Content = JsonContent.Create(new { repositories = new[] { repo } });
        using var tokenResponse = await http.SendAsync(exchange, cancellationToken);
        tokenResponse.EnsureSuccessStatusCode();
        var token = await tokenResponse.Content.ReadFromJsonAsync<AccessToken>(cancellationToken);
        return token!.Token;
    }

    /// <summary>
    /// Returns an installation token for an account that can only administer repositories, which is what creating one
    /// needs, or null when the App is not installed there. Everything after creation uses a repository token (L2-036 AC3).
    /// </summary>
    public async Task<string?> GetAccountTokenAsync(string owner, CancellationToken cancellationToken)
    {
        if (!_options.IsConfigured)
        {
            return null;
        }

        var jwt = CreateAppJwt();
        Installation? installation = null;
        foreach (var path in new[] { $"orgs/{owner}/installation", $"users/{owner}/installation" })
        {
            using var lookup = Request(HttpMethod.Get, path, jwt);
            using var response = await http.SendAsync(lookup, cancellationToken);
            if (response.IsSuccessStatusCode)
            {
                installation = await response.Content.ReadFromJsonAsync<Installation>(cancellationToken);
                break;
            }
        }

        if (installation is null)
        {
            return null;
        }

        using var exchange = Request(HttpMethod.Post, $"app/installations/{installation.Id}/access_tokens", jwt);
        exchange.Content = JsonContent.Create(new { permissions = new { administration = "write" } });
        using var tokenResponse = await http.SendAsync(exchange, cancellationToken);
        tokenResponse.EnsureSuccessStatusCode();
        return (await tokenResponse.Content.ReadFromJsonAsync<AccessToken>(cancellationToken))!.Token;
    }

    public async Task<HttpResponseMessage> SendAsRepositoryAsync(HttpMethod method, string path, string token, CancellationToken cancellationToken, object? body = null)
    {
        using var request = Request(method, path, token);
        if (body is not null)
        {
            request.Content = JsonContent.Create(body);
        }

        return await http.SendAsync(request, cancellationToken);
    }

    private HttpRequestMessage Request(HttpMethod method, string path, string bearer)
    {
        var request = new HttpRequestMessage(method, new Uri(new Uri(_options.ApiBaseUrl.TrimEnd('/') + "/"), path));
        request.Headers.Authorization = new AuthenticationHeaderValue("Bearer", bearer);
        request.Headers.Accept.Add(new MediaTypeWithQualityHeaderValue("application/vnd.github+json"));
        request.Headers.UserAgent.Add(new ProductInfoHeaderValue("hewn", "1.0"));
        request.Headers.Add("X-GitHub-Api-Version", "2022-11-28");
        return request;
    }

    private string CreateAppJwt()
    {
        var now = clock.GetUtcNow().ToUnixTimeSeconds();
        var header = Base64Url(JsonSerializer.SerializeToUtf8Bytes(new { alg = "RS256", typ = "JWT" }));
        var payload = Base64Url(JsonSerializer.SerializeToUtf8Bytes(new { iat = now - 60, exp = now + 540, iss = _options.AppId }));
        using var rsa = RSA.Create();
        rsa.ImportFromPem(_options.PrivateKey);
        var signature = rsa.SignData(Encoding.ASCII.GetBytes($"{header}.{payload}"), HashAlgorithmName.SHA256, RSASignaturePadding.Pkcs1);
        return $"{header}.{payload}.{Base64Url(signature)}";
    }

    private static string Base64Url(byte[] bytes) =>
        Convert.ToBase64String(bytes).TrimEnd('=').Replace('+', '-').Replace('/', '_');

    private sealed record Installation([property: JsonPropertyName("id")] long Id);

    private sealed record AccessToken([property: JsonPropertyName("token")] string Token);
}

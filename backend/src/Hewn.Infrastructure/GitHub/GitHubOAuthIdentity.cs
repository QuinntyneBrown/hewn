using System.Net.Http.Headers;
using System.Net.Http.Json;
using System.Text.Json;
using Hewn.Application.Abstractions;
using Microsoft.Extensions.Options;

namespace Hewn.Infrastructure.GitHub;

/// <summary>
/// Exchanges a sign-in code for a user access token, reads the login with it and drops it. GitHub gets 30 seconds;
/// after that the sign-in page says GitHub didn't answer.
/// </summary>
public sealed class GitHubOAuthIdentity(HttpClient http, IOptions<GitHubOAuthOptions> options) : IGitHubIdentity
{
    private static readonly TimeSpan Timeout = TimeSpan.FromSeconds(30);

    public async Task<string> LoginForCodeAsync(string code, string redirectUri, CancellationToken cancellationToken)
    {
        var o = options.Value;
        if (string.IsNullOrWhiteSpace(o.ClientId) || string.IsNullOrWhiteSpace(o.ClientSecret))
        {
            throw new GitHubException("GitHub sign-in isn't configured (HEWN_GITHUB_CLIENT_ID, HEWN_GITHUB_CLIENT_SECRET)");
        }

        using var timeout = CancellationTokenSource.CreateLinkedTokenSource(cancellationToken);
        timeout.CancelAfter(Timeout);
        try
        {
            using var exchange = new HttpRequestMessage(HttpMethod.Post, o.TokenUrl)
            {
                Content = new FormUrlEncodedContent(new Dictionary<string, string>
                {
                    ["client_id"] = o.ClientId,
                    ["client_secret"] = o.ClientSecret,
                    ["code"] = code,
                    ["redirect_uri"] = redirectUri,
                }),
            };
            exchange.Headers.Accept.Add(new MediaTypeWithQualityHeaderValue("application/json"));
            using var exchanged = await http.SendAsync(exchange, timeout.Token);
            var token = await exchanged.Content.ReadFromJsonAsync<JsonElement>(timeout.Token);
            if (!exchanged.IsSuccessStatusCode || !token.TryGetProperty("access_token", out var accessToken))
            {
                // GitHub's error code only (such as bad_verification_code); the response is never logged.
                var error = token.TryGetProperty("error", out var e) ? e.GetString() : $"HTTP {(int)exchanged.StatusCode}";
                throw new GitHubException($"GitHub refused the sign-in code ({error})");
            }

            using var user = new HttpRequestMessage(HttpMethod.Get, $"{o.ApiBaseUrl.TrimEnd('/')}/user");
            user.Headers.Authorization = new AuthenticationHeaderValue("Bearer", accessToken.GetString());
            user.Headers.UserAgent.Add(new ProductInfoHeaderValue("Hewn", "1.0"));
            user.Headers.Accept.Add(new MediaTypeWithQualityHeaderValue("application/vnd.github+json"));
            using var answered = await http.SendAsync(user, timeout.Token);
            if (!answered.IsSuccessStatusCode)
            {
                throw new GitHubException($"GitHub didn't return the signed-in user (HTTP {(int)answered.StatusCode})");
            }

            var login = (await answered.Content.ReadFromJsonAsync<JsonElement>(timeout.Token)).GetProperty("login").GetString();
            return string.IsNullOrWhiteSpace(login) ? throw new GitHubException("GitHub returned no login") : login;
        }
        catch (OperationCanceledException) when (!cancellationToken.IsCancellationRequested)
        {
            throw new GitHubException("Sign-in timed out after 30 seconds");
        }
        catch (Exception e) when (e is HttpRequestException or JsonException)
        {
            throw new GitHubException("GitHub didn't answer the sign-in");
        }
    }

    public async Task<string?> FindLoginAsync(string login, CancellationToken cancellationToken)
    {
        using var timeout = CancellationTokenSource.CreateLinkedTokenSource(cancellationToken);
        timeout.CancelAfter(Timeout);
        try
        {
            using var request = new HttpRequestMessage(HttpMethod.Get, $"{options.Value.ApiBaseUrl.TrimEnd('/')}/users/{Uri.EscapeDataString(login)}");
            request.Headers.UserAgent.Add(new ProductInfoHeaderValue("Hewn", "1.0"));
            request.Headers.Accept.Add(new MediaTypeWithQualityHeaderValue("application/vnd.github+json"));
            using var answered = await http.SendAsync(request, timeout.Token);
            if (answered.StatusCode == System.Net.HttpStatusCode.NotFound)
            {
                return null;
            }

            if (!answered.IsSuccessStatusCode)
            {
                var why = (int)answered.StatusCode is 403 or 429 ? "rate limited" : $"HTTP {(int)answered.StatusCode}";
                throw new GitHubException($"GitHub couldn't confirm the login exists ({why})");
            }

            return (await answered.Content.ReadFromJsonAsync<JsonElement>(timeout.Token)).GetProperty("login").GetString();
        }
        catch (OperationCanceledException) when (!cancellationToken.IsCancellationRequested)
        {
            throw new GitHubException("GitHub couldn't confirm the login exists (timed out)");
        }
        catch (Exception e) when (e is HttpRequestException or JsonException)
        {
            throw new GitHubException("GitHub couldn't confirm the login exists");
        }
    }
}

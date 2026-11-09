using System.Net;
using System.Net.Http.Json;
using System.Text.Json;

namespace Hewn.Api.Tests.Support;

/// <summary>
/// A signed-in HTTP client that echoes the anti-forgery token the way Angular's HttpClient does.
/// </summary>
public sealed class HewnClient
{
    private readonly HttpClient _http;
    private readonly string _xsrfToken;

    private HewnClient(HttpClient http, string xsrfToken)
    {
        _http = http;
        _xsrfToken = xsrfToken;
    }

    public HttpClient Http => _http;

    public static async Task<HewnClient> CreateAsync(HttpClient http)
    {
        var response = await http.GetAsync("/api/me");
        response.EnsureSuccessStatusCode();
        var cookie = response.Headers.TryGetValues("Set-Cookie", out var values)
            ? values.FirstOrDefault(v => v.StartsWith("XSRF-TOKEN=", StringComparison.Ordinal))
            : null;
        if (cookie is null)
        {
            throw new InvalidOperationException("GET /api/me did not issue an XSRF-TOKEN cookie.");
        }
        var token = WebUtility.UrlDecode(cookie.Split(';')[0]["XSRF-TOKEN=".Length..]);
        return new HewnClient(http, token);
    }

    public Task<HttpResponseMessage> GetAsync(string url) => _http.GetAsync(url);

    public Task<HttpResponseMessage> PostAsync(string url, object body)
    {
        var request = new HttpRequestMessage(HttpMethod.Post, url) { Content = JsonContent.Create(body) };
        request.Headers.Add("X-XSRF-TOKEN", _xsrfToken);
        return _http.SendAsync(request);
    }

    public static async Task<JsonElement> ReadJsonAsync(HttpResponseMessage response)
    {
        var text = await response.Content.ReadAsStringAsync();
        return JsonDocument.Parse(text).RootElement;
    }
}

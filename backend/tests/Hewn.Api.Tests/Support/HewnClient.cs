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
    private readonly string _sessionCookie;

    private HewnClient(HttpClient http, string xsrfToken, string sessionCookie)
    {
        _http = http;
        _xsrfToken = xsrfToken;
        _sessionCookie = sessionCookie;
    }

    /// <summary>The session cookie as a Cookie header value, for clients outside this HttpClient (SignalR).</summary>
    public string CookieHeader() => _sessionCookie;

    public HttpClient Http => _http;

    public static async Task<HewnClient> CreateAsync(HttpClient http, string sessionCookie)
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
        return new HewnClient(http, token, sessionCookie);
    }

    public Task<HttpResponseMessage> GetAsync(string url) => _http.GetAsync(url);

    /// <summary>Sends a request as built, such as a GET with a Range header.</summary>
    public Task<HttpResponseMessage> SendAsync(HttpRequestMessage request) => _http.SendAsync(request);

    public Task<HttpResponseMessage> PostAsync(string url, object body)
    {
        var request = new HttpRequestMessage(HttpMethod.Post, url) { Content = JsonContent.Create(body) };
        request.Headers.Add("X-XSRF-TOKEN", _xsrfToken);
        return _http.SendAsync(request);
    }

    public Task<HttpResponseMessage> PutAsync(string url, object body)
    {
        var request = new HttpRequestMessage(HttpMethod.Put, url) { Content = JsonContent.Create(body) };
        request.Headers.Add("X-XSRF-TOKEN", _xsrfToken);
        return _http.SendAsync(request);
    }

    public Task<HttpResponseMessage> DeleteAsync(string url)
    {
        var request = new HttpRequestMessage(HttpMethod.Delete, url);
        request.Headers.Add("X-XSRF-TOKEN", _xsrfToken);
        return _http.SendAsync(request);
    }

    /// <summary>Sends any method with a JSON body and the anti-forgery token, as the app would.</summary>
    public Task<HttpResponseMessage> SendAsync(string method, string url, object body)
    {
        var request = new HttpRequestMessage(new HttpMethod(method), url) { Content = JsonContent.Create(body) };
        request.Headers.Add("X-XSRF-TOKEN", _xsrfToken);
        return _http.SendAsync(request);
    }

    public static async Task<JsonElement> ReadJsonAsync(HttpResponseMessage response)
    {
        var text = await response.Content.ReadAsStringAsync();
        return JsonDocument.Parse(text).RootElement;
    }
}

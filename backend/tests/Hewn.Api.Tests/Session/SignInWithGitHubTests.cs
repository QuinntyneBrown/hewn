// Acceptance Test
// Traces to: L2-038
// Description: Users sign in with GitHub: the API sends them to GitHub with a one-time state, and on the callback an allow-listed login gets an HttpOnly, Secure, SameSite=Lax session cookie (AC4) while any other is refused with "This account doesn't have access" (AC2); a session ends after 8 hours or on sign-out, even if the old cookie is replayed (AC3); APIs and hubs answer 401 without a session, except /health/* and the GitHub webhook (AC1)

using System.Net;
using System.Web;
using Hewn.Api.Tests.Support;
using Hewn.Domain;
using Microsoft.AspNetCore.Mvc.Testing;

namespace Hewn.Api.Tests.Session;

public sealed class SignInWithGitHubTests : IAsyncLifetime
{
    private readonly HewnApiFactory _factory = new();

    public async Task InitializeAsync() => await _factory.SeedAsync(db =>
    {
        db.AllowList.Add(new AllowListEntry("quinntynebrown", Role.Owner));
        db.AllowList.Add(new AllowListEntry("ada", Role.Viewer));
    });

    public async Task DisposeAsync() => await _factory.DisposeAsync();

    private HttpClient Browser() => _factory.CreateClient(new WebApplicationFactoryClientOptions
    {
        AllowAutoRedirect = false,
        HandleCookies = false,
        BaseAddress = new Uri("https://localhost"),
    });

    private static string Cookie(HttpResponseMessage response, string name) =>
        response.Headers.TryGetValues("Set-Cookie", out var cookies)
            ? cookies.FirstOrDefault(c => c.StartsWith($"{name}=", StringComparison.Ordinal)) ?? ""
            : "";

    /// <summary>Starts sign-in and returns the GitHub address it was sent to and the state cookie.</summary>
    private async Task<(Uri Authorize, string StateCookie)> StartAsync(HttpClient browser, string returnUrl = "/projects")
    {
        var response = await browser.GetAsync($"/api/auth/github?returnUrl={Uri.EscapeDataString(returnUrl)}");
        Assert.Equal(HttpStatusCode.Redirect, response.StatusCode);
        return (response.Headers.Location!, Cookie(response, "hewn.oauth").Split(';')[0]);
    }

    /// <summary>Comes back from GitHub with a code the fake GitHub identity resolves to <paramref name="login"/>.</summary>
    private static async Task<HttpResponseMessage> CallbackAsync(HttpClient browser, Uri authorize, string stateCookie, string code, string? state = null)
    {
        var query = HttpUtility.ParseQueryString(authorize.Query);
        using var request = new HttpRequestMessage(HttpMethod.Get, $"/api/auth/github/callback?code={Uri.EscapeDataString(code)}&state={Uri.EscapeDataString(state ?? query["state"]!)}");
        request.Headers.Add("Cookie", stateCookie);
        return await browser.SendAsync(request);
    }

    private async Task<HttpStatusCode> MeAsync(string sessionCookie)
    {
        using var request = new HttpRequestMessage(HttpMethod.Get, "/api/me");
        request.Headers.Add("Cookie", sessionCookie);
        return (await Browser().SendAsync(request)).StatusCode;
    }

    [Fact]
    public async Task Sign_in_goes_to_GitHub_with_the_client_a_callback_and_a_one_time_state()
    {
        var (authorize, stateCookie) = await StartAsync(Browser());

        Assert.Equal("https://github.com/login/oauth/authorize", authorize.GetLeftPart(UriPartial.Path));
        var query = HttpUtility.ParseQueryString(authorize.Query);
        Assert.Equal(HewnApiFactory.GitHubClientId, query["client_id"]);
        Assert.Equal("https://localhost/api/auth/github/callback", query["redirect_uri"]);
        Assert.Equal("read:user", query["scope"]);
        Assert.True(query["state"]!.Length >= 32);
        Assert.StartsWith("hewn.oauth=", stateCookie);
    }

    [Fact]
    public async Task An_allow_listed_login_gets_a_session_cookie_and_returns_where_it_started()
    {
        var browser = Browser();
        var (authorize, stateCookie) = await StartAsync(browser, "/projects/42?tab=backlog");

        var response = await CallbackAsync(browser, authorize, stateCookie, "fake-QuinntyneBrown");

        Assert.Equal(HttpStatusCode.Redirect, response.StatusCode);
        Assert.Equal("/projects/42?tab=backlog", response.Headers.Location!.OriginalString);
        var session = Cookie(response, "hewn.session");
        Assert.Contains("httponly", session, StringComparison.OrdinalIgnoreCase);
        Assert.Contains("secure", session, StringComparison.OrdinalIgnoreCase);
        Assert.Contains("samesite=lax", session, StringComparison.OrdinalIgnoreCase);
        Assert.Equal(HttpStatusCode.OK, await MeAsync(session.Split(';')[0]));
    }

    [Fact]
    public async Task A_login_not_on_the_allow_list_is_refused_without_a_session()
    {
        var browser = Browser();
        var (authorize, stateCookie) = await StartAsync(browser);

        var response = await CallbackAsync(browser, authorize, stateCookie, "fake-devon-park");

        Assert.Equal("/sign-in?error=denied&login=devon-park", response.Headers.Location!.OriginalString);
        Assert.Equal("", Cookie(response, "hewn.session"));
    }

    [Fact]
    public async Task A_wrong_state_a_GitHub_failure_or_an_outside_return_address_never_signs_in_elsewhere()
    {
        var browser = Browser();
        var (authorize, stateCookie) = await StartAsync(browser);
        var forged = await CallbackAsync(browser, authorize, stateCookie, "fake-quinntynebrown", state: "forged");
        Assert.Equal("/sign-in?error=github", forged.Headers.Location!.OriginalString);
        Assert.Equal("", Cookie(forged, "hewn.session"));

        (authorize, stateCookie) = await StartAsync(browser);
        var failed = await CallbackAsync(browser, authorize, stateCookie, "fake-timeout");
        Assert.Equal("/sign-in?error=github", failed.Headers.Location!.OriginalString);

        (authorize, stateCookie) = await StartAsync(browser, "//evil.example/steal");
        var outside = await CallbackAsync(browser, authorize, stateCookie, "fake-ada");
        Assert.Equal("/", outside.Headers.Location!.OriginalString);
    }

    [Fact]
    public async Task Cancelling_on_GitHub_returns_to_sign_in_without_an_error()
    {
        var browser = Browser();
        var (authorize, stateCookie) = await StartAsync(browser);
        var state = HttpUtility.ParseQueryString(authorize.Query)["state"]!;
        using var request = new HttpRequestMessage(HttpMethod.Get, $"/api/auth/github/callback?error=access_denied&state={Uri.EscapeDataString(state)}");
        request.Headers.Add("Cookie", stateCookie);

        var response = await browser.SendAsync(request);

        Assert.Equal("/sign-in", response.Headers.Location!.OriginalString);
        Assert.Equal("", Cookie(response, "hewn.session"));
    }

    [Fact]
    public async Task A_session_ends_after_8_hours()
    {
        var browser = Browser();
        var (authorize, stateCookie) = await StartAsync(browser);
        var session = Cookie(await CallbackAsync(browser, authorize, stateCookie, "fake-ada"), "hewn.session").Split(';')[0];

        _factory.Clock.Advance(TimeSpan.FromHours(7.9));
        Assert.Equal(HttpStatusCode.OK, await MeAsync(session));
        _factory.Clock.Advance(TimeSpan.FromHours(0.2));
        Assert.Equal(HttpStatusCode.Unauthorized, await MeAsync(session));
    }

    [Fact]
    public async Task Signing_out_ends_the_session_even_if_its_cookie_is_replayed()
    {
        var owner = await _factory.SignInAsync("quinntynebrown", Role.Owner);
        var session = owner.CookieHeader();
        Assert.Equal(HttpStatusCode.OK, await MeAsync(session));

        var signedOut = await owner.PostAsync("/api/auth/sign-out", new { });

        Assert.Equal(HttpStatusCode.NoContent, signedOut.StatusCode);
        Assert.Equal(HttpStatusCode.Unauthorized, await MeAsync(session));
    }

    [Fact]
    public async Task Without_a_session_APIs_and_hubs_answer_401_but_health_and_the_webhook_do_not_ask_for_one()
    {
        var anonymous = Browser();

        Assert.Equal(HttpStatusCode.Unauthorized, (await anonymous.GetAsync("/api/projects")).StatusCode);
        Assert.Equal(HttpStatusCode.Unauthorized, (await anonymous.PostAsync("/hubs/mission-control/negotiate?negotiateVersion=1", null)).StatusCode);
        Assert.Equal(HttpStatusCode.OK, (await anonymous.GetAsync("/health/live")).StatusCode);
        // The webhook authenticates by signature, not session: unsigned, it is refused for that reason.
        var webhook = await anonymous.PostAsync("/api/github/webhook", new StringContent("{}"));
        Assert.Equal(HttpStatusCode.Unauthorized, webhook.StatusCode);
        Assert.False(webhook.Headers.Contains("Location"));
    }
}

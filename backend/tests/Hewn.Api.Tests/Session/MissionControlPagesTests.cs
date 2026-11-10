// Acceptance Test
// Traces to: L2-038, L2-043
// Description: The API serves Mission Control's pages: without a session a page redirects to sign-in, which itself needs none (L2-038 AC1); every page carries a Content-Security-Policy with no unsafe-inline scripts and frame-ancestors 'self', plus X-Content-Type-Options: nosniff (L2-043 AC2)

using System.Net;
using Hewn.Api.Tests.Support;
using Hewn.Domain;
using Microsoft.AspNetCore.Mvc.Testing;

namespace Hewn.Api.Tests.Session;

public sealed class MissionControlPagesTests : IAsyncLifetime
{
    private const string Index = "<!doctype html><html><head><script src=\"main.js\" type=\"module\"></script></head><body><hw-root></hw-root></body></html>";

    private readonly string _root = Directory.CreateTempSubdirectory("hewn-mission-control-").FullName;
    private HewnApiFactory _factory = null!;

    public Task InitializeAsync()
    {
        File.WriteAllText(Path.Combine(_root, "index.html"), Index);
        File.WriteAllText(Path.Combine(_root, "main.js"), "console.log('hewn');");
        _factory = new HewnApiFactory().WithSettings(("Hewn:MissionControl:Root", _root));
        return Task.CompletedTask;
    }

    public async Task DisposeAsync()
    {
        await _factory.DisposeAsync();
        Directory.Delete(_root, recursive: true);
    }

    private HttpClient Browser() => _factory.CreateClient(new WebApplicationFactoryClientOptions
    {
        AllowAutoRedirect = false,
        HandleCookies = false,
        BaseAddress = new Uri("https://localhost"),
    });

    private static void AssertProtected(HttpResponseMessage page)
    {
        var csp = string.Join(' ', page.Headers.GetValues("Content-Security-Policy"));
        var scripts = csp.Split(';').Select(d => d.Trim()).Single(d => d.StartsWith("script-src ", StringComparison.Ordinal));
        Assert.StartsWith("script-src 'self'", scripts);
        Assert.DoesNotContain("'unsafe-inline'", scripts);
        Assert.Contains("frame-ancestors 'self'", csp);
        Assert.Contains("default-src 'self'", csp);
        Assert.Equal("nosniff", page.Headers.GetValues("X-Content-Type-Options").Single());
    }

    [Fact]
    public async Task Without_a_session_a_page_redirects_to_sign_in_with_where_it_was_going()
    {
        var response = await Browser().GetAsync("/projects/42/backlog?tab=all");

        Assert.Equal(HttpStatusCode.Redirect, response.StatusCode);
        Assert.Equal("https://localhost/sign-in?returnUrl=%2Fprojects%2F42%2Fbacklog%3Ftab%3Dall", response.Headers.Location!.ToString());
    }

    [Fact]
    public async Task The_sign_in_page_and_the_app_files_need_no_session_and_carry_the_protections()
    {
        var browser = Browser();

        var signIn = await browser.GetAsync("/sign-in?error=denied");
        Assert.Equal(HttpStatusCode.OK, signIn.StatusCode);
        Assert.Equal(Index, await signIn.Content.ReadAsStringAsync());
        AssertProtected(signIn);

        var script = await browser.GetAsync("/main.js");
        Assert.Equal(HttpStatusCode.OK, script.StatusCode);
        Assert.Equal("nosniff", script.Headers.GetValues("X-Content-Type-Options").Single());
    }

    [Fact]
    public async Task A_signed_in_page_is_the_app_with_the_protections()
    {
        var viewer = await _factory.SignInAsync("ada", Role.Viewer);

        var page = await viewer.GetAsync("/projects");

        Assert.Equal(HttpStatusCode.OK, page.StatusCode);
        Assert.Equal("text/html", page.Content.Headers.ContentType!.MediaType);
        Assert.Equal(Index, await page.Content.ReadAsStringAsync());
        AssertProtected(page);
    }

    [Fact]
    public async Task API_answers_are_never_sniffed_and_unknown_API_paths_are_not_pages()
    {
        var viewer = await _factory.SignInAsync("ada", Role.Viewer);

        var me = await viewer.GetAsync("/api/me");
        Assert.Equal("nosniff", me.Headers.GetValues("X-Content-Type-Options").Single());
        Assert.Equal(HttpStatusCode.NotFound, (await viewer.GetAsync("/api/no-such-thing")).StatusCode);
    }

    [Fact]
    public async Task Without_a_built_app_pages_are_not_found_rather_than_a_sign_in_loop()
    {
        await using var factory = new HewnApiFactory();
        var browser = factory.CreateClient(new WebApplicationFactoryClientOptions { AllowAutoRedirect = false, BaseAddress = new Uri("https://localhost") });

        Assert.Equal(HttpStatusCode.NotFound, (await browser.GetAsync("/sign-in")).StatusCode);
        Assert.Equal(HttpStatusCode.NotFound, (await browser.GetAsync("/projects")).StatusCode);
        Assert.Equal(HttpStatusCode.Unauthorized, (await browser.GetAsync("/api/projects")).StatusCode);
    }
}

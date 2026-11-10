// Acceptance Test
// Traces to: L2-011
// Description: GET /api/projects/{id}/designs lists each screen and state stage 2 exported, with its Magic Patterns link and a signed preview URL on the separate preview origin; the preview host serves only docs/mocks/ and docs/design-system/ at the signed commit, sandboxed by CSP, without cookies, themed by ?theme=, and refuses tampered, expired or misplaced requests

using System.Net;
using System.Text.Json;
using Hewn.Api.Tests.Support;
using Hewn.Domain;
using Microsoft.AspNetCore.Mvc.Testing;

namespace Hewn.Api.Tests.Designs;

public sealed class PreviewDesignsTests : IAsyncLifetime
{
    private const string PreviewOrigin = "https://preview.localhost";

    private const string Manifest = """
        {
          "screens": [
            { "screen": "statements", "feature": "Statements", "magicPatternsUrl": "https://www.magicpatterns.com/c/statements", "editorId": "statements", "states": ["default", "loading", "empty", "error"], "notApplicable": {} },
            { "screen": "reconcile-statement", "feature": "Reconcile statement", "magicPatternsUrl": "https://www.magicpatterns.com/c/reconcile", "editorId": "reconcile", "states": ["default", "review", "upload-error"], "notApplicable": { "empty": "A reconciliation always has a statement." } }
          ]
        }
        """;

    private const string Review = "<!doctype html>\n<html lang=\"en\"><head><title>Review</title></head><body><p>Review the statement</p></body></html>\n";

    private readonly HewnApiFactory _factory = new HewnApiFactory().WithSettings(("Hewn:Preview:Origin", PreviewOrigin));

    public Task InitializeAsync() => Task.CompletedTask;

    public async Task DisposeAsync() => await _factory.DisposeAsync();

    /// <summary>A project on an existing repository holding the given files, as a direction that reached stage 2 leaves it.</summary>
    private async Task<(HewnClient Owner, Guid ProjectId)> ProjectAsync(Dictionary<string, string>? files)
    {
        _factory.GitHub.Seed("northwind", "ledgerline", topics: ["hewn"], files: files);
        var owner = await _factory.SignInAsync("quinntynebrown", Role.Owner);
        var submitted = await owner.PostAsync("/api/projects", new
        {
            name = "Ledgerline",
            idea = "A web app for small accounting teams to reconcile statements.",
            stackPreference = (string?)null,
            repositoryUrl = "https://github.com/northwind/ledgerline",
            budgetUsd = 300m,
        });
        submitted.EnsureSuccessStatusCode();
        return (owner, (await HewnClient.ReadJsonAsync(submitted)).GetProperty("projectId").GetGuid());
    }

    private static Dictionary<string, string> Designed() => new()
    {
        ["docs/mocks/manifest.json"] = Manifest,
        ["docs/mocks/statements/default.html"] = "<!doctype html><html><body>Statements</body></html>",
        ["docs/mocks/reconcile-statement/review.html"] = Review,
        ["docs/design-system/tokens/tokens.css"] = ":root { --color-accent: #2f6fed; }",
        ["src/app.ts"] = "export const secret = 'not for previews';",
    };

    private static async Task<JsonElement> DesignsAsync(HewnClient client, Guid projectId)
    {
        var response = await client.GetAsync($"/api/projects/{projectId}/designs");
        Assert.Equal(HttpStatusCode.OK, response.StatusCode);
        return await HewnClient.ReadJsonAsync(response);
    }

    private static string PreviewUrl(JsonElement designs, string screen, string state) =>
        designs.GetProperty("screens").EnumerateArray().Single(s => s.GetProperty("screen").GetString() == screen)
            .GetProperty("states").EnumerateArray().Single(s => s.GetProperty("state").GetString() == state)
            .GetProperty("previewUrl").GetString()!;

    /// <summary>A browser on the preview origin: no Mission Control cookie, no redirects followed.</summary>
    private HttpClient PreviewBrowser() => _factory.CreateClient(new WebApplicationFactoryClientOptions
    {
        BaseAddress = new Uri(PreviewOrigin),
        HandleCookies = false,
        AllowAutoRedirect = false,
    });

    [Fact]
    public async Task Designs_lists_each_screen_and_state_with_its_Magic_Patterns_link_and_a_preview_on_the_preview_origin()
    {
        var (owner, projectId) = await ProjectAsync(Designed());
        var head = _factory.GitHub.Repository("northwind", "ledgerline")!.Commits[^1].Sha;

        var designs = await DesignsAsync(owner, projectId);

        Assert.Equal(head, designs.GetProperty("sha").GetString());
        var screens = designs.GetProperty("screens").EnumerateArray().ToList();
        Assert.Equal(["statements", "reconcile-statement"], screens.Select(s => s.GetProperty("screen").GetString()));
        var reconcile = screens[1];
        Assert.Equal("Reconcile statement", reconcile.GetProperty("title").GetString());
        Assert.Equal("https://www.magicpatterns.com/c/reconcile", reconcile.GetProperty("magicPatternsUrl").GetString());
        var states = reconcile.GetProperty("states").EnumerateArray().ToList();
        Assert.Equal(["default", "review", "upload-error"], states.Select(s => s.GetProperty("state").GetString()));
        Assert.Equal(["Default", "Review", "Upload error"], states.Select(s => s.GetProperty("label").GetString()));
        Assert.Equal("docs/mocks/reconcile-statement/review.html", states[1].GetProperty("path").GetString());
        var preview = new Uri(states[1].GetProperty("previewUrl").GetString()!);
        Assert.Equal(new Uri(PreviewOrigin).Authority, preview.Authority);
        Assert.EndsWith("/docs/mocks/reconcile-statement/review.html", preview.AbsolutePath);
        Assert.Equal(7, designs.GetProperty("stateCount").GetInt32());
    }

    [Fact]
    public async Task The_preview_host_serves_the_mock_sandboxed_without_cookies_and_themed_by_the_query()
    {
        var (owner, projectId) = await ProjectAsync(Designed());
        var url = PreviewUrl(await DesignsAsync(owner, projectId), "reconcile-statement", "review");
        using var browser = PreviewBrowser();

        var light = await browser.GetAsync(url);
        var dark = await browser.GetAsync($"{url}?theme=dark");

        Assert.Equal(HttpStatusCode.OK, light.StatusCode);
        Assert.Equal("text/html", light.Content.Headers.ContentType?.MediaType);
        Assert.Equal("sandbox allow-scripts", string.Join(';', light.Headers.GetValues("Content-Security-Policy")));
        Assert.Equal("nosniff", light.Headers.GetValues("X-Content-Type-Options").Single());
        Assert.Equal("no-referrer", light.Headers.GetValues("Referrer-Policy").Single());
        Assert.False(light.Headers.Contains("Set-Cookie"));
        Assert.Contains("<p>Review the statement</p>", await light.Content.ReadAsStringAsync());
        Assert.Contains("<html data-theme=\"dark\" lang=\"en\">", await dark.Content.ReadAsStringAsync());
    }

    [Fact]
    public async Task A_preview_shows_the_signed_commit_even_after_the_file_changes()
    {
        var (owner, projectId) = await ProjectAsync(Designed());
        var url = PreviewUrl(await DesignsAsync(owner, projectId), "reconcile-statement", "review");
        _factory.GitHub.Repository("northwind", "ledgerline")!.Write("docs/mocks/reconcile-statement/review.html", "<html><body>Changed</body></html>");
        using var browser = PreviewBrowser();

        var pinned = await (await browser.GetAsync(url)).Content.ReadAsStringAsync();
        var current = await (await browser.GetAsync(PreviewUrl(await DesignsAsync(owner, projectId), "reconcile-statement", "review"))).Content.ReadAsStringAsync();

        Assert.Contains("Review the statement", pinned);
        Assert.Contains("Changed", current);
    }

    [Fact]
    public async Task The_design_system_pages_share_the_preview_and_nothing_else_in_the_repository_is_served()
    {
        var (owner, projectId) = await ProjectAsync(Designed());
        var url = PreviewUrl(await DesignsAsync(owner, projectId), "reconcile-statement", "review");
        var root = url[..url.IndexOf("/docs/", StringComparison.Ordinal)];
        using var browser = PreviewBrowser();

        var tokens = await browser.GetAsync($"{root}/docs/design-system/tokens/tokens.css");
        Assert.Equal(HttpStatusCode.OK, tokens.StatusCode);
        Assert.Equal("text/css", tokens.Content.Headers.ContentType?.MediaType);

        foreach (var path in new[] { "src/app.ts", "docs/mocks/../../src/app.ts", "docs/mocks/%2e%2e/%2e%2e/src/app.ts", "docs/mocks/missing.html" })
        {
            var refused = await browser.GetAsync($"{root}/{path}");
            Assert.True(refused.StatusCode == HttpStatusCode.NotFound, $"{path} answered {refused.StatusCode}");
        }
    }

    [Fact]
    public async Task A_tampered_or_expired_token_or_another_host_is_refused()
    {
        var (owner, projectId) = await ProjectAsync(Designed());
        var url = PreviewUrl(await DesignsAsync(owner, projectId), "reconcile-statement", "review");
        var path = new Uri(url).AbsolutePath;
        var token = path.Split('/')[2];
        using var browser = PreviewBrowser();

        var tampered = await browser.GetAsync(url.Replace(token, token[..^2] + (token[^2] == 'A' ? "BB" : "AA"), StringComparison.Ordinal));
        Assert.Equal(HttpStatusCode.NotFound, tampered.StatusCode);

        // Mission Control's own origin never serves project HTML, even with a valid token.
        var onMissionControl = await owner.GetAsync(path);
        Assert.Equal(HttpStatusCode.NotFound, onMissionControl.StatusCode);

        _factory.Clock.Advance(TimeSpan.FromMinutes(61));
        var expired = await browser.GetAsync(url);
        Assert.Equal(HttpStatusCode.NotFound, expired.StatusCode);
    }

    [Fact]
    public async Task A_project_before_stage_2_has_no_designs()
    {
        var (owner, projectId) = await ProjectAsync(new() { ["README.md"] = "# Ledgerline" });

        var designs = await DesignsAsync(owner, projectId);

        Assert.Empty(designs.GetProperty("screens").EnumerateArray());
        Assert.Equal(0, designs.GetProperty("stateCount").GetInt32());
    }

    [Fact]
    public async Task An_unreadable_manifest_is_a_502_that_names_the_commit()
    {
        var (owner, projectId) = await ProjectAsync(new() { ["docs/mocks/manifest.json"] = "{ not json" });
        var head = _factory.GitHub.Repository("northwind", "ledgerline")!.Commits[^1].Sha;

        var response = await owner.GetAsync($"/api/projects/{projectId}/designs");

        Assert.Equal(HttpStatusCode.BadGateway, response.StatusCode);
        var problem = await HewnClient.ReadJsonAsync(response);
        Assert.Equal("github_failed", problem.GetProperty("code").GetString());
        Assert.Equal($"docs/mocks/manifest.json couldn't be read at {head[..7]}", problem.GetProperty("title").GetString());
    }

    [Fact]
    public async Task Viewers_preview_designs_and_an_unknown_project_is_404()
    {
        var (_, projectId) = await ProjectAsync(Designed());
        var viewer = await _factory.SignInAsync("ada", Role.Viewer);

        var designs = await DesignsAsync(viewer, projectId);

        Assert.Equal(2, designs.GetProperty("screens").GetArrayLength());
        Assert.Equal(HttpStatusCode.NotFound, (await viewer.GetAsync($"/api/projects/{Guid.NewGuid()}/designs")).StatusCode);
        using var anonymous = _factory.CreateClient();
        Assert.Equal(HttpStatusCode.Unauthorized, (await anonymous.GetAsync($"/api/projects/{projectId}/designs")).StatusCode);
    }
}

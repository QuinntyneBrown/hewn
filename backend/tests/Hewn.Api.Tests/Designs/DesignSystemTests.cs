// Acceptance Test
// Traces to: L2-012
// Description: GET /api/projects/{id}/design-system lists the token (foundation) and component pages stage 3 wrote to docs/design-system/, read at the default branch's head with each token group's count, and gives each page a signed URL on the same sandboxed preview origin as the designs (AC4)

using System.Net;
using System.Text.Json;
using Hewn.Api.Tests.Support;
using Hewn.Domain;
using Microsoft.AspNetCore.Mvc.Testing;

namespace Hewn.Api.Tests.Designs;

public sealed class DesignSystemTests : IAsyncLifetime
{
    private const string PreviewOrigin = "https://preview.localhost";

    private const string Tokens = """
        {
          "color": {
            "light": { "surface": { "$type": "color", "$value": "#ffffff" }, "text": { "$type": "color", "$value": "#14181d" }, "accent": { "$type": "color", "$value": "#2f6fed" } },
            "dark": { "surface": { "$type": "color", "$value": "#14181d" }, "text": { "$type": "color", "$value": "#f4f5f7" }, "accent": { "$type": "color", "$value": "#6f9bff" } }
          },
          "typography": { "body": { "$type": "fontFamily", "$value": "system-ui, sans-serif" }, "mono": { "$type": "fontFamily", "$value": "ui-monospace, monospace" } },
          "spacing": { "2": { "$type": "dimension", "$value": "8px" }, "4": { "$type": "dimension", "$value": "16px" } },
          "radius": { "md": { "$type": "dimension", "$value": "8px" } },
          "elevation": { "1": { "$type": "shadow", "$value": "0 1px 2px rgb(0 0 0 / 10%)" } },
          "motion": { "fast": { "$type": "duration", "$value": "150ms" } }
        }
        """;

    private readonly HewnApiFactory _factory = new HewnApiFactory().WithSettings(("Hewn:Preview:Origin", PreviewOrigin));

    public Task InitializeAsync() => Task.CompletedTask;

    public async Task DisposeAsync() => await _factory.DisposeAsync();

    private async Task<(HewnClient Owner, Guid ProjectId)> ProjectAsync(Dictionary<string, string> files)
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

    /// <summary>What stage 3 leaves: tokens, a page per token group (in any order) and a page per component.</summary>
    private static Dictionary<string, string> Extracted() => new()
    {
        ["docs/design-system/tokens.json"] = Tokens,
        ["docs/design-system/foundations/spacing.html"] = Page("Spacing"),
        ["docs/design-system/foundations/colour.html"] = Page("Colour"),
        ["docs/design-system/foundations/motion.html"] = Page("Motion"),
        ["docs/design-system/foundations/typography.html"] = Page("Typography"),
        ["docs/design-system/foundations/radius.html"] = Page("Radius"),
        ["docs/design-system/foundations/elevation.html"] = Page("Elevation"),
        ["docs/design-system/components/status-badge.html"] = Page("Status badge"),
        ["docs/design-system/components/button.html"] = Page("Button"),
        ["docs/design-system/components/notes.md"] = "Not a page.",
        ["docs/design-system/assets/components.css"] = "body { margin: 0; }",
        ["docs/mocks/statements/default.html"] = Page("Statements"),
    };

    private static string Page(string title) =>
        $"<!doctype html>\n<html lang=\"en\"><head><title>{title}</title></head><body><h1>{title}</h1></body></html>\n";

    private static async Task<JsonElement> DesignSystemAsync(HewnClient client, Guid projectId)
    {
        var response = await client.GetAsync($"/api/projects/{projectId}/design-system");
        Assert.Equal(HttpStatusCode.OK, response.StatusCode);
        return await HewnClient.ReadJsonAsync(response);
    }

    private static List<JsonElement> Pages(JsonElement system, string group) =>
        system.GetProperty(group).EnumerateArray().ToList();

    private HttpClient PreviewBrowser() => _factory.CreateClient(new WebApplicationFactoryClientOptions
    {
        BaseAddress = new Uri(PreviewOrigin),
        HandleCookies = false,
        AllowAutoRedirect = false,
    });

    [Fact]
    public async Task The_design_system_lists_token_pages_in_the_token_order_and_component_pages_by_name()
    {
        var (owner, projectId) = await ProjectAsync(Extracted());
        var head = _factory.GitHub.Repository("northwind", "ledgerline")!.Commits[^1].Sha;

        var system = await DesignSystemAsync(owner, projectId);

        Assert.Equal(head, system.GetProperty("sha").GetString());
        var foundations = Pages(system, "foundations");
        Assert.Equal(["Colour", "Typography", "Spacing", "Radius", "Elevation", "Motion"], foundations.Select(p => p.GetProperty("title").GetString()));
        Assert.Equal("docs/design-system/foundations/colour.html", foundations[0].GetProperty("path").GetString());
        var components = Pages(system, "components");
        Assert.Equal(["Button", "Status badge"], components.Select(p => p.GetProperty("title").GetString()));
        Assert.Equal("status-badge", components[1].GetProperty("page").GetString());
        Assert.Equal("docs/design-system/components/status-badge.html", components[1].GetProperty("path").GetString());
    }

    [Fact]
    public async Task Each_token_page_counts_its_tokens_and_colour_says_it_has_light_and_dark()
    {
        var (owner, projectId) = await ProjectAsync(Extracted());

        var foundations = Pages(await DesignSystemAsync(owner, projectId), "foundations");

        Assert.Equal([3, 2, 2, 1, 1, 1], foundations.Select(p => p.GetProperty("tokenCount").GetInt32()));
        Assert.Equal([true, false, false, false, false, false], foundations.Select(p => p.GetProperty("lightAndDark").GetBoolean()));
        var button = Pages(await DesignSystemAsync(owner, projectId), "components")[0];
        Assert.Equal(JsonValueKind.Null, button.GetProperty("tokenCount").ValueKind);
    }

    [Fact]
    public async Task Token_and_component_pages_open_in_the_same_sandboxed_preview_as_the_designs()
    {
        var (owner, projectId) = await ProjectAsync(Extracted());
        var system = await DesignSystemAsync(owner, projectId);
        using var browser = PreviewBrowser();

        foreach (var page in new[] { Pages(system, "foundations")[0], Pages(system, "components")[0] })
        {
            var url = new Uri(page.GetProperty("previewUrl").GetString()!);
            Assert.Equal(new Uri(PreviewOrigin).Authority, url.Authority);
            Assert.EndsWith($"/{page.GetProperty("path").GetString()}", url.AbsolutePath);

            var dark = await browser.GetAsync($"{url}?theme=dark");
            Assert.Equal(HttpStatusCode.OK, dark.StatusCode);
            Assert.Equal("sandbox allow-scripts", string.Join(';', dark.Headers.GetValues("Content-Security-Policy")));
            Assert.False(dark.Headers.Contains("Set-Cookie"));
            Assert.Contains("<html data-theme=\"dark\" lang=\"en\">", await dark.Content.ReadAsStringAsync());
        }

        // The pages' own links resolve under the same signed commit.
        var css = Pages(system, "components")[0].GetProperty("previewUrl").GetString()!.Replace("components/button.html", "assets/components.css", StringComparison.Ordinal);
        Assert.Equal(HttpStatusCode.OK, (await browser.GetAsync(css)).StatusCode);
    }

    [Fact]
    public async Task A_project_before_stage_3_has_no_design_system()
    {
        var (owner, projectId) = await ProjectAsync(new() { ["docs/mocks/statements/default.html"] = Page("Statements") });

        var system = await DesignSystemAsync(owner, projectId);

        Assert.Equal(JsonValueKind.Null, system.GetProperty("sha").ValueKind);
        Assert.Empty(Pages(system, "foundations"));
        Assert.Empty(Pages(system, "components"));
    }

    [Fact]
    public async Task Unreadable_tokens_are_a_502_that_names_the_commit()
    {
        var files = Extracted();
        files["docs/design-system/tokens.json"] = "{ not json";
        var (owner, projectId) = await ProjectAsync(files);
        var head = _factory.GitHub.Repository("northwind", "ledgerline")!.Commits[^1].Sha;

        var response = await owner.GetAsync($"/api/projects/{projectId}/design-system");

        Assert.Equal(HttpStatusCode.BadGateway, response.StatusCode);
        var problem = await HewnClient.ReadJsonAsync(response);
        Assert.Equal("github_failed", problem.GetProperty("code").GetString());
        Assert.Equal($"docs/design-system/ couldn’t be read at {head[..7]}", problem.GetProperty("title").GetString());
    }

    [Fact]
    public async Task Viewers_browse_the_design_system_and_an_unknown_project_is_404()
    {
        var (_, projectId) = await ProjectAsync(Extracted());
        var viewer = await _factory.SignInAsync("ada", Role.Viewer);

        var system = await DesignSystemAsync(viewer, projectId);

        Assert.Equal(2, Pages(system, "components").Count);
        Assert.Equal(HttpStatusCode.NotFound, (await viewer.GetAsync($"/api/projects/{Guid.NewGuid()}/design-system")).StatusCode);
        using var anonymous = _factory.CreateClient();
        Assert.Equal(HttpStatusCode.Unauthorized, (await anonymous.GetAsync($"/api/projects/{projectId}/design-system")).StatusCode);
    }
}

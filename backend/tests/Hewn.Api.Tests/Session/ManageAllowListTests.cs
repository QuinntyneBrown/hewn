// Acceptance Test
// Traces to: L2-038, L2-039
// Description: An Owner adds a GitHub login to the allow list as Owner or Viewer, or removes one, and a Viewer reads the list but can't change it (L2-038 AC5); a removed login's session ends at once (L2-038 AC3, L2-039 AC1)

using System.Net;
using System.Text.Json;
using Hewn.Api.Tests.Support;
using Hewn.Domain;
using Microsoft.AspNetCore.Mvc.Testing;

namespace Hewn.Api.Tests.Session;

public sealed class ManageAllowListTests : IAsyncLifetime
{
    private readonly HewnApiFactory _factory = new();
    private HewnClient _owner = null!;

    public async Task InitializeAsync() => _owner = await _factory.SignInAsync("quinntynebrown", Role.Owner);

    public async Task DisposeAsync() => await _factory.DisposeAsync();

    private async Task<List<JsonElement>> ListAsync(HewnClient client)
    {
        var response = await client.GetAsync("/api/allow-list");
        Assert.Equal(HttpStatusCode.OK, response.StatusCode);
        return (await HewnClient.ReadJsonAsync(response)).EnumerateArray().ToList();
    }

    private static async Task<string> FieldErrorAsync(HttpResponseMessage response, string field)
    {
        Assert.Equal(HttpStatusCode.BadRequest, response.StatusCode);
        var body = await HewnClient.ReadJsonAsync(response);
        return body.GetProperty("errors").GetProperty(field)[0].GetString()!;
    }

    [Fact]
    public async Task The_list_shows_each_login_its_role_and_last_sign_in_Owners_first()
    {
        await _factory.SignInAsync("ada", Role.Viewer);
        await _factory.SeedAsync(db => db.AllowList.Add(new AllowListEntry("devon-park", Role.Viewer)));

        var list = await ListAsync(_owner);

        Assert.Equal(["quinntynebrown", "ada", "devon-park"], list.Select(e => e.GetProperty("login").GetString()));
        Assert.Equal(["Owner", "Viewer", "Viewer"], list.Select(e => e.GetProperty("role").GetString()));
        Assert.NotEqual(JsonValueKind.Null, list[0].GetProperty("lastSignInAt").ValueKind);
        Assert.Equal(JsonValueKind.Null, list[2].GetProperty("lastSignInAt").ValueKind);
    }

    [Fact]
    public async Task An_Owner_adds_a_Viewer_who_can_then_sign_in_with_GitHub()
    {
        var added = await _owner.PostAsync("/api/allow-list", new { login = "  Nadia-K ", role = "Viewer" });

        Assert.Equal(HttpStatusCode.Created, added.StatusCode);
        var entry = await HewnClient.ReadJsonAsync(added);
        Assert.Equal("nadia-k", entry.GetProperty("login").GetString());
        Assert.Equal("Viewer", entry.GetProperty("role").GetString());
        Assert.Contains(await ListAsync(_owner), e => e.GetProperty("login").GetString() == "nadia-k");

        var me = await (await _factory.SignInAsync("nadia-k", Role.Owner)).GetAsync("/api/me");
        Assert.Equal("Viewer", (await HewnClient.ReadJsonAsync(me)).GetProperty("role").GetString());
    }

    [Fact]
    public async Task An_Owner_can_add_another_Owner()
    {
        var added = await _owner.PostAsync("/api/allow-list", new { login = "grace", role = "Owner" });

        Assert.Equal(HttpStatusCode.Created, added.StatusCode);
        Assert.Equal("Owner", (await HewnClient.ReadJsonAsync(added)).GetProperty("role").GetString());
    }

    [Theory]
    [InlineData("QuinntyneBrown", "@quinntynebrown is already on the allow list.")]
    [InlineData("", "Enter a GitHub login.")]
    [InlineData("-bad-", "A GitHub login has letters, digits and single hyphens, and doesn't start or end with a hyphen.")]
    [InlineData("missing-person", "No GitHub account is called @missing-person.")]
    public async Task A_login_that_is_listed_malformed_or_unknown_to_GitHub_is_refused_with_a_field_error(string login, string message)
    {
        var refused = await _owner.PostAsync("/api/allow-list", new { login, role = "Viewer" });

        Assert.Equal(message, await FieldErrorAsync(refused, "login"));
        Assert.Single(await ListAsync(_owner));
    }

    [Fact]
    public async Task When_GitHub_cannot_confirm_the_login_nothing_is_added()
    {
        var refused = await _owner.PostAsync("/api/allow-list", new { login = "rate-limited", role = "Viewer" });

        Assert.Equal(HttpStatusCode.BadGateway, refused.StatusCode);
        Assert.Equal("github_failed", (await HewnClient.ReadJsonAsync(refused)).GetProperty("code").GetString());
        Assert.Single(await ListAsync(_owner));
    }

    [Fact]
    public async Task Removing_a_login_ends_its_session_at_once()
    {
        var viewer = await _factory.SignInAsync("ada", Role.Viewer);
        Assert.Equal(HttpStatusCode.OK, (await viewer.GetAsync("/api/me")).StatusCode);

        var removed = await _owner.DeleteAsync("/api/allow-list/Ada");

        Assert.Equal(HttpStatusCode.NoContent, removed.StatusCode);
        Assert.DoesNotContain(await ListAsync(_owner), e => e.GetProperty("login").GetString() == "ada");
        Assert.Equal(HttpStatusCode.Unauthorized, (await viewer.GetAsync("/api/me")).StatusCode);
    }

    [Fact]
    public async Task An_Owner_cannot_remove_themselves_and_an_unknown_login_is_not_found()
    {
        var self = await _owner.DeleteAsync("/api/allow-list/quinntynebrown");
        Assert.Equal(HttpStatusCode.Conflict, self.StatusCode);
        Assert.Equal("cannot_remove_yourself", (await HewnClient.ReadJsonAsync(self)).GetProperty("code").GetString());

        Assert.Equal(HttpStatusCode.NotFound, (await _owner.DeleteAsync("/api/allow-list/nobody")).StatusCode);
    }

    [Fact]
    public async Task A_Viewer_reads_the_list_but_gets_403_adding_or_removing()
    {
        var viewer = await _factory.SignInAsync("ada", Role.Viewer);

        Assert.Equal(2, (await ListAsync(viewer)).Count);
        Assert.Equal(HttpStatusCode.Forbidden, (await viewer.PostAsync("/api/allow-list", new { login = "nadia-k", role = "Owner" })).StatusCode);
        Assert.Equal(HttpStatusCode.Forbidden, (await viewer.DeleteAsync("/api/allow-list/quinntynebrown")).StatusCode);
        Assert.Equal(2, (await ListAsync(_owner)).Count);
    }

    [Fact]
    public async Task Signed_out_the_list_is_401()
    {
        var anonymous = _factory.CreateClient(new WebApplicationFactoryClientOptions { AllowAutoRedirect = false });
        Assert.Equal(HttpStatusCode.Unauthorized, (await anonymous.GetAsync("/api/allow-list")).StatusCode);
    }
}

// Acceptance Test
// Traces to: L2-001
// Description: New direction reads the repository owner and default budget it shows from the API

using System.Net;
using Hewn.Api.Tests.Support;
using Hewn.Domain;

namespace Hewn.Api.Tests.Session;

public sealed class PublicConfigTests : IAsyncLifetime
{
    private readonly HewnApiFactory _factory = new();

    public Task InitializeAsync() => Task.CompletedTask;

    public async Task DisposeAsync() => await _factory.DisposeAsync();

    [Fact]
    public async Task Signed_in_users_get_the_github_owner_and_default_budget()
    {
        var factory = _factory.WithSettings(("HEWN_GITHUB_OWNER", "hewn-builds"), ("HEWN_DEFAULT_BUDGET_USD", "300"));
        var viewer = await factory.SignInAsync("ada", Role.Viewer);

        var config = await HewnClient.ReadJsonAsync(await viewer.GetAsync("/api/config"));

        Assert.Equal("hewn-builds", config.GetProperty("githubOwner").GetString());
        Assert.Equal(300m, config.GetProperty("defaultBudgetUsd").GetDecimal());
    }

    [Fact]
    public async Task Me_names_the_signed_in_user_and_role()
    {
        var owner = await _factory.SignInAsync("quinntynebrown", Role.Owner);

        var me = await HewnClient.ReadJsonAsync(await owner.GetAsync("/api/me"));

        Assert.Equal("quinntynebrown", me.GetProperty("login").GetString());
        Assert.Equal("Owner", me.GetProperty("role").GetString());
    }

    [Fact]
    public async Task Anonymous_callers_get_401()
    {
        var response = await _factory.CreateAnonymousClient().GetAsync("/api/config");

        Assert.Equal(HttpStatusCode.Unauthorized, response.StatusCode);
    }
}

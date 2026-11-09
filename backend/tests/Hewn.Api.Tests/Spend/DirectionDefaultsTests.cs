// Acceptance Test
// Traces to: L2-053
// Description: An Owner sets the default budget per direction in Settings; a direction submitted without a budget gets it; Viewers can read it but not change it

using System.Net;
using Hewn.Api.Tests.Support;
using Hewn.Domain;

namespace Hewn.Api.Tests.Spend;

public sealed class DirectionDefaultsTests : IAsyncLifetime
{
    private readonly HewnApiFactory _factory = new();

    public Task InitializeAsync() => Task.CompletedTask;

    public async Task DisposeAsync() => await _factory.DisposeAsync();

    [Fact]
    public async Task An_Owner_saves_the_default_budget_and_new_directions_start_with_it()
    {
        var owner = await _factory.SignInAsync("quinntynebrown", Role.Owner);

        var saved = await owner.PutAsync("/api/settings/direction-defaults", new { defaultBudgetUsd = 350m });

        Assert.Equal(HttpStatusCode.OK, saved.StatusCode);
        Assert.Equal(350m, (await HewnClient.ReadJsonAsync(saved)).GetProperty("defaultBudgetUsd").GetDecimal());
        Assert.Equal(350m, (await HewnClient.ReadJsonAsync(await owner.GetAsync("/api/settings/direction-defaults"))).GetProperty("defaultBudgetUsd").GetDecimal());
        Assert.Equal(350m, (await HewnClient.ReadJsonAsync(await owner.GetAsync("/api/config"))).GetProperty("defaultBudgetUsd").GetDecimal());

        var submitted = await owner.PostAsync("/api/projects", new
        {
            name = "Glaze Library",
            idea = "A shared glaze recipe library for a pottery studio.",
            stackPreference = (string?)null,
            repositoryUrl = (string?)null,
            budgetUsd = (decimal?)null,
        });
        Assert.Equal(HttpStatusCode.Created, submitted.StatusCode);
        var projectId = (await HewnClient.ReadJsonAsync(submitted)).GetProperty("projectId").GetGuid();
        var project = await HewnClient.ReadJsonAsync(await owner.GetAsync($"/api/projects/{projectId}"));
        Assert.Equal(350m, project.GetProperty("directions")[0].GetProperty("budgetUsd").GetDecimal());
    }

    [Fact]
    public async Task The_default_budget_is_the_configured_fallback_until_an_Owner_saves_one()
    {
        var viewer = await _factory.SignInAsync("ada", Role.Viewer);

        var defaults = await viewer.GetAsync("/api/settings/direction-defaults");

        Assert.Equal(HttpStatusCode.OK, defaults.StatusCode);
        Assert.Equal(300m, (await HewnClient.ReadJsonAsync(defaults)).GetProperty("defaultBudgetUsd").GetDecimal());
    }

    [Fact]
    public async Task A_Viewer_cannot_change_the_default_budget()
    {
        var viewer = await _factory.SignInAsync("ada", Role.Viewer);

        var response = await viewer.PutAsync("/api/settings/direction-defaults", new { defaultBudgetUsd = 350m });

        Assert.Equal(HttpStatusCode.Forbidden, response.StatusCode);
    }

    [Theory]
    [InlineData(9.99)]
    [InlineData(10_000.01)]
    public async Task A_default_budget_outside_10_to_10000_dollars_is_refused(decimal budget)
    {
        var owner = await _factory.SignInAsync("quinntynebrown", Role.Owner);

        var response = await owner.PutAsync("/api/settings/direction-defaults", new { defaultBudgetUsd = budget });

        Assert.Equal(HttpStatusCode.BadRequest, response.StatusCode);
        var problem = await HewnClient.ReadJsonAsync(response);
        Assert.Equal("validation_failed", problem.GetProperty("code").GetString());
        Assert.Equal(
            "Default budget must be between $10.00 and $10,000.00.",
            problem.GetProperty("errors").GetProperty("defaultBudgetUsd")[0].GetString());
        Assert.Equal("Default budget is out of range", problem.GetProperty("summary").GetProperty("defaultBudgetUsd").GetString());
    }
}

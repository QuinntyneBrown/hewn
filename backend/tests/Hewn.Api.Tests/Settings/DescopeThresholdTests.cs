// Acceptance Test
// Traces to: L2-019
// Description: An Owner sets the descope threshold in ideal days in Settings (3 until saved); stage 9 is leased with it; it is a whole number from 1 to 20; Viewers can read it but not change it (AC1)

using System.Net;
using Hewn.Api.Tests.Support;
using Hewn.Domain;

namespace Hewn.Api.Tests.Settings;

public sealed class DescopeThresholdTests : IAsyncLifetime
{
    private readonly HewnApiFactory _factory = new();

    public Task InitializeAsync() => Task.CompletedTask;

    public async Task DisposeAsync() => await _factory.DisposeAsync();

    private static async Task<decimal> ThresholdAsync(HewnClient client) =>
        (await HewnClient.ReadJsonAsync(await client.GetAsync("/api/settings/direction-defaults"))).GetProperty("descopeThresholdDays").GetDecimal();

    [Fact]
    public async Task The_threshold_is_3_days_until_an_Owner_saves_one_and_the_next_lease_carries_it()
    {
        var owner = await _factory.SignInAsync("quinntynebrown", Role.Owner);
        var viewer = await _factory.SignInAsync("ada", Role.Viewer);
        Assert.Equal(3m, await ThresholdAsync(viewer));

        var saved = await owner.PutAsync("/api/settings/direction-defaults", new { defaultBudgetUsd = 350m, descopeThresholdDays = 5m });

        Assert.Equal(HttpStatusCode.OK, saved.StatusCode);
        Assert.Equal(5m, (await HewnClient.ReadJsonAsync(saved)).GetProperty("descopeThresholdDays").GetDecimal());
        Assert.Equal(5m, await ThresholdAsync(viewer));
        var submitted = await owner.PostAsync("/api/projects", new
        {
            name = "Glaze Library",
            idea = "A shared glaze recipe library for a pottery studio.",
            stackPreference = (string?)null,
            repositoryUrl = (string?)null,
            budgetUsd = (decimal?)null,
        });
        Assert.Equal(HttpStatusCode.Created, submitted.StatusCode);
        var run = (await (await _factory.RegisterWorkerAsync()).LeaseAsync())!;
        Assert.Equal(5m, run.Body.GetProperty("descopeThresholdDays").GetDecimal());
    }

    [Fact]
    public async Task Saving_only_the_budget_keeps_the_threshold()
    {
        var owner = await _factory.SignInAsync("quinntynebrown", Role.Owner);
        (await owner.PutAsync("/api/settings/direction-defaults", new { defaultBudgetUsd = 300m, descopeThresholdDays = 8m })).EnsureSuccessStatusCode();

        (await owner.PutAsync("/api/settings/direction-defaults", new { defaultBudgetUsd = 320m })).EnsureSuccessStatusCode();

        Assert.Equal(8m, await ThresholdAsync(owner));
    }

    [Theory]
    [InlineData(0)]
    [InlineData(21)]
    [InlineData(2.5)]
    public async Task The_threshold_must_be_a_whole_number_of_days_from_1_to_20(double days)
    {
        var owner = await _factory.SignInAsync("quinntynebrown", Role.Owner);

        var response = await owner.PutAsync("/api/settings/direction-defaults", new { defaultBudgetUsd = 300m, descopeThresholdDays = (decimal)days });

        Assert.Equal(HttpStatusCode.BadRequest, response.StatusCode);
        var problem = await HewnClient.ReadJsonAsync(response);
        Assert.Equal("Descope threshold must be a whole number of days from 1 to 20.", problem.GetProperty("errors").GetProperty("descopeThresholdDays")[0].GetString());
        Assert.Equal("Descope threshold must be 1 to 20 days", problem.GetProperty("summary").GetProperty("descopeThresholdDays").GetString());
        Assert.Equal(3m, await ThresholdAsync(owner));
    }

    [Fact]
    public async Task A_Viewer_cannot_change_the_threshold()
    {
        var viewer = await _factory.SignInAsync("ada", Role.Viewer);

        var response = await viewer.PutAsync("/api/settings/direction-defaults", new { defaultBudgetUsd = 300m, descopeThresholdDays = 5m });

        Assert.Equal(HttpStatusCode.Forbidden, response.StatusCode);
        Assert.Equal(3m, await ThresholdAsync(viewer));
    }
}

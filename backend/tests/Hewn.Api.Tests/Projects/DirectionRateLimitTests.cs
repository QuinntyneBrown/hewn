// Acceptance Test
// Traces to: L2-043, L2-004
// Description: An Owner may submit at most 10 directions, product or feature, in any minute; the extra requests return 429 with the code rate_limited and when they may submit again, create nothing, and the limit is the Owner's own

using System.Net;
using Hewn.Api.Tests.Support;
using Hewn.Domain;
using Microsoft.EntityFrameworkCore;

namespace Hewn.Api.Tests.Projects;

public sealed class DirectionRateLimitTests : IAsyncLifetime
{
    private readonly HewnApiFactory _factory = new();

    public Task InitializeAsync() => Task.CompletedTask;

    public async Task DisposeAsync() => await _factory.DisposeAsync();

    private static Task<HttpResponseMessage> SubmitProductAsync(HewnClient owner, string name, decimal budgetUsd = 300m) =>
        owner.PostAsync("/api/projects", new
        {
            name,
            idea = "A web app for small accounting teams to reconcile statements.",
            stackPreference = (string?)null,
            repositoryUrl = (string?)null,
            budgetUsd,
        });

    private static Task<HttpResponseMessage> SubmitFeatureAsync(HewnClient owner, Guid projectId) =>
        owner.PostAsync($"/api/projects/{projectId}/directions", new { idea = "Add a CSV export to the reconciliation report.", budgetUsd = 50m });

    private Task<int> DirectionCountAsync() => _factory.QueryAsync(db => db.Directions.CountAsync());

    [Fact]
    public async Task The_eleventh_direction_in_a_minute_returns_429_with_when_to_submit_again_and_creates_nothing()
    {
        var owner = await _factory.SignInAsync("quinntynebrown", Role.Owner);
        var first = await SubmitProductAsync(owner, "Ledgerline");
        Assert.Equal(HttpStatusCode.Created, first.StatusCode);
        var projectId = (await HewnClient.ReadJsonAsync(first)).GetProperty("projectId").GetGuid();

        // Product and feature directions both count; the clock moves 2 seconds between submissions.
        for (var i = 2; i <= 10; i++)
        {
            _factory.Clock.Advance(TimeSpan.FromSeconds(2));
            var accepted = i % 2 == 0 ? await SubmitFeatureAsync(owner, projectId) : await SubmitProductAsync(owner, $"Project {i}");
            Assert.Equal(HttpStatusCode.Created, accepted.StatusCode);
        }

        _factory.Clock.Advance(TimeSpan.FromSeconds(2));
        var refused = await SubmitFeatureAsync(owner, projectId);

        Assert.Equal(HttpStatusCode.TooManyRequests, refused.StatusCode);
        var problem = await HewnClient.ReadJsonAsync(refused);
        Assert.Equal("rate_limited", problem.GetProperty("code").GetString());
        Assert.Equal(10, problem.GetProperty("limit").GetInt32());
        // The first submission leaves the minute 60 - 20 = 40 seconds from now.
        Assert.Equal(40, problem.GetProperty("retryAfterSeconds").GetInt32());
        Assert.Equal(TimeSpan.FromSeconds(40), refused.Headers.RetryAfter?.Delta);
        Assert.Equal(10, await DirectionCountAsync());
        Assert.Equal(HttpStatusCode.TooManyRequests, (await SubmitProductAsync(owner, "Project 11")).StatusCode);
        Assert.Equal(10, await DirectionCountAsync());
    }

    [Fact]
    public async Task Once_the_oldest_submission_is_a_minute_old_the_Owner_can_submit_again()
    {
        var owner = await _factory.SignInAsync("quinntynebrown", Role.Owner);
        for (var i = 1; i <= 10; i++)
        {
            Assert.Equal(HttpStatusCode.Created, (await SubmitProductAsync(owner, $"Project {i}")).StatusCode);
            _factory.Clock.Advance(TimeSpan.FromSeconds(1));
        }

        _factory.Clock.Advance(TimeSpan.FromSeconds(49));
        var early = await SubmitProductAsync(owner, "Project 11");
        Assert.Equal(HttpStatusCode.TooManyRequests, early.StatusCode);
        Assert.Equal(1, (await HewnClient.ReadJsonAsync(early)).GetProperty("retryAfterSeconds").GetInt32());

        _factory.Clock.Advance(TimeSpan.FromSeconds(1));
        Assert.Equal(HttpStatusCode.Created, (await SubmitProductAsync(owner, "Project 11")).StatusCode);
        // Project 2 is still inside the minute, and Project 11 just joined it.
        Assert.Equal(HttpStatusCode.TooManyRequests, (await SubmitProductAsync(owner, "Project 12")).StatusCode);
    }

    [Fact]
    public async Task Refused_and_invalid_submissions_do_not_count_and_each_Owner_has_their_own_limit()
    {
        var owner = await _factory.SignInAsync("quinntynebrown", Role.Owner);
        var other = await _factory.SignInAsync("grace", Role.Owner);
        Assert.Equal(HttpStatusCode.BadRequest, (await SubmitProductAsync(owner, "Invalid", budgetUsd: 0m)).StatusCode);
        for (var i = 1; i <= 10; i++)
        {
            Assert.Equal(HttpStatusCode.Created, (await SubmitProductAsync(owner, $"Project {i}")).StatusCode);
        }

        Assert.Equal(HttpStatusCode.TooManyRequests, (await SubmitProductAsync(owner, "Project 11")).StatusCode);
        Assert.Equal(HttpStatusCode.Created, (await SubmitProductAsync(other, "Grace's project")).StatusCode);
    }

    [Fact]
    public async Task The_limit_can_be_set_for_a_deployment()
    {
        _factory.WithSettings(("Hewn:RateLimit:DirectionsPerMinute", "2"));
        var owner = await _factory.SignInAsync("quinntynebrown", Role.Owner);
        Assert.Equal(HttpStatusCode.Created, (await SubmitProductAsync(owner, "Project 1")).StatusCode);
        Assert.Equal(HttpStatusCode.Created, (await SubmitProductAsync(owner, "Project 2")).StatusCode);

        var refused = await SubmitProductAsync(owner, "Project 3");
        Assert.Equal(HttpStatusCode.TooManyRequests, refused.StatusCode);
        Assert.Equal(2, (await HewnClient.ReadJsonAsync(refused)).GetProperty("limit").GetInt32());
    }
}

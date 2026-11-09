// Acceptance Test
// Traces to: L2-001, L2-039, L2-043
// Description: An Owner submits a product direction; invalid input, an unwritable repository and a Viewer create nothing

using System.Net;
using Hewn.Api.Tests.Support;
using Hewn.Application.Abstractions;
using Hewn.Domain;
using Microsoft.EntityFrameworkCore;

namespace Hewn.Api.Tests.Projects;

public sealed class SubmitProductDirectionTests : IAsyncLifetime
{
    private const string LedgerlineIdea =
        "A web app for small accounting teams to reconcile bank and card statements against receipts.";

    private readonly HewnApiFactory _factory = new();

    public Task InitializeAsync() => Task.CompletedTask;

    public async Task DisposeAsync() => await _factory.DisposeAsync();

    private static object Direction(
        string name = "Ledgerline",
        string idea = LedgerlineIdea,
        string? repositoryUrl = null,
        decimal budgetUsd = 400m) =>
        new { name, idea, stackPreference = (string?)null, repositoryUrl, budgetUsd };

    [Fact]
    public async Task Owner_submits_a_valid_direction_and_a_project_is_created_with_stage_0_pending()
    {
        var owner = await _factory.SignInAsync("quinntynebrown", Role.Owner);

        var response = await owner.PostAsync("/api/projects", Direction());

        Assert.Equal(HttpStatusCode.Created, response.StatusCode);
        var body = await HewnClient.ReadJsonAsync(response);
        var projectId = body.GetProperty("projectId").GetGuid();
        Assert.Equal($"/api/projects/{projectId}", response.Headers.Location?.ToString());

        var project = await HewnClient.ReadJsonAsync(await owner.GetAsync($"/api/projects/{projectId}"));
        Assert.Equal("Ledgerline", project.GetProperty("name").GetString());
        Assert.Equal("Running", project.GetProperty("status").GetString());
        var direction = project.GetProperty("directions")[0];
        Assert.Equal("Product", direction.GetProperty("kind").GetString());
        Assert.Equal("Queued", direction.GetProperty("status").GetString());
        var stages = direction.GetProperty("stages");
        Assert.Equal(11, stages.GetArrayLength());
        Assert.Equal(0, stages[0].GetProperty("number").GetInt32());
        Assert.Equal("Pending", stages[0].GetProperty("status").GetString());
    }

    [Fact]
    public async Task Submitting_writes_a_direction_queued_event_with_sequence_number_1()
    {
        var owner = await _factory.SignInAsync("quinntynebrown", Role.Owner);

        var body = await HewnClient.ReadJsonAsync(await owner.PostAsync("/api/projects", Direction()));
        var projectId = body.GetProperty("projectId").GetGuid();

        var events = await _factory.QueryAsync(db =>
            db.Events.Where(e => e.ProjectId == projectId).OrderBy(e => e.Sequence).ToListAsync());
        var queued = Assert.Single(events);
        Assert.Equal("DirectionQueued", queued.Type);
        Assert.Equal(1, queued.Sequence);
    }

    [Theory]
    [InlineData("", "Enter a name.")]
    [InlineData("   ", "Enter a name.")]
    public async Task An_empty_name_is_refused_with_an_inline_error(string name, string message)
    {
        var owner = await _factory.SignInAsync("quinntynebrown", Role.Owner);

        var response = await owner.PostAsync("/api/projects", Direction(name: name));

        await AssertFieldErrorAsync(response, "name", message);
        await AssertNothingCreatedAsync();
    }

    [Fact]
    public async Task A_name_longer_than_100_characters_is_refused()
    {
        var owner = await _factory.SignInAsync("quinntynebrown", Role.Owner);

        var response = await owner.PostAsync("/api/projects", Direction(name: new string('a', 101)));

        await AssertFieldErrorAsync(response, "name", "Name must be 1 to 100 characters. This one has 101.");
        await AssertNothingCreatedAsync();
    }

    [Fact]
    public async Task A_name_already_used_by_another_project_is_refused_whatever_its_case()
    {
        var owner = await _factory.SignInAsync("quinntynebrown", Role.Owner);
        Assert.Equal(HttpStatusCode.Created, (await owner.PostAsync("/api/projects", Direction())).StatusCode);

        var response = await owner.PostAsync("/api/projects", Direction(name: "LEDGERLINE"));

        await AssertFieldErrorAsync(response, "name", "Name is already used by another project. Pick a different name.");
        Assert.Equal(1, await _factory.QueryAsync(db => db.Projects.CountAsync()));
    }

    [Theory]
    [InlineData(9)]
    [InlineData(20_001)]
    public async Task An_idea_outside_10_to_20000_characters_is_refused_with_the_allowed_length(int length)
    {
        var owner = await _factory.SignInAsync("quinntynebrown", Role.Owner);

        var response = await owner.PostAsync("/api/projects", Direction(idea: new string('x', length)));

        await AssertFieldErrorAsync(
            response, "idea", $"The idea must be 10 to 20,000 characters. This one has {length:N0}.");
        await AssertNothingCreatedAsync();
    }

    [Theory]
    [InlineData(10)]
    [InlineData(20_000)]
    public async Task An_idea_of_exactly_10_or_20000_characters_is_accepted(int length)
    {
        var owner = await _factory.SignInAsync("quinntynebrown", Role.Owner);

        var response = await owner.PostAsync("/api/projects", Direction(idea: new string('x', length)));

        Assert.Equal(HttpStatusCode.Created, response.StatusCode);
    }

    [Theory]
    [InlineData("gitlab.com/ledgerline")]
    [InlineData("https://gitlab.com/acme/ledgerline")]
    [InlineData("https://github.com/acme")]
    [InlineData("http://github.com/acme/ledgerline")]
    [InlineData("https://github.com/acme/ledgerline/tree/main")]
    public async Task A_repository_url_that_is_not_a_github_repository_url_is_refused(string url)
    {
        var owner = await _factory.SignInAsync("quinntynebrown", Role.Owner);

        var response = await owner.PostAsync("/api/projects", Direction(repositoryUrl: url));

        await AssertFieldErrorAsync(response, "repositoryUrl", "Use a https://github.com/{owner}/{repo} URL.");
        await AssertNothingCreatedAsync();
    }

    [Fact]
    public async Task A_repository_the_github_credential_cannot_write_to_is_refused()
    {
        _factory.GitHub.SetAccess("northwind", "handover", RepositoryAccess.NoAccess);
        var owner = await _factory.SignInAsync("quinntynebrown", Role.Owner);

        var response = await owner.PostAsync(
            "/api/projects", Direction(repositoryUrl: "https://github.com/northwind/handover"));

        await AssertFieldErrorAsync(
            response,
            "repositoryUrl",
            "Hewn’s GitHub App can’t write to northwind/handover. Install the app on that repository, or leave this empty to create one.");
        var problem = await HewnClient.ReadJsonAsync(response);
        Assert.Equal("repository_not_writable", problem.GetProperty("code").GetString());
        await AssertNothingCreatedAsync();
    }

    [Fact]
    public async Task A_repository_that_does_not_exist_is_refused()
    {
        _factory.GitHub.SetAccess("northwind", "missing", RepositoryAccess.NotFound);
        var owner = await _factory.SignInAsync("quinntynebrown", Role.Owner);

        var response = await owner.PostAsync(
            "/api/projects", Direction(repositoryUrl: "https://github.com/northwind/missing"));

        await AssertFieldErrorAsync(
            response,
            "repositoryUrl",
            "Hewn can’t find northwind/missing on GitHub. Check the URL, or leave this empty to create one.");
        await AssertNothingCreatedAsync();
    }

    [Fact]
    public async Task A_writable_existing_repository_is_recorded_on_the_project()
    {
        var owner = await _factory.SignInAsync("quinntynebrown", Role.Owner);

        var response = await owner.PostAsync(
            "/api/projects", Direction(repositoryUrl: "https://github.com/acme/ledgerline"));

        var projectId = (await HewnClient.ReadJsonAsync(response)).GetProperty("projectId").GetGuid();
        var project = await HewnClient.ReadJsonAsync(await owner.GetAsync($"/api/projects/{projectId}"));
        Assert.Equal("acme/ledgerline", project.GetProperty("repository").GetString());
    }

    [Fact]
    public async Task A_viewer_gets_403_and_nothing_is_created()
    {
        var viewer = await _factory.SignInAsync("ada", Role.Viewer);

        var response = await viewer.PostAsync("/api/projects", Direction());

        Assert.Equal(HttpStatusCode.Forbidden, response.StatusCode);
        await AssertNothingCreatedAsync();
    }

    [Fact]
    public async Task An_unauthenticated_request_gets_401()
    {
        var anonymous = _factory.CreateAnonymousClient();

        var response = await anonymous.PostAsync("/api/projects", null);

        Assert.Equal(HttpStatusCode.Unauthorized, response.StatusCode);
    }

    [Fact]
    public async Task A_submission_without_the_anti_forgery_token_is_refused()
    {
        var owner = await _factory.SignInAsync("quinntynebrown", Role.Owner);

        var response = await owner.Http.PostAsync(
            "/api/projects", System.Net.Http.Json.JsonContent.Create(Direction()));

        Assert.Equal(HttpStatusCode.BadRequest, response.StatusCode);
        await AssertNothingCreatedAsync();
    }

    [Fact]
    public async Task A_project_that_does_not_exist_returns_404()
    {
        var owner = await _factory.SignInAsync("quinntynebrown", Role.Owner);

        var response = await owner.GetAsync($"/api/projects/{Guid.NewGuid()}");

        Assert.Equal(HttpStatusCode.NotFound, response.StatusCode);
    }

    private static async Task AssertFieldErrorAsync(HttpResponseMessage response, string field, string message)
    {
        Assert.Equal(HttpStatusCode.BadRequest, response.StatusCode);
        Assert.Equal("application/problem+json", response.Content.Headers.ContentType?.MediaType);
        var problem = await HewnClient.ReadJsonAsync(response);
        var errors = problem.GetProperty("errors").GetProperty(field);
        Assert.Contains(message, errors.EnumerateArray().Select(e => e.GetString()));
    }

    private async Task AssertNothingCreatedAsync()
    {
        Assert.Equal(0, await _factory.QueryAsync(db => db.Projects.CountAsync()));
        Assert.Equal(0, await _factory.QueryAsync(db => db.Directions.CountAsync()));
    }
}

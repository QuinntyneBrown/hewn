// Acceptance Test
// Traces to: L2-003
// Description: An Owner archives a project with no active direction; it is marked archived in the list (the default list hides it, the Archived filter shows it) and can be restored. A project with an active direction is refused with "Cancel the running direction first"; Viewers get 403 and unknown projects 404 (AC1, AC2)

using System.Net;
using System.Text.Json;
using Hewn.Api.Tests.Support;
using Hewn.Domain;

namespace Hewn.Api.Tests.Projects;

public sealed class ArchiveProjectTests : IAsyncLifetime
{
    private readonly HewnApiFactory _factory = new();

    public Task InitializeAsync() => Task.CompletedTask;

    public async Task DisposeAsync() => await _factory.DisposeAsync();

    private async Task<(HewnClient Owner, Guid ProjectId, Guid DirectionId)> ProjectAsync(string name = "Saltmarsh Survey")
    {
        var owner = await _factory.SignInAsync("quinntynebrown", Role.Owner);
        var submitted = await owner.PostAsync("/api/projects", new
        {
            name,
            idea = "Bird-count logging for estuary volunteers.",
            stackPreference = (string?)null,
            repositoryUrl = (string?)null,
            budgetUsd = 300m,
        });
        Assert.Equal(HttpStatusCode.Created, submitted.StatusCode);
        var projectId = (await HewnClient.ReadJsonAsync(submitted)).GetProperty("projectId").GetGuid();
        var project = await HewnClient.ReadJsonAsync(await owner.GetAsync($"/api/projects/{projectId}"));
        return (owner, projectId, project.GetProperty("directions")[0].GetProperty("id").GetGuid());
    }

    /// <summary>A project whose only direction was cancelled before a worker leased it: no active direction.</summary>
    private async Task<(HewnClient Owner, Guid ProjectId)> IdleProjectAsync(string name = "Saltmarsh Survey")
    {
        var (owner, projectId, directionId) = await ProjectAsync(name);
        (await owner.PostAsync($"/api/projects/{projectId}/directions/{directionId}/cancel", new { })).EnsureSuccessStatusCode();
        return (owner, projectId);
    }

    private static async Task<JsonElement> RowAsync(HewnClient client, Guid projectId) =>
        (await HewnClient.ReadJsonAsync(await client.GetAsync("/api/projects")))
            .EnumerateArray()
            .Single(r => r.GetProperty("id").GetGuid() == projectId);

    private static async Task<List<string>> EventTypesAsync(HewnClient client, Guid projectId) =>
        (await HewnClient.ReadJsonAsync(await client.GetAsync($"/api/projects/{projectId}/events?after=0")))
            .EnumerateArray()
            .Select(e => e.GetProperty("type").GetString()!)
            .ToList();

    [Fact]
    public async Task An_idle_project_is_archived_then_restored()
    {
        var (owner, projectId) = await IdleProjectAsync();
        Assert.False((await RowAsync(owner, projectId)).GetProperty("archived").GetBoolean());

        var archived = await owner.PostAsync($"/api/projects/{projectId}/archive", new { });

        Assert.Equal(HttpStatusCode.NoContent, archived.StatusCode);
        var row = await RowAsync(owner, projectId);
        Assert.True(row.GetProperty("archived").GetBoolean());
        Assert.Equal("Cancelled", row.GetProperty("status").GetString());
        Assert.Contains("ProjectArchived", await EventTypesAsync(owner, projectId));
        // Archiving again changes nothing.
        Assert.Equal(HttpStatusCode.NoContent, (await owner.PostAsync($"/api/projects/{projectId}/archive", new { })).StatusCode);
        Assert.Single(await EventTypesAsync(owner, projectId), "ProjectArchived");

        var restored = await owner.PostAsync($"/api/projects/{projectId}/restore", new { });

        Assert.Equal(HttpStatusCode.NoContent, restored.StatusCode);
        Assert.False((await RowAsync(owner, projectId)).GetProperty("archived").GetBoolean());
        Assert.Contains("ProjectRestored", await EventTypesAsync(owner, projectId));
    }

    [Fact]
    public async Task A_project_with_an_active_direction_is_not_archived()
    {
        var (owner, projectId, _) = await ProjectAsync();

        var response = await owner.PostAsync($"/api/projects/{projectId}/archive", new { });

        Assert.Equal(HttpStatusCode.Conflict, response.StatusCode);
        var problem = await HewnClient.ReadJsonAsync(response);
        Assert.Equal("active_direction", problem.GetProperty("code").GetString());
        Assert.Equal("Cancel the running direction first", problem.GetProperty("title").GetString());
        Assert.False((await RowAsync(owner, projectId)).GetProperty("archived").GetBoolean());
        Assert.DoesNotContain("ProjectArchived", await EventTypesAsync(owner, projectId));
    }

    [Fact]
    public async Task An_archived_project_takes_no_new_direction_until_restored()
    {
        var (owner, projectId) = await IdleProjectAsync();
        (await owner.PostAsync($"/api/projects/{projectId}/archive", new { })).EnsureSuccessStatusCode();

        var refused = await owner.PostAsync($"/api/projects/{projectId}/directions", new { idea = "Export counts as CSV for the regional survey.", budgetUsd = 100m });

        Assert.Equal(HttpStatusCode.Conflict, refused.StatusCode);
        var problem = await HewnClient.ReadJsonAsync(refused);
        Assert.Equal("project_archived", problem.GetProperty("code").GetString());
        Assert.Equal("Restore the project first", problem.GetProperty("title").GetString());
    }

    [Fact]
    public async Task A_Viewer_cannot_archive_or_restore_and_an_unknown_project_is_not_found()
    {
        var (owner, projectId) = await IdleProjectAsync();
        var viewer = await _factory.SignInAsync("ada", Role.Viewer);

        Assert.Equal(HttpStatusCode.Forbidden, (await viewer.PostAsync($"/api/projects/{projectId}/archive", new { })).StatusCode);
        Assert.Equal(HttpStatusCode.Forbidden, (await viewer.PostAsync($"/api/projects/{projectId}/restore", new { })).StatusCode);
        Assert.Equal(HttpStatusCode.NotFound, (await owner.PostAsync($"/api/projects/{Guid.NewGuid()}/archive", new { })).StatusCode);
        Assert.Equal(HttpStatusCode.NotFound, (await owner.PostAsync($"/api/projects/{Guid.NewGuid()}/restore", new { })).StatusCode);
        Assert.False((await RowAsync(owner, projectId)).GetProperty("archived").GetBoolean());
    }
}

// Acceptance Test
// Traces to: L2-008
// Description: When Greenlit's default branch is ahead of the SHA in the project's .hewn/skills.lock, GET /api/projects/{id}/skills-update says how many commits and lists them, newest first; with no lock, none ahead or Greenlit unreachable, it reports none (AC1)

using System.Net;
using Hewn.Api.Tests.Support;
using Hewn.Domain;

namespace Hewn.Api.Tests.Skills;

public sealed class SkillsUpdateAvailableTests : IAsyncLifetime
{
    private readonly GreenlitRepository _greenlit = new();

    private readonly HewnApiFactory _factory;

    public SkillsUpdateAvailableTests() =>
        _factory = new HewnApiFactory().WithSettings(("HEWN_SKILLS_SOURCE", _greenlit.Url));

    public Task InitializeAsync() => Task.CompletedTask;

    public async Task DisposeAsync()
    {
        await _factory.DisposeAsync();
        _greenlit.Dispose();
    }

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

    [Fact]
    public async Task Greenlit_ahead_of_the_lock_gives_the_count_and_the_commits_newest_first()
    {
        var locked = _greenlit.Commit("Greenlit", (".claude/skills/grilling/SKILL.md", "Grill."));
        _greenlit.Commit("grilling: answer for the user when running unattended", (".claude/skills/grilling/SKILL.md", "Grill, unattended."));
        var newest = _greenlit.Commit("estimating-designs: 3-day descope threshold by default", (".agents/skills/estimating-designs/SKILL.md", "Estimate."));
        var (owner, projectId) = await ProjectAsync(new() { [".hewn/skills.lock"] = _greenlit.Lock(locked, "grilling") });

        var response = await owner.GetAsync($"/api/projects/{projectId}/skills-update");

        Assert.Equal(HttpStatusCode.OK, response.StatusCode);
        var update = await HewnClient.ReadJsonAsync(response);
        Assert.Equal(2, update.GetProperty("available").GetInt32());
        Assert.Equal(locked, update.GetProperty("lockedSha").GetString());
        Assert.Equal(newest, update.GetProperty("headSha").GetString());
        var commits = update.GetProperty("commits").EnumerateArray().Select(c => (c.GetProperty("sha").GetString(), c.GetProperty("message").GetString())).ToList();
        Assert.Equal(
            [(newest, "estimating-designs: 3-day descope threshold by default"), (commits[1].Item1, "grilling: answer for the user when running unattended")],
            commits);
    }

    [Fact]
    public async Task A_lock_at_Greenlits_head_or_no_lock_has_nothing_available()
    {
        var head = _greenlit.Commit("Greenlit", (".claude/skills/grilling/SKILL.md", "Grill."));
        var (owner, projectId) = await ProjectAsync(new() { [".hewn/skills.lock"] = _greenlit.Lock(head, "grilling") });
        _factory.GitHub.Seed("northwind", "no-lock", topics: ["hewn"], files: new() { ["README.md"] = "No skills yet." });
        var noLock = await owner.PostAsync("/api/projects", new
        {
            name = "No Lock",
            idea = "A project whose stage 0 has not run.",
            stackPreference = (string?)null,
            repositoryUrl = "https://github.com/northwind/no-lock",
            budgetUsd = 300m,
        });
        var noLockId = (await HewnClient.ReadJsonAsync(noLock)).GetProperty("projectId").GetGuid();

        foreach (var id in new[] { projectId, noLockId })
        {
            var update = await HewnClient.ReadJsonAsync(await owner.GetAsync($"/api/projects/{id}/skills-update"));
            Assert.Equal(0, update.GetProperty("available").GetInt32());
            Assert.Empty(update.GetProperty("commits").EnumerateArray());
        }
    }

    [Fact]
    public async Task An_unreachable_Greenlit_offers_no_update()
    {
        var locked = _greenlit.Commit("Greenlit", (".claude/skills/grilling/SKILL.md", "Grill."));
        _greenlit.Dispose();
        var (owner, projectId) = await ProjectAsync(new() { [".hewn/skills.lock"] = _greenlit.Lock(locked, "grilling") });

        var response = await owner.GetAsync($"/api/projects/{projectId}/skills-update");

        Assert.Equal(HttpStatusCode.OK, response.StatusCode);
        Assert.Equal(0, (await HewnClient.ReadJsonAsync(response)).GetProperty("available").GetInt32());
    }

    [Fact]
    public async Task An_unknown_project_is_not_found()
    {
        var owner = await _factory.SignInAsync("quinntynebrown", Role.Owner);

        var response = await owner.GetAsync($"/api/projects/{Guid.NewGuid()}/skills-update");

        Assert.Equal(HttpStatusCode.NotFound, response.StatusCode);
    }
}

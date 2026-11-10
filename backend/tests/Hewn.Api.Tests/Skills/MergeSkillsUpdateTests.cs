// Acceptance Test
// Traces to: L2-008, L2-025
// Description: The skills update's pull request merges once every check has passed, so the default branch's lock moves to Greenlit's head and no update is offered; it waits while checks run, is rebased when the default branch moved, and is left open, unmerged, when a check fails (AC2)

using System.Text;
using Hewn.Api.Tests.Support;
using Hewn.Domain;
using Hewn.Infrastructure.Fakes;

namespace Hewn.Api.Tests.Skills;

public sealed class MergeSkillsUpdateTests : IAsyncLifetime
{
    private const string Workflow = "name: CI\non: [pull_request]\njobs:\n  build:\n    runs-on: ubuntu-latest\n  e2e:\n    runs-on: ubuntu-latest\n";

    private readonly GreenlitRepository _greenlit = new();

    private readonly HewnApiFactory _factory;

    private string _head = string.Empty;

    public MergeSkillsUpdateTests() =>
        _factory = new HewnApiFactory().WithSettings(("HEWN_SKILLS_SOURCE", _greenlit.Url), ("Hewn:Skills:FetchSeconds", "0"));

    public Task InitializeAsync() => Task.CompletedTask;

    public async Task DisposeAsync()
    {
        await _factory.DisposeAsync();
        _greenlit.Dispose();
    }

    private FakeRepository Repository => _factory.GitHub.Repository("northwind", "ledgerline")!;

    /// <summary>A project one Greenlit commit behind, with Update skills chosen; returns the pull request's number.</summary>
    private async Task<(HewnClient Owner, Guid ProjectId, int Number)> UpdatingAsync()
    {
        var locked = _greenlit.Commit("Greenlit", (".claude/skills/grilling/SKILL.md", "Grill."));
        _head = _greenlit.Commit("grilling: answer for the user when running unattended", (".claude/skills/grilling/SKILL.md", "Grill, unattended."));
        _factory.GitHub.Seed("northwind", "ledgerline", topics: ["hewn"], files: new()
        {
            [".hewn/skills.lock"] = _greenlit.Lock(locked, "grilling"),
            [".claude/skills/grilling/SKILL.md"] = "Grill.",
            [".github/workflows/ci.yml"] = Workflow,
        });
        var owner = await _factory.SignInAsync("quinntynebrown", Role.Owner);
        var submitted = await owner.PostAsync("/api/projects", new
        {
            name = "Ledgerline",
            idea = "A web app for small accounting teams to reconcile statements.",
            stackPreference = (string?)null,
            repositoryUrl = "https://github.com/northwind/ledgerline",
            budgetUsd = 300m,
        });
        var projectId = (await HewnClient.ReadJsonAsync(submitted)).GetProperty("projectId").GetGuid();
        var opened = await HewnClient.ReadJsonAsync(await owner.PostAsync($"/api/projects/{projectId}/skills-update", new { }));
        return (owner, projectId, opened.GetProperty("pullRequest").GetProperty("number").GetInt32());
    }

    private async Task<int> AvailableAsync(HewnClient owner, Guid projectId) =>
        (await HewnClient.ReadJsonAsync(await owner.GetAsync($"/api/projects/{projectId}/skills-update"))).GetProperty("available").GetInt32();

    [Fact]
    public async Task It_merges_once_every_check_has_passed_and_no_update_is_offered()
    {
        _factory.GitHub.Clock = _factory.Clock;
        _factory.GitHub.CheckSeconds = 30;
        var (owner, projectId, number) = await UpdatingAsync();

        await _factory.MergeSkillsUpdatesAsync();
        Assert.False(Repository.PullRequests.Single(p => p.Number == number).Merged);

        _factory.Clock.Advance(TimeSpan.FromSeconds(61));
        await _factory.MergeSkillsUpdatesAsync();

        Assert.True(Repository.PullRequests.Single(p => p.Number == number).Merged);
        Assert.Contains(_head, Repository.Read(".hewn/skills.lock"));
        Assert.Equal("Grill, unattended.", Repository.Read(".claude/skills/grilling/SKILL.md"));
        Assert.Equal(0, await AvailableAsync(owner, projectId));
        var update = await HewnClient.ReadJsonAsync(await owner.GetAsync($"/api/projects/{projectId}/skills-update"));
        Assert.Equal(System.Text.Json.JsonValueKind.Null, update.GetProperty("pullRequest").ValueKind);
        var events = await _factory.QueryAsync(db => Task.FromResult(db.Events.Where(e => e.ProjectId == projectId).Select(e => e.Type).ToList()));
        Assert.Contains("SkillsUpdateMerged", events);
    }

    [Fact]
    public async Task A_default_branch_that_moved_is_rebased_then_merged()
    {
        var (_, _, number) = await UpdatingAsync();
        Repository.Write("docs/brief.md", "# Brief\n");

        await _factory.MergeSkillsUpdatesAsync();
        Assert.False(Repository.PullRequests.Single(p => p.Number == number).Merged);
        await _factory.MergeSkillsUpdatesAsync();

        Assert.True(Repository.PullRequests.Single(p => p.Number == number).Merged);
        Assert.Equal("# Brief\n", Repository.Read("docs/brief.md"));
        Assert.Contains(_head, Repository.Read(".hewn/skills.lock"));
    }

    [Fact]
    public async Task A_failing_check_leaves_it_open_and_unmerged_and_offers_the_update_again()
    {
        var (owner, projectId, number) = await UpdatingAsync();
        _factory.GitHub.FailCheck("northwind", "ledgerline", "e2e");

        await _factory.MergeSkillsUpdatesAsync();

        var pull = Repository.PullRequests.Single(p => p.Number == number);
        Assert.False(pull.Merged);
        Assert.Equal(1, await AvailableAsync(owner, projectId));
        var update = await _factory.QueryAsync(db => Task.FromResult(db.SkillsUpdates.Single(u => u.ProjectId == projectId)));
        Assert.Equal(SkillsUpdateStatus.ChecksFailed, update.Status);
        Assert.Equal("e2e", update.FailedChecks);
    }
}

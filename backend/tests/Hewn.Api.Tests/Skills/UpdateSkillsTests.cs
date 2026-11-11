// Acceptance Test
// Traces to: L2-008
// Description: An Owner's Update skills opens a pull request on hewn/update-skills-{short-sha} that updates the skill files from Greenlit's head and .hewn/skills.lock, keeps skill folders the project owns, and answers with the pull request; a second request returns the same one; Greenlit unreachable is 502 greenlit_unreachable with nothing opened; Viewers get 403 (AC2)

using System.Net;
using System.Text;
using Hewn.Api.Tests.Support;
using Hewn.Domain;

namespace Hewn.Api.Tests.Skills;

public sealed class UpdateSkillsTests : IAsyncLifetime
{
    private readonly GreenlitRepository _greenlit = new();

    private readonly HewnApiFactory _factory;

    private string _locked = string.Empty;

    public UpdateSkillsTests() =>
        _factory = new HewnApiFactory().WithSettings(("HEWN_SKILLS_SOURCE", _greenlit.Url), ("Hewn:Skills:FetchSeconds", "0"));

    public Task InitializeAsync()
    {
        _locked = _greenlit.Commit(
            "Greenlit",
            (".claude/skills/grilling/SKILL.md", "Grill."),
            (".claude/skills/estimating-designs/SKILL.md", "Estimate."));
        return Task.CompletedTask;
    }

    public async Task DisposeAsync()
    {
        await _factory.DisposeAsync();
        _greenlit.Dispose();
    }

    private async Task<(HewnClient Owner, Guid ProjectId)> ProjectAsync()
    {
        _factory.GitHub.Seed("northwind", "ledgerline", topics: ["hewn"], files: new()
        {
            [".hewn/skills.lock"] = _greenlit.Lock(_locked, "estimating-designs", "grilling"),
            [".claude/skills/grilling/SKILL.md"] = "Grill.",
            [".claude/skills/estimating-designs/SKILL.md"] = "Estimate.",
            [".claude/skills/house-style/SKILL.md"] = "Ours, kept at bootstrap.",
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
        submitted.EnsureSuccessStatusCode();
        return (owner, (await HewnClient.ReadJsonAsync(submitted)).GetProperty("projectId").GetGuid());
    }

    [Fact]
    public async Task Update_skills_opens_a_pull_request_with_the_new_skill_files_and_lock()
    {
        _greenlit.Commit("grilling: answer for the user when running unattended", (".claude/skills/grilling/SKILL.md", "Grill, unattended."));
        var head = _greenlit.Commit(
            "Add the house-style skill, and writing-html-mocks",
            (".claude/skills/house-style/SKILL.md", "Greenlit's house style."),
            (".agents/skills/writing-html-mocks/SKILL.md", "Mock."));
        var (owner, projectId) = await ProjectAsync();

        var response = await owner.PostAsync($"/api/projects/{projectId}/skills-update", new { });

        Assert.Equal(HttpStatusCode.OK, response.StatusCode);
        var pullRequest = (await HewnClient.ReadJsonAsync(response)).GetProperty("pullRequest");
        var number = pullRequest.GetProperty("number").GetInt32();
        Assert.StartsWith("https://github.com/northwind/ledgerline/pull/", pullRequest.GetProperty("url").GetString());
        var repository = _factory.GitHub.Repository("northwind", "ledgerline")!;
        var pull = repository.PullRequests.Single(p => p.Number == number);
        Assert.Equal($"hewn/update-skills-{head[..7]}", pull.Head);
        Assert.Equal($"Update skills to greenlit@{head[..7]}", pull.Title);
        Assert.Contains("grilling: answer for the user when running unattended", pull.Body);
        var branch = repository.Branches[pull.Head];
        Assert.Equal("Grill, unattended.", Encoding.UTF8.GetString(branch[".claude/skills/grilling/SKILL.md"]));
        Assert.Equal("Mock.", Encoding.UTF8.GetString(branch[".agents/skills/writing-html-mocks/SKILL.md"]));
        // A folder the project had before bootstrap stays its own (L2-007 AC3).
        Assert.Equal("Ours, kept at bootstrap.", Encoding.UTF8.GetString(branch[".claude/skills/house-style/SKILL.md"]));
        var lockFile = System.Text.Json.JsonDocument.Parse(branch[".hewn/skills.lock"]).RootElement;
        Assert.Equal(head, lockFile.GetProperty("sha").GetString());
        Assert.Equal(["estimating-designs", "grilling", "writing-html-mocks"], lockFile.GetProperty("skills").EnumerateArray().Select(s => s.GetString()));
        // The default branch is unchanged until the pull request merges.
        Assert.Contains(_locked, repository.Read(".hewn/skills.lock"));

        var again = await HewnClient.ReadJsonAsync(await owner.PostAsync($"/api/projects/{projectId}/skills-update", new { }));
        Assert.Equal(number, again.GetProperty("pullRequest").GetProperty("number").GetInt32());
        Assert.Single(repository.PullRequests);
        var update = await HewnClient.ReadJsonAsync(await owner.GetAsync($"/api/projects/{projectId}/skills-update"));
        Assert.Equal(number, update.GetProperty("pullRequest").GetProperty("number").GetInt32());
    }

    [Fact]
    public async Task Skills_already_at_Greenlits_head_are_not_updated()
    {
        var (owner, projectId) = await ProjectAsync();

        var response = await owner.PostAsync($"/api/projects/{projectId}/skills-update", new { });

        Assert.Equal(HttpStatusCode.Conflict, response.StatusCode);
        Assert.Equal("skills_up_to_date", (await HewnClient.ReadJsonAsync(response)).GetProperty("code").GetString());
    }

    [Fact]
    public async Task An_unreachable_Greenlit_is_502_and_opens_nothing()
    {
        var (owner, projectId) = await ProjectAsync();
        _greenlit.Dispose();

        var response = await owner.PostAsync($"/api/projects/{projectId}/skills-update", new { });

        Assert.Equal(HttpStatusCode.BadGateway, response.StatusCode);
        var problem = await HewnClient.ReadJsonAsync(response);
        Assert.Equal("greenlit_unreachable", problem.GetProperty("code").GetString());
        Assert.Matches(@"^Greenlit couldn’t be fetched \(git exited with \d+\)$", problem.GetProperty("title").GetString());
        Assert.DoesNotContain(_greenlit.Path, problem.GetRawText());
        Assert.Empty(_factory.GitHub.Repository("northwind", "ledgerline")!.PullRequests);
    }

    [Fact]
    public async Task A_Viewer_cannot_update_skills()
    {
        _greenlit.Commit("grilling: answer for the user", (".claude/skills/grilling/SKILL.md", "Grill, unattended."));
        var (_, projectId) = await ProjectAsync();
        var viewer = await _factory.SignInAsync("ada", Role.Viewer);

        var response = await viewer.PostAsync($"/api/projects/{projectId}/skills-update", new { });

        Assert.Equal(HttpStatusCode.Forbidden, response.StatusCode);
        Assert.Empty(_factory.GitHub.Repository("northwind", "ledgerline")!.PullRequests);
    }
}

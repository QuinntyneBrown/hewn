// Acceptance Test
// Traces to: L2-035
// Description: GET /api/projects/{id}/traceability reads the repository at the default branch's head and gives each L2 its L1, the designs that cover it, the journeys it appears in, the test files whose Traces to: header names it and the pull requests whose titles name it (AC1); an L2 with no test is marked No acceptance test unless it is Deferred (AC2)

using System.Net;
using System.Text.Json;
using Hewn.Api.Tests.Support;
using Hewn.Domain;

namespace Hewn.Api.Tests.Projects;

public sealed class TraceabilityTests : IAsyncLifetime
{
    private readonly HewnApiFactory _factory = new();

    public Task InitializeAsync() => Task.CompletedTask;

    public async Task DisposeAsync() => await _factory.DisposeAsync();

    private const string L1 = """
        # L1 - High-Level Requirements

        ## L1-001: Accounts
        People sign in and manage their accounts.

        ## L1-002: Statement reconciliation
        Reconcile statements against the ledger.
        """;

    private const string L2 = """
        # L2 - Detailed Requirements

        ## L2-001: Sign in with GitHub
        **Traces to:** L1-001

        **Acceptance Criteria:**
        1. Given a visitor, when they sign in, then they see their projects.

        ## L2-002: Match card lines to transactions within a tolerance
        **Traces to:** L1-002

        **Acceptance Criteria:**
        1. Given a statement, when it is reconciled, then lines within the tolerance match.

        ## L2-003: Close a period after review
        **Traces to:** L1-002

        **Acceptance Criteria:**
        1. Given a reviewed period, when it is closed, then it can't change.

        ## L2-004: Reconcile in a second currency
        **Status:** Deferred (Estimated 7 days; could not be split below 3)
        **Traces to:** L1-002

        **Acceptance Criteria:**
        1. Given a statement in another currency, when it is reconciled, then amounts convert.
        """;

    private static Dictionary<string, string> Files() => new()
    {
        ["docs/specs/L1.md"] = L1,
        ["docs/specs/L2.md"] = L2,
        ["docs/detailed-designs/reconciliation/match-card-lines/README.md"] = "# Match card lines\n\n## Requirements\n- L2-002\n",
        ["docs/detailed-designs/reconciliation/close-period/README.md"] = "# Close period\n\nRealizes L2-003 and refines L2-002.\n",
        ["docs/detailed-designs/accounts/sign-in/README.md"] = "# Sign in\n\nCovers L2-001. Not L2-0010.\n",
        ["docs/journeys.md"] = "# User journeys\n\n## 1. Sign in\n\n**Covers:** L2-001\n\n## 4. Close the month\n\n**Covers:** L2-002, L2-003\n",
        ["e2e/tests/reconcile-card-statement.spec.ts"] = "// Acceptance Test\n// Traces to: L2-002\n// Description: Reconcile a card statement\n",
        ["backend/tests/StatementMatcherTests.cs"] = "// Acceptance Test\n// Traces to: L2-001, L2-002\n// Description: Matching\n\nnamespace Tests;\n",
        ["worker/test/sign_in_test.py"] = "# Acceptance Test\n# Traces to: L2-001\n",
        // Named outside the header, or in a document, a requirement is not traced by a test.
        ["backend/tests/LaterTests.cs"] = string.Concat(Enumerable.Repeat("// filler\n", 30)) + "// Traces to: L2-003\n",
        ["docs/notes.md"] = "// Traces to: L2-003\n",
    };

    private async Task<(HewnClient Owner, Guid ProjectId)> ProjectAsync(Dictionary<string, string>? files = null, string repository = "ledgerline")
    {
        _factory.GitHub.Seed("northwind", repository, topics: ["hewn"], files: files ?? Files());
        var owner = await _factory.SignInAsync("quinntynebrown", Role.Owner);
        var submitted = await owner.PostAsync("/api/projects", new
        {
            name = "Ledgerline",
            idea = "A web app for small accounting teams to reconcile statements.",
            stackPreference = (string?)null,
            repositoryUrl = $"https://github.com/northwind/{repository}",
            budgetUsd = 300m,
        });
        submitted.EnsureSuccessStatusCode();
        return (owner, (await HewnClient.ReadJsonAsync(submitted)).GetProperty("projectId").GetGuid());
    }

    private void PullRequest(string title, bool merged) =>
        _factory.GitHub.Repository("northwind", "ledgerline")!.AddPullRequest(title, merged);

    private static async Task<JsonElement> TraceabilityAsync(HewnClient client, Guid projectId)
    {
        var response = await client.GetAsync($"/api/projects/{projectId}/traceability");
        Assert.Equal(HttpStatusCode.OK, response.StatusCode);
        return await HewnClient.ReadJsonAsync(response);
    }

    private static JsonElement Requirement(JsonElement trace, string id) =>
        trace.GetProperty("requirements").EnumerateArray().Single(r => r.GetProperty("id").GetString() == id);

    private static List<string?> Strings(JsonElement requirement, string group, string field) =>
        requirement.GetProperty(group).EnumerateArray().Select(e => e.GetProperty(field).GetString()).ToList();

    [Fact]
    public async Task Each_L2_is_listed_with_its_title_and_its_L1_at_the_head_commit()
    {
        var (owner, projectId) = await ProjectAsync();
        var head = _factory.GitHub.Repository("northwind", "ledgerline")!.Commits[^1].Sha;

        var trace = await TraceabilityAsync(owner, projectId);

        Assert.Equal(head[..7], trace.GetProperty("commit").GetString());
        Assert.Equal(["L2-001", "L2-002", "L2-003", "L2-004"], trace.GetProperty("requirements").EnumerateArray().Select(r => r.GetProperty("id").GetString()));
        var matching = Requirement(trace, "L2-002");
        Assert.Equal("Match card lines to transactions within a tolerance", matching.GetProperty("title").GetString());
        Assert.Equal("L1-002", matching.GetProperty("l1").GetProperty("id").GetString());
        Assert.Equal("Statement reconciliation", matching.GetProperty("l1").GetProperty("title").GetString());
    }

    [Fact]
    public async Task An_L2_traces_to_the_designs_journeys_tests_and_pull_requests_that_name_it()
    {
        var (owner, projectId) = await ProjectAsync();
        PullRequest("Sign in (journey 1, L2-001)", merged: true);
        PullRequest("Reconcile a card statement (journey 4, L2-002)", merged: false);
        PullRequest("Export to CSV (journey 9, L2-0020)", merged: true);

        var trace = await TraceabilityAsync(owner, projectId);

        var matching = Requirement(trace, "L2-002");
        Assert.Equal(["Close period", "Match card lines"], Strings(matching, "designs", "title"));
        Assert.Equal("docs/detailed-designs/reconciliation/close-period/README.md", Strings(matching, "designs", "path")[0]);
        Assert.Equal([4], matching.GetProperty("journeys").EnumerateArray().Select(j => j.GetProperty("number").GetInt32()));
        Assert.Equal(["Close the month"], Strings(matching, "journeys", "title"));
        Assert.Equal(["backend/tests/StatementMatcherTests.cs", "e2e/tests/reconcile-card-statement.spec.ts"], matching.GetProperty("tests").EnumerateArray().Select(t => t.GetString()));
        var pull = Assert.Single(matching.GetProperty("pullRequests").EnumerateArray());
        Assert.Equal(2, pull.GetProperty("number").GetInt32());
        Assert.Equal("Reconcile a card statement (journey 4, L2-002)", pull.GetProperty("title").GetString());
        Assert.False(pull.GetProperty("merged").GetBoolean());
        Assert.False(matching.GetProperty("noAcceptanceTest").GetBoolean());

        // An ID is matched whole: L2-0010 and L2-0020 don't name L2-001 or L2-002.
        var signIn = Requirement(trace, "L2-001");
        Assert.Equal(["Sign in"], Strings(signIn, "designs", "title"));
        Assert.Equal(["backend/tests/StatementMatcherTests.cs", "worker/test/sign_in_test.py"], signIn.GetProperty("tests").EnumerateArray().Select(t => t.GetString()));
        Assert.Equal([1], signIn.GetProperty("pullRequests").EnumerateArray().Select(p => p.GetProperty("number").GetInt32()));
        Assert.True(signIn.GetProperty("pullRequests")[0].GetProperty("merged").GetBoolean());
    }

    [Fact]
    public async Task An_L2_with_no_test_is_marked_No_acceptance_test_unless_it_is_Deferred()
    {
        var (owner, projectId) = await ProjectAsync();

        var trace = await TraceabilityAsync(owner, projectId);

        // Named after line 20 of a test, or in a document, is not a Traces to: header.
        var close = Requirement(trace, "L2-003");
        Assert.Empty(close.GetProperty("tests").EnumerateArray());
        Assert.True(close.GetProperty("noAcceptanceTest").GetBoolean());
        Assert.Equal(JsonValueKind.Null, close.GetProperty("deferred").ValueKind);

        var currency = Requirement(trace, "L2-004");
        Assert.Equal("Estimated 7 days; could not be split below 3", currency.GetProperty("deferred").GetString());
        Assert.Empty(currency.GetProperty("tests").EnumerateArray());
        Assert.False(currency.GetProperty("noAcceptanceTest").GetBoolean());
    }

    [Fact]
    public async Task A_project_before_stage_5_has_no_requirements()
    {
        var (owner, projectId) = await ProjectAsync(new() { ["docs/brief.md"] = "# Brief\n" });

        var trace = await TraceabilityAsync(owner, projectId);

        Assert.Empty(trace.GetProperty("requirements").EnumerateArray());
    }

    [Fact]
    public async Task An_unexpected_L2_heading_is_a_502_that_names_the_commit_and_the_line()
    {
        var files = Files();
        files["docs/specs/L2.md"] = L2 + "\n## L2-005 Missing its colon\n";
        var (owner, projectId) = await ProjectAsync(files);
        var head = _factory.GitHub.Repository("northwind", "ledgerline")!.Commits[^1].Sha;

        var response = await owner.GetAsync($"/api/projects/{projectId}/traceability");

        Assert.Equal(HttpStatusCode.BadGateway, response.StatusCode);
        var problem = await HewnClient.ReadJsonAsync(response);
        Assert.Equal("github_failed", problem.GetProperty("code").GetString());
        var line = L2.Split('\n').Length + 1;
        Assert.Equal($"docs/specs/L2.md couldn’t be parsed at {head[..7]} (unexpected heading on line {line})", problem.GetProperty("title").GetString());
    }

    [Fact]
    public async Task Viewers_read_the_trace_and_an_unknown_project_is_404()
    {
        var (_, projectId) = await ProjectAsync();
        var viewer = await _factory.SignInAsync("ada", Role.Viewer);

        var trace = await TraceabilityAsync(viewer, projectId);

        Assert.Equal(4, trace.GetProperty("requirements").GetArrayLength());
        Assert.Equal(HttpStatusCode.NotFound, (await viewer.GetAsync($"/api/projects/{Guid.NewGuid()}/traceability")).StatusCode);
        using var anonymous = _factory.CreateClient();
        Assert.Equal(HttpStatusCode.Unauthorized, (await anonymous.GetAsync($"/api/projects/{projectId}/traceability")).StatusCode);
    }
}

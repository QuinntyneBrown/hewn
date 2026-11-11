// Acceptance Test
// Traces to: L2-044
// Description: Sign-ins, direction submissions, pause, resume, cancel, stop all, start workers, token creation and revocation, and merges each write an audit entry with who, what, when and from which IP; Owners list entries newest first, filtered by project and action, a page at a time; Viewers are forbidden; no API edits an entry, the database refuses to change one, and deleting a project keeps its entries (AC1, AC2)

using System.Net;
using System.Net.Http.Json;
using System.Text;
using System.Text.Json;
using Hewn.Api.Tests.Support;
using Hewn.Domain;
using Microsoft.AspNetCore.Mvc.Testing;
using Microsoft.EntityFrameworkCore;

namespace Hewn.Api.Tests.Audit;

public sealed class AuditLogTests : IAsyncLifetime
{
    private const string OwnerIp = "24.114.38.91";

    private readonly HewnApiFactory _factory = new();

    public Task InitializeAsync() => Task.CompletedTask;

    public async Task DisposeAsync() => await _factory.DisposeAsync();

    /// <summary>Signs in through the API from <paramref name="ip"/>, as a browser behind Hewn's proxy would.</summary>
    private async Task<HewnClient> SignInFromAsync(string login, Role role, string ip)
    {
        await _factory.SeedAsync(db =>
        {
            if (!db.AllowList.Any(a => a.Login == login))
            {
                db.AllowList.Add(new AllowListEntry(login, role));
            }
        });
        var http = _factory.CreateClient(new WebApplicationFactoryClientOptions { HandleCookies = true, BaseAddress = new Uri("https://localhost") });
        http.DefaultRequestHeaders.Add("X-Forwarded-For", ip);
        var response = await http.PostAsJsonAsync("/api/auth/dev/sign-in", new { login });
        response.EnsureSuccessStatusCode();
        var session = response.Headers.GetValues("Set-Cookie").First(c => c.StartsWith("hewn.session=", StringComparison.Ordinal));
        return await HewnClient.CreateAsync(http, session.Split(';')[0]);
    }

    private static async Task<Guid> SubmitAsync(HewnClient owner, string name)
    {
        var submitted = await owner.PostAsync("/api/projects", new
        {
            name,
            idea = "A web app for small accounting teams to reconcile statements.",
            stackPreference = (string?)null,
            repositoryUrl = (string?)null,
            budgetUsd = 300m,
        });
        Assert.Equal(HttpStatusCode.Created, submitted.StatusCode);
        return (await HewnClient.ReadJsonAsync(submitted)).GetProperty("projectId").GetGuid();
    }

    private static async Task<Guid> DirectionAsync(HewnClient client, Guid projectId) =>
        (await HewnClient.ReadJsonAsync(await client.GetAsync($"/api/projects/{projectId}"))).GetProperty("directions")[0].GetProperty("id").GetGuid();

    private static async Task<JsonElement> AuditAsync(HewnClient client, string query = "")
    {
        var response = await client.GetAsync($"/api/audit{query}");
        Assert.Equal(HttpStatusCode.OK, response.StatusCode);
        return await HewnClient.ReadJsonAsync(response);
    }

    private static List<JsonElement> Entries(JsonElement page) => page.GetProperty("entries").EnumerateArray().ToList();

    private static string? Str(JsonElement e, string name) => e.GetProperty(name).ValueKind == JsonValueKind.Null ? null : e.GetProperty(name).GetString();

    [Fact]
    public async Task Each_audited_action_records_who_what_when_and_from_where()
    {
        var owner = await SignInFromAsync("quinntynebrown", Role.Owner, OwnerIp);
        var projectId = await SubmitAsync(owner, "Tidewater");
        var directionId = await DirectionAsync(owner, projectId);
        var worker = await _factory.RegisterWorkerAsync();
        var run = (await worker.LeaseAsync())!;
        (await owner.PostAsync($"/api/projects/{projectId}/directions/{directionId}/pause", new { })).EnsureSuccessStatusCode();
        // The step in progress finishes; at its checkpoint the direction pauses.
        (await worker.CheckpointAsync(run, 1)).EnsureSuccessStatusCode();
        (await owner.PostAsync($"/api/projects/{projectId}/directions/{directionId}/resume", new { })).EnsureSuccessStatusCode();
        (await owner.PostAsync($"/api/projects/{projectId}/directions/{directionId}/cancel", new { })).EnsureSuccessStatusCode();
        (await owner.PostAsync("/api/workers/stop", new { })).EnsureSuccessStatusCode();
        (await owner.PostAsync("/api/workers/start", new { })).EnsureSuccessStatusCode();
        var created = await owner.PostAsync("/api/worker-tokens", new { name = "build-box-01", location = "Local", expiresInDays = 90 });
        var token = (await HewnClient.ReadJsonAsync(created)).GetProperty("token").GetString()!;
        var boxed = await WorkerClient.RegisterAsync(_factory.CreateAnonymousClient(), token, "build-box-01");
        (await owner.PostAsync($"/api/workers/{boxed.WorkerId}/revoke", new { })).EnsureSuccessStatusCode();

        var entries = Entries(await AuditAsync(owner));

        Assert.Equal(
            ["TokenRevoked", "TokenCreated", "StartWorkers", "StopAll", "Cancel", "Resume", "Pause", "DirectionSubmitted", "SignIn"],
            entries.Select(e => e.GetProperty("action").GetString()));
        Assert.All(entries, e =>
        {
            Assert.Equal("quinntynebrown", e.GetProperty("actor").GetString());
            Assert.Equal(OwnerIp, Str(e, "ipAddress"));
            Assert.True(e.GetProperty("at").GetDateTimeOffset() > DateTimeOffset.UtcNow.AddMinutes(-1));
        });
        Assert.Equal(
            ["build-box-01", "build-box-01", "All projects", "All projects", "Tidewater", "Tidewater", "Tidewater", "Tidewater", null],
            entries.Select(e => Str(e, "target")));
        Assert.All(entries.Where(e => Str(e, "target") == "Tidewater"), e => Assert.Equal(projectId, e.GetProperty("projectId").GetGuid()));
        Assert.All(entries.Where(e => Str(e, "target") != "Tidewater"), e => Assert.Equal(JsonValueKind.Null, e.GetProperty("projectId").ValueKind));
        // Ordered by when, newest first.
        Assert.Equal(entries.Select(e => e.GetProperty("at").GetDateTimeOffset()).OrderByDescending(t => t), entries.Select(e => e.GetProperty("at").GetDateTimeOffset()));
    }

    [Fact]
    public async Task A_merge_is_recorded_for_whoever_submitted_the_direction_with_no_IP()
    {
        var owner = await SignInFromAsync("quinntynebrown", Role.Owner, OwnerIp);
        var projectId = await SubmitAsync(owner, "Ledgerline");
        var worker = await _factory.RegisterWorkerAsync();
        LeasedRun run;
        while ((run = (await worker.LeaseAsync())!).Stage != 6)
        {
            (await worker.SucceedAsync(run)).EnsureSuccessStatusCode();
        }

        (await MutateAsync(worker, run, "commit", "commit", new
        {
            message = "Scaffold the solution",
            branch = "hewn/scaffold",
            files = new[] { new { path = "README.md", contentBase64 = Convert.ToBase64String(Encoding.UTF8.GetBytes("# Ledgerline\n")) } },
        })).EnsureSuccessStatusCode();
        var opened = await MutateAsync(worker, run, "open_pull_request", "open", new { head = "hewn/scaffold", title = "Scaffold the solution", body = "Generated by Hewn." });
        var number = (await HewnClient.ReadJsonAsync(opened)).GetProperty("number").GetInt32();
        (await MutateAsync(worker, run, "merge_pull_request", "merge", new { number })).EnsureSuccessStatusCode();
        // A retried merge (the same idempotency key) is recorded once.
        (await MutateAsync(worker, run, "merge_pull_request", "merge", new { number })).EnsureSuccessStatusCode();

        var merges = Entries(await AuditAsync(owner, "?action=Merge"));

        var merge = Assert.Single(merges);
        Assert.Equal("quinntynebrown", merge.GetProperty("actor").GetString());
        Assert.Equal($"Ledgerline #{number}", Str(merge, "target"));
        Assert.Equal(projectId, merge.GetProperty("projectId").GetGuid());
        Assert.Null(Str(merge, "ipAddress"));
    }

    private static Task<HttpResponseMessage> MutateAsync(WorkerClient worker, LeasedRun run, string kind, string key, object fields)
    {
        var body = JsonSerializer.SerializeToElement(fields).EnumerateObject().ToDictionary(p => p.Name, p => (object?)p.Value);
        body["workerId"] = worker.WorkerId;
        body["epoch"] = run.Epoch;
        body["kind"] = kind;
        body["idempotencyKey"] = $"{run.RunId}/{key}";
        return worker.Http.PostAsJsonAsync($"/api/worker/runs/{run.RunId}/github/mutations", body);
    }

    [Fact]
    public async Task Owners_filter_by_project_and_action_and_page_newest_first()
    {
        var owner = await SignInFromAsync("quinntynebrown", Role.Owner, OwnerIp);
        var ledgerline = await SubmitAsync(owner, "Ledgerline");
        var tidewater = await SubmitAsync(owner, "Tidewater");
        (await owner.PostAsync($"/api/projects/{tidewater}/directions/{await DirectionAsync(owner, tidewater)}/cancel", new { })).EnsureSuccessStatusCode();
        (await owner.PostAsync("/api/workers/stop", new { })).EnsureSuccessStatusCode();

        var all = await AuditAsync(owner);
        var projects = all.GetProperty("projects").EnumerateArray().Select(p => (p.GetProperty("id").GetGuid(), p.GetProperty("name").GetString())).ToList();
        Assert.Equal([(tidewater, "Tidewater"), (ledgerline, "Ledgerline")], projects);

        var tidewaterOnly = Entries(await AuditAsync(owner, $"?project={tidewater}"));
        Assert.Equal(["Cancel", "DirectionSubmitted"], tidewaterOnly.Select(e => e.GetProperty("action").GetString()));
        var submissions = Entries(await AuditAsync(owner, "?action=DirectionSubmitted"));
        Assert.Equal(["Tidewater", "Ledgerline"], submissions.Select(e => Str(e, "target")));
        Assert.Empty(Entries(await AuditAsync(owner, $"?project={ledgerline}&action=StopAll")));

        var first = await AuditAsync(owner, "?limit=2");
        Assert.Equal(["StopAll", "Cancel"], Entries(first).Select(e => e.GetProperty("action").GetString()));
        var next = first.GetProperty("next").GetString();
        var second = await AuditAsync(owner, $"?limit=2&before={next}");
        Assert.Equal(["DirectionSubmitted", "DirectionSubmitted"], Entries(second).Select(e => e.GetProperty("action").GetString()));
        var last = await AuditAsync(owner, $"?limit=2&before={second.GetProperty("next").GetString()}");
        Assert.Equal(["SignIn"], Entries(last).Select(e => e.GetProperty("action").GetString()));
        Assert.Equal(JsonValueKind.Null, last.GetProperty("next").ValueKind);

        Assert.Equal(HttpStatusCode.BadRequest, (await owner.GetAsync("/api/audit?action=Delete")).StatusCode);
    }

    [Fact]
    public async Task Only_Owners_read_the_audit_log()
    {
        await SignInFromAsync("quinntynebrown", Role.Owner, OwnerIp);
        var viewer = await SignInFromAsync("ada", Role.Viewer, "99.230.12.4");

        Assert.Equal(HttpStatusCode.Forbidden, (await viewer.GetAsync("/api/audit")).StatusCode);
        Assert.Equal(HttpStatusCode.Unauthorized, (await _factory.CreateAnonymousClient().GetAsync("/api/audit")).StatusCode);
    }

    [Fact]
    public async Task No_API_edits_an_entry_and_the_database_refuses_to()
    {
        var owner = await SignInFromAsync("quinntynebrown", Role.Owner, OwnerIp);
        var entry = Assert.Single(Entries(await AuditAsync(owner)));
        var id = entry.GetProperty("id").GetInt64();

        foreach (var method in new[] { "PUT", "PATCH", "DELETE", "POST" })
        {
            foreach (var url in new[] { "/api/audit", $"/api/audit/{id}" })
            {
                var response = await owner.SendAsync(method, url, new { actor = "someone-else", action = "Merge" });
                Assert.True(response.StatusCode is HttpStatusCode.MethodNotAllowed or HttpStatusCode.NotFound, $"{method} {url} answered {(int)response.StatusCode}");
            }
        }

        Assert.Equal(entry.ToString(), Assert.Single(Entries(await AuditAsync(owner))).ToString());

        var update = await Record.ExceptionAsync(() => _factory.QueryAsync(db => db.Database.ExecuteSqlRawAsync("UPDATE audit_entries SET Actor = 'someone-else'")));
        Assert.Contains("append-only", update?.Message);
        var delete = await Record.ExceptionAsync(() => _factory.QueryAsync(db => db.Database.ExecuteSqlRawAsync("DELETE FROM audit_entries")));
        Assert.Contains("append-only", delete?.Message);
        Assert.Single(Entries(await AuditAsync(owner)));
    }

    [Fact]
    public async Task Deleting_a_project_keeps_its_entries()
    {
        var owner = await SignInFromAsync("quinntynebrown", Role.Owner, OwnerIp);
        var projectId = await SubmitAsync(owner, "Harbor CRM");
        (await owner.PostAsync($"/api/projects/{projectId}/directions/{await DirectionAsync(owner, projectId)}/cancel", new { })).EnsureSuccessStatusCode();
        (await owner.SendAsync("DELETE", $"/api/projects/{projectId}", new { confirmName = "Harbor CRM" })).EnsureSuccessStatusCode();

        var page = await AuditAsync(owner, $"?project={projectId}");

        Assert.Equal(["Cancel", "DirectionSubmitted"], Entries(page).Select(e => e.GetProperty("action").GetString()));
        Assert.All(Entries(page), e => Assert.Equal("Harbor CRM", Str(e, "target")));
        Assert.Contains(page.GetProperty("projects").EnumerateArray(), p => p.GetProperty("name").GetString() == "Harbor CRM");
    }
}

using System.Text.Json.Serialization;
using Hewn.Api.Auth;
using Hewn.Api.Designs;
using Hewn.Api.Errors;
using Hewn.Api.MissionControl;
using Hewn.Api.Hubs;
using Hewn.Api.Pipeline;
using Hewn.Application;
using Hewn.Application.Abstractions;
using Hewn.Infrastructure;

var builder = WebApplication.CreateBuilder(args);

builder.Services.AddApplication();
builder.Services.AddInfrastructure(builder.Configuration);
builder.Services.AddHttpContextAccessor();
builder.Services.AddScoped<ICurrentUser, HttpCurrentUser>();
builder.Services.AddHewnAuth();
builder.Services.AddAntiforgery(o => o.HeaderName = "X-XSRF-TOKEN");
builder.Services.AddProblemDetails();
builder.Services.AddExceptionHandler<ApplicationExceptionHandler>();
builder.Services.AddSignalR();
builder.Services.AddSingleton<IProjectEventPublisher, SignalRProjectEventPublisher>();
builder.Services.AddSingleton<IWorkersNotifier, SignalRWorkersNotifier>();
if (builder.Configuration.GetValue("Hewn:Leases:ReaperEnabled", true))
{
    builder.Services.AddHostedService<LeaseReaper>();
}

if (builder.Configuration.GetValue("Hewn:Workers:PresenceWatcherEnabled", true))
{
    builder.Services.AddHostedService<WorkerPresenceWatcher>();
}

if (builder.Configuration.GetValue("Hewn:Checks:PollerEnabled", true))
{
    builder.Services.AddHostedService<CheckPollerService>();
}

if (builder.Configuration.GetValue("Hewn:Skills:MergerEnabled", true))
{
    builder.Services.AddHostedService<SkillsUpdateMergerService>();
}

builder.Services
    .AddControllers(o => o.Filters.Add<ValidateAntiforgeryFilter>())
    .AddJsonOptions(o => o.JsonSerializerOptions.Converters.Add(new JsonStringEnumConverter()));

var app = builder.Build();

app.UseSecurityHeaders();
app.UseExceptionHandler();
app.UseStatusCodePages();
app.UseMissionControlFiles();
app.UseAuthentication();
app.UseAuthorization();
app.MapControllers();
app.MapHub<MissionControlHub>(MissionControlHub.Path);
app.MapPreview();
app.MapGet("/health/live", () => Results.Ok(new { status = "Healthy" })).AllowAnonymous();
app.MapMissionControl();

if (app.Configuration.GetValue<bool>("Hewn:Fakes:Enabled"))
{
    // The e2e stack and demos only: a repository as the fake GitHub holds it, so a test can see that stage 0 made it
    // private and stage 6 protected its default branch (L2-036).
    app.MapGet("/api/fakes/github/{owner}/{name}", (string owner, string name, Hewn.Infrastructure.Fakes.InMemoryGitHub gitHub) =>
        gitHub.Repository(owner, name) is { } repository
            ? Results.Ok(new { repository.Owner, repository.Name, Private = repository.IsPrivate, Topics = repository.Topics.ToList(), RequiredChecks = repository.RequiredChecks.ToList() })
            : Results.NotFound());

    // The e2e stack and demos only: what the fake GitHub holds, so a test can see a pull request's labels.
    app.MapGet("/api/fakes/github/{owner}/{name}/pulls", (string owner, string name, Hewn.Infrastructure.Fakes.InMemoryGitHub gitHub) =>
        gitHub.Repository(owner, name) is { } repository
            ? Results.Ok(repository.PullRequests.Select(p => new { p.Number, p.Title, p.Head, p.Open, p.Merged, Labels = p.Labels.ToList() }).ToList())
            : Results.NotFound());

    // Each commit on a fake repository with the paths it wrote, so a test can see what a linked commit recorded.
    app.MapGet("/api/fakes/github/{owner}/{name}/commits", (string owner, string name, Hewn.Infrastructure.Fakes.InMemoryGitHub gitHub) =>
        gitHub.Repository(owner, name) is { } repository
            ? Results.Ok(repository.Commits.Select(c => new { c.Sha, c.Message, c.Paths }).ToList())
            : Results.NotFound());

    // A file's text at a commit (or the head), so a test or a video can show what a commit recorded.
    app.MapGet("/api/fakes/github/{owner}/{name}/contents/{**path}", (string owner, string name, string path, string? @ref, Hewn.Infrastructure.Fakes.InMemoryGitHub gitHub) =>
    {
        var repository = gitHub.Repository(owner, name);
        var files = repository is null ? null : @ref is null ? repository.Files : repository.Snapshots.GetValueOrDefault(@ref);
        return files is not null && files.TryGetValue(path, out var bytes)
            ? Results.Text(System.Text.Encoding.UTF8.GetString(bytes), "text/plain; charset=utf-8")
            : Results.NotFound();
    });

    // Commits files to a fake repository, making it when it doesn't exist, as stage 2 or someone outside Hewn would.
    app.MapPut("/api/fakes/github/{owner}/{name}/files", (string owner, string name, Dictionary<string, string> files, Hewn.Infrastructure.Fakes.InMemoryGitHub gitHub) =>
    {
        var repository = gitHub.Repository(owner, name) ?? gitHub.Seed(owner, name, topics: ["hewn"]);
        var sha = string.Empty;
        foreach (var (path, content) in files)
        {
            sha = repository.Write(path, content);
        }

        return Results.Ok(new { sha });
    });

    // Opens (and optionally merges) a pull request on a fake repository, as someone outside Hewn would.
    app.MapPost("/api/fakes/github/{owner}/{name}/pulls", (string owner, string name, FakePullRequestRequest request, Hewn.Infrastructure.Fakes.InMemoryGitHub gitHub) =>
        Results.Ok(new { Number = gitHub.AddPullRequest(owner, name, request.Title, request.Merged, request.Head) }));

    // How long each check takes in the fake CI, so a test or a video can watch checks turn green (0: at once).
    // GitHub's authorize page for sign-in (L2-038): choose a login, or cancel, and come back as GitHub would.
    app.MapGet("/api/fakes/github/login/oauth/authorize", (string? redirect_uri, string? state) =>
    {
        static string Attr(string? value) => System.Net.WebUtility.HtmlEncode(value ?? "");
        return Results.Content($$"""
            <!doctype html><html lang="en"><head><meta charset="utf-8"><title>Sign in to GitHub · e2e fake</title>
            <style>body{font:16px/1.5 system-ui,sans-serif;margin:0;display:grid;place-items:center;min-height:100vh;background:#f6f8fa;color:#1f2328}
            main{background:#fff;border:1px solid #d1d9e0;border-radius:6px;padding:24px 32px;width:340px}h1{font-size:20px;margin:0 0 4px}
            p{margin:0 0 16px;color:#59636e;font-size:14px}label{display:block;font-size:14px;font-weight:600;margin-bottom:6px}
            input{box-sizing:border-box;width:100%;padding:6px 8px;font:inherit;border:1px solid #d1d9e0;border-radius:6px;margin-bottom:16px}
            button,a{display:block;box-sizing:border-box;width:100%;padding:6px;border-radius:6px;font:inherit;font-weight:600;text-align:center;text-decoration:none}
            button{background:#1f883d;color:#fff;border:0;margin-bottom:8px}a{border:1px solid #d1d9e0;color:#1f2328}</style></head>
            <body><main><h1>Authorize Hewn</h1><p>e2e fake GitHub: sign in as any login.</p>
            <form method="get" action="/api/fakes/github/login/oauth/approve">
            <input type="hidden" name="redirect_uri" value="{{Attr(redirect_uri)}}"><input type="hidden" name="state" value="{{Attr(state)}}">
            <label for="login">GitHub login</label><input id="login" name="login" autocomplete="off" required>
            <button type="submit">Authorize</button></form>
            <a href="/api/fakes/github/login/oauth/approve?cancel=true&amp;redirect_uri={{Uri.EscapeDataString(redirect_uri ?? "")}}&amp;state={{Uri.EscapeDataString(state ?? "")}}">Cancel</a>
            </main></body></html>
            """, "text/html");
    }).AllowAnonymous();
    app.MapGet("/api/fakes/github/login/oauth/approve", (string? login, string? redirect_uri, string? state, bool? cancel, IConfiguration configuration) =>
    {
        // Back to Mission Control's callback only, so the fake can't be used as an open redirect.
        var callback = $"{configuration["Hewn:Auth:PublicOrigin"]?.TrimEnd('/')}/api/auth/github/callback";
        if (redirect_uri != callback)
        {
            return Results.BadRequest();
        }

        var answer = cancel == true ? "error=access_denied" : $"code={Uri.EscapeDataString($"fake-{login?.Trim()}")}";
        return Results.Redirect($"{redirect_uri}?{answer}&state={Uri.EscapeDataString(state ?? "")}");
    }).AllowAnonymous();

    app.MapPut("/api/fakes/github/check-seconds", (CheckPace pace, Hewn.Infrastructure.Fakes.InMemoryGitHub gitHub) =>
    {
        gitHub.CheckSeconds = Math.Clamp(pace.Seconds, 0, 600);
        return Results.NoContent();
    });
}

app.Run();

public partial class Program;

internal sealed record CheckPace(double Seconds);

internal sealed record FakePullRequestRequest(string Title, string? Head, bool Merged);

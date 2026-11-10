using System.Text.Json.Serialization;
using Hewn.Api.Auth;
using Hewn.Api.Designs;
using Hewn.Api.Errors;
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
if (builder.Configuration.GetValue("Hewn:Leases:ReaperEnabled", true))
{
    builder.Services.AddHostedService<LeaseReaper>();
}

if (builder.Configuration.GetValue("Hewn:Checks:PollerEnabled", true))
{
    builder.Services.AddHostedService<CheckPollerService>();
}

builder.Services
    .AddControllers(o => o.Filters.Add<ValidateAntiforgeryFilter>())
    .AddJsonOptions(o => o.JsonSerializerOptions.Converters.Add(new JsonStringEnumConverter()));

var app = builder.Build();

app.UseExceptionHandler();
app.UseStatusCodePages();
app.UseAuthentication();
app.UseAuthorization();
app.MapControllers();
app.MapHub<MissionControlHub>(MissionControlHub.Path);
app.MapPreview();
app.MapGet("/health/live", () => Results.Ok(new { status = "Healthy" })).AllowAnonymous();

if (app.Configuration.GetValue<bool>("Hewn:Fakes:Enabled"))
{
    // The e2e stack and demos only: what the fake GitHub holds, so a test can see a pull request's labels.
    app.MapGet("/api/fakes/github/{owner}/{name}/pulls", (string owner, string name, Hewn.Infrastructure.Fakes.InMemoryGitHub gitHub) =>
        gitHub.Repository(owner, name) is { } repository
            ? Results.Ok(repository.PullRequests.Select(p => new { p.Number, p.Title, p.Head, p.Open, p.Merged, Labels = p.Labels.ToList() }).ToList())
            : Results.NotFound());

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

    // How long each check takes in the fake CI, so a test or a video can watch checks turn green (0: at once).
    app.MapPut("/api/fakes/github/check-seconds", (CheckPace pace, Hewn.Infrastructure.Fakes.InMemoryGitHub gitHub) =>
    {
        gitHub.CheckSeconds = Math.Clamp(pace.Seconds, 0, 600);
        return Results.NoContent();
    });
}

app.Run();

public partial class Program;

internal sealed record CheckPace(double Seconds);

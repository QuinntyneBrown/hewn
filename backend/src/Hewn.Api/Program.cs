using System.Text.Json.Serialization;
using Hewn.Api.Auth;
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
app.MapGet("/health/live", () => Results.Ok(new { status = "Healthy" })).AllowAnonymous();

if (app.Configuration.GetValue<bool>("Hewn:Fakes:Enabled"))
{
    // The e2e stack and demos only: what the fake GitHub holds, so a test can see a pull request's labels.
    app.MapGet("/api/fakes/github/{owner}/{name}/pulls", (string owner, string name, Hewn.Infrastructure.Fakes.InMemoryGitHub gitHub) =>
        gitHub.Repository(owner, name) is { } repository
            ? Results.Ok(repository.PullRequests.Select(p => new { p.Number, p.Title, p.Head, p.Open, p.Merged, Labels = p.Labels.ToList() }).ToList())
            : Results.NotFound());
}

app.Run();

public partial class Program;

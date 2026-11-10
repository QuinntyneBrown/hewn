// Acceptance Test
// Traces to: L2-039
// Description: A project the caller cannot access answers every project route with the same 404 as one that never existed, for Owners and Viewers alike, so nothing reveals that it exists (AC2)

using System.Net;
using Hewn.Api.Tests.Support;
using Hewn.Domain;
using Microsoft.AspNetCore.Routing;
using Microsoft.Extensions.DependencyInjection;

namespace Hewn.Api.Tests.Projects;

public sealed class ProjectVisibilityTests : IAsyncLifetime
{
    private readonly HewnApiFactory _factory = new();

    public Task InitializeAsync() => Task.CompletedTask;

    public async Task DisposeAsync() => await _factory.DisposeAsync();

    /// <summary>Every GET route under a project, for a project id nobody can see.</summary>
    private IEnumerable<string> ProjectReads(Guid projectId) =>
        _factory.Services.GetServices<EndpointDataSource>()
            .SelectMany(s => s.Endpoints).OfType<RouteEndpoint>()
            .Where(e => e.Metadata.GetMetadata<HttpMethodMetadata>()?.HttpMethods.Contains("GET") == true)
            .Select(e => e.RoutePattern.RawText!.TrimStart('/'))
            .Where(p => p.StartsWith("api/projects/{", StringComparison.Ordinal))
            .Distinct()
            .Select(p => "/" + System.Text.RegularExpressions.Regex.Replace(p, @"\{\*?\*?(\w+)[^}]*\}", m =>
                m.Groups[1].Value is "id" or "projectId" ? projectId.ToString()
                : m.Groups[1].Value.EndsWith("Id", StringComparison.Ordinal) ? Guid.NewGuid().ToString()
                : "1"));

    [Theory]
    [InlineData(Role.Owner)]
    [InlineData(Role.Viewer)]
    public async Task Every_project_route_answers_the_same_404(Role role)
    {
        var client = await _factory.SignInAsync(role == Role.Owner ? "quinntynebrown" : "ada", role);
        var reads = ProjectReads(Guid.NewGuid()).ToList();
        Assert.True(reads.Count >= 10, $"only {reads.Count} project routes found");

        var answers = new List<string>();
        foreach (var url in reads)
        {
            var response = await client.GetAsync(url);
            var body = await response.Content.ReadAsStringAsync();
            var code = response.StatusCode == HttpStatusCode.NotFound && body.Length > 0
                && System.Text.Json.JsonDocument.Parse(body).RootElement.TryGetProperty("code", out var c)
                ? c.GetString()
                : $"HTTP {(int)response.StatusCode} {body}";
            answers.Add($"{url}: {code}");
        }

        Assert.All(answers, a => Assert.EndsWith(": not_found", a));
    }
}

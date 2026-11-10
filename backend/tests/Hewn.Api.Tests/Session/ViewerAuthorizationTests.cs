// Acceptance Test
// Traces to: L2-039
// Description: A Viewer gets 403 from every endpoint that changes state, whatever the request holds, and nothing changes (AC1)

using System.Net;
using Hewn.Api.Tests.Support;
using Hewn.Domain;
using Microsoft.AspNetCore.Routing;
using Microsoft.Extensions.DependencyInjection;

namespace Hewn.Api.Tests.Session;

public sealed class ViewerAuthorizationTests : IAsyncLifetime
{
    // Not Mission Control's state changes: signing in and out, workers (their own token), GitHub's webhook, the e2e fakes.
    private static readonly string[] OtherCallers = ["api/auth/", "api/worker/", "api/github/webhook", "api/fakes/"];

    private readonly HewnApiFactory _factory = new();

    public Task InitializeAsync() => Task.CompletedTask;

    public async Task DisposeAsync() => await _factory.DisposeAsync();

    /// <summary>Every route with a method that changes state, with its parameters filled in.</summary>
    private IEnumerable<(string Method, string Url)> StateChanges()
    {
        var sources = _factory.Services.GetServices<EndpointDataSource>();
        foreach (var endpoint in sources.SelectMany(s => s.Endpoints).OfType<RouteEndpoint>())
        {
            var pattern = endpoint.RoutePattern.RawText!.TrimStart('/');
            if (OtherCallers.Any(p => pattern.StartsWith(p, StringComparison.OrdinalIgnoreCase)))
            {
                continue;
            }

            var methods = endpoint.Metadata.GetMetadata<HttpMethodMetadata>()?.HttpMethods ?? [];
            foreach (var method in methods.Where(m => m is not ("GET" or "HEAD" or "OPTIONS")))
            {
                var url = System.Text.RegularExpressions.Regex.Replace(pattern, @"\{\*?\*?(\w+)[^}]*\}", m =>
                    m.Groups[1].Value.EndsWith("Id", StringComparison.Ordinal) || m.Groups[1].Value == "id" ? Guid.NewGuid().ToString() : "1");
                yield return (method, "/" + url);
            }
        }
    }

    [Fact]
    public async Task Every_state_changing_endpoint_answers_a_Viewer_with_403()
    {
        var viewer = await _factory.SignInAsync("ada", Role.Viewer);
        var changes = StateChanges().ToList();
        Assert.True(changes.Count >= 10, $"only {changes.Count} state-changing endpoints found");

        var allowed = new List<string>();
        foreach (var (method, url) in changes)
        {
            var response = await viewer.SendAsync(method, url, new { });
            if (response.StatusCode != HttpStatusCode.Forbidden)
            {
                allowed.Add($"{method} {url}: {(int)response.StatusCode}");
            }
        }

        Assert.Empty(allowed);
    }
}

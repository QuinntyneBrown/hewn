// Acceptance Test
// Traces to: L2-040
// Description: Credentials an operator supplies are kept in the secret store and reach the API from there; settings
// show each one only as a reference with its last-updated time, and no response contains a value (AC1)

using System.Net;
using System.Security.Cryptography;
using System.Text;
using System.Text.Json;
using Hewn.Api.Tests.Support;
using Hewn.Application.Abstractions;
using Hewn.Domain;
using Microsoft.Extensions.DependencyInjection;

namespace Hewn.Api.Tests.Settings;

public sealed class ProtectedCredentialsTests : IAsyncLifetime
{
    private readonly HewnApiFactory _factory = new();

    public Task InitializeAsync() => Task.CompletedTask;

    public async Task DisposeAsync() => await _factory.DisposeAsync();

    private ISecretStore Store => _factory.Services.GetRequiredService<ISecretStore>();

    private static async Task<JsonElement[]> CredentialsAsync(HewnClient client)
    {
        var response = await client.GetAsync("/api/settings/credentials");
        Assert.Equal(HttpStatusCode.OK, response.StatusCode);
        return [.. (await HewnClient.ReadJsonAsync(response)).EnumerateArray()];
    }

    [Fact]
    public async Task A_supplied_credential_shows_only_as_a_reference_with_its_last_updated_time()
    {
        var owner = await _factory.SignInAsync("quinntynebrown", Role.Owner);
        var before = await CredentialsAsync(owner);
        Assert.Equal(
            ["model-api-key", "magic-patterns-token", "github-app-private-key", "github-client-secret", "github-webhook-secret", "worker-token", "metrics-token"],
            before.Select(c => c.GetProperty("name").GetString()));
        Assert.All(before, c => Assert.Equal(JsonValueKind.Null, c.GetProperty("updatedAt").ValueKind));

        const string value = "sk-ant-api03-supplied-model-key-0123456789abcdef";
        var supplied = DateTimeOffset.UtcNow;
        await Store.SetAsync("model-api-key", value, CancellationToken.None);

        var response = await owner.GetAsync("/api/settings/credentials");
        var body = await response.Content.ReadAsStringAsync();
        Assert.DoesNotContain(value, body);
        Assert.DoesNotContain("sk-ant", body);
        var model = (await CredentialsAsync(owner)).Single(c => c.GetProperty("name").GetString() == "model-api-key");
        Assert.Equal(["name", "description", "updatedAt"], model.EnumerateObject().Select(p => p.Name));
        Assert.InRange(model.GetProperty("updatedAt").GetDateTimeOffset(), supplied.AddSeconds(-5), DateTimeOffset.UtcNow.AddSeconds(5));
        Assert.Equal("The Anthropic API key workers call the model with", model.GetProperty("description").GetString());

        // A Viewer sees the same references; a caller who isn't signed in sees nothing.
        var viewer = await _factory.SignInAsync("ada", Role.Viewer);
        Assert.Equal(body, await (await viewer.GetAsync("/api/settings/credentials")).Content.ReadAsStringAsync());
        Assert.Equal(HttpStatusCode.Unauthorized, (await _factory.CreateAnonymousClient().GetAsync("/api/settings/credentials")).StatusCode);
    }

    [Fact]
    public async Task A_credential_the_store_holds_is_the_one_the_API_uses()
    {
        const string secret = "webhook-secret-from-the-store-7f3a9c";
        const string body = "{\"zen\":\"Keep it logically awesome.\"}";
        var client = _factory.CreateClient();

        Assert.Equal(HttpStatusCode.Unauthorized, (await client.SendAsync(Webhook(body, secret))).StatusCode);
        await Store.SetAsync("github-webhook-secret", secret, CancellationToken.None);
        Assert.Equal(HttpStatusCode.Accepted, (await client.SendAsync(Webhook(body, secret))).StatusCode);
    }

    [Fact]
    public async Task Only_known_credentials_can_be_stored()
    {
        await Assert.ThrowsAsync<ArgumentException>(() => Store.SetAsync("budget", "100", CancellationToken.None));
        await Assert.ThrowsAsync<ArgumentException>(() => Store.SetAsync("model-api-key", " ", CancellationToken.None));
    }

    private static HttpRequestMessage Webhook(string body, string secret)
    {
        var request = new HttpRequestMessage(HttpMethod.Post, "/api/github/webhook") { Content = new StringContent(body, Encoding.UTF8, "application/json") };
        request.Headers.Add("X-GitHub-Event", "ping");
        request.Headers.Add("X-GitHub-Delivery", Guid.NewGuid().ToString());
        request.Headers.Add("X-Hub-Signature-256",
            "sha256=" + Convert.ToHexStringLower(HMACSHA256.HashData(Encoding.UTF8.GetBytes(secret), Encoding.UTF8.GetBytes(body))));
        return request;
    }
}

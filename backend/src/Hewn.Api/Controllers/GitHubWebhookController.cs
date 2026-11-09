using System.Text.Json;
using Hewn.Application.Abstractions;
using Hewn.Application.Pipeline;
using MediatR;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;

namespace Hewn.Api.Controllers;

/// <summary>
/// GitHub's webhook (L2-037). Anonymous, but every request must carry a valid <c>X-Hub-Signature-256</c> made with
/// <c>HEWN_GITHUB_WEBHOOK_SECRET</c>; unsigned or invalid requests get 401 and are logged, without their body.
/// </summary>
[ApiController]
[Route("api/github/webhook")]
[AllowAnonymous]
[IgnoreAntiforgeryToken]
public sealed class GitHubWebhookController(IMediator mediator, IConfiguration configuration, ILogger<GitHubWebhookController> logger) : ControllerBase
{
    private const int MaxBody = 1024 * 1024;

    [HttpPost]
    [RequestSizeLimit(MaxBody)]
    public async Task<IActionResult> Receive(CancellationToken cancellationToken)
    {
        using var buffer = new MemoryStream();
        await Request.Body.CopyToAsync(buffer, cancellationToken);
        var body = buffer.ToArray();
        var delivery = Request.Headers["X-GitHub-Delivery"].ToString();
        var type = Request.Headers["X-GitHub-Event"].ToString();

        var problem = WebhookSignature.Problem(configuration["HEWN_GITHUB_WEBHOOK_SECRET"], body, Request.Headers["X-Hub-Signature-256"].ToString());
        if (problem is not null)
        {
            logger.LogWarning("Rejected GitHub webhook {Delivery} ({Event}) from {Address}: {Problem}", delivery, type, HttpContext.Connection.RemoteIpAddress, problem);
            return Problem(statusCode: StatusCodes.Status401Unauthorized, title: "The webhook signature is missing or invalid.", extensions: new Dictionary<string, object?> { ["code"] = "webhook_signature_invalid" });
        }

        if (type == "check_run" && Parse(body) is { } command)
        {
            var found = await mediator.Send(command, cancellationToken);
            logger.LogInformation("GitHub webhook {Delivery}: check {Check} {Status} on {Repository}, {Found} increments", delivery, command.Check.Name, command.Check.Status, command.Repository, found);
        }

        return Accepted();
    }

    private static RecordCheckRunCommand? Parse(byte[] body)
    {
        try
        {
            var root = JsonDocument.Parse(body).RootElement;
            var run = root.GetProperty("check_run");
            static DateTimeOffset? Time(JsonElement e, string name) =>
                e.TryGetProperty(name, out var v) && v.ValueKind == JsonValueKind.String ? v.GetDateTimeOffset() : null;
            var conclusion = run.TryGetProperty("conclusion", out var c) && c.ValueKind == JsonValueKind.String ? c.GetString() : null;
            return new RecordCheckRunCommand(
                root.GetProperty("repository").GetProperty("full_name").GetString()!,
                [.. run.GetProperty("pull_requests").EnumerateArray().Select(p => p.GetProperty("number").GetInt32())],
                new CheckRunInfo(run.GetProperty("name").GetString()!, run.GetProperty("status").GetString()!, conclusion, Time(run, "started_at"), Time(run, "completed_at")));
        }
        catch (Exception e) when (e is JsonException or KeyNotFoundException or InvalidOperationException or FormatException)
        {
            return null;
        }
    }
}

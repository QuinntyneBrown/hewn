using System.Diagnostics;
using System.Text;
using System.Text.Encodings.Web;
using System.Text.Json;
using Hewn.Application.Common;
using Hewn.Application.Pipeline;

namespace Hewn.Api.Logging;

/// <summary>Where log lines go: standard output in production; a test swaps in its own writer to read them back.</summary>
public sealed class LogSink(TextWriter writer)
{
    private readonly Lock _gate = new();

    public void WriteLine(string line)
    {
        lock (_gate)
        {
            writer.WriteLine(line);
            writer.Flush();
        }
    }
}

/// <summary>
/// Writes each log entry as one line of JSON (L2-049 AC1): timestamp, level, category and message, the trace and span
/// IDs of the current activity, and every field of the entry and its scopes, such as projectId, directionId, stage and
/// runId. Text passes <see cref="SecretRedactor"/> first, since a message or an exception can quote a credential.
/// </summary>
[ProviderAlias("Json")]
public sealed class JsonLoggerProvider(LogSink sink) : ILoggerProvider, ISupportExternalScope
{
    private IExternalScopeProvider _scopes = new LoggerExternalScopeProvider();

    public ILogger CreateLogger(string categoryName) => new JsonLogger(categoryName, sink, () => _scopes);

    public void SetScopeProvider(IExternalScopeProvider scopeProvider) => _scopes = scopeProvider;

    public void Dispose()
    {
    }

    private sealed class JsonLogger(string category, LogSink sink, Func<IExternalScopeProvider> scopes) : ILogger
    {
        public IDisposable? BeginScope<TState>(TState state) where TState : notnull => scopes().Push(state);

        public bool IsEnabled(LogLevel logLevel) => logLevel != LogLevel.None;

        public void Log<TState>(LogLevel logLevel, EventId eventId, TState state, Exception? exception, Func<TState, Exception?, string> formatter)
        {
            if (!IsEnabled(logLevel))
            {
                return;
            }

            var fields = new Dictionary<string, object?>();
            scopes().ForEachScope((scope, f) => Collect(scope, f), fields);
            Collect(state, fields);

            using var buffer = new MemoryStream();
            // Relaxed escaping keeps quotes and + readable; these lines are never put into HTML.
            using (var json = new Utf8JsonWriter(buffer, new JsonWriterOptions { Encoder = JavaScriptEncoder.UnsafeRelaxedJsonEscaping }))
            {
                json.WriteStartObject();
                json.WriteString("timestamp", DateTime.UtcNow.ToString("O"));
                json.WriteString("level", logLevel.ToString());
                json.WriteString("category", category);
                json.WriteString("message", SecretRedactor.Redact(formatter(state, exception)));
                if (Activity.Current is { } activity)
                {
                    json.WriteString("traceId", activity.TraceId.ToHexString());
                    json.WriteString("spanId", activity.SpanId.ToHexString());
                }

                foreach (var (key, value) in fields)
                {
                    if (key is "timestamp" or "level" or "category" or "message" or "traceId" or "spanId" or "exception")
                    {
                        continue;
                    }

                    json.WritePropertyName(key);
                    switch (value)
                    {
                        case null: json.WriteNullValue(); break;
                        case int or long or short or byte or double or decimal or float: JsonSerializer.Serialize(json, value); break;
                        case bool b: json.WriteBooleanValue(b); break;
                        default: json.WriteStringValue(SecretRedactor.Redact(Convert.ToString(value, System.Globalization.CultureInfo.InvariantCulture) ?? "")); break;
                    }
                }

                if (exception is not null)
                {
                    json.WriteString("exception", SecretRedactor.Redact(exception.ToString()));
                }

                json.WriteEndObject();
            }

            sink.WriteLine(Encoding.UTF8.GetString(buffer.ToArray()));
        }

        private static void Collect(object? state, Dictionary<string, object?> fields)
        {
            if (state is IEnumerable<KeyValuePair<string, object?>> pairs)
            {
                foreach (var (key, value) in pairs)
                {
                    if (key != "{OriginalFormat}")
                    {
                        fields[char.ToLowerInvariant(key[0]) + key[1..]] = value;
                    }
                }
            }
        }
    }
}

public static class RunLogScope
{
    /// <summary>A scope that puts a run's project, direction, stage and run IDs on every entry logged inside it.</summary>
    public static IDisposable? BeginRunScope(this ILogger logger, RunCorrelation run) =>
        logger.BeginScope(new Dictionary<string, object?>
        {
            ["projectId"] = run.ProjectId,
            ["directionId"] = run.DirectionId,
            ["stage"] = run.Stage,
            ["runId"] = run.RunId,
        });
}

/// <summary>
/// On every worker call that names a run, opens the run's log scope for the whole request, so whatever the API logs
/// while handling it carries the run's IDs.
/// </summary>
public sealed class RunLogScopeFilter(MediatR.IMediator mediator, ILogger<RunLogScopeFilter> logger) : Microsoft.AspNetCore.Mvc.Filters.IAsyncActionFilter
{
    public async Task OnActionExecutionAsync(Microsoft.AspNetCore.Mvc.Filters.ActionExecutingContext context, Microsoft.AspNetCore.Mvc.Filters.ActionExecutionDelegate next)
    {
        if (context.RouteData.Values.TryGetValue("runId", out var value) && Guid.TryParse(value?.ToString(), out var runId)
            && await mediator.Send(new RunCorrelationQuery(runId), context.HttpContext.RequestAborted) is { } run)
        {
            using (logger.BeginRunScope(run))
            {
                await next();
            }

            return;
        }

        await next();
    }
}

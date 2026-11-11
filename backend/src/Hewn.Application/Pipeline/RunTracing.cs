using System.Diagnostics;
using Hewn.Domain;

namespace Hewn.Application.Pipeline;

/// <summary>The spans Hewn adds to a run's trace, beside the HTTP spans: the time it waited in the queue (L2-049 AC2).</summary>
public static class RunTracing
{
    public const string SourceName = "Hewn";

    public static readonly ActivitySource Source = new(SourceName);

    /// <summary>
    /// Records "Run queued" as a child of the work that queued the run, lasting from then until this lease, and returns
    /// its traceparent for the worker; the run's own traceparent when nothing listens.
    /// </summary>
    public static string? Queued(Run run, DateTimeOffset now)
    {
        ActivityContext.TryParse(run.TraceParent, null, out var parent);
        var end = DateTimeOffset.UtcNow;
        var waited = now - run.CreatedAt;
        using var activity = Source.StartActivity(
            "Run queued",
            ActivityKind.Internal,
            parent,
            startTime: end - (waited > TimeSpan.Zero ? waited : TimeSpan.Zero));
        if (activity is null)
        {
            return run.TraceParent;
        }

        activity.SetTag("hewn.project.id", run.ProjectId.ToString());
        activity.SetTag("hewn.direction.id", run.DirectionId.ToString());
        activity.SetTag("hewn.stage", run.Stage);
        activity.SetTag("hewn.run.id", run.Id.ToString());
        activity.SetTag("hewn.run.attempt", run.Attempt);
        activity.SetEndTime(end.UtcDateTime);
        return activity.Id;
    }

    /// <summary>Starts a span in the run's trace, under <paramref name="traceParent"/>; null when nothing listens.</summary>
    public static Activity? Start(string name, string? traceParent) =>
        ActivityContext.TryParse(traceParent, null, out var parent)
            ? Source.StartActivity(name, ActivityKind.Internal, parent)
            : Source.StartActivity(name);
}

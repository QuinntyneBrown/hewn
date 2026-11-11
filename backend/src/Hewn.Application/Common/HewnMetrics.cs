using System.Diagnostics;
using System.Diagnostics.Metrics;
using Hewn.Application.Abstractions;
using Hewn.Domain;
using Microsoft.Extensions.DependencyInjection;

namespace Hewn.Application.Common;

/// <summary>
/// The platform's operational metrics (L2-049 AC3), on the meter "Hewn": stage duration and outcomes (the success rate
/// is succeeded over all), queue depth and active workers read from the database at each scrape, the time from an
/// event being stored to its being sent to clients, and model tokens and spend.
/// </summary>
public sealed class HewnMetrics
{
    public const string MeterName = "Hewn";

    private readonly Histogram<double> _stageDuration;
    private readonly Counter<long> _stageRuns;
    private readonly Histogram<double> _eventLatency;
    private readonly Counter<long> _tokens;
    private readonly Counter<double> _spend;
    private readonly IServiceScopeFactory _scopes;
    private readonly TimeProvider _clock;

    public HewnMetrics(IMeterFactory meters, IServiceScopeFactory scopes, TimeProvider clock)
    {
        _scopes = scopes;
        _clock = clock;
        var meter = meters.Create(MeterName);
        _stageDuration = meter.CreateHistogram<double>("hewn_stage_duration", "s", "How long a stage's run took, from lease to result.");
        _stageRuns = meter.CreateCounter<long>("hewn_stage_runs", description: "Stage runs that ended, by stage and outcome.");
        _eventLatency = meter.CreateHistogram<double>("hewn_event_latency", "s", "From an event being stored to its being sent to Mission Control.");
        _tokens = meter.CreateCounter<long>("hewn_model_tokens", description: "Model tokens, by model and kind (input or output).");
        _spend = meter.CreateCounter<double>("hewn_spend_usd", description: "Model spend in US dollars, by model.");
        meter.CreateObservableGauge("hewn_queue_depth", () => Count(db => db.Runs.Count(r => r.Status == RunStatus.Queued)), description: "Runs queued and waiting for a worker.");
        meter.CreateObservableGauge("hewn_workers_active", () => Count(db =>
        {
            var since = _clock.GetUtcNow() - Run.LeaseDuration;
            return db.Workers.Count(w => w.RevokedAt == null && w.LastSeenAt >= since);
        }), description: "Workers heard from in the last 60 seconds.");
    }

    public void RunEnded(Run run)
    {
        var tags = new TagList { { "stage", run.Stage }, { "outcome", run.Status.ToString() } };
        _stageRuns.Add(1, tags);
        if (run.StartedAt is { } started && run.EndedAt is { } ended)
        {
            _stageDuration.Record((ended - started).TotalSeconds, tags);
        }
    }

    public void EventSent(StoredEvent stored) =>
        _eventLatency.Record(Math.Max(0, (_clock.GetUtcNow() - stored.OccurredAt).TotalSeconds));

    public void ModelCalled(string model, long inputTokens, long outputTokens, decimal costUsd)
    {
        _tokens.Add(inputTokens, new KeyValuePair<string, object?>("model", model), new KeyValuePair<string, object?>("kind", "input"));
        _tokens.Add(outputTokens, new KeyValuePair<string, object?>("model", model), new KeyValuePair<string, object?>("kind", "output"));
        _spend.Add((double)costUsd, new KeyValuePair<string, object?>("model", model));
    }

    private int Count(Func<IAppDbContext, int> query)
    {
        using var scope = _scopes.CreateScope();
        return query(scope.ServiceProvider.GetRequiredService<IAppDbContext>());
    }
}

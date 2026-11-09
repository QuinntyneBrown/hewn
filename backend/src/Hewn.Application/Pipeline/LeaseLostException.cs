namespace Hewn.Application.Pipeline;

/// <summary>The caller no longer holds the run's lease (wrong worker or stale epoch). Answered with 409 lease_lost.</summary>
public sealed class LeaseLostException() : Exception("The lease on this run is no longer held by this worker.");

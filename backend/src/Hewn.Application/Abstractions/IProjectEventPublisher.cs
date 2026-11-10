using Hewn.Domain;

namespace Hewn.Application.Abstractions;

/// <summary>Broadcasts stored events to Mission Control. Called only after the events are committed.</summary>
public interface IProjectEventPublisher
{
    Task PublishAsync(IReadOnlyList<StoredEvent> events, CancellationToken cancellationToken);

    /// <summary>Tells Projects pages and the project's own page that it was deleted (L2-003 AC3).</summary>
    Task ProjectDeletedAsync(Guid projectId, CancellationToken cancellationToken);
}

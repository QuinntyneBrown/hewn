using Hewn.Domain;

namespace Hewn.Application.Abstractions;

/// <summary>Broadcasts stored events to Mission Control. Called only after the events are committed.</summary>
public interface IProjectEventPublisher
{
    Task PublishAsync(IReadOnlyList<StoredEvent> events, CancellationToken cancellationToken);
}

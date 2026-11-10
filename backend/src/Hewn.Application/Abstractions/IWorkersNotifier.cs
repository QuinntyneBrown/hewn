namespace Hewn.Application.Abstractions;

/// <summary>Tells Mission Control's Workers view that a worker changed, so it shows within 2 seconds (L2-026 AC1).</summary>
public interface IWorkersNotifier
{
    Task WorkersChangedAsync(CancellationToken cancellationToken);
}

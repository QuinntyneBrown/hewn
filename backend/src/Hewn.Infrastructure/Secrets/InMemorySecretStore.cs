using System.Collections.Concurrent;
using Hewn.Application.Abstractions;
using Hewn.Application.Secrets;

namespace Hewn.Infrastructure.Secrets;

/// <summary>
/// Holds credentials in the process only, for tests and for a stack configured from environment variables: nothing is
/// written anywhere, and they are gone when the process ends.
/// </summary>
public sealed class InMemorySecretStore(TimeProvider clock) : ISecretStore
{
    private readonly ConcurrentDictionary<string, (string Value, DateTimeOffset UpdatedAt)> _secrets = new();

    public event Action? Changed;

    public Task<string?> GetAsync(string name, CancellationToken cancellationToken) =>
        Task.FromResult(_secrets.TryGetValue(name, out var secret) ? secret.Value : null);

    public Task SetAsync(string name, string value, CancellationToken cancellationToken)
    {
        Credentials.Check(name, value);
        _secrets[name] = (value, clock.GetUtcNow());
        Changed?.Invoke();
        return Task.CompletedTask;
    }

    public Task<IReadOnlyList<SecretRef>> ListAsync(CancellationToken cancellationToken) =>
        Task.FromResult<IReadOnlyList<SecretRef>>([.. Credentials.All.Select(c => new SecretRef(c.Name, _secrets.TryGetValue(c.Name, out var s) ? s.UpdatedAt : null))]);
}

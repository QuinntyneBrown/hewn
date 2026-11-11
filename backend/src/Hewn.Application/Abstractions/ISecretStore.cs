namespace Hewn.Application.Abstractions;

/// <summary>A credential's value-free form: its name and when it was last set, or null when it isn't set (L2-040 AC1).</summary>
public sealed record SecretRef(string Name, DateTimeOffset? UpdatedAt);

/// <summary>
/// Where Hewn keeps the credentials in <see cref="Secrets.Credentials"/>, encrypted at rest: Azure Key Vault in the cloud,
/// the OS key store locally (L2-040 AC1, ADR 0037). Only known credentials can be stored.
/// </summary>
public interface ISecretStore
{
    /// <summary>Raised after a credential is set through this store, so readers can pick up the new value.</summary>
    event Action? Changed;

    Task<string?> GetAsync(string name, CancellationToken cancellationToken);

    Task SetAsync(string name, string value, CancellationToken cancellationToken);

    /// <summary>Every known credential, in catalogue order, with its last-updated time; never a value.</summary>
    Task<IReadOnlyList<SecretRef>> ListAsync(CancellationToken cancellationToken);
}

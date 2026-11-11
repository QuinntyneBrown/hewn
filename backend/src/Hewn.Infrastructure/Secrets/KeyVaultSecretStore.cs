using Azure;
using Azure.Security.KeyVault.Secrets;
using Hewn.Application.Abstractions;
using Hewn.Application.Secrets;

namespace Hewn.Infrastructure.Secrets;

/// <summary>
/// Keeps credentials in Azure Key Vault, which encrypts them at rest, under their store names (L2-040 AC1, ADR 0037).
/// The API signs in with its managed identity, or whatever <c>DefaultAzureCredential</c> finds.
/// </summary>
public sealed class KeyVaultSecretStore(SecretClient client) : ISecretStore
{
    public event Action? Changed;

    public async Task<string?> GetAsync(string name, CancellationToken cancellationToken)
    {
        try
        {
            return (await client.GetSecretAsync(name, null, cancellationToken)).Value.Value;
        }
        catch (RequestFailedException e) when (e.Status == 404)
        {
            return null;
        }
    }

    public async Task SetAsync(string name, string value, CancellationToken cancellationToken)
    {
        Credentials.Check(name, value);
        await client.SetSecretAsync(name, value, cancellationToken);
        Changed?.Invoke();
    }

    public async Task<IReadOnlyList<SecretRef>> ListAsync(CancellationToken cancellationToken)
    {
        var updated = new Dictionary<string, DateTimeOffset?>();
        await foreach (var properties in client.GetPropertiesOfSecretsAsync(cancellationToken))
        {
            updated[properties.Name] = properties.UpdatedOn;
        }

        return [.. Credentials.All.Select(c => new SecretRef(c.Name, updated.GetValueOrDefault(c.Name)))];
    }
}

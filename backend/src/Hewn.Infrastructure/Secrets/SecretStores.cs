using Azure.Identity;
using Azure.Security.KeyVault.Secrets;
using Hewn.Application.Abstractions;
using Hewn.Application.Secrets;
using Microsoft.Extensions.Configuration;

namespace Hewn.Infrastructure.Secrets;

/// <summary>
/// Picks the secret store from <c>HEWN_SECRET_STORE</c>: <c>keyvault</c> (with <c>HEWN_KEY_VAULT_URI</c>) in the cloud,
/// <c>os</c> locally, or, when unset, one in memory beside environment variables (ADR 0037).
/// </summary>
public static class SecretStores
{
    public static ISecretStore Create(IConfiguration configuration) => configuration["HEWN_SECRET_STORE"]?.ToLowerInvariant() switch
    {
        null or "" or "memory" => new InMemorySecretStore(TimeProvider.System),
        "os" when OsKeyStoreSecretStore.IsSupported => new OsKeyStoreSecretStore(
            new ProcessKeyStoreCommands(), TimeProvider.System, configuration["HEWN_KEY_STORE_SERVICE"] ?? "hewn"),
        "os" => throw new InvalidOperationException("The OS key store is supported on macOS and Linux. Use HEWN_SECRET_STORE=keyvault elsewhere."),
        "keyvault" => new KeyVaultSecretStore(new SecretClient(
            new Uri(configuration["HEWN_KEY_VAULT_URI"] ?? throw new InvalidOperationException("HEWN_SECRET_STORE=keyvault needs HEWN_KEY_VAULT_URI.")),
            new DefaultAzureCredential())),
        var other => throw new InvalidOperationException($"HEWN_SECRET_STORE is \"{other}\"; use keyvault, os or memory."),
    };
}

/// <summary>
/// Fills each credential's configuration key from the secret store, over environment variables and settings files, and
/// again whenever the store changes a credential (L2-040 AC1).
/// </summary>
public sealed class SecretStoreConfigurationSource(ISecretStore store) : IConfigurationSource
{
    public IConfigurationProvider Build(IConfigurationBuilder builder) => new Provider(store);

    private sealed class Provider : ConfigurationProvider
    {
        private readonly ISecretStore _store;

        public Provider(ISecretStore store)
        {
            _store = store;
            _store.Changed += () =>
            {
                Load();
                OnReload();
            };
        }

        public override void Load()
        {
            var data = new Dictionary<string, string?>(StringComparer.OrdinalIgnoreCase);
            foreach (var credential in Credentials.All)
            {
                var value = _store.GetAsync(credential.Name, CancellationToken.None).GetAwaiter().GetResult();
                if (value is not null)
                {
                    data[credential.ConfigurationKey] = value;
                }
            }

            Data = data;
        }
    }
}

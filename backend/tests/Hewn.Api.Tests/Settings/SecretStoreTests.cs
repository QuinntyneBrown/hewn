// Acceptance Test
// Traces to: L2-040
// Description: The OS key store (macOS keychain, Linux Secret Service) and Azure Key Vault keep each credential encrypted
// at rest with its last-updated time; a value only ever reaches the key store tool on standard input (AC1)

using Azure;
using Azure.Security.KeyVault.Secrets;
using Hewn.Infrastructure.Secrets;
using Microsoft.Extensions.Time.Testing;

namespace Hewn.Api.Tests.Settings;

public sealed class SecretStoreTests
{
    private const string PrivateKey = "-----BEGIN RSA PRIVATE KEY-----\nMIIEowIBAAKCAQEA0test\nline two\n-----END RSA PRIVATE KEY-----\n";

    /// <summary>A key store tool that keeps items in a dictionary and records every call.</summary>
    private sealed class FakeKeyStore : IKeyStoreCommands
    {
        public Dictionary<string, string> Items { get; } = [];

        public List<(string File, IReadOnlyList<string> Arguments, string? Input)> Calls { get; } = [];

        public Task<(int ExitCode, string Output)> RunAsync(string file, IReadOnlyList<string> arguments, string? input, CancellationToken cancellationToken)
        {
            Calls.Add((file, arguments, input));
            if (file == "security" && arguments is ["-i"])
            {
                var words = input!.TrimEnd('\n').Split(' ');
                Items[$"{words[Array.IndexOf(words, "-s") + 1]}/{words[Array.IndexOf(words, "-a") + 1]}"] = words[Array.IndexOf(words, "-w") + 1];
                return Task.FromResult((0, ""));
            }

            if (file == "secret-tool" && arguments[0] == "store")
            {
                Items[$"{arguments[^3]}/{arguments[^1]}"] = input!;
                return Task.FromResult((0, ""));
            }

            var key = file == "security"
                ? $"{arguments[Array.IndexOf([.. arguments], "-s") + 1]}/{arguments[Array.IndexOf([.. arguments], "-a") + 1]}"
                : $"{arguments[^3]}/{arguments[^1]}";
            return Task.FromResult(Items.TryGetValue(key, out var item) ? (0, item + "\n") : (file == "security" ? 44 : 1, ""));
        }
    }

    [Theory]
    [InlineData(true)]
    [InlineData(false)]
    public async Task The_OS_key_store_keeps_a_credential_with_its_time_and_never_puts_the_value_in_arguments(bool macOS)
    {
        var tool = new FakeKeyStore();
        var clock = new FakeTimeProvider(new DateTimeOffset(2026, 11, 11, 9, 30, 0, TimeSpan.Zero));
        var store = new OsKeyStoreSecretStore(tool, clock, "hewn-test", macOS);
        var changed = 0;
        store.Changed += () => changed++;

        Assert.Null(await store.GetAsync("github-app-private-key", CancellationToken.None));
        await store.SetAsync("github-app-private-key", PrivateKey, CancellationToken.None);

        Assert.Equal(PrivateKey, await store.GetAsync("github-app-private-key", CancellationToken.None));
        Assert.Equal(1, changed);
        var item = Assert.Single(tool.Items);
        Assert.Equal("hewn-test/github-app-private-key", item.Key);
        Assert.DoesNotContain("PRIVATE KEY", item.Value);
        Assert.All(tool.Calls, call => Assert.DoesNotContain(call.Arguments, a => a.Contains("PRIVATE KEY") || a.StartsWith("hewn1:", StringComparison.Ordinal)));
        Assert.Equal(macOS ? "security" : "secret-tool", tool.Calls[1].File);

        var refs = await store.ListAsync(CancellationToken.None);
        Assert.Equal(7, refs.Count);
        Assert.Equal(clock.GetUtcNow(), refs.Single(r => r.Name == "github-app-private-key").UpdatedAt);
        Assert.All(refs.Where(r => r.Name != "github-app-private-key"), r => Assert.Null(r.UpdatedAt));
    }

    [Fact]
    public async Task A_key_store_item_Hewn_did_not_write_reads_as_not_set()
    {
        var tool = new FakeKeyStore();
        tool.Items["hewn/worker-token"] = "plain-text-someone-typed";
        var store = new OsKeyStoreSecretStore(tool, TimeProvider.System, "hewn", macOS: true);

        Assert.Null(await store.GetAsync("worker-token", CancellationToken.None));
    }

    /// <summary>A Key Vault that keeps secrets in a dictionary.</summary>
    private sealed class FakeVault : SecretClient
    {
        public Dictionary<string, (string Value, DateTimeOffset UpdatedOn)> Secrets { get; } = [];

        public override Task<Response<KeyVaultSecret>> GetSecretAsync(string name, string? version = null, CancellationToken cancellationToken = default) =>
            Secrets.TryGetValue(name, out var s)
                ? Task.FromResult(Response.FromValue(SecretModelFactory.KeyVaultSecret(SecretModelFactory.SecretProperties(name: name, updatedOn: s.UpdatedOn), s.Value), null!))
                : throw new RequestFailedException(404, "SecretNotFound");

        public override Task<Response<KeyVaultSecret>> SetSecretAsync(string name, string value, CancellationToken cancellationToken = default)
        {
            Secrets[name] = (value, new DateTimeOffset(2026, 11, 11, 10, 0, 0, TimeSpan.Zero));
            return GetSecretAsync(name, null, cancellationToken);
        }

        public override AsyncPageable<SecretProperties> GetPropertiesOfSecretsAsync(CancellationToken cancellationToken = default) =>
            AsyncPageable<SecretProperties>.FromPages([Page<SecretProperties>.FromValues(
                [.. Secrets.Select(s => SecretModelFactory.SecretProperties(name: s.Key, updatedOn: s.Value.UpdatedOn))], null, null!)]);
    }

    [Fact]
    public async Task Key_Vault_keeps_a_credential_under_its_name_with_the_vault_s_last_updated_time()
    {
        var vault = new FakeVault();
        vault.Secrets["unrelated-secret"] = ("x", DateTimeOffset.UnixEpoch);
        var store = new KeyVaultSecretStore(vault);

        Assert.Null(await store.GetAsync("magic-patterns-token", CancellationToken.None));
        await store.SetAsync("magic-patterns-token", "mp-token-0123456789", CancellationToken.None);

        Assert.Equal("mp-token-0123456789", await store.GetAsync("magic-patterns-token", CancellationToken.None));
        var refs = await store.ListAsync(CancellationToken.None);
        Assert.DoesNotContain(refs, r => r.Name == "unrelated-secret");
        Assert.Equal(new DateTimeOffset(2026, 11, 11, 10, 0, 0, TimeSpan.Zero), refs.Single(r => r.Name == "magic-patterns-token").UpdatedAt);
        await Assert.ThrowsAsync<ArgumentException>(() => store.SetAsync("unrelated-secret", "y", CancellationToken.None));
    }
}

using System.Globalization;
using System.Text;
using Hewn.Application.Abstractions;
using Hewn.Application.Secrets;

namespace Hewn.Infrastructure.Secrets;

/// <summary>
/// Keeps credentials in the operating system's key store, which encrypts them at rest: the login keychain on macOS
/// (<c>security</c>) and the Secret Service on Linux (<c>secret-tool</c>, libsecret). Each is one item under the
/// service name, holding <c>hewn1:{unix ms}:{base64 value}</c>, so multi-line keys survive and the item carries its own
/// last-updated time (L2-040 AC1, ADR 0037).
/// </summary>
public sealed class OsKeyStoreSecretStore(IKeyStoreCommands commands, TimeProvider clock, string service = "hewn", bool? macOS = null) : ISecretStore
{
    private const string Prefix = "hewn1:";
    private readonly bool _macOS = macOS ?? OperatingSystem.IsMacOS();

    public event Action? Changed;

    public static bool IsSupported => OperatingSystem.IsMacOS() || OperatingSystem.IsLinux();

    public async Task<string?> GetAsync(string name, CancellationToken cancellationToken) =>
        (await ReadAsync(name, cancellationToken))?.Value;

    public async Task SetAsync(string name, string value, CancellationToken cancellationToken)
    {
        Credentials.Check(name, value);
        var item = $"{Prefix}{clock.GetUtcNow().ToUnixTimeMilliseconds()}:{Convert.ToBase64String(Encoding.UTF8.GetBytes(value))}";
        var (exitCode, _) = _macOS
            ? await commands.RunAsync("security", ["-i"], $"add-generic-password -U -s {service} -a {name} -w {item}\n", cancellationToken)
            : await commands.RunAsync("secret-tool", ["store", "--label", $"Hewn {name}", "service", service, "account", name], item, cancellationToken);
        if (exitCode != 0)
        {
            throw new InvalidOperationException($"The OS key store refused {name} (exit code {exitCode}).");
        }

        Changed?.Invoke();
    }

    public async Task<IReadOnlyList<SecretRef>> ListAsync(CancellationToken cancellationToken)
    {
        var refs = new List<SecretRef>();
        foreach (var credential in Credentials.All)
        {
            refs.Add(new SecretRef(credential.Name, (await ReadAsync(credential.Name, cancellationToken))?.UpdatedAt));
        }

        return refs;
    }

    private async Task<(string Value, DateTimeOffset UpdatedAt)?> ReadAsync(string name, CancellationToken cancellationToken)
    {
        var (exitCode, output) = _macOS
            ? await commands.RunAsync("security", ["find-generic-password", "-s", service, "-a", name, "-w"], null, cancellationToken)
            : await commands.RunAsync("secret-tool", ["lookup", "service", service, "account", name], null, cancellationToken);
        var item = output.Trim();
        if (exitCode != 0 || !item.StartsWith(Prefix, StringComparison.Ordinal))
        {
            return null;
        }

        var parts = item[Prefix.Length..].Split(':', 2);
        return parts.Length == 2 && long.TryParse(parts[0], NumberStyles.None, CultureInfo.InvariantCulture, out var ms)
            ? (Encoding.UTF8.GetString(Convert.FromBase64String(parts[1])), DateTimeOffset.FromUnixTimeMilliseconds(ms))
            : null;
    }
}

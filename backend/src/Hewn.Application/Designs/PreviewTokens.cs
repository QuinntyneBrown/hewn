using System.Buffers.Text;
using System.Security.Cryptography;
using System.Text;
using Microsoft.Extensions.Options;

namespace Hewn.Application.Designs;

/// <summary>What a preview token grants: one project's files at one commit, until it expires.</summary>
public sealed record PreviewGrant(Guid ProjectId, string Sha);

/// <summary>
/// Signs and reads preview tokens: <c>{project}.{sha}.{expiry}</c> with an HMAC-SHA256 under a key made at start-up,
/// so a token needs no storage and dies with the process (ADR 0018). The preview host trusts nothing else.
/// </summary>
public sealed class PreviewTokens(IOptions<PreviewOptions> options, TimeProvider clock)
{
    private readonly byte[] _key = RandomNumberGenerator.GetBytes(32);

    public string Sign(Guid projectId, string sha)
    {
        var expires = clock.GetUtcNow().AddMinutes(options.Value.TokenMinutes).ToUnixTimeSeconds();
        var payload = Encoding.ASCII.GetBytes($"{projectId:N}.{sha}.{expires}");
        return $"{Base64Url.EncodeToString(payload)}.{Base64Url.EncodeToString(HMACSHA256.HashData(_key, payload))}";
    }

    /// <summary>The grant, or null for a token that is malformed, signed with another key, or expired.</summary>
    public PreviewGrant? Read(string token)
    {
        var parts = token.Split('.');
        if (parts.Length != 2 || !Base64Url.IsValid(parts[0]) || !Base64Url.IsValid(parts[1]))
        {
            return null;
        }

        var payload = Base64Url.DecodeFromChars(parts[0]);
        if (!CryptographicOperations.FixedTimeEquals(HMACSHA256.HashData(_key, payload), Base64Url.DecodeFromChars(parts[1])))
        {
            return null;
        }

        var fields = Encoding.ASCII.GetString(payload).Split('.');
        return fields.Length == 3
            && Guid.TryParseExact(fields[0], "N", out var projectId)
            && long.TryParse(fields[2], out var expires)
            && clock.GetUtcNow().ToUnixTimeSeconds() < expires
                ? new PreviewGrant(projectId, fields[1])
                : null;
    }

    /// <summary>The preview URL of <paramref name="path"/> under a signed token.</summary>
    public string Url(string token, string path) => $"{options.Value.Origin.TrimEnd('/')}/preview/{token}/{path}";
}

using System.Security.Cryptography;
using System.Text;

namespace Hewn.Application.Pipeline;

/// <summary>
/// Verifies GitHub's <c>X-Hub-Signature-256</c> header: <c>sha256=</c> and the hex HMAC-SHA256 of the raw body,
/// keyed with the webhook secret (L2-037 AC2). The comparison takes the same time however many bytes match.
/// </summary>
public static class WebhookSignature
{
    private const string Prefix = "sha256=";

    /// <summary>Null when the signature is valid; otherwise why it was rejected, safe to log.</summary>
    public static string? Problem(string? secret, ReadOnlySpan<byte> body, string? header)
    {
        if (string.IsNullOrEmpty(secret))
        {
            return "no webhook secret is configured";
        }

        if (string.IsNullOrEmpty(header))
        {
            return "unsigned";
        }

        if (!header.StartsWith(Prefix, StringComparison.Ordinal) || header.Length != Prefix.Length + 64)
        {
            return "malformed signature";
        }

        byte[] given;
        try
        {
            given = Convert.FromHexString(header.AsSpan(Prefix.Length));
        }
        catch (FormatException)
        {
            return "malformed signature";
        }

        var expected = HMACSHA256.HashData(Encoding.UTF8.GetBytes(secret), body);
        return CryptographicOperations.FixedTimeEquals(expected, given) ? null : "signature mismatch";
    }
}

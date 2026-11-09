using System.Text.RegularExpressions;

namespace Hewn.Application.Common;

/// <summary>Masks credentials in text that came from a worker or an agent before it is stored or shown.</summary>
public static partial class SecretRedactor
{
    public const string Mask = "[redacted]";

    public static string Redact(string text) => Patterns().Replace(text, Mask);

    [GeneratedRegex(
        @"-----BEGIN [A-Z ]*PRIVATE KEY-----[\s\S]*?-----END [A-Z ]*PRIVATE KEY-----" +
        @"|\b(?:ghp|gho|ghu|ghs|ghr)_[A-Za-z0-9]{20,}" +
        @"|\bgithub_pat_[A-Za-z0-9_]{20,}" +
        @"|\bsk-[A-Za-z0-9_\-]{20,}" +
        @"|\bAKIA[0-9A-Z]{16}\b" +
        @"|(?i:bearer)\s+[A-Za-z0-9._\-~+/]{16,}=*" +
        @"|(?i:(?:password|passwd|secret|token|api[_-]?key)\s*[:=]\s*)\S+",
        RegexOptions.CultureInvariant)]
    private static partial Regex Patterns();
}

using System.Collections.Immutable;
using System.Text.Json.Nodes;
using System.Text.RegularExpressions;

namespace Hewn.Application.Common;

/// <summary>
/// Replaces secrets with <c>***</c> in text from a worker or an agent before it is stored, logged or sent (L2-040 AC2):
/// the value of every credential Hewn holds, and anything shaped like a private key, a GitHub, Anthropic, OpenAI-style,
/// AWS or Azure key, a bearer token, or a <c>password=</c> style assignment's value.
/// </summary>
public static partial class SecretRedactor
{
    public const string Mask = "***";

    /// <summary>Values shorter than this aren't matched as they are, so a short setting can't mask ordinary words.</summary>
    private const int MinimumKnownLength = 8;

    private static ImmutableArray<string> _known = [];

    /// <summary>Adds a credential's value to those replaced wherever they appear; blank and short values are ignored.</summary>
    public static void Remember(string? value)
    {
        if (value is null || value.Trim().Length < MinimumKnownLength)
        {
            return;
        }

        ImmutableInterlocked.Update(ref _known, known => known.Contains(value)
            ? known
            : [.. known.Add(value).OrderByDescending(v => v.Length)]);
    }

    public static string Redact(string text)
    {
        foreach (var value in _known)
        {
            text = text.Replace(value, Mask, StringComparison.Ordinal);
        }

        return Patterns().Replace(text, Mask);
    }

    /// <summary>Redacts every string in a JSON document, leaving its shape as it was.</summary>
    public static string RedactJson(string json)
    {
        var node = JsonNode.Parse(json);
        return node is null ? json : Walk(node)?.ToJsonString() ?? json;
    }

    private static JsonNode? Walk(JsonNode? node)
    {
        switch (node)
        {
            case JsonObject o:
                foreach (var (key, value) in o.ToList())
                {
                    if (Walk(value) is var walked && !ReferenceEquals(walked, value))
                    {
                        o[key] = walked;
                    }
                }

                return o;
            case JsonArray a:
                for (var i = 0; i < a.Count; i++)
                {
                    if (Walk(a[i]) is var walked && !ReferenceEquals(walked, a[i]))
                    {
                        a[i] = walked;
                    }
                }

                return a;
            case JsonValue v when v.TryGetValue<string>(out var text):
                var redacted = Redact(text);
                return redacted == text ? v : JsonValue.Create(redacted);
            default:
                return node;
        }
    }

    [GeneratedRegex(
        @"-----BEGIN [A-Z ]*PRIVATE KEY-----[\s\S]*?-----END [A-Z ]*PRIVATE KEY-----" +
        @"|\b(?:ghp|gho|ghu|ghs|ghr)_[A-Za-z0-9]{20,}" +
        @"|\bgithub_pat_[A-Za-z0-9_]{20,}" +
        // Anthropic keys (sk-ant-…) and other sk- keys.
        @"|\bsk-[A-Za-z0-9_\-]{20,}" +
        @"|\bAKIA[0-9A-Z]{16}\b" +
        // Azure: storage and Service Bus connection string keys, SAS signatures, and Entra ID client secrets.
        @"|(?<=\b(?i:AccountKey|SharedAccessKey|SharedAccessSignature|sig)=)[^;&\s""']{8,}" +
        @"|\b[A-Za-z0-9_~.\-]{3}\dQ~[A-Za-z0-9_~.\-]{31,34}" +
        @"|(?<=(?i:bearer)\s+)[A-Za-z0-9._\-~+/]{16,}=*" +
        @"|(?<=(?i:(?:password|passwd|secret|token|api[_-]?key)\s*[:=]\s*))[^\s;&""']+",
        RegexOptions.CultureInvariant)]
    private static partial Regex Patterns();
}

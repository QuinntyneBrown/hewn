using System.Text.Json;
using System.Text.Json.Serialization;

namespace Hewn.Application.Skills;

/// <summary><c>.hewn/skills.lock</c>, as stage 0 writes it: the source, the commit and the copied skill names (L2-007 AC2).</summary>
public sealed record SkillsLock(
    [property: JsonPropertyName("source")] string Source,
    [property: JsonPropertyName("sha")] string Sha,
    [property: JsonPropertyName("skills")] IReadOnlyList<string> Skills)
{
    public const string Path = ".hewn/skills.lock";

    /// <summary>The lock, or null when it is missing or isn't one.</summary>
    public static SkillsLock? Parse(byte[]? content)
    {
        if (content is null)
        {
            return null;
        }

        try
        {
            var parsed = JsonSerializer.Deserialize<SkillsLock>(content);
            return parsed is { Sha.Length: 40 } && parsed.Skills is not null ? parsed : null;
        }
        catch (JsonException)
        {
            return null;
        }
    }

    /// <summary>Formatted as stage 0 writes it: two-space indent and a final newline.</summary>
    public byte[] ToBytes() =>
        System.Text.Encoding.UTF8.GetBytes(JsonSerializer.Serialize(this, new JsonSerializerOptions { WriteIndented = true, IndentSize = 2 }) + "\n");
}

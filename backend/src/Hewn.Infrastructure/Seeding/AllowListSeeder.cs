using Hewn.Domain;
using Hewn.Infrastructure.Persistence;
using Microsoft.EntityFrameworkCore;

namespace Hewn.Infrastructure.Seeding;

/// <summary>
/// Seeds the allow list from HEWN_ALLOWED_GITHUB_USERS: comma-separated logins, each optionally
/// suffixed with ":Viewer" or ":Owner" (Owner by default). Safe to rerun: existing logins are left as they are.
/// </summary>
public static class AllowListSeeder
{
    public static IReadOnlyList<AllowListEntry> Parse(string? setting) =>
        (setting ?? string.Empty)
            .Split(',', StringSplitOptions.RemoveEmptyEntries | StringSplitOptions.TrimEntries)
            .Select(item =>
            {
                var parts = item.Split(':', 2, StringSplitOptions.TrimEntries);
                var role = parts.Length == 2 && Enum.TryParse<Role>(parts[1], ignoreCase: true, out var parsed) ? parsed : Role.Owner;
                return new AllowListEntry(parts[0], role);
            })
            .ToList();

    public static async Task<int> SeedAsync(HewnDbContext db, string? setting, CancellationToken cancellationToken = default)
    {
        var added = 0;
        foreach (var entry in Parse(setting))
        {
            if (!await db.AllowList.AnyAsync(a => a.Login == entry.Login, cancellationToken))
            {
                db.AllowList.Add(entry);
                added++;
            }
        }

        await db.SaveChangesAsync(cancellationToken);
        return added;
    }
}

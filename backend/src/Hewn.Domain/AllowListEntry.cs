namespace Hewn.Domain;

/// <summary>A GitHub login that may sign in to Hewn, with its role.</summary>
public sealed class AllowListEntry
{
    public AllowListEntry(string login, Role role)
    {
        Login = login.Trim().ToLowerInvariant();
        Role = role;
    }

    public string Login { get; private set; }

    public Role Role { get; private set; }

    /// <summary>When this login last signed in; null until it first does (shown in Settings, L2-038 AC5).</summary>
    public DateTimeOffset? LastSignInAt { get; private set; }

    /// <summary>When an Owner added it; null for logins seeded from configuration.</summary>
    public DateTimeOffset? AddedAt { get; private set; }

    public string? AddedBy { get; private set; }

    public static AllowListEntry Add(string login, Role role, string addedBy, DateTimeOffset at) =>
        new(login, role) { AddedBy = addedBy, AddedAt = at };

    public void RecordSignIn(DateTimeOffset at) => LastSignInAt = at;
}

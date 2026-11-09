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
}

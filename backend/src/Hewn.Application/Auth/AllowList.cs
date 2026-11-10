using System.Collections.Concurrent;
using System.Text.RegularExpressions;
using Hewn.Application.Abstractions;
using Hewn.Application.Common;
using Hewn.Domain;
using MediatR;
using Microsoft.EntityFrameworkCore;

namespace Hewn.Application.Auth;

/// <summary>One login on the allow list, as Settings shows it.</summary>
public sealed record AllowListEntryDto(string Login, Role Role, DateTimeOffset? LastSignInAt);

/// <summary>The allow list (L2-038 AC5): Owners first, then by login. Anyone signed in may read it.</summary>
public sealed record ListAllowListQuery : IRequest<IReadOnlyList<AllowListEntryDto>>;

public sealed class ListAllowListHandler(IAppDbContext db) : IRequestHandler<ListAllowListQuery, IReadOnlyList<AllowListEntryDto>>
{
    public async Task<IReadOnlyList<AllowListEntryDto>> Handle(ListAllowListQuery query, CancellationToken cancellationToken)
    {
        var entries = await db.AllowList.AsNoTracking().ToListAsync(cancellationToken);
        return entries
            .OrderBy(e => e.Role == Role.Owner ? 0 : 1)
            .ThenBy(e => e.AddedAt ?? DateTimeOffset.MinValue)
            .ThenBy(e => e.Login, StringComparer.Ordinal)
            .Select(e => new AllowListEntryDto(e.Login, e.Role, e.LastSignInAt))
            .ToList();
    }
}

/// <summary>
/// Adds a GitHub login as Owner or Viewer (L2-038 AC5). GitHub must know the login; when GitHub can't say, nothing
/// is added and <see cref="GitHubException"/> is thrown. They can sign in at once.
/// </summary>
public sealed record AddToAllowListCommand(string Login, Role Role, string AddedBy) : IRequest<AllowListEntryDto>;

public sealed partial class AddToAllowListHandler(IAppDbContext db, IGitHubIdentity gitHub, AllowListAccess access, TimeProvider clock)
    : IRequestHandler<AddToAllowListCommand, AllowListEntryDto>
{
    // GitHub's rule: 1-39 letters, digits or single hyphens, not starting or ending with a hyphen.
    [GeneratedRegex("^[a-z0-9](?:[a-z0-9]|-(?=[a-z0-9])){0,38}$")]
    private static partial Regex LoginPattern();

    public async Task<AllowListEntryDto> Handle(AddToAllowListCommand command, CancellationToken cancellationToken)
    {
        var login = command.Login.Trim().TrimStart('@').ToLowerInvariant();
        if (login.Length == 0)
        {
            throw Invalid("Enter a GitHub login.", "Enter a GitHub login");
        }

        if (!LoginPattern().IsMatch(login))
        {
            throw Invalid(
                "A GitHub login has letters, digits and single hyphens, and doesn't start or end with a hyphen.",
                "The GitHub login isn't valid");
        }

        if (await db.AllowList.AnyAsync(a => a.Login == login, cancellationToken))
        {
            throw Invalid($"@{login} is already on the allow list.", $"@{login} is already on the allow list", "already_listed");
        }

        if (await gitHub.FindLoginAsync(login, cancellationToken) is null)
        {
            throw Invalid($"No GitHub account is called @{login}.", $"No GitHub account is called @{login}", "unknown_login");
        }

        var entry = AllowListEntry.Add(login, command.Role, command.AddedBy, clock.GetUtcNow());
        db.AllowList.Add(entry);
        await db.SaveChangesAsync(cancellationToken);
        access.Set(entry.Login, entry.Role);
        return new AllowListEntryDto(entry.Login, entry.Role, entry.LastSignInAt);
    }

    private static FieldValidationException Invalid(string message, string summary, string? code = null) =>
        new([new FieldError("login", message, summary)], code);
}

/// <summary>Removes a login (L2-038 AC5); its sessions end at once. An Owner can't remove themselves.</summary>
public sealed record RemoveFromAllowListCommand(string Login, string RemovedBy) : IRequest;

public sealed class RemoveFromAllowListHandler(IAppDbContext db, AllowListAccess access) : IRequestHandler<RemoveFromAllowListCommand>
{
    public async Task Handle(RemoveFromAllowListCommand command, CancellationToken cancellationToken)
    {
        var login = command.Login.Trim().TrimStart('@').ToLowerInvariant();
        if (string.Equals(login, command.RemovedBy, StringComparison.OrdinalIgnoreCase))
        {
            throw new ConflictException("cannot_remove_yourself", "You can't remove yourself; ask another Owner.");
        }

        var entry = await db.AllowList.SingleOrDefaultAsync(a => a.Login == login, cancellationToken)
            ?? throw new NotFoundException();
        db.AllowList.Remove(entry);
        await db.SaveChangesAsync(cancellationToken);
        access.Remove(login);
    }
}

/// <summary>Records a sign-in's time on the login's allow-list entry.</summary>
public sealed record RecordSignInCommand(string Login) : IRequest;

public sealed class RecordSignInHandler(IAppDbContext db, TimeProvider clock) : IRequestHandler<RecordSignInCommand>
{
    public async Task Handle(RecordSignInCommand command, CancellationToken cancellationToken)
    {
        var login = command.Login.Trim().ToLowerInvariant();
        if (await db.AllowList.SingleOrDefaultAsync(a => a.Login == login, cancellationToken) is { } entry)
        {
            entry.RecordSignIn(clock.GetUtcNow());
            await db.SaveChangesAsync(cancellationToken);
        }
    }
}

/// <summary>
/// Whether a session may still be used (L2-038 AC3, AC5): it wasn't signed out, and its login is still on the allow
/// list with the role it signed in with. Removing a login, or changing its role, ends its sessions.
/// </summary>
public sealed record IsSessionValidQuery(Guid SessionId, string Login, string Role) : IRequest<bool>;

public sealed class IsSessionValidHandler(IAppDbContext db, RevokedSessions revoked, AllowListAccess access) : IRequestHandler<IsSessionValidQuery, bool>
{
    public async Task<bool> Handle(IsSessionValidQuery query, CancellationToken cancellationToken) =>
        !await revoked.ContainsAsync(query.SessionId, db, cancellationToken)
        && await access.RoleOfAsync(query.Login, db, cancellationToken) is { } role
        && string.Equals(role.ToString(), query.Role, StringComparison.Ordinal);
}

/// <summary>
/// The allow list's logins and roles, kept in memory so checking each request's session costs no database read.
/// A login not held yet is read once from the database; adding and removing through Hewn keep it current. Hewn runs
/// one API instance (ADR 0022).
/// </summary>
public sealed class AllowListAccess
{
    private readonly ConcurrentDictionary<string, Role> _roles = new(StringComparer.Ordinal);

    public async Task<Role?> RoleOfAsync(string login, IAppDbContext db, CancellationToken cancellationToken)
    {
        var key = login.ToLowerInvariant();
        if (_roles.TryGetValue(key, out var role))
        {
            return role;
        }

        var entry = await db.AllowList.AsNoTracking().SingleOrDefaultAsync(a => a.Login == key, cancellationToken);
        if (entry is null)
        {
            return null;
        }

        return _roles.GetOrAdd(key, entry.Role);
    }

    public void Set(string login, Role role) => _roles[login.ToLowerInvariant()] = role;

    public void Remove(string login) => _roles.TryRemove(login.ToLowerInvariant(), out _);
}

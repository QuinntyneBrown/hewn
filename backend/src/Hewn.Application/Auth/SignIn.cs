using System.Collections.Concurrent;
using Hewn.Application.Abstractions;
using Hewn.Domain;
using MediatR;
using Microsoft.EntityFrameworkCore;

namespace Hewn.Application.Auth;

/// <summary>Looks a GitHub login up on the allow list. Null means the account has no access.</summary>
public sealed record FindAllowListEntryQuery(string Login) : IRequest<AllowListEntry?>;

public sealed class FindAllowListEntryHandler(IAppDbContext db) : IRequestHandler<FindAllowListEntryQuery, AllowListEntry?>
{
    public Task<AllowListEntry?> Handle(FindAllowListEntryQuery query, CancellationToken cancellationToken)
    {
        var login = query.Login.Trim().ToLowerInvariant();
        return db.AllowList.AsNoTracking().SingleOrDefaultAsync(a => a.Login == login, cancellationToken);
    }
}

/// <summary>The GitHub login a sign-in resolved to, and its allow-list entry; a null entry is refused (L2-038 AC2).</summary>
public sealed record GitHubSignIn(string Login, AllowListEntry? Entry);

/// <summary>Completes a GitHub sign-in: the login GitHub vouches for, looked up on the allow list.</summary>
public sealed record SignInWithGitHubCommand(string Code, string RedirectUri) : IRequest<GitHubSignIn>;

public sealed class SignInWithGitHubHandler(IGitHubIdentity gitHub, IMediator mediator) : IRequestHandler<SignInWithGitHubCommand, GitHubSignIn>
{
    public async Task<GitHubSignIn> Handle(SignInWithGitHubCommand command, CancellationToken cancellationToken)
    {
        var login = await gitHub.LoginForCodeAsync(command.Code, command.RedirectUri, cancellationToken);
        return new GitHubSignIn(login, await mediator.Send(new FindAllowListEntryQuery(login), cancellationToken));
    }
}

/// <summary>
/// The signed-out sessions, held in memory so checking a session costs no database read per request; loaded from
/// the database once, and added to on sign-out. Hewn runs one API instance (ADR 0022).
/// </summary>
public sealed class RevokedSessions
{
    private readonly ConcurrentDictionary<Guid, DateTimeOffset> _revoked = new();
    private readonly SemaphoreSlim _load = new(1, 1);
    private volatile bool _loaded;

    public async Task<bool> ContainsAsync(Guid id, IAppDbContext db, CancellationToken cancellationToken)
    {
        await EnsureLoadedAsync(db, cancellationToken);
        return _revoked.ContainsKey(id);
    }

    public async Task AddAsync(Guid id, DateTimeOffset expiresAt, IAppDbContext db, CancellationToken cancellationToken)
    {
        await EnsureLoadedAsync(db, cancellationToken);
        _revoked[id] = expiresAt;
    }

    /// <summary>Drops revocations of sessions that have expired anyway.</summary>
    public void Prune(DateTimeOffset now)
    {
        foreach (var (id, expires) in _revoked)
        {
            if (expires < now)
            {
                _revoked.TryRemove(id, out _);
            }
        }
    }

    private async Task EnsureLoadedAsync(IAppDbContext db, CancellationToken cancellationToken)
    {
        if (_loaded)
        {
            return;
        }

        await _load.WaitAsync(cancellationToken);
        try
        {
            if (!_loaded)
            {
                foreach (var s in await db.RevokedSessions.AsNoTracking().ToListAsync(cancellationToken))
                {
                    _revoked[s.Id] = s.ExpiresAt;
                }

                _loaded = true;
            }
        }
        finally
        {
            _load.Release();
        }
    }
}

/// <summary>Ends a session (L2-038 AC3): its id is kept until the session would have expired, so a replayed cookie is refused.</summary>
public sealed record SignOutCommand(Guid SessionId, DateTimeOffset ExpiresAt) : IRequest;

public sealed class SignOutHandler(IAppDbContext db, RevokedSessions revoked, TimeProvider clock) : IRequestHandler<SignOutCommand>
{
    public async Task Handle(SignOutCommand command, CancellationToken cancellationToken)
    {
        // Sessions past their 8 hours are refused anyway, so their revocations can go.
        var now = clock.GetUtcNow();
        db.RevokedSessions.RemoveRange(await db.RevokedSessions.Where(s => s.ExpiresAt < now).ToListAsync(cancellationToken));
        if (await db.RevokedSessions.FindAsync([command.SessionId], cancellationToken) is null)
        {
            db.RevokedSessions.Add(new RevokedSession(command.SessionId, command.ExpiresAt));
        }

        await db.SaveChangesAsync(cancellationToken);
        await revoked.AddAsync(command.SessionId, command.ExpiresAt, db, cancellationToken);
        revoked.Prune(now);
    }
}

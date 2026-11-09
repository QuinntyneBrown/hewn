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

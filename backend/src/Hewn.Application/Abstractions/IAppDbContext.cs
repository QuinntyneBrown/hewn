using Hewn.Domain;
using Microsoft.EntityFrameworkCore;

namespace Hewn.Application.Abstractions;

public interface IAppDbContext
{
    DbSet<AllowListEntry> AllowList { get; }

    DbSet<Project> Projects { get; }

    DbSet<Direction> Directions { get; }

    DbSet<StoredEvent> Events { get; }

    Task<int> SaveChangesAsync(CancellationToken cancellationToken = default);
}

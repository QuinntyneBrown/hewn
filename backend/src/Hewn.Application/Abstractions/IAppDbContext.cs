using Hewn.Domain;
using Microsoft.EntityFrameworkCore;

namespace Hewn.Application.Abstractions;

public interface IAppDbContext
{
    DbSet<AllowListEntry> AllowList { get; }

    DbSet<Project> Projects { get; }

    DbSet<Direction> Directions { get; }

    DbSet<StoredEvent> Events { get; }

    DbSet<Run> Runs { get; }

    DbSet<Worker> Workers { get; }

    Task<int> SaveChangesAsync(CancellationToken cancellationToken = default);
}

using Hewn.Application.Abstractions;
using Hewn.Domain;
using Microsoft.EntityFrameworkCore;

namespace Hewn.Infrastructure.Persistence;

public sealed class HewnDbContext(DbContextOptions<HewnDbContext> options) : DbContext(options), IAppDbContext
{
    public DbSet<AllowListEntry> AllowList => Set<AllowListEntry>();

    public DbSet<Project> Projects => Set<Project>();

    public DbSet<Direction> Directions => Set<Direction>();

    public DbSet<StoredEvent> Events => Set<StoredEvent>();

    public DbSet<Run> Runs => Set<Run>();

    public DbSet<Worker> Workers => Set<Worker>();

    public DbSet<RunLogLine> RunLogLines => Set<RunLogLine>();

    public DbSet<GitHubMutation> GitHubMutations => Set<GitHubMutation>();

    public DbSet<Increment> Increments => Set<Increment>();

    protected override void OnModelCreating(ModelBuilder modelBuilder)
    {
        modelBuilder.ApplyConfigurationsFromAssembly(typeof(HewnDbContext).Assembly);
    }

    protected override void ConfigureConventions(ModelConfigurationBuilder configurationBuilder)
    {
        // SQLite cannot order or compare DateTimeOffset; store UTC ticks instead.
        configurationBuilder.Properties<DateTimeOffset>().HaveConversion<DateTimeOffsetToTicksConverter>();
        configurationBuilder.Properties<decimal>().HaveConversion<double>();
    }
}

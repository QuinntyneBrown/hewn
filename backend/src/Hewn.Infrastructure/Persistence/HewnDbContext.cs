using Hewn.Application.Abstractions;
using Hewn.Domain;
using Microsoft.EntityFrameworkCore;

namespace Hewn.Infrastructure.Persistence;

public sealed class HewnDbContext(DbContextOptions<HewnDbContext> options) : DbContext(options), IAppDbContext
{
    public DbSet<AllowListEntry> AllowList => Set<AllowListEntry>();

    public DbSet<RevokedSession> RevokedSessions => Set<RevokedSession>();

    public DbSet<WorkerToken> WorkerTokens => Set<WorkerToken>();

    public DbSet<Project> Projects => Set<Project>();

    public DbSet<Direction> Directions => Set<Direction>();

    public DbSet<StoredEvent> Events => Set<StoredEvent>();

    public DbSet<Run> Runs => Set<Run>();

    public DbSet<Worker> Workers => Set<Worker>();

    public DbSet<RunLogLine> RunLogLines => Set<RunLogLine>();

    public DbSet<RunDecision> RunDecisions => Set<RunDecision>();

    public DbSet<GitHubMutation> GitHubMutations => Set<GitHubMutation>();

    public DbSet<Increment> Increments => Set<Increment>();

    public DbSet<IncrementCheck> IncrementChecks => Set<IncrementCheck>();

    public DbSet<ModelCall> ModelCalls => Set<ModelCall>();

    public DbSet<DirectionDefaults> DirectionDefaults => Set<DirectionDefaults>();

    public DbSet<LeasingSwitch> LeasingSwitches => Set<LeasingSwitch>();

    public DbSet<SkillsUpdate> SkillsUpdates => Set<SkillsUpdate>();

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

using Hewn.Domain;
using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;

namespace Hewn.Infrastructure.Persistence;

internal sealed class AllowListEntryConfiguration : IEntityTypeConfiguration<AllowListEntry>
{
    public void Configure(EntityTypeBuilder<AllowListEntry> b)
    {
        b.ToTable("allow_list");
        b.HasKey(a => a.Login);
        b.Property(a => a.Login).HasMaxLength(39);
        b.Property(a => a.Role).HasConversion<string>().HasMaxLength(16);
    }
}

internal sealed class ProjectConfiguration : IEntityTypeConfiguration<Project>
{
    public void Configure(EntityTypeBuilder<Project> b)
    {
        b.ToTable("projects");
        b.HasKey(p => p.Id);
        b.Property(p => p.Name).HasMaxLength(Project.MaxNameLength).IsRequired();
        b.Property(p => p.NormalizedName).HasMaxLength(Project.MaxNameLength).IsRequired();
        b.HasIndex(p => p.NormalizedName).IsUnique();
        b.Property(p => p.Idea).HasMaxLength(Project.MaxIdeaLength).IsRequired();
        b.Property(p => p.StackPreference).HasMaxLength(200);
        b.Property(p => p.RepositoryOwner).HasMaxLength(39);
        b.Property(p => p.RepositoryName).HasMaxLength(100);
        b.Property(p => p.Status).HasConversion<string>().HasMaxLength(16);
        b.Property(p => p.CreatedBy).HasMaxLength(39);
        b.Ignore(p => p.Repository);
        b.HasMany(p => p.Directions).WithOne().HasForeignKey(d => d.ProjectId);
        b.Navigation(p => p.Directions).UsePropertyAccessMode(PropertyAccessMode.Field);
    }
}

internal sealed class DirectionConfiguration : IEntityTypeConfiguration<Direction>
{
    public void Configure(EntityTypeBuilder<Direction> b)
    {
        b.ToTable("directions");
        b.HasKey(d => d.Id);
        b.Property(d => d.Kind).HasConversion<string>().HasMaxLength(16);
        b.Property(d => d.Status).HasConversion<string>().HasMaxLength(16);
        b.Property(d => d.Idea).HasMaxLength(Project.MaxIdeaLength);
        b.Property(d => d.SubmittedBy).HasMaxLength(39);
        b.HasIndex(d => new { d.ProjectId, d.SubmittedAt });
        b.OwnsMany(d => d.Stages, s =>
        {
            s.ToTable("stage_states");
            s.WithOwner().HasForeignKey(x => x.DirectionId);
            s.HasKey(x => new { x.DirectionId, x.Number });
            s.Property(x => x.Number).ValueGeneratedNever();
            s.Property(x => x.Name).HasMaxLength(32);
            s.Property(x => x.Status).HasConversion<string>().HasMaxLength(16);
        });
        b.Navigation(d => d.Stages).UsePropertyAccessMode(PropertyAccessMode.Field);
    }
}

internal sealed class StoredEventConfiguration : IEntityTypeConfiguration<StoredEvent>
{
    public void Configure(EntityTypeBuilder<StoredEvent> b)
    {
        b.ToTable("events");
        b.HasKey(e => e.Id);
        b.Property(e => e.Type).HasMaxLength(64);
        b.HasIndex(e => new { e.ProjectId, e.Sequence }).IsUnique();
    }
}

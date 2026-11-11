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
        b.Property(a => a.AddedBy).HasMaxLength(39);
    }
}

internal sealed class RevokedSessionConfiguration : IEntityTypeConfiguration<RevokedSession>
{
    public void Configure(EntityTypeBuilder<RevokedSession> b)
    {
        b.ToTable("revoked_sessions");
        b.HasKey(s => s.Id);
        b.Property(s => s.Id).ValueGeneratedNever();
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
        b.Property(p => p.ArchivedBy).HasMaxLength(39);
        b.Ignore(p => p.Repository);
        b.Ignore(p => p.IsArchived);
        b.Ignore(p => p.HasActiveDirection);
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
        b.Property(d => d.UiDecision).HasMaxLength(2000);
        b.Property(d => d.PauseReason).HasMaxLength(100);
        b.Property(d => d.PauseRequestedBy).HasMaxLength(39);
        b.Property(d => d.PausedBy).HasMaxLength(39);
        b.Property(d => d.CancelledBy).HasMaxLength(39);
        b.Property(d => d.FailureReason).HasMaxLength(Direction.MaxFailureReasonLength);
        b.Property(d => d.LabelledPullRequests).HasMaxLength(400);
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

internal sealed class RunConfiguration : IEntityTypeConfiguration<Run>
{
    public void Configure(EntityTypeBuilder<Run> b)
    {
        b.ToTable("runs");
        b.HasKey(r => r.Id);
        b.Property(r => r.Status).HasConversion<string>().HasMaxLength(16);
        b.Property(r => r.WorkerId).HasMaxLength(32);
        b.Property(r => r.CheckpointSha).HasMaxLength(64);
        b.Property(r => r.Error).HasMaxLength(2000);
        b.Property(r => r.RanBy).HasMaxLength(32);
        b.Property(r => r.CurrentStepName).HasMaxLength(Run.MaxStepNameLength);
        b.HasIndex(r => new { r.DirectionId, r.Stage });
        b.Property(r => r.LeaseEpoch).IsConcurrencyToken();
        b.HasIndex(r => new { r.Status, r.CreatedAt });
        b.HasIndex(r => new { r.ProjectId, r.Status });
        b.HasIndex(r => new { r.DirectionId, r.Stage });
    }
}

internal sealed class WorkerConfiguration : IEntityTypeConfiguration<Worker>
{
    public void Configure(EntityTypeBuilder<Worker> b)
    {
        b.ToTable("workers");
        b.HasKey(w => w.Id);
        b.Property(w => w.Id).HasMaxLength(32);
        b.Property(w => w.Name).HasMaxLength(100);
        b.Property(w => w.Host).HasMaxLength(255);
        b.Property(w => w.Version).HasMaxLength(64);
        b.Property(w => w.Location).HasConversion<string>().HasMaxLength(16);
        b.Property(w => w.Status).HasConversion<string>().HasMaxLength(16);
        b.Property(w => w.TokenId).HasMaxLength(32);
        b.HasIndex(w => w.TokenId);
    }
}

internal sealed class WorkerTokenConfiguration : IEntityTypeConfiguration<WorkerToken>
{
    public void Configure(EntityTypeBuilder<WorkerToken> b)
    {
        b.ToTable("worker_tokens");
        b.HasKey(t => t.Id);
        b.Property(t => t.Id).HasMaxLength(32);
        b.Property(t => t.Name).HasMaxLength(40);
        b.Property(t => t.Location).HasConversion<string>().HasMaxLength(16);
        b.Property(t => t.Hash).HasMaxLength(64).IsFixedLength();
        b.HasIndex(t => t.Hash).IsUnique();
        b.Property(t => t.CreatedBy).HasMaxLength(39);
        b.Property(t => t.RevokedBy).HasMaxLength(39);
    }
}

internal sealed class RunLogLineConfiguration : IEntityTypeConfiguration<RunLogLine>
{
    public void Configure(EntityTypeBuilder<RunLogLine> b)
    {
        b.ToTable("run_log_lines");
        b.HasKey(l => l.Id);
        b.Property(l => l.Level).HasMaxLength(16);
        b.Property(l => l.Text).HasMaxLength(RunLogLine.MaxTextLength);
        b.HasIndex(l => new { l.RunId, l.Sequence }).IsUnique();
    }
}

internal sealed class RunDecisionConfiguration : IEntityTypeConfiguration<RunDecision>
{
    public void Configure(EntityTypeBuilder<RunDecision> b)
    {
        b.ToTable("run_decisions");
        b.HasKey(d => d.Id);
        b.Property(d => d.Question).HasMaxLength(RunDecision.MaxQuestionLength);
        b.Property(d => d.Answer).HasMaxLength(RunDecision.MaxAnswerLength);
        b.Property(d => d.Rationale).HasMaxLength(RunDecision.MaxRationaleLength);
        b.Property(d => d.CommitSha).HasMaxLength(40);
        b.Property(d => d.Adr).HasMaxLength(RunDecision.MaxAdrLength);
        b.HasIndex(d => new { d.DirectionId, d.Stage });
        b.HasIndex(d => new { d.ProjectId, d.RecordedAt });
    }
}

internal sealed class ModelCallConfiguration : IEntityTypeConfiguration<ModelCall>
{
    public void Configure(EntityTypeBuilder<ModelCall> b)
    {
        b.ToTable("model_calls");
        b.HasKey(c => c.Id);
        b.Property(c => c.CallId).HasMaxLength(ModelCall.MaxCallIdLength);
        b.Property(c => c.Model).HasMaxLength(ModelCall.MaxModelLength);
        b.HasIndex(c => new { c.RunId, c.CallId }).IsUnique();
        b.HasIndex(c => new { c.ProjectId, c.DirectionId });
    }
}

internal sealed class LeasingSwitchConfiguration : IEntityTypeConfiguration<LeasingSwitch>
{
    public void Configure(EntityTypeBuilder<LeasingSwitch> b)
    {
        b.ToTable("leasing_switches");
        b.HasKey(s => s.Id);
        b.Property(s => s.Id).ValueGeneratedNever();
        b.Property(s => s.ChangedBy).HasMaxLength(39);
    }
}

internal sealed class DirectionDefaultsConfiguration : IEntityTypeConfiguration<DirectionDefaults>
{
    public void Configure(EntityTypeBuilder<DirectionDefaults> b)
    {
        b.ToTable("direction_defaults");
        b.HasKey(d => d.Id);
        b.Property(d => d.Id).ValueGeneratedNever();
        b.Property(d => d.UpdatedBy).HasMaxLength(39);
    }
}

internal sealed class GitHubMutationConfiguration : IEntityTypeConfiguration<GitHubMutation>
{
    public void Configure(EntityTypeBuilder<GitHubMutation> b)
    {
        b.ToTable("github_mutations");
        b.HasKey(m => m.Id);
        b.Property(m => m.IdempotencyKey).HasMaxLength(200);
        b.Property(m => m.Kind).HasMaxLength(32);
        b.Property(m => m.Result).HasMaxLength(4000);
        b.HasIndex(m => m.IdempotencyKey).IsUnique();
    }
}

internal sealed class IncrementConfiguration : IEntityTypeConfiguration<Increment>
{
    public void Configure(EntityTypeBuilder<Increment> b)
    {
        b.ToTable("increments");
        b.HasKey(i => i.Id);
        b.Property(i => i.Title).HasMaxLength(200);
        b.Property(i => i.L2Ids).HasMaxLength(2000);
        b.Property(i => i.DependsOn).HasMaxLength(500);
        b.Property(i => i.Reason).HasMaxLength(500);
        b.Property(i => i.Status).HasConversion<string>().HasMaxLength(16);
        b.Property(i => i.EstimateDays).HasPrecision(6, 1);
        b.Property(i => i.FailingTests).HasMaxLength(52_000);
        b.Property(i => i.Video).HasMaxLength(16);
        b.Property(i => i.VideoNote).HasMaxLength(500);
        b.HasIndex(i => new { i.DirectionId, i.Number });
        b.HasIndex(i => i.PullRequestNumber);
    }
}

internal sealed class IncrementCheckConfiguration : IEntityTypeConfiguration<IncrementCheck>
{
    public void Configure(EntityTypeBuilder<IncrementCheck> b)
    {
        b.ToTable("increment_checks");
        b.HasKey(c => c.Id);
        b.Property(c => c.Name).HasMaxLength(200);
        b.Property(c => c.Status).HasMaxLength(16);
        b.Property(c => c.Conclusion).HasMaxLength(32);
        b.HasIndex(c => new { c.IncrementId, c.PullRequestNumber, c.Name }).IsUnique();
    }
}

internal sealed class SkillsUpdateConfiguration : IEntityTypeConfiguration<SkillsUpdate>
{
    public void Configure(EntityTypeBuilder<SkillsUpdate> b)
    {
        b.ToTable("skills_updates");
        b.HasKey(u => u.Id);
        b.HasIndex(u => new { u.ProjectId, u.Status });
        b.Property(u => u.FromSha).HasMaxLength(40);
        b.Property(u => u.ToSha).HasMaxLength(40);
        b.Property(u => u.Branch).HasMaxLength(255);
        b.Property(u => u.PullRequestUrl).HasMaxLength(500);
        b.Property(u => u.RequestedBy).HasMaxLength(39);
        b.Property(u => u.Status).HasConversion<string>().HasMaxLength(20);
    }
}

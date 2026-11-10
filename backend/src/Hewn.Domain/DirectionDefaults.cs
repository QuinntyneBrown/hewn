namespace Hewn.Domain;

/// <summary>The defaults every new direction starts with, set by an Owner in Settings (L2-053 AC1). One row.</summary>
public sealed class DirectionDefaults
{
    public const int SingletonId = 1;
    public const decimal MinBudgetUsd = 10m;
    public const decimal MaxBudgetUsd = 10_000m;
    public const int MinDescopeThresholdDays = 1;
    public const int MaxDescopeThresholdDays = 20;

    private DirectionDefaults()
    {
    }

    public DirectionDefaults(decimal defaultBudgetUsd, string updatedBy, DateTimeOffset now)
    {
        Id = SingletonId;
        Update(defaultBudgetUsd, updatedBy, now);
        UpdatedBy = updatedBy;
    }

    public int Id { get; private set; }

    public decimal DefaultBudgetUsd { get; private set; }

    /// <summary>Ideal days above which stage 9 splits or defers a design (L2-019 AC1); null until an Owner saves one.</summary>
    public int? DescopeThresholdDays { get; private set; }

    public string UpdatedBy { get; private set; } = string.Empty;

    public DateTimeOffset UpdatedAt { get; private set; }

    public void Update(decimal defaultBudgetUsd, string updatedBy, DateTimeOffset now, int? descopeThresholdDays = null)
    {
        DefaultBudgetUsd = defaultBudgetUsd;
        DescopeThresholdDays = descopeThresholdDays ?? DescopeThresholdDays;
        UpdatedBy = updatedBy;
        UpdatedAt = now;
    }
}

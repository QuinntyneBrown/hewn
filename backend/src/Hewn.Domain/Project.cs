namespace Hewn.Domain;

/// <summary>One product being built. Owns one GitHub repository and an ordered queue of directions.</summary>
public sealed class Project
{
    public const int MaxNameLength = 100;
    public const int MinIdeaLength = 10;
    public const int MaxIdeaLength = 20_000;

    private readonly List<Direction> _directions = [];

    private Project()
    {
        Name = string.Empty;
        NormalizedName = string.Empty;
        Idea = string.Empty;
        CreatedBy = string.Empty;
    }

    private Project(string name, string idea, string? stackPreference, RepositoryRef? repository, string createdBy, DateTimeOffset now)
    {
        Id = Guid.NewGuid();
        Name = name;
        NormalizedName = Normalize(name);
        Idea = idea;
        StackPreference = stackPreference;
        RepositoryOwner = repository?.Owner;
        RepositoryName = repository?.Name;
        CreatedBy = createdBy;
        CreatedAt = now;
        Status = ProjectStatus.Running;
    }

    public Guid Id { get; private set; }

    public string Name { get; private set; }

    /// <summary>The name in upper-invariant form; unique across projects.</summary>
    public string NormalizedName { get; private set; }

    public string Idea { get; private set; }

    public string? StackPreference { get; private set; }

    public string? RepositoryOwner { get; private set; }

    public string? RepositoryName { get; private set; }

    public ProjectStatus Status { get; private set; }

    public string CreatedBy { get; private set; }

    public DateTimeOffset CreatedAt { get; private set; }

    public IReadOnlyList<Direction> Directions => _directions;

    public string? Repository => RepositoryOwner is null ? null : $"{RepositoryOwner}/{RepositoryName}";

    /// <summary>Running while a direction is active; Idle once none is; Blocked when a stage fails.</summary>
    public void ChangeStatus(ProjectStatus status) => Status = status;

    /// <summary>Records the repository stage 0 created or adopted. A project's repository never changes once set.</summary>
    public void AttachRepository(string owner, string name)
    {
        if (RepositoryOwner is not null)
        {
            throw new InvalidOperationException($"Project {Id} already has repository {Repository}.");
        }

        RepositoryOwner = owner;
        RepositoryName = name;
    }

    /// <summary>The direction now running or paused, or the oldest still queued; null when the project is idle.</summary>
    public Direction? ActiveDirection =>
        _directions.Where(d => d.IsActive).OrderBy(d => d.Status == DirectionStatus.Queued).ThenBy(d => d.SubmittedAt).FirstOrDefault();

    /// <summary>True once the first product direction is Complete; a feature submitted earlier waits behind it.</summary>
    public bool FirstDirectionComplete =>
        _directions.OrderBy(d => d.SubmittedAt).FirstOrDefault()?.Status == DirectionStatus.Complete;

    /// <summary>
    /// Adds a feature direction (L2-005). Returns true when it can start now; false when another direction is
    /// active and it waits in the queue, first in, first out (L2-004 AC4).
    /// </summary>
    public bool AddFeatureDirection(string idea, decimal budgetUsd, string submittedBy, DateTimeOffset now, out Direction direction)
    {
        var startsNow = ActiveDirection is null;
        direction = Direction.Feature(Id, idea, budgetUsd, submittedBy, now);
        _directions.Add(direction);
        return startsNow;
    }

    /// <summary>The oldest queued direction, to start once the active one ends; null when none waits.</summary>
    public Direction? NextQueuedDirection(Guid endedDirectionId) =>
        _directions.Where(d => d.Id != endedDirectionId && d.Status == DirectionStatus.Queued).OrderBy(d => d.SubmittedAt).FirstOrDefault();

    public static string Normalize(string name) => name.Trim().ToUpperInvariant();

    /// <summary>Creates a project with its first product direction queued and stage 0 Pending.</summary>
    public static Project CreateWithProductDirection(
        string name,
        string idea,
        string? stackPreference,
        RepositoryRef? repository,
        decimal budgetUsd,
        string createdBy,
        DateTimeOffset now)
    {
        var project = new Project(name.Trim(), idea, stackPreference, repository, createdBy, now);
        project._directions.Add(Direction.Product(project.Id, idea, budgetUsd, createdBy, now));
        return project;
    }
}

/// <summary>A GitHub repository, as {owner}/{name}.</summary>
public sealed record RepositoryRef(string Owner, string Name);

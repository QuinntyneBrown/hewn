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

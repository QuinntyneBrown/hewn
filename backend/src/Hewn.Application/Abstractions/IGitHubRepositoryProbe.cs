namespace Hewn.Application.Abstractions;

public enum RepositoryAccess
{
    Writable,
    NotFound,
    NoAccess,
}

/// <summary>Reports whether Hewn's GitHub credential can write to a repository.</summary>
public interface IGitHubRepositoryProbe
{
    Task<RepositoryAccess> ProbeAsync(string owner, string name, CancellationToken cancellationToken);
}

using Hewn.Application.Abstractions;
using Hewn.Domain;

namespace Hewn.Application.Audit;

/// <summary>
/// Adds an audit entry to the change being saved (L2-044 AC1), so an action and its entry commit together or not at
/// all. Callers save; the writer never does.
/// </summary>
public sealed class AuditWriter(IAppDbContext db, IRequestOrigin origin, TimeProvider clock)
{
    /// <summary>"All projects": the target of stopping and starting every worker.</summary>
    public const string AllProjects = "All projects";

    /// <summary>Records an action a person took in this request on a project, from the request's IP address.</summary>
    public void Record(AuditAction action, string actor, Project project) =>
        Add(action, actor, project.Id, project.Name, project.Name, origin.IpAddress);

    /// <summary>Records an action a person took in this request on no one project, from the request's IP address.</summary>
    public void Record(AuditAction action, string actor, string? target) =>
        Add(action, actor, null, null, target, origin.IpAddress);

    /// <summary>Records a merge Hewn made for whoever submitted the direction: no IP address.</summary>
    public void RecordMerge(string actor, Project project, int pullRequest) =>
        Add(AuditAction.Merge, actor, project.Id, project.Name, $"{project.Name} #{pullRequest}", null);

    private void Add(AuditAction action, string actor, Guid? projectId, string? projectName, string? target, string? ip) =>
        db.AuditEntries.Add(new AuditEntry(clock.GetUtcNow(), actor, action, projectId, projectName, target, ip));
}

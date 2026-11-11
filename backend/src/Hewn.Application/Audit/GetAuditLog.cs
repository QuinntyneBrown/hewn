using Hewn.Application.Abstractions;
using Hewn.Domain;
using MediatR;
using Microsoft.EntityFrameworkCore;

namespace Hewn.Application.Audit;

public sealed record AuditEntryDto(long Id, DateTimeOffset At, string Actor, string Action, Guid? ProjectId, string? Target, string? IpAddress);

public sealed record AuditProjectDto(Guid Id, string Name);

/// <summary>
/// A page of entries, newest first, and every project the log names (for the project filter, including deleted ones).
/// `Next` is the cursor for the page after this one, or null on the last page.
/// </summary>
public sealed record AuditLogDto(IReadOnlyList<AuditEntryDto> Entries, IReadOnlyList<AuditProjectDto> Projects, string? Next);

public sealed record GetAuditLogQuery(Guid? ProjectId, AuditAction? Action, long? Before, int Limit) : IRequest<AuditLogDto>;

/// <summary>L2-044 AC2: entries newest first, filtered by project and action, a page at a time.</summary>
public sealed class GetAuditLogHandler(IAppDbContext db) : IRequestHandler<GetAuditLogQuery, AuditLogDto>
{
    public const int DefaultLimit = 100;
    public const int MaxLimit = 200;

    public async Task<AuditLogDto> Handle(GetAuditLogQuery query, CancellationToken cancellationToken)
    {
        var limit = Math.Clamp(query.Limit, 1, MaxLimit);
        var entries = db.AuditEntries.AsNoTracking();
        if (query.ProjectId is { } projectId)
        {
            entries = entries.Where(e => e.ProjectId == projectId);
        }

        if (query.Action is { } action)
        {
            entries = entries.Where(e => e.Action == action);
        }

        if (query.Before is { } before)
        {
            entries = entries.Where(e => e.Id < before);
        }

        var page = await entries.OrderByDescending(e => e.Id).Take(limit + 1).ToListAsync(cancellationToken);
        var next = page.Count > limit ? page[limit - 1].Id.ToString(System.Globalization.CultureInfo.InvariantCulture) : null;

        // Each project once, under the name of its newest entry, newest first.
        var named = await db.AuditEntries.AsNoTracking()
            .Where(e => e.ProjectId != null && e.ProjectName != null)
            .GroupBy(e => e.ProjectId)
            .Select(g => g.OrderByDescending(e => e.Id).Select(e => new { e.Id, ProjectId = e.ProjectId!.Value, Name = e.ProjectName! }).First())
            .ToListAsync(cancellationToken);
        var projects = named.OrderByDescending(p => p.Id).Select(p => new AuditProjectDto(p.ProjectId, p.Name)).ToList();

        return new AuditLogDto(
            page.Take(limit).Select(e => new AuditEntryDto(e.Id, e.At, e.Actor, e.Action.ToString(), e.ProjectId, e.Target, e.IpAddress)).ToList(),
            projects,
            next);
    }
}

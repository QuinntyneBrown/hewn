using Hewn.Api.Auth;
using Hewn.Application.Audit;
using Hewn.Application.Common;
using Hewn.Domain;
using MediatR;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;

namespace Hewn.Api.Controllers;

/// <summary>
/// L2-044 AC2: the audit log, for Owners, newest first, filtered by project and action. It is read-only: there is no
/// endpoint that writes, edits or deletes an entry (AC1); entries are written by the actions they record.
/// </summary>
[ApiController]
[Route("api/audit")]
[Authorize(Policy = AuthSetup.OwnerPolicy)]
public sealed class AuditController(IMediator mediator) : ControllerBase
{
    [HttpGet]
    public Task<AuditLogDto> List(
        [FromQuery] Guid? project,
        [FromQuery] string? action,
        [FromQuery] long? before,
        [FromQuery] int? limit,
        CancellationToken cancellationToken)
    {
        AuditAction? filter = null;
        if (!string.IsNullOrEmpty(action))
        {
            filter = Enum.TryParse<AuditAction>(action, ignoreCase: false, out var parsed) && Enum.IsDefined(parsed)
                ? parsed
                : throw new FieldValidationException(
                    [new FieldError("action", $"Choose one of: {string.Join(", ", Enum.GetNames<AuditAction>())}.", "Unknown action")],
                    "invalid_action");
        }

        return mediator.Send(new GetAuditLogQuery(project, filter, before, limit ?? GetAuditLogHandler.DefaultLimit), cancellationToken);
    }
}

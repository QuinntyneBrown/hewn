using FluentValidation;
using Hewn.Application.Abstractions;
using Hewn.Domain;
using MediatR;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Options;

namespace Hewn.Application.Spend;

public sealed record DirectionDefaultsDto(decimal DefaultBudgetUsd);

/// <summary>The defaults a new direction starts with: the Owner's saved value, else the configured fallback.</summary>
public sealed class DirectionDefaultsReader(IAppDbContext db, IOptions<SpendOptions> options)
{
    public async Task<DirectionDefaultsDto> ReadAsync(CancellationToken cancellationToken)
    {
        var saved = await db.DirectionDefaults.AsNoTracking()
            .Where(d => d.Id == DirectionDefaults.SingletonId)
            .Select(d => (decimal?)d.DefaultBudgetUsd)
            .SingleOrDefaultAsync(cancellationToken);
        return new DirectionDefaultsDto(saved ?? options.Value.DefaultBudgetUsd);
    }
}

public sealed record GetDirectionDefaultsQuery : IRequest<DirectionDefaultsDto>;

public sealed class GetDirectionDefaultsHandler(DirectionDefaultsReader reader) : IRequestHandler<GetDirectionDefaultsQuery, DirectionDefaultsDto>
{
    public Task<DirectionDefaultsDto> Handle(GetDirectionDefaultsQuery query, CancellationToken cancellationToken) =>
        reader.ReadAsync(cancellationToken);
}

public sealed record UpdateDirectionDefaultsCommand(decimal DefaultBudgetUsd) : IRequest<DirectionDefaultsDto>;

public sealed class UpdateDirectionDefaultsValidator : AbstractValidator<UpdateDirectionDefaultsCommand>
{
    public UpdateDirectionDefaultsValidator()
    {
        RuleFor(c => c.DefaultBudgetUsd)
            .InclusiveBetween(DirectionDefaults.MinBudgetUsd, DirectionDefaults.MaxBudgetUsd)
            .WithMessage("Default budget must be between $10.00 and $10,000.00.")
            .WithState(_ => "Default budget is out of range");
    }
}

/// <summary>L2-053 AC1: an Owner sets the default budget; directions already submitted keep theirs.</summary>
public sealed class UpdateDirectionDefaultsHandler(IAppDbContext db, ICurrentUser user, TimeProvider clock)
    : IRequestHandler<UpdateDirectionDefaultsCommand, DirectionDefaultsDto>
{
    public async Task<DirectionDefaultsDto> Handle(UpdateDirectionDefaultsCommand command, CancellationToken cancellationToken)
    {
        var budget = Math.Round(command.DefaultBudgetUsd, 2, MidpointRounding.AwayFromZero);
        var defaults = await db.DirectionDefaults.SingleOrDefaultAsync(d => d.Id == DirectionDefaults.SingletonId, cancellationToken);
        if (defaults is null)
        {
            db.DirectionDefaults.Add(new DirectionDefaults(budget, user.Login, clock.GetUtcNow()));
        }
        else
        {
            defaults.Update(budget, user.Login, clock.GetUtcNow());
        }

        await db.SaveChangesAsync(cancellationToken);
        return new DirectionDefaultsDto(budget);
    }
}

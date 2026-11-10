using FluentValidation;
using Hewn.Application.Abstractions;
using Hewn.Domain;
using MediatR;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Options;
using Hewn.Application.Pipeline;

namespace Hewn.Application.Spend;

public sealed record DirectionDefaultsDto(decimal DefaultBudgetUsd, decimal DescopeThresholdDays);

/// <summary>The defaults a new direction starts with: the Owner's saved values, else the configured fallbacks.</summary>
public sealed class DirectionDefaultsReader(IAppDbContext db, IOptions<SpendOptions> options, IOptions<PipelineOptions> pipeline)
{
    public async Task<DirectionDefaultsDto> ReadAsync(CancellationToken cancellationToken)
    {
        var saved = await db.DirectionDefaults.AsNoTracking()
            .SingleOrDefaultAsync(d => d.Id == DirectionDefaults.SingletonId, cancellationToken);
        return new DirectionDefaultsDto(
            saved?.DefaultBudgetUsd ?? options.Value.DefaultBudgetUsd,
            saved?.DescopeThresholdDays ?? pipeline.Value.DescopeThresholdDays);
    }
}

public sealed record GetDirectionDefaultsQuery : IRequest<DirectionDefaultsDto>;

public sealed class GetDirectionDefaultsHandler(DirectionDefaultsReader reader) : IRequestHandler<GetDirectionDefaultsQuery, DirectionDefaultsDto>
{
    public Task<DirectionDefaultsDto> Handle(GetDirectionDefaultsQuery query, CancellationToken cancellationToken) =>
        reader.ReadAsync(cancellationToken);
}

/// <summary>A null threshold keeps the one saved.</summary>
public sealed record UpdateDirectionDefaultsCommand(decimal DefaultBudgetUsd, decimal? DescopeThresholdDays = null) : IRequest<DirectionDefaultsDto>;

public sealed class UpdateDirectionDefaultsValidator : AbstractValidator<UpdateDirectionDefaultsCommand>
{
    public UpdateDirectionDefaultsValidator()
    {
        RuleFor(c => c.DefaultBudgetUsd)
            .InclusiveBetween(DirectionDefaults.MinBudgetUsd, DirectionDefaults.MaxBudgetUsd)
            .WithMessage("Default budget must be between $10.00 and $10,000.00.")
            .WithState(_ => "Default budget is out of range");
        RuleFor(c => c.DescopeThresholdDays)
            .Must(d => d is null || (d % 1 == 0 && d >= DirectionDefaults.MinDescopeThresholdDays && d <= DirectionDefaults.MaxDescopeThresholdDays))
            .WithMessage("Descope threshold must be a whole number of days from 1 to 20.")
            .WithState(_ => "Descope threshold must be 1 to 20 days");
    }
}

/// <summary>
/// L2-053 AC1 and L2-019 AC1: an Owner sets the default budget and the descope threshold. Directions already submitted
/// keep their budget; stage 9 reads the threshold when it is leased.
/// </summary>
public sealed class UpdateDirectionDefaultsHandler(IAppDbContext db, ICurrentUser user, TimeProvider clock, DirectionDefaultsReader reader)
    : IRequestHandler<UpdateDirectionDefaultsCommand, DirectionDefaultsDto>
{
    public async Task<DirectionDefaultsDto> Handle(UpdateDirectionDefaultsCommand command, CancellationToken cancellationToken)
    {
        var budget = Math.Round(command.DefaultBudgetUsd, 2, MidpointRounding.AwayFromZero);
        var threshold = (int?)command.DescopeThresholdDays;
        var defaults = await db.DirectionDefaults.SingleOrDefaultAsync(d => d.Id == DirectionDefaults.SingletonId, cancellationToken);
        if (defaults is null)
        {
            defaults = new DirectionDefaults(budget, user.Login, clock.GetUtcNow());
            db.DirectionDefaults.Add(defaults);
        }

        defaults.Update(budget, user.Login, clock.GetUtcNow(), threshold);
        await db.SaveChangesAsync(cancellationToken);
        return await reader.ReadAsync(cancellationToken);
    }
}

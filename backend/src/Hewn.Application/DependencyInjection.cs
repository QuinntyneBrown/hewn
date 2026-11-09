using FluentValidation;
using Hewn.Application.Common;
using Hewn.Application.Events;
using Hewn.Application.Pipeline;
using MediatR;
using Microsoft.Extensions.DependencyInjection;

namespace Hewn.Application;

public static class DependencyInjection
{
    public static IServiceCollection AddApplication(this IServiceCollection services)
    {
        services.AddMediatR(c => c.RegisterServicesFromAssembly(typeof(DependencyInjection).Assembly));
        // L2-043: the submission limit runs before validation (ADR 0015).
        services.AddTransient(typeof(IPipelineBehavior<,>), typeof(Projects.DirectionSubmissionLimit<,>));
        services.AddTransient(typeof(IPipelineBehavior<,>), typeof(ValidationBehavior<,>));
        services.AddSingleton<Projects.DirectionSubmissionGate>();
        services.AddValidatorsFromAssembly(typeof(DependencyInjection).Assembly, includeInternalTypes: true);
        services.AddScoped<EventAppender>();
        services.AddScoped<PipelineOrchestrator>();
        services.AddScoped<LeaseService>();
        services.AddSingleton<RunControlSignals>();
        services.AddScoped<Spend.PriceTable>();
        services.AddScoped<Spend.DirectionDefaultsReader>();
        services.AddScoped<RepositoryProvisioner>();
        services.AddSingleton(TimeProvider.System);
        return services;
    }
}

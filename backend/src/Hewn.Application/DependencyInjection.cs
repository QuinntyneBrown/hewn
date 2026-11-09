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
        services.AddTransient(typeof(IPipelineBehavior<,>), typeof(ValidationBehavior<,>));
        services.AddValidatorsFromAssembly(typeof(DependencyInjection).Assembly, includeInternalTypes: true);
        services.AddScoped<EventAppender>();
        services.AddScoped<PipelineOrchestrator>();
        services.AddScoped<LeaseService>();
        services.AddSingleton(TimeProvider.System);
        return services;
    }
}

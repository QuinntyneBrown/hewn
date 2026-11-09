using Hewn.Application.Abstractions;
using Hewn.Infrastructure.Fakes;
using Hewn.Infrastructure.GitHub;
using Hewn.Infrastructure.Persistence;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Configuration;
using Microsoft.Extensions.DependencyInjection;

namespace Hewn.Infrastructure;

public static class DependencyInjection
{
    public static IServiceCollection AddInfrastructure(this IServiceCollection services, IConfiguration configuration)
    {
        var connectionString = configuration.GetConnectionString("Hewn") ?? "DataSource=hewn.db";
        services.AddDbContext<HewnDbContext>(o => o.UseSqlite(connectionString, s => s.UseQuerySplittingBehavior(QuerySplittingBehavior.SplitQuery)));
        services.AddScoped<IAppDbContext>(sp => sp.GetRequiredService<HewnDbContext>());

        services.Configure<GitHubAppOptions>(o =>
        {
            o.AppId = configuration["HEWN_GITHUB_APP_ID"];
            o.PrivateKey = configuration["HEWN_GITHUB_APP_PRIVATE_KEY"];
        });

        if (configuration.GetValue<bool>("Hewn:Fakes:Enabled"))
        {
            services.AddSingleton<IGitHubRepositoryProbe, ScriptedGitHubRepositoryProbe>();
        }
        else
        {
            services.AddHttpClient<GitHubAppClient>();
            services.AddScoped<IGitHubRepositoryProbe, GitHubAppRepositoryProbe>();
        }

        return services;
    }
}

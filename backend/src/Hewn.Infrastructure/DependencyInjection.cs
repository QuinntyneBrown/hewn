using Hewn.Application.Abstractions;
using Hewn.Application.Pipeline;
using Hewn.Application.Spend;
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

        services.Configure<SpendOptions>(o =>
        {
            if (decimal.TryParse(configuration["HEWN_DEFAULT_BUDGET_USD"], System.Globalization.CultureInfo.InvariantCulture, out var budget) && budget > 0)
            {
                o.DefaultBudgetUsd = budget;
            }

            // Hewn:Prices:{model}:InputPerMillionUsd and OutputPerMillionUsd add to or replace the built-in rates.
            foreach (var model in configuration.GetSection("Hewn:Prices").GetChildren())
            {
                var input = model.GetValue<decimal?>("InputPerMillionUsd");
                var output = model.GetValue<decimal?>("OutputPerMillionUsd");
                if (input is >= 0 && output is >= 0)
                {
                    o.Prices[model.Key] = new ModelPrice(input.Value, output.Value);
                }
            }
        });

        services.Configure<PipelineOptions>(o =>
        {
            o.GitHubOwner = configuration["HEWN_GITHUB_OWNER"];
            if (!string.IsNullOrWhiteSpace(configuration["HEWN_SKILLS_SOURCE"]))
            {
                o.SkillsSource = configuration["HEWN_SKILLS_SOURCE"]!;
            }

            if (decimal.TryParse(configuration["HEWN_DESCOPE_THRESHOLD_DAYS"], System.Globalization.CultureInfo.InvariantCulture, out var threshold) && threshold > 0)
            {
                o.DescopeThresholdDays = threshold;
            }

            if (int.TryParse(configuration["HEWN_MAX_ITERATIONS"], out var iterations) && iterations > 0)
            {
                o.MaxIterations = iterations;
            }

            if (int.TryParse(configuration["Hewn:Control:StopDeadlineSeconds"], out var deadline) && deadline > 0)
            {
                o.StopDeadlineSeconds = deadline;
            }

            if (int.TryParse(configuration["Hewn:RateLimit:DirectionsPerMinute"], out var perMinute) && perMinute > 0)
            {
                o.DirectionsPerMinute = perMinute;
            }

            if (configuration["Hewn:Retry:BackoffSeconds"] is { Length: > 0 } backoff)
            {
                o.RetryBackoffSeconds = [.. backoff.Split(',').Select(v => int.Parse(v.Trim(), System.Globalization.CultureInfo.InvariantCulture))];
            }
        });

        if (configuration.GetValue<bool>("Hewn:Fakes:Enabled"))
        {
            services.AddSingleton<InMemoryGitHub>(sp => new InMemoryGitHub(configuration));
            services.AddSingleton<IGitHubRepositoryProbe>(sp => sp.GetRequiredService<InMemoryGitHub>());
            services.AddSingleton<IGitHubRepositories>(sp => sp.GetRequiredService<InMemoryGitHub>());
        }
        else
        {
            services.AddHttpClient<GitHubAppClient>();
            services.AddScoped<IGitHubRepositoryProbe, GitHubAppRepositoryProbe>();
            services.AddScoped<IGitHubRepositories, GitHubAppRepositories>();
        }

        return services;
    }
}

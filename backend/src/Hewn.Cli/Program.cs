using Hewn.Infrastructure.Persistence;
using Hewn.Infrastructure.Secrets;
using Hewn.Infrastructure.Seeding;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Configuration;

// hewn migrate | seed | reset --yes | secret set <name> | secret list
// Reads the connection string from ConnectionStrings__Hewn (default: DataSource=hewn.db).
var connectionString = Environment.GetEnvironmentVariable("ConnectionStrings__Hewn") ?? "DataSource=hewn.db";
var options = new DbContextOptionsBuilder<HewnDbContext>().UseSqlite(connectionString).Options;
await using var db = new HewnDbContext(options);

switch (args.FirstOrDefault())
{
    // L2-040 AC1: the value comes on standard input, so it is never in the shell's history or a process list, and is
    // never printed. HEWN_SECRET_STORE picks the store: os locally, keyvault (with HEWN_KEY_VAULT_URI) in the cloud.
    case "secret" when args is [_, "set", _] or [_, "list"]:
        var configuration = new ConfigurationBuilder().AddInMemoryCollection(
            new[] { "HEWN_SECRET_STORE", "HEWN_KEY_VAULT_URI", "HEWN_KEY_STORE_SERVICE" }
                .Select(key => KeyValuePair.Create(key, Environment.GetEnvironmentVariable(key)))).Build();
        if (string.IsNullOrEmpty(configuration["HEWN_SECRET_STORE"]) || configuration["HEWN_SECRET_STORE"] == "memory")
        {
            Console.Error.WriteLine("Set HEWN_SECRET_STORE to os or keyvault first.");
            return 2;
        }

        var store = SecretStores.Create(configuration);
        if (args[1] == "list")
        {
            foreach (var reference in await store.ListAsync(CancellationToken.None))
            {
                Console.WriteLine($"{reference.Name,-24} {(reference.UpdatedAt is { } at ? $"updated {at:yyyy-MM-dd HH:mm:ss}Z" : "not set")}");
            }

            return 0;
        }

        if (!Console.IsInputRedirected)
        {
            Console.Error.WriteLine($"Enter {args[2]}, then press Ctrl-D:");
        }

        var value = (await Console.In.ReadToEndAsync()).TrimEnd('\r', '\n');
        try
        {
            await store.SetAsync(args[2], value, CancellationToken.None);
        }
        catch (ArgumentException e)
        {
            Console.Error.WriteLine(e.Message.Split(" (Parameter")[0]);
            return 2;
        }

        Console.WriteLine($"Stored {args[2]}. Restart the API and workers to use it.");
        return 0;

    case "migrate":
        await db.Database.MigrateAsync();
        Console.WriteLine("Database is up to date.");
        return 0;

    case "seed":
        await db.Database.MigrateAsync();
        var added = await AllowListSeeder.SeedAsync(db, Environment.GetEnvironmentVariable("HEWN_ALLOWED_GITHUB_USERS"));
        Console.WriteLine($"Seeded {added} allow-list entr{(added == 1 ? "y" : "ies")}.");
        return 0;

    case "reset" when args.Contains("--yes"):
        await db.Database.EnsureDeletedAsync();
        await db.Database.MigrateAsync();
        Console.WriteLine("Database reset.");
        return 0;

    case "reset":
        Console.Error.WriteLine("reset deletes every project. Run `hewn reset --yes` to confirm.");
        return 2;

    default:
        Console.Error.WriteLine("Usage: hewn migrate | seed | reset --yes | secret set <name> | secret list");
        return 2;
}

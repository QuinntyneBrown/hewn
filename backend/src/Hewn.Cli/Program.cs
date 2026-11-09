using Hewn.Infrastructure.Persistence;
using Hewn.Infrastructure.Seeding;
using Microsoft.EntityFrameworkCore;

// hewn migrate | seed | reset --yes
// Reads the connection string from ConnectionStrings__Hewn (default: DataSource=hewn.db).
var connectionString = Environment.GetEnvironmentVariable("ConnectionStrings__Hewn") ?? "DataSource=hewn.db";
var options = new DbContextOptionsBuilder<HewnDbContext>().UseSqlite(connectionString).Options;
await using var db = new HewnDbContext(options);

switch (args.FirstOrDefault())
{
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
        Console.Error.WriteLine("Usage: hewn migrate | seed | reset --yes");
        return 2;
}

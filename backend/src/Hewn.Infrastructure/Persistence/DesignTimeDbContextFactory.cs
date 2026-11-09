using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Design;

namespace Hewn.Infrastructure.Persistence;

/// <summary>Lets `dotnet ef migrations add` build the context without starting the API.</summary>
internal sealed class DesignTimeDbContextFactory : IDesignTimeDbContextFactory<HewnDbContext>
{
    public HewnDbContext CreateDbContext(string[] args) =>
        new(new DbContextOptionsBuilder<HewnDbContext>().UseSqlite("DataSource=design.db").Options);
}

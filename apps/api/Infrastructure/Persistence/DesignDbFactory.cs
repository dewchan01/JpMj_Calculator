using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Design;

namespace Riichi.Api.Data;

/// <summary>Creates the SQL Server model for explicit deployment migrations.</summary>
public sealed class DesignDbFactory : IDesignTimeDbContextFactory<AppDb>
{
    /// <inheritdoc />
    public AppDb CreateDbContext(string[] args) => new(new DbContextOptionsBuilder<AppDb>()
        .UseSqlServer(Environment.GetEnvironmentVariable("ConnectionStrings__Database") ??
            "Server=localhost;Database=Riichi;Integrated Security=true;TrustServerCertificate=true")
        .Options);
}

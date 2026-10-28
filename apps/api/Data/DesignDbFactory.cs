using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Design;

namespace Riichi.Api.Data;

// Schema generation never opens a connection. Applying migrations requires an explicit deployment connection.
public sealed class DesignDbFactory : IDesignTimeDbContextFactory<AppDb>
{
    public AppDb CreateDbContext(string[] args) => new(new DbContextOptionsBuilder<AppDb>()
        .UseSqlServer(Environment.GetEnvironmentVariable("ConnectionStrings__Database") ??
            "Server=localhost;Database=Riichi;Integrated Security=true;TrustServerCertificate=true")
        .Options);
}

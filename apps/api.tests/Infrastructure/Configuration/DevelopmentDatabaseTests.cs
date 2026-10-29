using FluentAssertions;
using Microsoft.Data.Sqlite;
using Microsoft.EntityFrameworkCore;
using Microsoft.VisualStudio.TestTools.UnitTesting;
using Riichi.Api.Data;
using Riichi.Api.Infrastructure.Persistence;

namespace Riichi.Api.Tests;

[TestClass]
public sealed class DevelopmentDatabaseTests
{
    [TestMethod]
    public async Task UpgradeKeepsExistingRoomsAndCanRunAgain()
    {
        await using var connection = new SqliteConnection("Data Source=:memory:");
        await connection.OpenAsync();
        await using var db = new AppDb(new DbContextOptionsBuilder<AppDb>().UseSqlite(connection).Options);
        await db.Database.EnsureCreatedAsync();
        db.Rooms.Add(new Room { Id = "existing", PlayerCount = 3 });
        await db.SaveChangesAsync();
        await db.Database.ExecuteSqlRawAsync("ALTER TABLE Rooms DROP COLUMN Permissions");
        db.ChangeTracker.Clear();

        await DevelopmentDatabase.InitializeAsync(db);
        await DevelopmentDatabase.InitializeAsync(db);

        var room = await db.Rooms.SingleAsync();
        room.Id.Should().Be("existing");
        room.Permissions.Should().Be("{}");
    }
}

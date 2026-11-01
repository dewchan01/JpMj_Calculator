using Microsoft.EntityFrameworkCore;
using Riichi.Api.Data;

namespace Riichi.Api.Infrastructure.Persistence;

/// <summary>Initializes local-only SQLite storage without discarding existing rooms.</summary>
public static class DevelopmentDatabase
{
    /// <summary>Creates the local schema and applies the additive room-capability upgrade.</summary>
    /// <param name="db">The local context.</param>
    /// <param name="cancellationToken">The caller cancellation token.</param>
    /// <returns>The initialization completion.</returns>
    public static async Task InitializeAsync(AppDb db, CancellationToken cancellationToken = default)
    {
        ArgumentNullException.ThrowIfNull(db);
        await db.Database.EnsureCreatedAsync(cancellationToken);
        if (!db.Database.IsSqlite()) return;
        await db.Database.ExecuteSqlRawAsync("CREATE TABLE IF NOT EXISTS Unassigned (RoomId TEXT NOT NULL, Id TEXT NOT NULL, TokenHash TEXT NOT NULL, RequestedSeat INTEGER NULL, PRIMARY KEY (RoomId, Id), FOREIGN KEY (RoomId) REFERENCES Rooms (Id) ON DELETE CASCADE)", cancellationToken);
        await db.Database.ExecuteSqlRawAsync("CREATE UNIQUE INDEX IF NOT EXISTS IX_Unassigned_RoomId_TokenHash ON Unassigned (RoomId, TokenHash)", cancellationToken);
        await db.Database.OpenConnectionAsync(cancellationToken);
        try
        {
            await using var command = db.Database.GetDbConnection().CreateCommand();
            foreach (var (table, name, definition) in new[] { ("Rooms", "Closed", "INTEGER NOT NULL DEFAULT 0"), ("Rooms", "HostOfflineSince", "INTEGER NULL"), ("Seats", "OfflineSince", "INTEGER NULL"), ("Unassigned", "Decision", "TEXT NOT NULL DEFAULT 'unassigned'") })
            {
                command.CommandText = $"SELECT COUNT(*) FROM pragma_table_info('{table}') WHERE name = '{name}'";
                if (Convert.ToInt64(await command.ExecuteScalarAsync(cancellationToken)) == 0)
                {
                    command.CommandText = $"ALTER TABLE {table} ADD COLUMN {name} {definition}";
                    await command.ExecuteNonQueryAsync(cancellationToken);
                }
            }
            command.CommandText = "SELECT COUNT(*) FROM pragma_table_info('Rooms') WHERE name = 'Permissions'";
            if (Convert.ToInt64(await command.ExecuteScalarAsync(cancellationToken)) == 0)
            {
                command.CommandText = "ALTER TABLE Rooms ADD COLUMN Permissions TEXT NOT NULL DEFAULT '{}'";
                await command.ExecuteNonQueryAsync(cancellationToken);
            }
        }
        finally { await db.Database.CloseConnectionAsync(); }
    }
}

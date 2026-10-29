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
        await db.Database.OpenConnectionAsync(cancellationToken);
        try
        {
            await using var command = db.Database.GetDbConnection().CreateCommand();
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

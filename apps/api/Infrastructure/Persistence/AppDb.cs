using Microsoft.EntityFrameworkCore;

namespace Riichi.Api.Data;

/// <summary>Stores rooms, seat credentials, declarations and expiring archives.</summary>
/// <param name="options">The configured database provider.</param>
public sealed class AppDb(DbContextOptions<AppDb> options) : DbContext(options ?? throw new ArgumentNullException(nameof(options)))
{
    /// <summary>Gets the shares collection.</summary>
    public DbSet<SharedArchive> Shares => Set<SharedArchive>();
    /// <summary>Gets the rooms collection.</summary>
    public DbSet<Room> Rooms => Set<Room>();
    /// <summary>Gets the seats collection.</summary>
    public DbSet<Seat> Seats => Set<Seat>();
    /// <summary>Gets the actions collection.</summary>
    public DbSet<RoomAction> Actions => Set<RoomAction>();

    /// <summary>Estimates the combined logical quota for archives, snapshots and declarations.</summary>
    /// <param name="cancellationToken">The caller cancellation token.</param>
    /// <returns>The estimated storage in bytes.</returns>
    public async Task<long> StorageBytes(CancellationToken cancellationToken = default) =>
        (await Shares.SumAsync(x => (long?)x.Size, cancellationToken) ?? 0) +
        (await Rooms.SumAsync(x => (long?)(x.Snapshot.Length * 2L + 1024), cancellationToken) ?? 0) +
        (await Actions.SumAsync(x => (long?)(x.Payload.Length * 2L + 1024), cancellationToken) ?? 0);

    /// <inheritdoc />
    protected override void OnModelCreating(ModelBuilder model)
    {
        model.Entity<SharedArchive>().Property(x => x.Id).HasMaxLength(64);
        model.Entity<SharedArchive>().HasIndex(x => x.ExpiresAt);
        model.Entity<Room>().Property(x => x.Id).HasMaxLength(16);
        model.Entity<Room>().HasIndex(x => x.ExpiresAt);
        model.Entity<Room>().Property(x => x.Revision).IsConcurrencyToken();
        model.Entity<Seat>().HasKey(x => new { x.RoomId, x.Number });
        model.Entity<Seat>().HasOne<Room>().WithMany().HasForeignKey(x => x.RoomId).OnDelete(DeleteBehavior.Cascade);
        model.Entity<RoomAction>().HasKey(x => new { x.RoomId, x.Id });
        model.Entity<RoomAction>().Property(x => x.Id).HasMaxLength(64);
        model.Entity<RoomAction>().HasOne<Room>().WithMany().HasForeignKey(x => x.RoomId).OnDelete(DeleteBehavior.Cascade);
    }
}

using Microsoft.EntityFrameworkCore;

namespace Riichi.Api.Data;

public sealed class AppDb(DbContextOptions<AppDb> options) : DbContext(options)
{
    public DbSet<SharedArchive> Shares => Set<SharedArchive>();
    public DbSet<Room> Rooms => Set<Room>();
    public DbSet<Seat> Seats => Set<Seat>();
    public DbSet<RoomAction> Actions => Set<RoomAction>();

    // Conservative logical quota shared by archives, room snapshots and queued actions.
    public async Task<long> StorageBytes() =>
        (await Shares.SumAsync(x => (long?)x.Size) ?? 0) +
        (await Rooms.SumAsync(x => (long?)(x.Snapshot.Length * 2L + 1024)) ?? 0) +
        (await Actions.SumAsync(x => (long?)(x.Payload.Length * 2L + 1024)) ?? 0);

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

public sealed class SharedArchive
{
    public string Id { get; set; } = "";
    public byte[] Content { get; set; } = [];
    public long Size { get; set; }
    public long ExpiresAt { get; set; }
    public string DeleteHash { get; set; } = "";
}

public sealed class Room
{
    public string Id { get; set; } = "";
    public string PinHash { get; set; } = "";
    public string HostHash { get; set; } = "";
    public int PlayerCount { get; set; }
    public long ExpiresAt { get; set; }
    public long Revision { get; set; }
    public string Snapshot { get; set; } = "{}";
    public string HandKey { get; set; } = "";
}

public sealed class RoomAction
{
    public string RoomId { get; set; } = "";
    public string Id { get; set; } = "";
    public int Seat { get; set; }
    public string ActorHash { get; set; } = "";
    public string HandKey { get; set; } = "";
    public string Kind { get; set; } = "";
    public string Payload { get; set; } = "{}";
    public long CreatedAt { get; set; }
    public string Status { get; set; } = "pending";
    public string Error { get; set; } = "";
}

public sealed class Seat
{
    public string RoomId { get; set; } = "";
    public int Number { get; set; }
    public string TokenHash { get; set; } = "";
}

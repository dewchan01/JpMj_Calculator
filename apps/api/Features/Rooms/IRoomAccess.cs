using Riichi.Api.Data;

namespace Riichi.Api.Features.Rooms;

/// <summary>Checks current room membership without exposing credentials.</summary>
public interface IRoomAccess
{
    /// <summary>Checks whether a host or occupied seat can read the room.</summary>
    /// <param name="room">The active room.</param>
    /// <param name="token">The presented bearer credential.</param>
    /// <param name="cancellationToken">The caller cancellation token.</param>
    /// <returns>Whether access is allowed.</returns>
    Task<bool> CanReadAsync(Room room, string token, CancellationToken cancellationToken);
}

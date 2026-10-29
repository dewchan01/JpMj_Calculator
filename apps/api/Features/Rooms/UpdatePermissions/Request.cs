namespace Riichi.Api.Features.Rooms.UpdatePermissions;

/// <summary>Requests a host-controlled capability update.</summary>
/// <param name="Id">The room identifier.</param>
/// <param name="Permissions">The complete player capability set.</param>
/// <param name="Token">The presented host credential.</param>
public sealed record Request(string Id, RoomPermissions Permissions, string Token);

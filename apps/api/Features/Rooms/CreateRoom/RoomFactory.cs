using System.Security.Cryptography;
using Riichi.Api.Data;
using Riichi.Api.Infrastructure.Security;

namespace Riichi.Api.Features.Rooms.CreateRoom;

/// <summary>Creates a room and its one-time plaintext credentials together.</summary>
internal static class RoomFactory
{
    internal static (Room Room, string Pin, string Token) Create(int playerCount, string snapshot, string? handKey, long now)
    {
        var id = Convert.ToHexString(RandomNumberGenerator.GetBytes(5));
        var pin = RandomNumberGenerator.GetInt32(1000000).ToString("D6");
        var token = Secrets.Create();
        return (new Room
        {
            Id = id,
            PinHash = Secrets.PinHash(pin, id),
            HostHash = Secrets.Hash(token),
            PlayerCount = playerCount,
            ExpiresAt = now + 86400,
            Snapshot = snapshot,
            HandKey = snapshot == "null" ? "" : handKey!,
            Revision = snapshot == "null" ? 0 : 1
        }, pin, token);
    }
}

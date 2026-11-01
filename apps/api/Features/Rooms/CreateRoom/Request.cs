using System.Text.Json;

namespace Riichi.Api.Features.Rooms.CreateRoom;

/// <summary>Input for create room.</summary>
/// <param name="PlayerCount">The number of player seats, either three or four.</param>
/// <param name="Match">The optional initial game snapshot.</param>
/// <param name="HandKey">The optional initial hand identity.</param>
/// <param name="HostSeat">The optional seat reserved for the hosting player.</param>
/// <param name="PlayerNames">The optional ordered player names displayed before the game starts.</param>
/// <param name="RuleLabel">The rule preset or custom name shown in the lobby.</param>
/// <param name="GameLength">The pending game's east or south length.</param>
/// <param name="Pending">Whether the snapshot is waiting for the host to start.</param>
public sealed record Request(int PlayerCount, JsonElement? Match = null, string? HandKey = null, int? HostSeat = null, string[]? PlayerNames = null, string? RuleLabel = null, string? GameLength = null, bool Pending = false);

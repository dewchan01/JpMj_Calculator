namespace Riichi.Api.Features.Rooms.ChoosePlayer;

/// <summary>The player seat selected in the lobby.</summary>
public sealed record Body(int Seat);
/// <summary>An authenticated lobby player selection.</summary>
public sealed record Request(string Id, int Seat, string Token);

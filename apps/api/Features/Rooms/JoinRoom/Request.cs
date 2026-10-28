namespace Riichi.Api.Features.Rooms.JoinRoom;

/// <summary>The JSON payload accepted by this operation.</summary>
/// <param name="Pin">The six-digit room passcode.</param>
/// <param name="Seat">The optional zero-based seat index.</param>
public sealed record Body(string Pin, int? Seat);

/// <summary>Input for join room.</summary>
/// <param name="Id">The operation resource identifier.</param>
/// <param name="Input">The submitted operation payload.</param>
public sealed record Request(string Id, Body Input);

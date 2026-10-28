namespace Riichi.Api.Features.Rooms.ReleaseSeat;

/// <summary>Input for release seat.</summary>
/// <param name="Id">The operation resource identifier.</param>
/// <param name="Seat">The optional zero-based seat index.</param>
/// <param name="Token">The presented host or seat credential.</param>
public sealed record Request(string Id, int Seat, string Token);

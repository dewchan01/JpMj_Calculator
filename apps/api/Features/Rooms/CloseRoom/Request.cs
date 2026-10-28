namespace Riichi.Api.Features.Rooms.CloseRoom;

/// <summary>Input for close room.</summary>
/// <param name="Id">The operation resource identifier.</param>
/// <param name="Token">The presented host or seat credential.</param>
public sealed record Request(string Id, string Token);

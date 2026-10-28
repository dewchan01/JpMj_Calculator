namespace Riichi.Api.Features.Games.GetGame;

/// <summary>Input for get game.</summary>
/// <param name="Id">The operation resource identifier.</param>
/// <param name="Revision">The expected game revision.</param>
/// <param name="Token">The presented host or seat credential.</param>
public sealed record Request(string Id, long? Revision, string Token);

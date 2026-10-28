using System.Text.Json;

namespace Riichi.Api.Features.Games.SubmitAction;

/// <summary>The JSON payload accepted by this operation.</summary>
/// <param name="Id">The operation resource identifier.</param>
/// <param name="HandKey">The current hand identity.</param>
/// <param name="Kind">The declaration kind.</param>
/// <param name="Payload">The internal declaration payload.</param>
/// <param name="Seat">The optional zero-based seat index.</param>
public sealed record Body(string Id, string HandKey, string Kind, JsonElement Payload, int? Seat = null);

/// <summary>Input for submit action.</summary>
/// <param name="Id">The operation resource identifier.</param>
/// <param name="Input">The submitted operation payload.</param>
/// <param name="Token">The presented host or seat credential.</param>
public sealed record Request(string Id, Body Input, string Token);

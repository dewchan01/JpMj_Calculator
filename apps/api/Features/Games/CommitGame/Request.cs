using System.Text.Json;

namespace Riichi.Api.Features.Games.CommitGame;

/// <summary>The JSON payload accepted by this operation.</summary>
/// <param name="Revision">The expected game revision.</param>
/// <param name="HandKey">The current hand identity.</param>
/// <param name="Match">The game snapshot.</param>
/// <param name="Decisions">The host declaration decisions.</param>
public sealed record Body(long Revision, string HandKey, JsonElement Match, ActionDecision[] Decisions);

/// <summary>Input for commit game.</summary>
/// <param name="Id">The operation resource identifier.</param>
/// <param name="Input">The submitted operation payload.</param>
/// <param name="Token">The presented host or seat credential.</param>
public sealed record Request(string Id, Body Input, string Token);

/// <summary>The outcome of processing a pending declaration.</summary>
/// <param name="Id">The operation resource identifier.</param>
/// <param name="Error">The safe rejection reason, or empty when accepted.</param>
public sealed record ActionDecision(string Id, string Error);

namespace Riichi.Api.Features.Shares.CreateShare;

/// <summary>Input for create share.</summary>
/// <param name="Content">The archive upload stream.</param>
public sealed record Request(Stream Content);

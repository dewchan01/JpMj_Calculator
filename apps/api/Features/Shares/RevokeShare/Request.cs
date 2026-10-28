namespace Riichi.Api.Features.Shares.RevokeShare;

/// <summary>Input for revoke share.</summary>
/// <param name="Id">The operation resource identifier.</param>
/// <param name="DeletionSecret">The independent archive revocation credential.</param>
public sealed record Request(string Id, string DeletionSecret);

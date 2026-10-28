namespace Riichi.Api.Data;

/// <summary>An expiring internal game archive.</summary>
public sealed class SharedArchive
{
    /// <summary>Gets or sets the persistent identifier.</summary>
    public string Id { get; set; } = "";
    /// <summary>Gets or sets the internal JSON archive bytes.</summary>
    public byte[] Content { get; set; } = [];
    /// <summary>Gets or sets the logical archive size in bytes.</summary>
    public long Size { get; set; }
    /// <summary>Gets or sets the UTC expiry as Unix seconds.</summary>
    public long ExpiresAt { get; set; }
    /// <summary>Gets or sets the archive revocation credential hash.</summary>
    public string DeleteHash { get; set; } = "";
}

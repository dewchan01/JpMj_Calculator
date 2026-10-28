namespace Riichi.Api.Data;

/// <summary>A shared room and its versioned game snapshot.</summary>
public sealed class Room
{
    /// <summary>Gets or sets the persistent identifier.</summary>
    public string Id { get; set; } = "";
    /// <summary>Gets or sets the salted room passcode hash.</summary>
    public string PinHash { get; set; } = "";
    /// <summary>Gets or sets the host credential hash.</summary>
    public string HostHash { get; set; } = "";
    /// <summary>Gets or sets the number of player seats.</summary>
    public int PlayerCount { get; set; }
    /// <summary>Gets or sets the UTC expiry as Unix seconds.</summary>
    public long ExpiresAt { get; set; }
    /// <summary>Gets or sets the optimistic concurrency revision.</summary>
    public long Revision { get; set; }
    /// <summary>Gets or sets the internal game snapshot JSON.</summary>
    public string Snapshot { get; set; } = "{}";
    /// <summary>Gets or sets the current hand identity.</summary>
    public string HandKey { get; set; } = "";
}

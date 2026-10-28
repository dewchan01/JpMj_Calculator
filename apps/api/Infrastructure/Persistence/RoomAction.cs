namespace Riichi.Api.Data;

/// <summary>An authenticated player declaration awaiting host settlement.</summary>
public sealed class RoomAction
{
    /// <summary>Gets or sets the owning room identifier.</summary>
    public string RoomId { get; set; } = "";
    /// <summary>Gets or sets the persistent identifier.</summary>
    public string Id { get; set; } = "";
    /// <summary>Gets or sets the declaring seat index.</summary>
    public int Seat { get; set; }
    /// <summary>Gets or sets the declaring credential hash.</summary>
    public string ActorHash { get; set; } = "";
    /// <summary>Gets or sets the current hand identity.</summary>
    public string HandKey { get; set; } = "";
    /// <summary>Gets or sets the declaration kind.</summary>
    public string Kind { get; set; } = "";
    /// <summary>Gets or sets the internal declaration JSON.</summary>
    public string Payload { get; set; } = "{}";
    /// <summary>Gets or sets the UTC creation time as Unix seconds.</summary>
    public long CreatedAt { get; set; }
    /// <summary>Gets or sets the declaration processing status.</summary>
    public string Status { get; set; } = "pending";
    /// <summary>Gets or sets the safe rejection reason.</summary>
    public string Error { get; set; } = "";
}

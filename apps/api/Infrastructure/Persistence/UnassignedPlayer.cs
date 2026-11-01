namespace Riichi.Api.Data;

/// <summary>A room member who has not successfully claimed a player seat.</summary>
public sealed class UnassignedPlayer
{
    /// <summary>Gets or sets the pending host decision for a mid-game seat request.</summary>
    public string Decision { get; set; } = "unassigned";
    /// <summary>Gets or sets the room identifier.</summary>
    public string RoomId { get; set; } = "";
    /// <summary>Gets or sets the public waiting-member identifier.</summary>
    public string Id { get; set; } = Guid.NewGuid().ToString("N");
    /// <summary>Gets or sets the private membership credential hash.</summary>
    public string TokenHash { get; set; } = "";
    /// <summary>Gets or sets the most recently requested seat.</summary>
    public int? RequestedSeat { get; set; }
}

namespace Riichi.Api.Data;

/// <summary>An occupied seat with a hashed bearer credential.</summary>
public sealed class Seat
{
    /// <summary>Gets or sets the owning room identifier.</summary>
    public string RoomId { get; set; } = "";
    /// <summary>Gets or sets the zero-based seat index.</summary>
    public int Number { get; set; }
    /// <summary>Gets or sets the seat credential hash.</summary>
    public string TokenHash { get; set; } = "";
}

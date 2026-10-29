namespace Riichi.Api.Features.Rooms;

/// <summary>Host-controlled capabilities granted to occupied player seats.</summary>
/// <param name="Riichi">Whether players may declare or cancel their own Riichi.</param>
/// <param name="Calls">Whether players may record their own melds and North extractions.</param>
/// <param name="Win">Whether players may submit their own winning hands.</param>
/// <param name="Indicators">Whether players may edit shared indicators.</param>
/// <param name="Settle">Whether players may settle hands and pending wins.</param>
/// <param name="History">Whether players may edit or undo recorded hands.</param>
/// <param name="Finish">Whether players may end the shared game.</param>
public sealed record RoomPermissions(bool Riichi = true, bool Calls = true, bool Win = true,
    bool Indicators = false, bool Settle = false, bool History = false, bool Finish = false);

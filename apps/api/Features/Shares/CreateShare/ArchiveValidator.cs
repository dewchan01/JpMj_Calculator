using System.Text.Json;

namespace Riichi.Api.Features.Shares.CreateShare;

/// <summary>Validates the internal archive envelope before persisting it.</summary>
internal static class ArchiveValidator
{
    internal static bool IsValid(JsonElement value) => value.ValueKind == JsonValueKind.Object &&
        value.TryGetProperty("format", out var format) && format.ValueKind == JsonValueKind.String && format.GetString() == "riichi-table" &&
        value.TryGetProperty("version", out var version) && version.ValueKind == JsonValueKind.Number && version.TryGetInt32(out var v) && v == 1 &&
        value.TryGetProperty("matches", out var matches) && matches.ValueKind == JsonValueKind.Array && matches.GetArrayLength() is > 0 and <= 500;
}

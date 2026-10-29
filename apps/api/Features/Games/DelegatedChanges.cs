using System.Text.Json;
using Riichi.Api.Features.Rooms;

namespace Riichi.Api.Features.Games;

/// <summary>Restricts delegated snapshot changes to their authorized operation.</summary>
internal static class DelegatedChanges
{
    internal static RoomPermissions Permissions(string json) => JsonSerializer.Deserialize<RoomPermissions>(json) ?? new();

    internal static bool Allowed(string previousJson, JsonElement next, string? operation, RoomPermissions permissions)
    {
        if (operation is not ("indicators" or "settle" or "history" or "finish")) return false;
        if (!(operation switch
        {
            "indicators" => permissions.Indicators,
            "settle" => permissions.Settle,
            "history" => permissions.History,
            "finish" => permissions.Finish,
            _ => false
        })) return false;
        using var doc = JsonDocument.Parse(previousJson);
        var previous = doc.RootElement;
        if (previous.ValueKind != JsonValueKind.Object) return false;
        // A delegated operation never changes the game identity, rules or player identities.
        foreach (var field in new[] { "id", "schemaVersion", "createdAt", "playerCount", "rules", "players",
            "initialBalances", "initialDealerId", "gameLength", "name" })
            if (!Same(previous, next, field)) return false;
        if (operation == "indicators")
        {
            if (!EqualExcept(previous, next, "live", "updatedAt")) return false;
            if (!previous.TryGetProperty("live", out var before) || !next.TryGetProperty("live", out var after)) return false;
            foreach (var field in new[] { "dora", "ura" })
                if (!after.TryGetProperty(field, out var indicator) || indicator.ValueKind != JsonValueKind.String || indicator.GetString()!.Length > 64)
                    return false;
            return EqualExcept(before, after, "dora", "ura");
        }
        if (operation == "history") return true;
        if (!previous.TryGetProperty("events", out var oldEvents) || !next.TryGetProperty("events", out var events) ||
            oldEvents.ValueKind != JsonValueKind.Array || events.ValueKind != JsonValueKind.Array ||
            events.GetArrayLength() < oldEvents.GetArrayLength()) return false;
        for (var i = 0; i < oldEvents.GetArrayLength(); i++)
            if (!JsonElement.DeepEquals(oldEvents[i], events[i])) return false;
        return operation != "finish" || (next.TryGetProperty("ended", out var ended) && ended.ValueKind == JsonValueKind.True);
    }

    private static bool Same(JsonElement before, JsonElement after, string field)
    {
        var first = before.TryGetProperty(field, out var a);
        var second = after.TryGetProperty(field, out var b);
        return first == second && (!first || JsonElement.DeepEquals(a, b));
    }

    private static bool EqualExcept(JsonElement before, JsonElement after, params string[] allowed)
    {
        if (before.ValueKind != JsonValueKind.Object || after.ValueKind != JsonValueKind.Object) return false;
        return before.EnumerateObject().Select(x => x.Name).Union(after.EnumerateObject().Select(x => x.Name))
            .Where(x => !allowed.Contains(x)).All(x => Same(before, after, x));
    }
}

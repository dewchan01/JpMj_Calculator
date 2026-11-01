using System.Text.Json.Nodes;
using Riichi.Api.Data;

namespace Riichi.Api.Features.Rooms.Lifecycle;

/// <summary>Ends an abandoned game using its saved ledger, final penalties and escrow policy.</summary>
public static class RoomFinalizer
{
    /// <summary>Finalizes a room once; unfinished hands are not scored.</summary>
    public static void Finish(Room room)
    {
        if (room.Closed) return;
        room.Closed = true;
        if (JsonNode.Parse(room.Snapshot) is not JsonObject match || match["id"] is null) return;
        if (match["ended"]?.GetValue<bool>() == true) return;
        var players = match["players"]!.AsArray().Select(x => x!["id"]!.GetValue<string>()).ToArray();
        var balances = players.ToDictionary(x => x, x => match["initialBalances"]![x]!.GetValue<long>());
        long escrow = 0;
        var events = match["events"]!.AsArray();
        foreach (var entry in events)
            foreach (var payment in entry!["payments"]!.AsArray())
            {
                var from = payment!["from"]!.GetValue<string>();
                var to = payment["to"]!.GetValue<string>();
                var amount = payment["amount"]!.GetValue<long>();
                if (from == "table") escrow -= amount; else balances[from] -= amount;
                if (to == "table") escrow += amount; else balances[to] += amount;
            }
        var payments = new JsonArray();
        var rules = match["rules"]!;
        var table = rules["table"];
        var penalty = table?["yakitoriPenalty"]?.GetValue<long>() ?? 0;
        var winners = new HashSet<string>();
        foreach (var entry in events)
        {
            if (entry!["winnerIds"] is JsonArray ids) foreach (var id in ids) winners.Add(id!.GetValue<string>());
            else if (entry["win"]?["winnerId"] is JsonValue winner) winners.Add(winner.GetValue<string>());
        }
        if (penalty > 0)
            foreach (var player in players.Where(x => !winners.Contains(x)))
                foreach (var opponent in players.Where(x => x != player))
                {
                    payments.Add(new JsonObject { ["from"] = player, ["to"] = opponent, ["amount"] = penalty, ["reason"] = "Final Yakitori penalty" });
                    balances[player] -= penalty; balances[opponent] += penalty;
                }
        var leader = players.OrderByDescending(x => balances[x]).First();
        var split = (table?["finalRiichiReceiver"]?.GetValue<string>() ?? (rules["preset"]?.GetValue<string>() == "m-league" ? "split-top" : "first")) == "split-top";
        var leaders = split ? players.Where(x => balances[x] == balances[leader]).ToArray() : [leader];
        for (var i = 0; i < leaders.Length && escrow > 0; i++)
        {
            var amount = split ? (escrow / 100 / leaders.Length + (i < escrow / 100 % leaders.Length ? 1 : 0)) * 100 : escrow;
            payments.Add(new JsonObject { ["from"] = "table", ["to"] = leaders[i], ["amount"] = amount, ["reason"] = "Final table escrow award" });
        }
        var before = new JsonObject();
        foreach (var key in new[] { "dealerId", "roundWind", "handNumber", "honba", "ended" }) before[key] = match[key]?.DeepClone();
        before["ended"] = false;
        var after = before.DeepClone().AsObject();
        after["ended"] = true; after["endReason"] = "All players left";
        var now = DateTimeOffset.UtcNow;
        var timestamp = now.ToString("O");
        events.Add(new JsonObject { ["id"] = Guid.NewGuid().ToString(), ["type"] = "matchEnd", ["timestamp"] = timestamp, ["payments"] = payments, ["before"] = before, ["after"] = after });
        match["ended"] = true; match["endReason"] = "All players left"; match["updatedAt"] = timestamp;
        if (match["clock"] is JsonObject clock)
        {
            var elapsed = clock["elapsedMs"]?.GetValue<long>() ?? 0;
            if (DateTimeOffset.TryParse(clock["runningSince"]?.GetValue<string>(), out var running)) elapsed += Math.Max(0, (long)(now - running).TotalMilliseconds);
            clock["elapsedMs"] = elapsed; clock["runningSince"] = null;
        }
        room.Snapshot = match.ToJsonString();
    }
}

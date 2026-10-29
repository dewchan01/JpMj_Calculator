using System.Net;
using System.Net.Http.Headers;
using System.Net.Http.Json;
using System.Text.Json;
using System.Text.Json.Nodes;
using FluentAssertions;
using Microsoft.VisualStudio.TestTools.UnitTesting;

namespace Riichi.Api.Tests;

[TestClass]
public sealed class PermissionsTests
{
    [TestMethod]
    public async Task HostingReservesTheChosenPlayerAndAutoJoinSkipsIt()
    {
        using var app = new ApiFactory();
        using var client = app.CreateClient();
        using var created = await client.PostAsJsonAsync("/api/rooms", new { playerCount = 3, hostSeat = 1 });
        created.EnsureSuccessStatusCode();
        var room = await created.Content.ReadFromJsonAsync<JsonElement>();
        room.GetProperty("seat").GetInt32().Should().Be(1);
        var path = "/api/rooms/" + room.GetProperty("id").GetString() + "/join";
        var pin = room.GetProperty("pin").GetString();
        (await client.PostAsJsonAsync(path, new { pin, seat = 1 })).StatusCode.Should().Be(HttpStatusCode.Conflict);
        var first = await (await client.PostAsJsonAsync(path, new { pin })).Content.ReadFromJsonAsync<JsonElement>();
        var second = await (await client.PostAsJsonAsync(path, new { pin })).Content.ReadFromJsonAsync<JsonElement>();
        first.GetProperty("seat").GetInt32().Should().Be(0);
        second.GetProperty("seat").GetInt32().Should().Be(2);
        (await client.PostAsJsonAsync(path, new { pin })).StatusCode.Should().Be(HttpStatusCode.Conflict);
    }

    [TestMethod]
    public async Task OnlyHostCanGrantCapabilitiesAndIndicatorAccessCannotChangeScores()
    {
        using var app = new ApiFactory();
        using var host = app.CreateClient();
        using var guest = app.CreateClient();
        var match = JsonNode.Parse("""
            {"id":"permissions-game","playerCount":3,"players":[{"id":"a"},{"id":"b"},{"id":"c"}],
             "events":[],"live":{"dora":"1m","ura":"","players":{}}}
            """)!;
        using var created = await host.PostAsJsonAsync("/api/rooms", new { playerCount = 3, match, handKey = "first" });
        created.EnsureSuccessStatusCode();
        var room = await created.Content.ReadFromJsonAsync<JsonElement>();
        var path = "/api/rooms/" + room.GetProperty("id").GetString();
        using var joined = await guest.PostAsJsonAsync(path + "/join", new { pin = room.GetProperty("pin").GetString() });
        joined.EnsureSuccessStatusCode();
        var player = await joined.Content.ReadFromJsonAsync<JsonElement>();
        host.DefaultRequestHeaders.Authorization = new AuthenticationHeaderValue("Bearer", room.GetProperty("token").GetString());
        guest.DefaultRequestHeaders.Authorization = new AuthenticationHeaderValue("Bearer", player.GetProperty("token").GetString());
        var permissions = new { riichi = false, calls = true, win = true, indicators = true, settle = false, history = false, finish = false };

        (await guest.PutAsJsonAsync(path + "/permissions", permissions)).StatusCode.Should().Be(HttpStatusCode.Unauthorized);
        (await host.PutAsJsonAsync(path + "/permissions", permissions)).StatusCode.Should().Be(HttpStatusCode.NoContent);
        var state = await host.GetFromJsonAsync<JsonElement>(path + "/game");
        state.GetProperty("permissions").GetProperty("riichi").GetBoolean().Should().BeFalse();
        (await guest.PostAsJsonAsync(path + "/game/actions", new { id = Guid.NewGuid(), handKey = "first", kind = "riichi", payload = new { } }))
            .StatusCode.Should().Be(HttpStatusCode.Forbidden);

        var revision = state.GetProperty("revision").GetInt64();
        match["live"]!["dora"] = "2m";
        (await guest.PutAsJsonAsync(path + "/game", new { revision, handKey = "first", match, decisions = Array.Empty<object>(), operation = "indicators" }))
            .StatusCode.Should().Be(HttpStatusCode.OK);

        match["events"] = JsonNode.Parse("""[{"type":"win","payments":[]}]""");
        (await guest.PutAsJsonAsync(path + "/game", new { revision = revision + 1, handKey = "first", match, decisions = Array.Empty<object>(), operation = "indicators" }))
            .StatusCode.Should().Be(HttpStatusCode.Forbidden);
        (await guest.PutAsJsonAsync(path + "/game", new { revision = revision + 1, handKey = "first", match, decisions = Array.Empty<object>(), operation = "history" }))
            .StatusCode.Should().Be(HttpStatusCode.Forbidden);
        (await host.PutAsJsonAsync(path + "/permissions", permissions with { indicators = false })).StatusCode.Should().Be(HttpStatusCode.NoContent);
        match["events"] = new JsonArray();
        (await guest.PutAsJsonAsync(path + "/game", new { revision = revision + 2, handKey = "first", match, decisions = Array.Empty<object>(), operation = "indicators" }))
            .StatusCode.Should().Be(HttpStatusCode.Forbidden);
    }
}

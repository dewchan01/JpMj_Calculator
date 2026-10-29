using System.Net;
using System.Net.Http.Headers;
using System.Net.Http.Json;
using System.Text.Json;
using System.Text.Json.Nodes;
using FluentAssertions;
using Microsoft.VisualStudio.TestTools.UnitTesting;

namespace Riichi.Api.Tests;

[TestClass]
public sealed class DrawPermissionsTests
{
    [TestMethod]
    public async Task DrawPermissionDoesNotGrantWinsHistoryOrFinishAndCanBeRevoked()
    {
        using var app = new ApiFactory();
        using var host = app.CreateClient();
        using var guest = app.CreateClient();
        var match = JsonNode.Parse("""
            {"id":"draw-game","playerCount":3,"players":[{"id":"a"},{"id":"b"},{"id":"c"}],
             "rules":{},"dealerId":"a","honba":0,"events":[],"live":{"players":{}}}
            """)!;
        var room = await Read(await host.PostAsJsonAsync("/api/rooms", new { playerCount = 3, match, handKey = "first" }));
        var path = "/api/rooms/" + room.GetProperty("id").GetString();
        var joined = await Read(await guest.PostAsJsonAsync(path + "/join", new { pin = room.GetProperty("pin").GetString() }));
        host.DefaultRequestHeaders.Authorization = new AuthenticationHeaderValue("Bearer", room.GetProperty("token").GetString());
        guest.DefaultRequestHeaders.Authorization = new AuthenticationHeaderValue("Bearer", joined.GetProperty("token").GetString());
        var next = match.DeepClone();
        next["events"]!.AsArray().Add(JsonNode.Parse("""
            {"id":"draw","type":"exhaustiveDraw","payments":[],"drawInput":{"type":"exhaustive",
             "rules":{},"players":[{"id":"a"},{"id":"b"},{"id":"c"}],"dealerId":"a","honba":0}}
            """));
        (await guest.PutAsJsonAsync(path + "/game", new { revision = 1, handKey = "next", match = next, operation = "draw", decisions = Array.Empty<object>() })).StatusCode.Should().Be(HttpStatusCode.Forbidden);
        (await host.PutAsJsonAsync(path + "/permissions", new { draw = true })).EnsureSuccessStatusCode();
        var malicious = next.DeepClone();
        malicious["events"]![0]!["type"] = "win";
        (await guest.PutAsJsonAsync(path + "/game", new { revision = 2, handKey = "next", match = malicious, operation = "draw", decisions = Array.Empty<object>() })).StatusCode.Should().Be(HttpStatusCode.Forbidden);
        (await guest.PutAsJsonAsync(path + "/game", new { revision = 2, handKey = "next", match = next, operation = "settle", decisions = Array.Empty<object>() })).StatusCode.Should().Be(HttpStatusCode.Forbidden);
        var pendingId = Guid.NewGuid().ToString();
        (await guest.PostAsJsonAsync(path + "/game/actions", new { id = pendingId, handKey = "first", kind = "win", payload = new { } })).EnsureSuccessStatusCode();
        (await guest.PutAsJsonAsync(path + "/game", new { revision = 3, handKey = "next", match = next, operation = "draw", decisions = Array.Empty<object>() })).StatusCode.Should().Be(HttpStatusCode.Conflict);
        (await host.PutAsJsonAsync(path + "/game", new { revision = 3, handKey = "first", match, decisions = new[] { new { id = pendingId, error = "Rejected" } } })).EnsureSuccessStatusCode();
        (await guest.PutAsJsonAsync(path + "/game", new { revision = 4, handKey = "next", match = next, operation = "draw", decisions = Array.Empty<object>() })).EnsureSuccessStatusCode();
        var rewrite = next.DeepClone();
        rewrite["events"]![0]!["id"] = "rewritten";
        rewrite["events"]!.AsArray().Add(next["events"]![0]!.DeepClone());
        (await guest.PutAsJsonAsync(path + "/game", new { revision = 5, handKey = "third", match = rewrite, operation = "draw", decisions = Array.Empty<object>() })).StatusCode.Should().Be(HttpStatusCode.Forbidden);
        (await guest.PutAsJsonAsync(path + "/game", new { revision = 5, handKey = "next", match = next, operation = "history", decisions = Array.Empty<object>() })).StatusCode.Should().Be(HttpStatusCode.Forbidden);
        (await guest.PutAsJsonAsync(path + "/game", new { revision = 5, handKey = "next", match = next, operation = "finish", decisions = Array.Empty<object>() })).StatusCode.Should().Be(HttpStatusCode.Forbidden);
        (await host.PutAsJsonAsync(path + "/permissions", new { draw = false, settle = true })).EnsureSuccessStatusCode();
        (await guest.PutAsJsonAsync(path + "/game", new { revision = 6, handKey = "third", match = next, operation = "draw", decisions = Array.Empty<object>() })).StatusCode.Should().Be(HttpStatusCode.Forbidden);
        var another = next.DeepClone();
        another["events"]!.AsArray().Add(next["events"]![0]!.DeepClone());
        (await guest.PutAsJsonAsync(path + "/game", new { revision = 6, handKey = "third", match = another, operation = "settle", decisions = Array.Empty<object>() })).StatusCode.Should().Be(HttpStatusCode.Forbidden);
    }

    private static async Task<JsonElement> Read(HttpResponseMessage response)
    {
        response.EnsureSuccessStatusCode();
        return await response.Content.ReadFromJsonAsync<JsonElement>();
    }
}

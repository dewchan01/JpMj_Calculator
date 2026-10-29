using System.Net;
using System.Net.Http.Headers;
using System.Net.Http.Json;
using System.Text.Json;
using FluentAssertions;
using Microsoft.VisualStudio.TestTools.UnitTesting;

namespace Riichi.Api.Tests;

[TestClass]
public sealed class ChoosePlayerTests
{
    [TestMethod]
    public async Task LobbyNamesAndOwnSelectionArePersistedWithoutStartingTheGame()
    {
        using var app = new ApiFactory();
        using var client = app.CreateClient();
        var created = await Read(await client.PostAsJsonAsync("/api/rooms", new { playerCount = 4, hostSeat = 0, playerNames = new[] { "Alice", "Bob", "Carol", "Dan" } }));
        var path = "/api/rooms/" + created.GetProperty("id").GetString();
        var joined = await Read(await client.PostAsJsonAsync(path + "/join", new { pin = created.GetProperty("pin").GetString() }));
        client.DefaultRequestHeaders.Authorization = new AuthenticationHeaderValue("Bearer", joined.GetProperty("token").GetString());
        (await client.PutAsJsonAsync(path + "/player", new { seat = 3 })).StatusCode.Should().Be(HttpStatusCode.NoContent);
        var lobby = await Read(await client.GetAsync(path));
        lobby.GetProperty("playerNames").EnumerateArray().Select(name => name.GetString()).Should().Equal("Alice", "Bob", "Carol", "Dan");
        lobby.GetProperty("seats").EnumerateArray().Select(seat => seat.GetInt32()).Should().BeEquivalentTo(new[] { 0, 3 });
        (await Read(await client.GetAsync(path + "/game"))).GetProperty("match").ValueKind.Should().Be(JsonValueKind.Null);
        (await client.PutAsJsonAsync(path + "/player", new { seat = 0 })).StatusCode.Should().Be(HttpStatusCode.Conflict);
        (await client.PutAsJsonAsync(path + "/player", new { seat = 4 })).StatusCode.Should().Be(HttpStatusCode.BadRequest);
        client.DefaultRequestHeaders.Authorization = new AuthenticationHeaderValue("Bearer", "invalid");
        (await client.PutAsJsonAsync(path + "/player", new { seat = 2 })).StatusCode.Should().Be(HttpStatusCode.Unauthorized);
        client.DefaultRequestHeaders.Authorization = new AuthenticationHeaderValue("Bearer", created.GetProperty("token").GetString());
        (await client.PutAsJsonAsync(path + "/player", new { seat = 2 })).StatusCode.Should().Be(HttpStatusCode.Forbidden);
        var match = new { id = "started", playerCount = 4, players = new[] { new { id = "a" }, new { id = "b" }, new { id = "c" }, new { id = "d" } } };
        (await client.PutAsJsonAsync(path + "/game", new { revision = 0, handKey = "first-hand", match, decisions = Array.Empty<object>() })).EnsureSuccessStatusCode();
        client.DefaultRequestHeaders.Authorization = new AuthenticationHeaderValue("Bearer", joined.GetProperty("token").GetString());
        (await client.PutAsJsonAsync(path + "/player", new { seat = 2 })).StatusCode.Should().Be(HttpStatusCode.Conflict);
        (await client.PutAsJsonAsync(path + "/player", new { seat = 3 })).StatusCode.Should().Be(HttpStatusCode.NoContent);
    }

    [TestMethod]
    public async Task ConcurrentGuestsCannotChooseTheSamePlayer()
    {
        using var app = new ApiFactory();
        using var host = app.CreateClient();
        var room = await Read(await host.PostAsJsonAsync("/api/rooms", new { playerCount = 4, hostSeat = 0 }));
        var path = "/api/rooms/" + room.GetProperty("id").GetString();
        using var first = app.CreateClient();
        using var second = app.CreateClient();
        foreach (var client in new[] { first, second })
        {
            var access = await Read(await client.PostAsJsonAsync(path + "/join", new { pin = room.GetProperty("pin").GetString() }));
            client.DefaultRequestHeaders.Authorization = new AuthenticationHeaderValue("Bearer", access.GetProperty("token").GetString());
        }
        var responses = await Task.WhenAll(first.PutAsJsonAsync(path + "/player", new { seat = 3 }), second.PutAsJsonAsync(path + "/player", new { seat = 3 }));
        responses.Select(response => response.StatusCode).Should().BeEquivalentTo(new[] { HttpStatusCode.NoContent, HttpStatusCode.Conflict });
    }

    private static async Task<JsonElement> Read(HttpResponseMessage response)
    {
        response.EnsureSuccessStatusCode();
        return await response.Content.ReadFromJsonAsync<JsonElement>();
    }
}

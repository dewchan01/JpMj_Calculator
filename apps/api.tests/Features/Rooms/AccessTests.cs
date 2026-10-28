using System.Net;
using System.Net.Http.Json;
using System.Net.Http.Headers;
using System.Text.Json;
using Microsoft.AspNetCore.Hosting;
using Microsoft.AspNetCore.Mvc.Testing;
using Microsoft.Extensions.DependencyInjection;
using Microsoft.Extensions.DependencyInjection.Extensions;
using Microsoft.Extensions.Logging;
using Microsoft.EntityFrameworkCore;
using Riichi.Api.Data;
using Microsoft.VisualStudio.TestTools.UnitTesting;
using FluentAssertions;

namespace Riichi.Api.Tests;

[TestClass]
public sealed class AccessTests
{
    [TestMethod]
    public async Task CreateRoomCanAttachGameAndReturnInitialLobbyWithoutExtraReads()
    {
        using var app = new ApiFactory(); using var client = app.CreateClient();
        var match = new { id = "atomic-game", playerCount = 3, players = new[] { new { id = "a" }, new { id = "b" }, new { id = "c" } } };
        var created = await Json(await client.PostAsJsonAsync("/api/rooms", new { playerCount = 3, match, handKey = "first-hand" }));
        (created.GetProperty("room").GetProperty("playerCount").GetInt32()).Should().Be(3);
        (created.GetProperty("game").GetProperty("revision").GetInt64()).Should().Be(1);
        (created.GetProperty("game").GetProperty("match").GetProperty("id").GetString()).Should().Be("atomic-game");
        client.DefaultRequestHeaders.Authorization = new AuthenticationHeaderValue("Bearer", created.GetProperty("token").GetString());
        var saved = await Json(await client.GetAsync("/api/rooms/" + created.GetProperty("id").GetString() + "/game"));
        (saved.GetProperty("handKey").GetString()).Should().Be("first-hand");
        ((await client.PostAsJsonAsync("/api/rooms", new { playerCount = 4, match, handKey = "first-hand" })).StatusCode).Should().Be(HttpStatusCode.BadRequest);
    }
    [TestMethod]
    public async Task JoinWithoutSeatAssignsFreeSeatsAndRejectsFullRoom()
    {
        using var app = new ApiFactory(); using var client = app.CreateClient();
        var room = await Json(await client.PostAsJsonAsync("/api/rooms", new { playerCount = 3 }));
        var path = "/api/rooms/" + room.GetProperty("id").GetString() + "/join";
        var input = new { pin = room.GetProperty("pin").GetString() };
        for (var seat = 0; seat < 3; seat++)
        {
            var joined = await Json(await client.PostAsJsonAsync(path, input));
            (joined.GetProperty("seat").GetInt32()).Should().Be(seat);
        }
        ((await client.PostAsJsonAsync(path, input)).StatusCode).Should().Be(HttpStatusCode.Conflict);
    }
    [TestMethod]
    public async Task ConcurrentSeatClaimHasExactlyOneWinner()
    {
        using var app = new ApiFactory(); using var client = app.CreateClient();
        var room = await Json(await client.PostAsJsonAsync("/api/rooms", new { playerCount = 3 }));
        var path = "/api/rooms/" + room.GetProperty("id").GetString() + "/join";
        var input = new { pin = room.GetProperty("pin").GetString(), seat = 1 };
        var results = await Task.WhenAll(client.PostAsJsonAsync(path, input), client.PostAsJsonAsync(path, input));
        (results).Should().ContainSingle(result => result.StatusCode == HttpStatusCode.OK);
        (results).Should().ContainSingle(result => result.StatusCode == HttpStatusCode.Conflict);
    }

    private static async Task<JsonElement> Json(HttpResponseMessage response)
    {
        response.EnsureSuccessStatusCode();
        return await response.Content.ReadFromJsonAsync<JsonElement>();
    }

    [TestMethod]
    public async Task RoomSeatCredentialsRevocationAndClose()
    {
        using var app = new ApiFactory(); using var client = app.CreateClient();
        var room = await Json(await client.PostAsJsonAsync("/api/rooms", new { playerCount = 4 }));
        var path = "/api/rooms/" + room.GetProperty("id").GetString();
        var pin = room.GetProperty("pin").GetString();
        ((await client.GetAsync(path)).StatusCode).Should().Be(HttpStatusCode.Unauthorized);
        ((await client.PostAsJsonAsync(path + "/join", new { pin = "wrong", seat = 0 })).StatusCode).Should().Be(HttpStatusCode.Unauthorized);
        var player = await Json(await client.PostAsJsonAsync(path + "/join", new { pin, seat = 0 }));
        ((await client.PostAsJsonAsync(path + "/join", new { pin, seat = 0 })).StatusCode).Should().Be(HttpStatusCode.Conflict);
        client.DefaultRequestHeaders.Authorization = new AuthenticationHeaderValue("Bearer", player.GetProperty("token").GetString());
        var state = await Json(await client.GetAsync(path));
        (state.GetProperty("seats")[0].GetInt32()).Should().Be(0);
        (state.TryGetProperty("pinHash", out _)).Should().BeFalse();
        ((await client.DeleteAsync(path)).StatusCode).Should().Be(HttpStatusCode.Unauthorized);
        var playerToken = player.GetProperty("token").GetString();
        client.DefaultRequestHeaders.Authorization = new AuthenticationHeaderValue("Bearer", room.GetProperty("token").GetString());
        ((await client.DeleteAsync(path + "/seats/0")).StatusCode).Should().Be(HttpStatusCode.NoContent);
        client.DefaultRequestHeaders.Authorization = new AuthenticationHeaderValue("Bearer", playerToken);
        ((await client.GetAsync(path)).StatusCode).Should().Be(HttpStatusCode.Unauthorized);
        client.DefaultRequestHeaders.Authorization = new AuthenticationHeaderValue("Bearer", room.GetProperty("token").GetString());
        ((await client.DeleteAsync(path)).StatusCode).Should().Be(HttpStatusCode.NoContent);
        ((await client.GetAsync(path)).StatusCode).Should().Be(HttpStatusCode.NotFound);
    }
}

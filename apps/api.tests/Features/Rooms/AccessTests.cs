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
    public async Task PendingGameIsStoredForHostWithoutStartingOrExposingItToGuests()
    {
        using var app = new ApiFactory(); using var host = app.CreateClient(); using var guest = app.CreateClient();
        var match = new { id = "pending-game", name = "Friday game", playerCount = 3, players = new[] { new { id = "a" }, new { id = "b" }, new { id = "c" } } };
        var room = await Json(await host.PostAsJsonAsync("/api/rooms", new { playerCount = 3, match, pending = true, hostSeat = 0 }));
        var path = "/api/rooms/" + room.GetProperty("id").GetString();
        room.GetProperty("game").GetProperty("match").ValueKind.Should().Be(JsonValueKind.Null);
        host.DefaultRequestHeaders.Authorization = new AuthenticationHeaderValue("Bearer", room.GetProperty("token").GetString());
        var state = await Json(await host.GetAsync(path));
        state.GetProperty("started").GetBoolean().Should().BeFalse();
        state.GetProperty("pendingMatch").GetProperty("id").GetString().Should().Be("pending-game");
        var member = await Json(await guest.PostAsJsonAsync(path + "/join", new { pin = room.GetProperty("pin").GetString() }));
        guest.DefaultRequestHeaders.Authorization = new AuthenticationHeaderValue("Bearer", member.GetProperty("token").GetString());
        var guestState = await Json(await guest.GetAsync(path));
        guestState.GetProperty("pendingMatch").ValueKind.Should().Be(JsonValueKind.Null);
        guestState.GetProperty("matchName").GetString().Should().Be("Friday game");
    }

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
    public async Task JoinWithoutSeatLeavesPlayersUnassigned()
    {
        using var app = new ApiFactory(); using var client = app.CreateClient();
        var room = await Json(await client.PostAsJsonAsync("/api/rooms", new { playerCount = 3 }));
        var path = "/api/rooms/" + room.GetProperty("id").GetString() + "/join";
        var input = new { pin = room.GetProperty("pin").GetString() };
        for (var seat = 0; seat < 3; seat++)
        {
            var joined = await Json(await client.PostAsJsonAsync(path, input));
            joined.GetProperty("seat").ValueKind.Should().Be(JsonValueKind.Null);
        }
        ((await client.PostAsJsonAsync(path, input)).StatusCode).Should().Be(HttpStatusCode.OK);
    }
    [TestMethod]
    public async Task FullRoomRejectsNewMembershipWithoutCreatingAnUnassignedPlayer()
    {
        using var app = new ApiFactory(); using var client = app.CreateClient();
        var room = await Json(await client.PostAsJsonAsync("/api/rooms", new { playerCount = 3, hostSeat = 0 }));
        var path = "/api/rooms/" + room.GetProperty("id").GetString();
        var pin = room.GetProperty("pin").GetString();
        await Json(await client.PostAsJsonAsync(path + "/join", new { pin, seat = 1 }));
        await Json(await client.PostAsJsonAsync(path + "/join", new { pin, seat = 2 }));
        var response = await client.PostAsJsonAsync(path + "/join", new { pin });
        response.StatusCode.Should().Be(HttpStatusCode.Conflict);
        (await response.Content.ReadFromJsonAsync<JsonElement>()).GetProperty("code").GetString().Should().Be("room-full");
        client.DefaultRequestHeaders.Authorization = new AuthenticationHeaderValue("Bearer", room.GetProperty("token").GetString());
        (await Json(await client.GetAsync(path))).GetProperty("unassigned").GetArrayLength().Should().Be(0);
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

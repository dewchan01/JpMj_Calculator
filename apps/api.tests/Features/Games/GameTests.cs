using System.Net;
using System.Net.Http.Headers;
using System.Net.Http.Json;
using System.Text.Json;
using Microsoft.VisualStudio.TestTools.UnitTesting;
using FluentAssertions;

namespace Riichi.Api.Tests;

[TestClass]
public sealed class GameTests
{
    [TestMethod]
    public async Task SeatActionsAreAuthorizedDeduplicatedVersionedAndRevocable()
    {
        using var app = new ApiFactory(); using var host = app.CreateClient(); using var guest = app.CreateClient();
        var room = await (await host.PostAsJsonAsync("/api/rooms", new { playerCount = 3 })).Content.ReadFromJsonAsync<JsonElement>();
        var path = $"/api/rooms/{room.GetProperty("id").GetString()}";
        var player = await (await guest.PostAsJsonAsync(path + "/join", new { pin = room.GetProperty("pin").GetString(), seat = 1 })).Content.ReadFromJsonAsync<JsonElement>();
        host.DefaultRequestHeaders.Authorization = new AuthenticationHeaderValue("Bearer", room.GetProperty("token").GetString());
        guest.DefaultRequestHeaders.Authorization = new AuthenticationHeaderValue("Bearer", player.GetProperty("token").GetString());
        var match = new { id = "game", playerCount = 3, players = new[] { new { id = "a" }, new { id = "b" }, new { id = "c" } } };
        var commit = new { revision = 0, handKey = "first", match, decisions = Array.Empty<object>() };
        ((await guest.PutAsJsonAsync(path + "/game", commit)).StatusCode).Should().Be(HttpStatusCode.Unauthorized);
        ((await host.PutAsJsonAsync(path + "/game", commit)).StatusCode).Should().Be(HttpStatusCode.OK);
        var action = new { id = Guid.NewGuid().ToString(), handKey = "first", kind = "riichi", payload = new { }, seat = 0 };
        ((await guest.PostAsJsonAsync(path + "/game/actions", action)).StatusCode).Should().Be(HttpStatusCode.OK);
        ((await guest.PostAsJsonAsync(path + "/game/actions", action)).StatusCode).Should().Be(HttpStatusCode.OK);
        var state = await (await host.GetAsync(path + "/game")).Content.ReadFromJsonAsync<JsonElement>();
        (state.GetProperty("revision").GetInt32()).Should().Be(2);
        (state.GetProperty("actions").GetArrayLength()).Should().Be(1);
        (state.GetProperty("actions")[0].GetProperty("seat").GetInt32()).Should().Be(1); // ignores guest's forged seat
        ((await host.PutAsJsonAsync(path + "/game", commit)).StatusCode).Should().Be(HttpStatusCode.Conflict);
        var accepted = new { revision = 2, handKey = "second", match, decisions = new[] { new { id = action.id, error = "" } } };
        ((await host.PutAsJsonAsync(path + "/game", accepted)).StatusCode).Should().Be(HttpStatusCode.OK);
        ((await guest.PostAsJsonAsync(path + "/game/actions", action with { id = Guid.NewGuid().ToString() })).StatusCode).Should().Be(HttpStatusCode.Conflict);
        ((await guest.PostAsJsonAsync(path + "/game/actions", action)).StatusCode).Should().Be(HttpStatusCode.OK); // retry old receipt, no mutation
        ((await host.DeleteAsync(path + "/seats/1")).StatusCode).Should().Be(HttpStatusCode.NoContent);
        ((await guest.PostAsJsonAsync(path + "/game/actions", action)).StatusCode).Should().Be(HttpStatusCode.Unauthorized);
    }
}

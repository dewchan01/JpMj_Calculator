using System.Net;
using System.Net.Http.Headers;
using System.Net.Http.Json;
using System.Text.Json;
using Xunit;

namespace Riichi.Api.Tests;

public sealed class GameTests
{
    [Fact]
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
        Assert.Equal(HttpStatusCode.Unauthorized, (await guest.PutAsJsonAsync(path + "/game", commit)).StatusCode);
        Assert.Equal(HttpStatusCode.OK, (await host.PutAsJsonAsync(path + "/game", commit)).StatusCode);
        var action = new { id = Guid.NewGuid().ToString(), handKey = "first", kind = "riichi", payload = new { }, seat = 0 };
        Assert.Equal(HttpStatusCode.OK, (await guest.PostAsJsonAsync(path + "/game/actions", action)).StatusCode);
        Assert.Equal(HttpStatusCode.OK, (await guest.PostAsJsonAsync(path + "/game/actions", action)).StatusCode);
        var state = await (await host.GetAsync(path + "/game")).Content.ReadFromJsonAsync<JsonElement>();
        Assert.Equal(2, state.GetProperty("revision").GetInt32());
        Assert.Equal(1, state.GetProperty("actions").GetArrayLength());
        Assert.Equal(1, state.GetProperty("actions")[0].GetProperty("seat").GetInt32()); // ignores guest's forged seat
        Assert.Equal(HttpStatusCode.Conflict, (await host.PutAsJsonAsync(path + "/game", commit)).StatusCode);
        var accepted = new { revision = 2, handKey = "second", match, decisions = new[] { new { id = action.id, error = "" } } };
        Assert.Equal(HttpStatusCode.OK, (await host.PutAsJsonAsync(path + "/game", accepted)).StatusCode);
        Assert.Equal(HttpStatusCode.Conflict, (await guest.PostAsJsonAsync(path + "/game/actions", action with { id = Guid.NewGuid().ToString() })).StatusCode);
        Assert.Equal(HttpStatusCode.OK, (await guest.PostAsJsonAsync(path + "/game/actions", action)).StatusCode); // retry old receipt, no mutation
        Assert.Equal(HttpStatusCode.NoContent, (await host.DeleteAsync(path + "/seats/1")).StatusCode);
        Assert.Equal(HttpStatusCode.Unauthorized, (await guest.PostAsJsonAsync(path + "/game/actions", action)).StatusCode);
    }
}

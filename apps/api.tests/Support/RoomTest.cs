using System.Net;
using System.Net.Http.Json;
using System.Text.Json;
using FluentAssertions;

namespace Riichi.Api.Tests;

internal static class RoomTest
{
    public static async Task Approve(HttpClient host, HttpClient guest, string path, int seat = 0)
    {
        (await guest.PutAsJsonAsync(path + "/player", new { seat })).StatusCode.Should().Be(HttpStatusCode.Accepted);
        var state = await host.GetFromJsonAsync<JsonElement>(path + "/game");
        var id = state.GetProperty("seatRequests")[0].GetProperty("id").GetString();
        (await host.PostAsJsonAsync(path + "/assignments/" + id, new { accept = true })).EnsureSuccessStatusCode();
    }
}

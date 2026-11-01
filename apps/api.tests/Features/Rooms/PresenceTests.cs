using FluentAssertions;
using Microsoft.VisualStudio.TestTools.UnitTesting;
using Riichi.Api.Features.Rooms.Notifications;

namespace Riichi.Api.Tests;

[TestClass]
public sealed class PresenceTests
{
    [TestMethod]
    public void AwayConnectionsKeepTheirSeatAndAnActiveTabRestoresGreenStatus()
    {
        var presence = new RoomPresence();
        presence.Connect("first", "room", 1);
        presence.SetAway("first", true)!.AwaySeats.Should().Equal(1);
        presence.Get("room").Seats.Should().Equal(1);
        presence.Connect("second", "room", 1);
        presence.Get("room").AwaySeats.Should().BeEmpty();
        presence.Disconnect("second");
        presence.Get("room").AwaySeats.Should().Equal(1);
        presence.SetAway("first", false)!.AwaySeats.Should().BeEmpty();
        presence.SetAway("unknown", true).Should().BeNull();
    }
    [TestMethod]
    public void MultipleTabsRemainOnlineUntilLastConnectionLeaves()
    {
        var presence = new RoomPresence();
        presence.Connect("first", "room", 1).Seats.Should().Equal(1);
        presence.Connect("second", "room", 1);
        presence.Connect("other-room", "other", 2);
        var first = presence.Disconnect("first");
        first!.Value.Presence.Seats.Should().Equal(1);
        var second = presence.Disconnect("second");
        second!.Value.Presence.Seats.Should().BeEmpty();
        second.Value.Presence.Version.Should().BeGreaterThan(first.Value.Presence.Version);
        presence.Get("other").Seats.Should().Equal(2);
    }

    [TestMethod]
    public void RevokingAndClosingRemovePresenceWithoutKeepingCredentials()
    {
        var presence = new RoomPresence();
        presence.Connect("host", "room", 0);
        presence.Connect("guest", "room", 1);
        presence.Release("room", 1).Seats.Should().Equal(0);
        presence.Remove("room");
        presence.Get("room").Seats.Should().BeEmpty();
        presence.Disconnect("guest").Should().BeNull();
    }
}

using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace Riichi.Api.Migrations
{
    /// <inheritdoc />
    public partial class RoomLifecycle : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.AddColumn<string>(
                name: "Decision",
                table: "Unassigned",
                type: "nvarchar(max)",
                nullable: false,
                defaultValue: "unassigned");

            migrationBuilder.AddColumn<long>(
                name: "OfflineSince",
                table: "Seats",
                type: "bigint",
                nullable: true);

            migrationBuilder.AddColumn<bool>(
                name: "Closed",
                table: "Rooms",
                type: "bit",
                nullable: false,
                defaultValue: false);

            migrationBuilder.AddColumn<long>(
                name: "HostOfflineSince",
                table: "Rooms",
                type: "bigint",
                nullable: true);
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropColumn(
                name: "Decision",
                table: "Unassigned");

            migrationBuilder.DropColumn(
                name: "OfflineSince",
                table: "Seats");

            migrationBuilder.DropColumn(
                name: "Closed",
                table: "Rooms");

            migrationBuilder.DropColumn(
                name: "HostOfflineSince",
                table: "Rooms");
        }
    }
}

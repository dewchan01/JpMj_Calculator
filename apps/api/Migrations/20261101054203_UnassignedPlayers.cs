using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace Riichi.Api.Migrations
{
    /// <inheritdoc />
    public partial class UnassignedPlayers : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.CreateTable(
                name: "Unassigned",
                columns: table => new
                {
                    RoomId = table.Column<string>(type: "nvarchar(16)", nullable: false),
                    Id = table.Column<string>(type: "nvarchar(32)", maxLength: 32, nullable: false),
                    TokenHash = table.Column<string>(type: "nvarchar(64)", maxLength: 64, nullable: false),
                    RequestedSeat = table.Column<int>(type: "int", nullable: true)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_Unassigned", x => new { x.RoomId, x.Id });
                    table.ForeignKey(
                        name: "FK_Unassigned_Rooms_RoomId",
                        column: x => x.RoomId,
                        principalTable: "Rooms",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Cascade);
                });

            migrationBuilder.CreateIndex(
                name: "IX_Unassigned_RoomId_TokenHash",
                table: "Unassigned",
                columns: new[] { "RoomId", "TokenHash" },
                unique: true);
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropTable(
                name: "Unassigned");
        }
    }
}

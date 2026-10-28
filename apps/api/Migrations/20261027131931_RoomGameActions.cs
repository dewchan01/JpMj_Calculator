using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace Riichi.Api.Migrations
{
    /// <inheritdoc />
    public partial class RoomGameActions : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.AddColumn<string>(
                name: "HandKey",
                table: "Rooms",
                type: "nvarchar(max)",
                nullable: false,
                defaultValue: "");

            migrationBuilder.CreateTable(
                name: "Actions",
                columns: table => new
                {
                    RoomId = table.Column<string>(type: "nvarchar(16)", nullable: false),
                    Id = table.Column<string>(type: "nvarchar(64)", maxLength: 64, nullable: false),
                    Seat = table.Column<int>(type: "int", nullable: false),
                    ActorHash = table.Column<string>(type: "nvarchar(max)", nullable: false),
                    HandKey = table.Column<string>(type: "nvarchar(max)", nullable: false),
                    Kind = table.Column<string>(type: "nvarchar(max)", nullable: false),
                    Payload = table.Column<string>(type: "nvarchar(max)", nullable: false),
                    CreatedAt = table.Column<long>(type: "bigint", nullable: false),
                    Status = table.Column<string>(type: "nvarchar(max)", nullable: false),
                    Error = table.Column<string>(type: "nvarchar(max)", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_Actions", x => new { x.RoomId, x.Id });
                    table.ForeignKey(
                        name: "FK_Actions_Rooms_RoomId",
                        column: x => x.RoomId,
                        principalTable: "Rooms",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Cascade);
                });
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropTable(
                name: "Actions");

            migrationBuilder.DropColumn(
                name: "HandKey",
                table: "Rooms");
        }
    }
}

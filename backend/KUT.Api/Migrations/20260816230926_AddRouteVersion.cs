using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace KUT.Api.Migrations
{
    /// <inheritdoc />
    public partial class AddRouteVersion : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.AddColumn<int>(
                name: "RouteVersion",
                table: "Assignments",
                type: "integer",
                nullable: false,
                defaultValue: 0);
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropColumn(
                name: "RouteVersion",
                table: "Assignments");
        }
    }
}

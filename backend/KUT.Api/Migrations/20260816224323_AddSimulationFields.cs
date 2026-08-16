using System;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace KUT.Api.Migrations
{
    /// <inheritdoc />
    public partial class AddSimulationFields : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.AddColumn<string>(
                name: "Capabilities",
                table: "Vehicles",
                type: "text",
                nullable: false,
                defaultValue: "");

            migrationBuilder.AddColumn<double>(
                name: "Heading",
                table: "Vehicles",
                type: "double precision",
                nullable: true);

            migrationBuilder.AddColumn<int>(
                name: "EtaSeconds",
                table: "Assignments",
                type: "integer",
                nullable: true);

            migrationBuilder.AddColumn<DateTime>(
                name: "LastAdvancedAt",
                table: "Assignments",
                type: "timestamp with time zone",
                nullable: true);

            migrationBuilder.AddColumn<int>(
                name: "RouteIndex",
                table: "Assignments",
                type: "integer",
                nullable: false,
                defaultValue: 0);

            migrationBuilder.AddColumn<string>(
                name: "RoutePath",
                table: "Assignments",
                type: "text",
                nullable: true);
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropColumn(
                name: "Capabilities",
                table: "Vehicles");

            migrationBuilder.DropColumn(
                name: "Heading",
                table: "Vehicles");

            migrationBuilder.DropColumn(
                name: "EtaSeconds",
                table: "Assignments");

            migrationBuilder.DropColumn(
                name: "LastAdvancedAt",
                table: "Assignments");

            migrationBuilder.DropColumn(
                name: "RouteIndex",
                table: "Assignments");

            migrationBuilder.DropColumn(
                name: "RoutePath",
                table: "Assignments");
        }
    }
}

using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace Hewn.Infrastructure.Persistence.Migrations
{
    /// <inheritdoc />
    public partial class FeatureDirections : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.AddColumn<bool>(
                name: "HasUiChange",
                table: "directions",
                type: "INTEGER",
                nullable: true);

            migrationBuilder.AddColumn<string>(
                name: "UiDecision",
                table: "directions",
                type: "TEXT",
                maxLength: 2000,
                nullable: true);
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropColumn(
                name: "HasUiChange",
                table: "directions");

            migrationBuilder.DropColumn(
                name: "UiDecision",
                table: "directions");
        }
    }
}

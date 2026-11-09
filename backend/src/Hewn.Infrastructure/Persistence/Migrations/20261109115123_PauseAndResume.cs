using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace Hewn.Infrastructure.Persistence.Migrations
{
    /// <inheritdoc />
    public partial class PauseAndResume : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.AddColumn<string>(
                name: "PauseRequestedBy",
                table: "directions",
                type: "TEXT",
                maxLength: 39,
                nullable: true);

            migrationBuilder.AddColumn<long>(
                name: "PausedAt",
                table: "directions",
                type: "INTEGER",
                nullable: true);

            migrationBuilder.AddColumn<string>(
                name: "PausedBy",
                table: "directions",
                type: "TEXT",
                maxLength: 39,
                nullable: true);
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropColumn(
                name: "PauseRequestedBy",
                table: "directions");

            migrationBuilder.DropColumn(
                name: "PausedAt",
                table: "directions");

            migrationBuilder.DropColumn(
                name: "PausedBy",
                table: "directions");
        }
    }
}

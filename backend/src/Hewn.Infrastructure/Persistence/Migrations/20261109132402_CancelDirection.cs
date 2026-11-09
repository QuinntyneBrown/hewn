using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace Hewn.Infrastructure.Persistence.Migrations
{
    /// <inheritdoc />
    public partial class CancelDirection : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.AddColumn<long>(
                name: "StopAcknowledgedAt",
                table: "runs",
                type: "INTEGER",
                nullable: true);

            migrationBuilder.AddColumn<bool>(
                name: "AwaitingStop",
                table: "directions",
                type: "INTEGER",
                nullable: false,
                defaultValue: false);

            migrationBuilder.AddColumn<long>(
                name: "CancelledAt",
                table: "directions",
                type: "INTEGER",
                nullable: true);

            migrationBuilder.AddColumn<string>(
                name: "CancelledBy",
                table: "directions",
                type: "TEXT",
                maxLength: 39,
                nullable: true);

            migrationBuilder.AddColumn<string>(
                name: "LabelledPullRequests",
                table: "directions",
                type: "TEXT",
                maxLength: 400,
                nullable: true);

            migrationBuilder.AddColumn<int>(
                name: "StoppedWithinSeconds",
                table: "directions",
                type: "INTEGER",
                nullable: true);
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropColumn(
                name: "StopAcknowledgedAt",
                table: "runs");

            migrationBuilder.DropColumn(
                name: "AwaitingStop",
                table: "directions");

            migrationBuilder.DropColumn(
                name: "CancelledAt",
                table: "directions");

            migrationBuilder.DropColumn(
                name: "CancelledBy",
                table: "directions");

            migrationBuilder.DropColumn(
                name: "LabelledPullRequests",
                table: "directions");

            migrationBuilder.DropColumn(
                name: "StoppedWithinSeconds",
                table: "directions");
        }
    }
}

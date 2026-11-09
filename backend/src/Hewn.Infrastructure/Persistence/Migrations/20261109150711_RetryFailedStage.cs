using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace Hewn.Infrastructure.Persistence.Migrations
{
    /// <inheritdoc />
    public partial class RetryFailedStage : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.AddColumn<int>(
                name: "Attempt",
                table: "runs",
                type: "INTEGER",
                nullable: false,
                defaultValue: 1);

            migrationBuilder.AddColumn<long>(
                name: "NotBefore",
                table: "runs",
                type: "INTEGER",
                nullable: true);

            migrationBuilder.AddColumn<long>(
                name: "FailedAt",
                table: "directions",
                type: "INTEGER",
                nullable: true);

            migrationBuilder.AddColumn<int>(
                name: "FailedStage",
                table: "directions",
                type: "INTEGER",
                nullable: true);

            migrationBuilder.AddColumn<string>(
                name: "FailureReason",
                table: "directions",
                type: "TEXT",
                maxLength: 2000,
                nullable: true);
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropColumn(
                name: "Attempt",
                table: "runs");

            migrationBuilder.DropColumn(
                name: "NotBefore",
                table: "runs");

            migrationBuilder.DropColumn(
                name: "FailedAt",
                table: "directions");

            migrationBuilder.DropColumn(
                name: "FailedStage",
                table: "directions");

            migrationBuilder.DropColumn(
                name: "FailureReason",
                table: "directions");
        }
    }
}

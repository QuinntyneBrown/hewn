using System;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace Hewn.Infrastructure.Persistence.Migrations
{
    /// <inheritdoc />
    public partial class FollowIncrement : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.AddColumn<long>(
                name: "ChecksHeardAt",
                table: "increments",
                type: "INTEGER",
                nullable: true);

            migrationBuilder.AddColumn<long>(
                name: "FinishedAt",
                table: "increments",
                type: "INTEGER",
                nullable: true);

            migrationBuilder.AddColumn<int>(
                name: "GreenAfter",
                table: "increments",
                type: "INTEGER",
                nullable: true);

            migrationBuilder.AddColumn<long>(
                name: "GreenAt",
                table: "increments",
                type: "INTEGER",
                nullable: true);

            migrationBuilder.AddColumn<long>(
                name: "PullRequestOpenedAt",
                table: "increments",
                type: "INTEGER",
                nullable: true);

            migrationBuilder.AddColumn<long>(
                name: "StartedAt",
                table: "increments",
                type: "INTEGER",
                nullable: true);

            migrationBuilder.AddColumn<int>(
                name: "TestCount",
                table: "increments",
                type: "INTEGER",
                nullable: true);

            migrationBuilder.AddColumn<long>(
                name: "TestsCommittedAt",
                table: "increments",
                type: "INTEGER",
                nullable: true);

            migrationBuilder.AddColumn<string>(
                name: "Video",
                table: "increments",
                type: "TEXT",
                maxLength: 16,
                nullable: true);

            migrationBuilder.AddColumn<long>(
                name: "VideoAt",
                table: "increments",
                type: "INTEGER",
                nullable: true);

            migrationBuilder.AddColumn<string>(
                name: "VideoNote",
                table: "increments",
                type: "TEXT",
                maxLength: 500,
                nullable: true);

            migrationBuilder.CreateTable(
                name: "increment_checks",
                columns: table => new
                {
                    Id = table.Column<Guid>(type: "TEXT", nullable: false),
                    IncrementId = table.Column<Guid>(type: "TEXT", nullable: false),
                    PullRequestNumber = table.Column<int>(type: "INTEGER", nullable: false),
                    Name = table.Column<string>(type: "TEXT", maxLength: 200, nullable: false),
                    Status = table.Column<string>(type: "TEXT", maxLength: 16, nullable: false),
                    Conclusion = table.Column<string>(type: "TEXT", maxLength: 32, nullable: true),
                    StartedAt = table.Column<long>(type: "INTEGER", nullable: true),
                    CompletedAt = table.Column<long>(type: "INTEGER", nullable: true)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_increment_checks", x => x.Id);
                });

            migrationBuilder.CreateIndex(
                name: "IX_increments_PullRequestNumber",
                table: "increments",
                column: "PullRequestNumber");

            migrationBuilder.CreateIndex(
                name: "IX_increment_checks_IncrementId_PullRequestNumber_Name",
                table: "increment_checks",
                columns: new[] { "IncrementId", "PullRequestNumber", "Name" },
                unique: true);
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropTable(
                name: "increment_checks");

            migrationBuilder.DropIndex(
                name: "IX_increments_PullRequestNumber",
                table: "increments");

            migrationBuilder.DropColumn(
                name: "ChecksHeardAt",
                table: "increments");

            migrationBuilder.DropColumn(
                name: "FinishedAt",
                table: "increments");

            migrationBuilder.DropColumn(
                name: "GreenAfter",
                table: "increments");

            migrationBuilder.DropColumn(
                name: "GreenAt",
                table: "increments");

            migrationBuilder.DropColumn(
                name: "PullRequestOpenedAt",
                table: "increments");

            migrationBuilder.DropColumn(
                name: "StartedAt",
                table: "increments");

            migrationBuilder.DropColumn(
                name: "TestCount",
                table: "increments");

            migrationBuilder.DropColumn(
                name: "TestsCommittedAt",
                table: "increments");

            migrationBuilder.DropColumn(
                name: "Video",
                table: "increments");

            migrationBuilder.DropColumn(
                name: "VideoAt",
                table: "increments");

            migrationBuilder.DropColumn(
                name: "VideoNote",
                table: "increments");
        }
    }
}

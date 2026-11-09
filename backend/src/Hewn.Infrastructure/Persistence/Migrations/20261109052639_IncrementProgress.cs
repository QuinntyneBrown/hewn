using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace Hewn.Infrastructure.Persistence.Migrations
{
    /// <inheritdoc />
    public partial class IncrementProgress : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.AddColumn<string>(
                name: "FailingTests",
                table: "increments",
                type: "TEXT",
                maxLength: 52000,
                nullable: true);

            migrationBuilder.AddColumn<int>(
                name: "Iterations",
                table: "increments",
                type: "INTEGER",
                nullable: false,
                defaultValue: 0);

            migrationBuilder.AddColumn<int>(
                name: "RedFailing",
                table: "increments",
                type: "INTEGER",
                nullable: true);

            migrationBuilder.AddColumn<int>(
                name: "RedPassing",
                table: "increments",
                type: "INTEGER",
                nullable: true);

            migrationBuilder.AddColumn<bool>(
                name: "TestsPassedEarly",
                table: "increments",
                type: "INTEGER",
                nullable: false,
                defaultValue: false);
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropColumn(
                name: "FailingTests",
                table: "increments");

            migrationBuilder.DropColumn(
                name: "Iterations",
                table: "increments");

            migrationBuilder.DropColumn(
                name: "RedFailing",
                table: "increments");

            migrationBuilder.DropColumn(
                name: "RedPassing",
                table: "increments");

            migrationBuilder.DropColumn(
                name: "TestsPassedEarly",
                table: "increments");
        }
    }
}

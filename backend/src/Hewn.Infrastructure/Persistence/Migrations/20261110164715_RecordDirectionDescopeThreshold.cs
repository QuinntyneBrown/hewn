using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace Hewn.Infrastructure.Persistence.Migrations
{
    /// <inheritdoc />
    public partial class RecordDirectionDescopeThreshold : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.AddColumn<int>(
                name: "DescopeThresholdDays",
                table: "directions",
                type: "INTEGER",
                nullable: true);
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropColumn(
                name: "DescopeThresholdDays",
                table: "directions");
        }
    }
}

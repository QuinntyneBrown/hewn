using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace Hewn.Infrastructure.Persistence.Migrations
{
    /// <inheritdoc />
    public partial class ManageAllowList : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.AddColumn<long>(
                name: "AddedAt",
                table: "allow_list",
                type: "INTEGER",
                nullable: true);

            migrationBuilder.AddColumn<string>(
                name: "AddedBy",
                table: "allow_list",
                type: "TEXT",
                maxLength: 39,
                nullable: true);

            migrationBuilder.AddColumn<long>(
                name: "LastSignInAt",
                table: "allow_list",
                type: "INTEGER",
                nullable: true);
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropColumn(
                name: "AddedAt",
                table: "allow_list");

            migrationBuilder.DropColumn(
                name: "AddedBy",
                table: "allow_list");

            migrationBuilder.DropColumn(
                name: "LastSignInAt",
                table: "allow_list");
        }
    }
}

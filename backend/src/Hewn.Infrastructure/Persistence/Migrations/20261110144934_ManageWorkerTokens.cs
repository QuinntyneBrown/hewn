using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace Hewn.Infrastructure.Persistence.Migrations
{
    /// <inheritdoc />
    public partial class ManageWorkerTokens : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.AddColumn<long>(
                name: "RevokedAt",
                table: "workers",
                type: "INTEGER",
                nullable: true);

            migrationBuilder.AddColumn<string>(
                name: "TokenId",
                table: "workers",
                type: "TEXT",
                maxLength: 32,
                nullable: true);

            migrationBuilder.CreateTable(
                name: "worker_tokens",
                columns: table => new
                {
                    Id = table.Column<string>(type: "TEXT", maxLength: 32, nullable: false),
                    Name = table.Column<string>(type: "TEXT", maxLength: 40, nullable: false),
                    Location = table.Column<string>(type: "TEXT", maxLength: 16, nullable: false),
                    Hash = table.Column<string>(type: "TEXT", fixedLength: true, maxLength: 64, nullable: false),
                    CreatedBy = table.Column<string>(type: "TEXT", maxLength: 39, nullable: false),
                    CreatedAt = table.Column<long>(type: "INTEGER", nullable: false),
                    ExpiresAt = table.Column<long>(type: "INTEGER", nullable: false),
                    RevokedAt = table.Column<long>(type: "INTEGER", nullable: true),
                    RevokedBy = table.Column<string>(type: "TEXT", maxLength: 39, nullable: true)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_worker_tokens", x => x.Id);
                });

            migrationBuilder.CreateIndex(
                name: "IX_workers_TokenId",
                table: "workers",
                column: "TokenId");

            migrationBuilder.CreateIndex(
                name: "IX_worker_tokens_Hash",
                table: "worker_tokens",
                column: "Hash",
                unique: true);
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropTable(
                name: "worker_tokens");

            migrationBuilder.DropIndex(
                name: "IX_workers_TokenId",
                table: "workers");

            migrationBuilder.DropColumn(
                name: "RevokedAt",
                table: "workers");

            migrationBuilder.DropColumn(
                name: "TokenId",
                table: "workers");
        }
    }
}

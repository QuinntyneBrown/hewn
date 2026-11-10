using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace Hewn.Infrastructure.Persistence.Migrations
{
    /// <inheritdoc />
    public partial class RecordDecisionCommits : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.AddColumn<string>(
                name: "Adr",
                table: "run_decisions",
                type: "TEXT",
                maxLength: 200,
                nullable: true);

            migrationBuilder.AddColumn<string>(
                name: "CommitSha",
                table: "run_decisions",
                type: "TEXT",
                maxLength: 40,
                nullable: true);

            migrationBuilder.CreateIndex(
                name: "IX_run_decisions_ProjectId_RecordedAt",
                table: "run_decisions",
                columns: new[] { "ProjectId", "RecordedAt" });
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropIndex(
                name: "IX_run_decisions_ProjectId_RecordedAt",
                table: "run_decisions");

            migrationBuilder.DropColumn(
                name: "Adr",
                table: "run_decisions");

            migrationBuilder.DropColumn(
                name: "CommitSha",
                table: "run_decisions");
        }
    }
}

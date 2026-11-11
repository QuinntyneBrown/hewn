using System;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace Hewn.Infrastructure.Persistence.Migrations
{
    /// <inheritdoc />
    public partial class UpdateProjectSkills : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.CreateTable(
                name: "skills_updates",
                columns: table => new
                {
                    Id = table.Column<Guid>(type: "TEXT", nullable: false),
                    ProjectId = table.Column<Guid>(type: "TEXT", nullable: false),
                    FromSha = table.Column<string>(type: "TEXT", maxLength: 40, nullable: false),
                    ToSha = table.Column<string>(type: "TEXT", maxLength: 40, nullable: false),
                    Branch = table.Column<string>(type: "TEXT", maxLength: 255, nullable: false),
                    PullRequestNumber = table.Column<int>(type: "INTEGER", nullable: false),
                    PullRequestUrl = table.Column<string>(type: "TEXT", maxLength: 500, nullable: false),
                    RequestedBy = table.Column<string>(type: "TEXT", maxLength: 39, nullable: false),
                    Status = table.Column<string>(type: "TEXT", maxLength: 20, nullable: false),
                    CreatedAt = table.Column<long>(type: "INTEGER", nullable: false),
                    EndedAt = table.Column<long>(type: "INTEGER", nullable: true),
                    FailedChecks = table.Column<string>(type: "TEXT", nullable: true)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_skills_updates", x => x.Id);
                });

            migrationBuilder.CreateIndex(
                name: "IX_skills_updates_ProjectId_Status",
                table: "skills_updates",
                columns: new[] { "ProjectId", "Status" });
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropTable(
                name: "skills_updates");
        }
    }
}

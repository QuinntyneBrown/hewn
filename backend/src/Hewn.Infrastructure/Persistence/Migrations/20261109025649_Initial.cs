using System;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace Hewn.Infrastructure.Persistence.Migrations
{
    /// <inheritdoc />
    public partial class Initial : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.CreateTable(
                name: "allow_list",
                columns: table => new
                {
                    Login = table.Column<string>(type: "TEXT", maxLength: 39, nullable: false),
                    Role = table.Column<string>(type: "TEXT", maxLength: 16, nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_allow_list", x => x.Login);
                });

            migrationBuilder.CreateTable(
                name: "events",
                columns: table => new
                {
                    Id = table.Column<long>(type: "INTEGER", nullable: false)
                        .Annotation("Sqlite:Autoincrement", true),
                    ProjectId = table.Column<Guid>(type: "TEXT", nullable: false),
                    Sequence = table.Column<long>(type: "INTEGER", nullable: false),
                    Type = table.Column<string>(type: "TEXT", maxLength: 64, nullable: false),
                    Payload = table.Column<string>(type: "TEXT", nullable: false),
                    OccurredAt = table.Column<long>(type: "INTEGER", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_events", x => x.Id);
                });

            migrationBuilder.CreateTable(
                name: "projects",
                columns: table => new
                {
                    Id = table.Column<Guid>(type: "TEXT", nullable: false),
                    Name = table.Column<string>(type: "TEXT", maxLength: 100, nullable: false),
                    NormalizedName = table.Column<string>(type: "TEXT", maxLength: 100, nullable: false),
                    Idea = table.Column<string>(type: "TEXT", maxLength: 20000, nullable: false),
                    StackPreference = table.Column<string>(type: "TEXT", maxLength: 200, nullable: true),
                    RepositoryOwner = table.Column<string>(type: "TEXT", maxLength: 39, nullable: true),
                    RepositoryName = table.Column<string>(type: "TEXT", maxLength: 100, nullable: true),
                    Status = table.Column<string>(type: "TEXT", maxLength: 16, nullable: false),
                    CreatedBy = table.Column<string>(type: "TEXT", maxLength: 39, nullable: false),
                    CreatedAt = table.Column<long>(type: "INTEGER", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_projects", x => x.Id);
                });

            migrationBuilder.CreateTable(
                name: "directions",
                columns: table => new
                {
                    Id = table.Column<Guid>(type: "TEXT", nullable: false),
                    ProjectId = table.Column<Guid>(type: "TEXT", nullable: false),
                    Kind = table.Column<string>(type: "TEXT", maxLength: 16, nullable: false),
                    Idea = table.Column<string>(type: "TEXT", maxLength: 20000, nullable: false),
                    BudgetUsd = table.Column<double>(type: "REAL", nullable: false),
                    Status = table.Column<string>(type: "TEXT", maxLength: 16, nullable: false),
                    SubmittedBy = table.Column<string>(type: "TEXT", maxLength: 39, nullable: false),
                    SubmittedAt = table.Column<long>(type: "INTEGER", nullable: false),
                    CompletedAt = table.Column<long>(type: "INTEGER", nullable: true)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_directions", x => x.Id);
                    table.ForeignKey(
                        name: "FK_directions_projects_ProjectId",
                        column: x => x.ProjectId,
                        principalTable: "projects",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Cascade);
                });

            migrationBuilder.CreateTable(
                name: "stage_states",
                columns: table => new
                {
                    DirectionId = table.Column<Guid>(type: "TEXT", nullable: false),
                    Number = table.Column<int>(type: "INTEGER", nullable: false),
                    Name = table.Column<string>(type: "TEXT", maxLength: 32, nullable: false),
                    Status = table.Column<string>(type: "TEXT", maxLength: 16, nullable: false),
                    StartedAt = table.Column<long>(type: "INTEGER", nullable: true),
                    EndedAt = table.Column<long>(type: "INTEGER", nullable: true)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_stage_states", x => new { x.DirectionId, x.Number });
                    table.ForeignKey(
                        name: "FK_stage_states_directions_DirectionId",
                        column: x => x.DirectionId,
                        principalTable: "directions",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Cascade);
                });

            migrationBuilder.CreateIndex(
                name: "IX_directions_ProjectId_SubmittedAt",
                table: "directions",
                columns: new[] { "ProjectId", "SubmittedAt" });

            migrationBuilder.CreateIndex(
                name: "IX_events_ProjectId_Sequence",
                table: "events",
                columns: new[] { "ProjectId", "Sequence" },
                unique: true);

            migrationBuilder.CreateIndex(
                name: "IX_projects_NormalizedName",
                table: "projects",
                column: "NormalizedName",
                unique: true);
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropTable(
                name: "allow_list");

            migrationBuilder.DropTable(
                name: "events");

            migrationBuilder.DropTable(
                name: "stage_states");

            migrationBuilder.DropTable(
                name: "directions");

            migrationBuilder.DropTable(
                name: "projects");
        }
    }
}

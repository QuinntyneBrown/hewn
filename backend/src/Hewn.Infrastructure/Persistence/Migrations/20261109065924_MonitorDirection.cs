using System;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace Hewn.Infrastructure.Persistence.Migrations
{
    /// <inheritdoc />
    public partial class MonitorDirection : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.AddColumn<int>(
                name: "CurrentStep",
                table: "runs",
                type: "INTEGER",
                nullable: true);

            migrationBuilder.AddColumn<string>(
                name: "CurrentStepName",
                table: "runs",
                type: "TEXT",
                maxLength: 200,
                nullable: true);

            migrationBuilder.AddColumn<string>(
                name: "RanBy",
                table: "runs",
                type: "TEXT",
                maxLength: 32,
                nullable: true);

            migrationBuilder.CreateTable(
                name: "run_decisions",
                columns: table => new
                {
                    Id = table.Column<long>(type: "INTEGER", nullable: false)
                        .Annotation("Sqlite:Autoincrement", true),
                    RunId = table.Column<Guid>(type: "TEXT", nullable: false),
                    ProjectId = table.Column<Guid>(type: "TEXT", nullable: false),
                    DirectionId = table.Column<Guid>(type: "TEXT", nullable: false),
                    Stage = table.Column<int>(type: "INTEGER", nullable: false),
                    Question = table.Column<string>(type: "TEXT", maxLength: 1000, nullable: false),
                    Answer = table.Column<string>(type: "TEXT", maxLength: 2000, nullable: false),
                    Rationale = table.Column<string>(type: "TEXT", maxLength: 4000, nullable: false),
                    RecordedAt = table.Column<long>(type: "INTEGER", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_run_decisions", x => x.Id);
                });

            migrationBuilder.CreateIndex(
                name: "IX_run_decisions_DirectionId_Stage",
                table: "run_decisions",
                columns: new[] { "DirectionId", "Stage" });
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropTable(
                name: "run_decisions");

            migrationBuilder.DropColumn(
                name: "CurrentStep",
                table: "runs");

            migrationBuilder.DropColumn(
                name: "CurrentStepName",
                table: "runs");

            migrationBuilder.DropColumn(
                name: "RanBy",
                table: "runs");
        }
    }
}

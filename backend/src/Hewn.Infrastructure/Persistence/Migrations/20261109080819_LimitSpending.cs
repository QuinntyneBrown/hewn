using System;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace Hewn.Infrastructure.Persistence.Migrations
{
    /// <inheritdoc />
    public partial class LimitSpending : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.AddColumn<bool>(
                name: "BudgetWarned",
                table: "directions",
                type: "INTEGER",
                nullable: false,
                defaultValue: false);

            migrationBuilder.AddColumn<string>(
                name: "PauseReason",
                table: "directions",
                type: "TEXT",
                maxLength: 100,
                nullable: true);

            migrationBuilder.AddColumn<double>(
                name: "SpendUsd",
                table: "directions",
                type: "REAL",
                nullable: false,
                defaultValue: 0.0);

            migrationBuilder.CreateTable(
                name: "direction_defaults",
                columns: table => new
                {
                    Id = table.Column<int>(type: "INTEGER", nullable: false),
                    DefaultBudgetUsd = table.Column<double>(type: "REAL", nullable: false),
                    UpdatedBy = table.Column<string>(type: "TEXT", maxLength: 39, nullable: false),
                    UpdatedAt = table.Column<long>(type: "INTEGER", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_direction_defaults", x => x.Id);
                });

            migrationBuilder.CreateTable(
                name: "model_calls",
                columns: table => new
                {
                    Id = table.Column<Guid>(type: "TEXT", nullable: false),
                    RunId = table.Column<Guid>(type: "TEXT", nullable: false),
                    ProjectId = table.Column<Guid>(type: "TEXT", nullable: false),
                    DirectionId = table.Column<Guid>(type: "TEXT", nullable: false),
                    Stage = table.Column<int>(type: "INTEGER", nullable: false),
                    CallId = table.Column<string>(type: "TEXT", maxLength: 100, nullable: false),
                    Model = table.Column<string>(type: "TEXT", maxLength: 100, nullable: false),
                    InputTokens = table.Column<long>(type: "INTEGER", nullable: false),
                    OutputTokens = table.Column<long>(type: "INTEGER", nullable: false),
                    CostUsd = table.Column<double>(type: "REAL", nullable: false),
                    RecordedAt = table.Column<long>(type: "INTEGER", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_model_calls", x => x.Id);
                });

            migrationBuilder.CreateIndex(
                name: "IX_model_calls_ProjectId_DirectionId",
                table: "model_calls",
                columns: new[] { "ProjectId", "DirectionId" });

            migrationBuilder.CreateIndex(
                name: "IX_model_calls_RunId_CallId",
                table: "model_calls",
                columns: new[] { "RunId", "CallId" },
                unique: true);
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropTable(
                name: "direction_defaults");

            migrationBuilder.DropTable(
                name: "model_calls");

            migrationBuilder.DropColumn(
                name: "BudgetWarned",
                table: "directions");

            migrationBuilder.DropColumn(
                name: "PauseReason",
                table: "directions");

            migrationBuilder.DropColumn(
                name: "SpendUsd",
                table: "directions");
        }
    }
}

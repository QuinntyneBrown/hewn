using System;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace Hewn.Infrastructure.Persistence.Migrations
{
    /// <inheritdoc />
    public partial class RecordAuditEntries : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.CreateTable(
                name: "audit_entries",
                columns: table => new
                {
                    Id = table.Column<long>(type: "INTEGER", nullable: false)
                        .Annotation("Sqlite:Autoincrement", true),
                    At = table.Column<long>(type: "INTEGER", nullable: false),
                    Actor = table.Column<string>(type: "TEXT", maxLength: 39, nullable: false),
                    Action = table.Column<string>(type: "TEXT", maxLength: 24, nullable: false),
                    ProjectId = table.Column<Guid>(type: "TEXT", nullable: true),
                    ProjectName = table.Column<string>(type: "TEXT", maxLength: 100, nullable: true),
                    Target = table.Column<string>(type: "TEXT", maxLength: 200, nullable: true),
                    IpAddress = table.Column<string>(type: "TEXT", maxLength: 45, nullable: true)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_audit_entries", x => x.Id);
                });

            migrationBuilder.CreateIndex(
                name: "IX_audit_entries_Action_Id",
                table: "audit_entries",
                columns: new[] { "Action", "Id" });

            migrationBuilder.CreateIndex(
                name: "IX_audit_entries_ProjectId_Id",
                table: "audit_entries",
                columns: new[] { "ProjectId", "Id" });

            // L2-044 AC1: entries are append-only even against a defect in Hewn's own code.
            migrationBuilder.Sql(
                "CREATE TRIGGER audit_entries_no_update BEFORE UPDATE ON audit_entries " +
                "BEGIN SELECT RAISE(ABORT, 'audit entries are append-only'); END;");
            migrationBuilder.Sql(
                "CREATE TRIGGER audit_entries_no_delete BEFORE DELETE ON audit_entries " +
                "BEGIN SELECT RAISE(ABORT, 'audit entries are append-only'); END;");
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.Sql("DROP TRIGGER IF EXISTS audit_entries_no_delete;");
            migrationBuilder.Sql("DROP TRIGGER IF EXISTS audit_entries_no_update;");
            migrationBuilder.DropTable(
                name: "audit_entries");
        }
    }
}

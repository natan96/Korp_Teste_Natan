using System;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

#pragma warning disable CA1814 // Prefer jagged arrays over multidimensional

namespace Korp.Estoque.Api.Migrations
{
    /// <inheritdoc />
    public partial class InitialCreate : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.CreateTable(
                name: "Produtos",
                columns: table => new
                {
                    Id = table.Column<int>(type: "int", nullable: false)
                        .Annotation("SqlServer:Identity", "1, 1"),
                    Codigo = table.Column<string>(type: "nvarchar(50)", maxLength: 50, nullable: false),
                    Descricao = table.Column<string>(type: "nvarchar(200)", maxLength: 200, nullable: false),
                    Saldo = table.Column<int>(type: "int", nullable: false),
                    RowVersion = table.Column<byte[]>(type: "rowversion", rowVersion: true, nullable: true),
                    DataCriacao = table.Column<DateTime>(type: "datetime2", nullable: false),
                    DataAtualizacao = table.Column<DateTime>(type: "datetime2", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_Produtos", x => x.Id);
                });

            migrationBuilder.InsertData(
                table: "Produtos",
                columns: new[] { "Id", "Codigo", "DataAtualizacao", "DataCriacao", "Descricao", "Saldo" },
                values: new object[,]
                {
                    { 1, "PROD001", new DateTime(2025, 12, 6, 3, 32, 36, 530, DateTimeKind.Utc).AddTicks(1823), new DateTime(2025, 12, 6, 3, 32, 36, 530, DateTimeKind.Utc).AddTicks(1822), "Produto Exemplo 1", 100 },
                    { 2, "PROD002", new DateTime(2025, 12, 6, 3, 32, 36, 530, DateTimeKind.Utc).AddTicks(1828), new DateTime(2025, 12, 6, 3, 32, 36, 530, DateTimeKind.Utc).AddTicks(1827), "Produto Exemplo 2", 50 },
                    { 3, "PROD003", new DateTime(2025, 12, 6, 3, 32, 36, 530, DateTimeKind.Utc).AddTicks(1831), new DateTime(2025, 12, 6, 3, 32, 36, 530, DateTimeKind.Utc).AddTicks(1831), "Produto Exemplo 3", 75 }
                });

            migrationBuilder.CreateIndex(
                name: "IX_Produtos_Codigo",
                table: "Produtos",
                column: "Codigo",
                unique: true);
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropTable(
                name: "Produtos");
        }
    }
}

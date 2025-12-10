using Microsoft.EntityFrameworkCore;
using Korp.Estoque.Api.Models;

namespace Korp.Estoque.Api.Data
{
    public class EstoqueDbContext : DbContext
    {
        public EstoqueDbContext(DbContextOptions<EstoqueDbContext> options) : base(options)
        {
        }

        public DbSet<Produto> Produtos { get; set; }

        protected override void OnModelCreating(ModelBuilder modelBuilder)
        {
            base.OnModelCreating(modelBuilder);

            modelBuilder.Entity<Produto>(entity =>
            {
                entity.HasIndex(e => e.Codigo).IsUnique();
                entity.Property(e => e.Codigo).IsRequired().HasMaxLength(50);
                entity.Property(e => e.Descricao).IsRequired().HasMaxLength(200);
                entity.Property(e => e.Saldo).IsRequired();
                entity.Property(e => e.RowVersion).IsRowVersion();
            });

            // Seed inicial de dados
            modelBuilder.Entity<Produto>().HasData(
                new Produto { Id = 1, Codigo = "PROD001", Descricao = "Produto Exemplo 1", Saldo = 100, DataCriacao = DateTime.UtcNow, DataAtualizacao = DateTime.UtcNow },
                new Produto { Id = 2, Codigo = "PROD002", Descricao = "Produto Exemplo 2", Saldo = 50, DataCriacao = DateTime.UtcNow, DataAtualizacao = DateTime.UtcNow },
                new Produto { Id = 3, Codigo = "PROD003", Descricao = "Produto Exemplo 3", Saldo = 75, DataCriacao = DateTime.UtcNow, DataAtualizacao = DateTime.UtcNow }
            );
        }
    }
}

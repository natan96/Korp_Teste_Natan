using Microsoft.EntityFrameworkCore;
using Korp.Faturamento.Api.Models;

namespace Korp.Faturamento.Api.Data
{
    public class FaturamentoDbContext : DbContext
    {
        public FaturamentoDbContext(DbContextOptions<FaturamentoDbContext> options) : base(options)
        {
        }

        public DbSet<NotaFiscal> NotasFiscais { get; set; }
        public DbSet<ItemNotaFiscal> ItensNotaFiscal { get; set; }

        protected override void OnModelCreating(ModelBuilder modelBuilder)
        {
            base.OnModelCreating(modelBuilder);

            modelBuilder.Entity<NotaFiscal>(entity =>
            {
                entity.HasIndex(e => e.Numero).IsUnique();
                entity.Property(e => e.Numero).IsRequired();
                entity.Property(e => e.Status).IsRequired();
                entity.Property(e => e.RowVersion).IsRowVersion();
                
                entity.HasMany(e => e.Itens)
                      .WithOne(e => e.NotaFiscal)
                      .HasForeignKey(e => e.NotaFiscalId)
                      .OnDelete(DeleteBehavior.Cascade);
            });

            modelBuilder.Entity<ItemNotaFiscal>(entity =>
            {
                entity.Property(e => e.CodigoProduto).IsRequired().HasMaxLength(50);
                entity.Property(e => e.DescricaoProduto).IsRequired().HasMaxLength(200);
                entity.Property(e => e.Quantidade).IsRequired();
            });
        }
    }
}

using System.ComponentModel.DataAnnotations;
using System.ComponentModel.DataAnnotations.Schema;

namespace Korp.Faturamento.Api.Models
{
    public enum StatusNotaFiscal
    {
        Aberta,
        Fechada
    }

    public class NotaFiscal
    {
        [Key]
        [DatabaseGenerated(DatabaseGeneratedOption.Identity)]
        public int Id { get; set; }

        [Required]
        public int Numero { get; set; } // Numeração sequencial

        [Required]
        public StatusNotaFiscal Status { get; set; } = StatusNotaFiscal.Aberta;

        public DateTime DataEmissao { get; set; } = DateTime.UtcNow;
        public DateTime? DataFechamento { get; set; }

        public List<ItemNotaFiscal> Itens { get; set; } = new();

        [Timestamp]
        public byte[]? RowVersion { get; set; } // Controle de concorrência
    }

    public class ItemNotaFiscal
    {
        [Key]
        [DatabaseGenerated(DatabaseGeneratedOption.Identity)]
        public int Id { get; set; }

        [Required]
        public int NotaFiscalId { get; set; }

        [ForeignKey("NotaFiscalId")]
        public NotaFiscal NotaFiscal { get; set; } = null!;

        [Required]
        public int ProdutoId { get; set; }

        [Required]
        [StringLength(50)]
        public string CodigoProduto { get; set; } = string.Empty;

        [Required]
        [StringLength(200)]
        public string DescricaoProduto { get; set; } = string.Empty;

        [Required]
        [Range(1, int.MaxValue, ErrorMessage = "A quantidade deve ser maior que zero")]
        public int Quantidade { get; set; }
    }
}

using System.ComponentModel.DataAnnotations;
using System.ComponentModel.DataAnnotations.Schema;

namespace Korp.Estoque.Api.Models
{
    public class Produto
    {
        [Key]
        [DatabaseGenerated(DatabaseGeneratedOption.Identity)]
        public int Id { get; set; }

        [Required(ErrorMessage = "O código do produto é obrigatório")]
        [StringLength(50)]
        public string Codigo { get; set; } = string.Empty;

        [Required(ErrorMessage = "A descrição do produto é obrigatória")]
        [StringLength(200)]
        public string Descricao { get; set; } = string.Empty;

        [Required(ErrorMessage = "O saldo é obrigatório")]
        [Range(0, int.MaxValue, ErrorMessage = "O saldo não pode ser negativo")]
        public int Saldo { get; set; }

        [Timestamp]
        public byte[]? RowVersion { get; set; } // Para controle de concorrência otimista

        public DateTime DataCriacao { get; set; } = DateTime.UtcNow;
        public DateTime DataAtualizacao { get; set; } = DateTime.UtcNow;
    }
}

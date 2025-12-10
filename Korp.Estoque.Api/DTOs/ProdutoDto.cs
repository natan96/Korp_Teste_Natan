using System.ComponentModel.DataAnnotations;

namespace Korp.Estoque.Api.DTOs
{
    public class ProdutoDto
    {
        public int Id { get; set; }

        [Required(ErrorMessage = "O código do produto é obrigatório")]
        [StringLength(50, ErrorMessage = "O código deve ter no máximo 50 caracteres")]
        public string Codigo { get; set; } = string.Empty;

        [Required(ErrorMessage = "A descrição do produto é obrigatória")]
        [StringLength(200, ErrorMessage = "A descrição deve ter no máximo 200 caracteres")]
        public string Descricao { get; set; } = string.Empty;

        [Required(ErrorMessage = "O saldo é obrigatório")]
        [Range(0, int.MaxValue, ErrorMessage = "O saldo não pode ser negativo")]
        public int Saldo { get; set; }
    }

    public class AtualizarSaldoDto
    {
        [Required]
        public int ProdutoId { get; set; }

        [Required]
        [Range(1, int.MaxValue, ErrorMessage = "A quantidade deve ser maior que zero")]
        public int Quantidade { get; set; }

        public byte[]? RowVersion { get; set; }
    }

    public class BaixarEstoqueDto
    {
        [Required]
        public List<ItemBaixaDto> Itens { get; set; } = new();

        [Required]
        public string IdempotencyKey { get; set; } = string.Empty; // Para garantir idempotência
    }

    public class ItemBaixaDto
    {
        [Required]
        public int ProdutoId { get; set; }

        [Required]
        [Range(1, int.MaxValue, ErrorMessage = "A quantidade deve ser maior que zero")]
        public int Quantidade { get; set; }
    }
}

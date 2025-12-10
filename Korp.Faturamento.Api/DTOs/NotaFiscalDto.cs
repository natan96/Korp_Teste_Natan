using System.ComponentModel.DataAnnotations;
using Korp.Faturamento.Api.Models;

namespace Korp.Faturamento.Api.DTOs
{
    public class NotaFiscalDto
    {
        public int Id { get; set; }
        public int Numero { get; set; }
        public StatusNotaFiscal Status { get; set; }
        public DateTime DataEmissao { get; set; }
        public DateTime? DataFechamento { get; set; }
        public List<ItemNotaFiscalDto> Itens { get; set; } = new();
    }

    public class CriarNotaFiscalDto
    {
        [Required(ErrorMessage = "Deve incluir pelo menos um item")]
        [MinLength(1, ErrorMessage = "Deve incluir pelo menos um item")]
        public List<ItemNotaFiscalDto> Itens { get; set; } = new();
    }

    public class ItemNotaFiscalDto
    {
        public int Id { get; set; }

        [Required(ErrorMessage = "O ID do produto é obrigatório")]
        public int ProdutoId { get; set; }

        public string CodigoProduto { get; set; } = string.Empty;
        public string DescricaoProduto { get; set; } = string.Empty;

        [Required(ErrorMessage = "A quantidade é obrigatória")]
        [Range(1, int.MaxValue, ErrorMessage = "A quantidade deve ser maior que zero")]
        public int Quantidade { get; set; }
    }

    public class ImprimirNotaFiscalDto
    {
        [Required]
        public int NotaFiscalId { get; set; }
    }
}

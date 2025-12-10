using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using Korp.Faturamento.Api.Services;
using Korp.Faturamento.Api.DTOs;
using Korp.Faturamento.Api.Models;

namespace Korp.Faturamento.Api.Controllers
{
    [ApiController]
    [Route("api/[controller]")]
    public class NotasFiscaisController : ControllerBase
    {
        private readonly INotaFiscalService _notaFiscalService;
        private readonly IEstoqueService _estoqueService;
        private readonly ILogger<NotasFiscaisController> _logger;

        public NotasFiscaisController(
            INotaFiscalService notaFiscalService,
            IEstoqueService estoqueService,
            ILogger<NotasFiscaisController> logger)
        {
            _notaFiscalService = notaFiscalService;
            _estoqueService = estoqueService;
            _logger = logger;
        }

        /// <summary>
        /// Obtém todas as notas fiscais
        /// </summary>
        [HttpGet]
        [ProducesResponseType(typeof(List<NotaFiscalDto>), StatusCodes.Status200OK)]
        [ProducesResponseType(StatusCodes.Status500InternalServerError)]
        public async Task<ActionResult<List<NotaFiscalDto>>> GetAll()
        {
            try
            {
                var notasFiscais = await _notaFiscalService.GetAllAsync();
                var dtos = notasFiscais.Select(nf => MapToDto(nf)).ToList();
                return Ok(dtos);
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Erro ao buscar notas fiscais");
                return StatusCode(500, new { message = "Erro interno ao buscar notas fiscais", error = ex.Message });
            }
        }

        /// <summary>
        /// Obtém uma nota fiscal por ID
        /// </summary>
        [HttpGet("{id}")]
        [ProducesResponseType(typeof(NotaFiscalDto), StatusCodes.Status200OK)]
        [ProducesResponseType(StatusCodes.Status404NotFound)]
        [ProducesResponseType(StatusCodes.Status500InternalServerError)]
        public async Task<ActionResult<NotaFiscalDto>> GetById(int id)
        {
            try
            {
                var notaFiscal = await _notaFiscalService.GetByIdAsync(id);
                if (notaFiscal == null)
                {
                    return NotFound(new { message = $"Nota fiscal com ID {id} não encontrada" });
                }
                return Ok(MapToDto(notaFiscal));
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, $"Erro ao buscar nota fiscal {id}");
                return StatusCode(500, new { message = "Erro interno ao buscar nota fiscal", error = ex.Message });
            }
        }

        /// <summary>
        /// Cria uma nova nota fiscal
        /// </summary>
        [HttpPost]
        [ProducesResponseType(typeof(NotaFiscalDto), StatusCodes.Status201Created)]
        [ProducesResponseType(StatusCodes.Status400BadRequest)]
        [ProducesResponseType(StatusCodes.Status500InternalServerError)]
        [ProducesResponseType(StatusCodes.Status503ServiceUnavailable)]
        public async Task<ActionResult<NotaFiscalDto>> Create([FromBody] CriarNotaFiscalDto criarDto)
        {
            if (!ModelState.IsValid)
            {
                return BadRequest(ModelState);
            }

            try
            {
                // Verificar se o serviço de estoque está disponível
                var estoqueDisponivel = await _estoqueService.VerificarDisponibilidadeAsync();
                if (!estoqueDisponivel)
                {
                    return StatusCode(503, new
                    {
                        message = "Serviço de Estoque temporariamente indisponível",
                        detail = "Não foi possível criar a nota fiscal. Tente novamente em alguns instantes."
                    });
                }

                var notaFiscal = await _notaFiscalService.CreateAsync(criarDto);
                var dto = MapToDto(notaFiscal);
                return CreatedAtAction(nameof(GetById), new { id = notaFiscal.Id }, dto);
            }
            catch (KeyNotFoundException ex)
            {
                return NotFound(new { message = ex.Message });
            }
            catch (InvalidOperationException ex)
            {
                return BadRequest(new { message = ex.Message });
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Erro ao criar nota fiscal");
                return StatusCode(500, new { message = "Erro interno ao criar nota fiscal", error = ex.Message });
            }
        }

        /// <summary>
        /// Imprime uma nota fiscal e atualiza o estoque
        /// </summary>
        [HttpPost("{id}/imprimir")]
        [ProducesResponseType(typeof(NotaFiscalDto), StatusCodes.Status200OK)]
        [ProducesResponseType(StatusCodes.Status400BadRequest)]
        [ProducesResponseType(StatusCodes.Status404NotFound)]
        [ProducesResponseType(StatusCodes.Status409Conflict)]
        [ProducesResponseType(StatusCodes.Status500InternalServerError)]
        [ProducesResponseType(StatusCodes.Status503ServiceUnavailable)]
        public async Task<ActionResult<NotaFiscalDto>> Imprimir(int id)
        {
            try
            {
                _logger.LogInformation($"Requisição de impressão recebida para nota fiscal {id}");

                var notaFiscal = await _notaFiscalService.ImprimirAsync(id);
                var dto = MapToDto(notaFiscal);

                return Ok(new
                {
                    message = "Nota fiscal impressa com sucesso e estoque atualizado",
                    notaFiscal = dto
                });
            }
            catch (KeyNotFoundException ex)
            {
                return NotFound(new { message = ex.Message });
            }
            catch (InvalidOperationException ex) when (ex.Message.Contains("indisponível"))
            {
                return StatusCode(503, new
                {
                    message = "Serviço de Estoque temporariamente indisponível",
                    detail = ex.Message
                });
            }
            catch (InvalidOperationException ex)
            {
                return BadRequest(new { message = ex.Message });
            }
            catch (DbUpdateConcurrencyException ex)
            {
                return Conflict(new { message = "Conflito de concorrência detectado", detail = ex.Message });
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, $"Erro ao imprimir nota fiscal {id}");
                return StatusCode(500, new
                {
                    message = "Erro interno ao imprimir nota fiscal",
                    error = ex.Message
                });
            }
        }

        /// <summary>
        /// Verifica o status do serviço de Estoque
        /// </summary>
        [HttpGet("estoque/status")]
        [ProducesResponseType(StatusCodes.Status200OK)]
        public async Task<ActionResult> VerificarEstoqueStatus()
        {
            var disponivel = await _estoqueService.VerificarDisponibilidadeAsync();
            return Ok(new
            {
                estoqueServiceDisponivel = disponivel,
                timestamp = DateTime.UtcNow
            });
        }

        /// <summary>
        /// Endpoint de health check
        /// </summary>
        [HttpGet("health")]
        [ProducesResponseType(StatusCodes.Status200OK)]
        public ActionResult Health()
        {
            return Ok(new
            {
                status = "healthy",
                service = "Faturamento API",
                timestamp = DateTime.UtcNow
            });
        }

        private static NotaFiscalDto MapToDto(NotaFiscal notaFiscal)
        {
            return new NotaFiscalDto
            {
                Id = notaFiscal.Id,
                Numero = notaFiscal.Numero,
                Status = notaFiscal.Status,
                DataEmissao = notaFiscal.DataEmissao,
                DataFechamento = notaFiscal.DataFechamento,
                Itens = notaFiscal.Itens?.Select(i => new ItemNotaFiscalDto
                {
                    Id = i.Id,
                    ProdutoId = i.ProdutoId,
                    CodigoProduto = i.CodigoProduto,
                    DescricaoProduto = i.DescricaoProduto,
                    Quantidade = i.Quantidade
                }).ToList() ?? new List<ItemNotaFiscalDto>()
            };
        }
    }
}

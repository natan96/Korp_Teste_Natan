using Microsoft.AspNetCore.Mvc;
using Korp.Estoque.Api.Services;
using Korp.Estoque.Api.DTOs;
using Korp.Estoque.Api.Models;

namespace Korp.Estoque.Api.Controllers
{
    [ApiController]
    [Route("api/[controller]")]
    public class ProdutosController : ControllerBase
    {
        private readonly IProdutoService _produtoService;
        private readonly ILogger<ProdutosController> _logger;

        public ProdutosController(IProdutoService produtoService, ILogger<ProdutosController> logger)
        {
            _produtoService = produtoService;
            _logger = logger;
        }

        /// <summary>
        /// Obtém todos os produtos
        /// </summary>
        [HttpGet]
        [ProducesResponseType(typeof(List<Produto>), StatusCodes.Status200OK)]
        [ProducesResponseType(StatusCodes.Status500InternalServerError)]
        public async Task<ActionResult<List<Produto>>> GetAll()
        {
            try
            {
                var produtos = await _produtoService.GetAllAsync();
                return Ok(produtos);
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Erro ao buscar produtos");
                return StatusCode(500, new { message = "Erro interno ao buscar produtos", error = ex.Message });
            }
        }

        /// <summary>
        /// Obtém produto por ID
        /// </summary>
        [HttpGet("{id}")]
        [ProducesResponseType(typeof(Produto), StatusCodes.Status200OK)]
        [ProducesResponseType(StatusCodes.Status404NotFound)]
        [ProducesResponseType(StatusCodes.Status500InternalServerError)]
        public async Task<ActionResult<Produto>> GetById(int id)
        {
            try
            {
                var produto = await _produtoService.GetByIdAsync(id);
                if (produto == null)
                {
                    return NotFound(new { message = $"Produto com ID {id} não encontrado" });
                }
                return Ok(produto);
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, $"Erro ao buscar produto {id}");
                return StatusCode(500, new { message = "Erro interno ao buscar produto", error = ex.Message });
            }
        }

        /// <summary>
        /// Obtém produto por código
        /// </summary>
        [HttpGet("codigo/{codigo}")]
        [ProducesResponseType(typeof(Produto), StatusCodes.Status200OK)]
        [ProducesResponseType(StatusCodes.Status404NotFound)]
        [ProducesResponseType(StatusCodes.Status500InternalServerError)]
        public async Task<ActionResult<Produto>> GetByCodigo(string codigo)
        {
            try
            {
                var produto = await _produtoService.GetByCodigoAsync(codigo);
                if (produto == null)
                {
                    return NotFound(new { message = $"Produto com código {codigo} não encontrado" });
                }
                return Ok(produto);
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, $"Erro ao buscar produto por código {codigo}");
                return StatusCode(500, new { message = "Erro interno ao buscar produto", error = ex.Message });
            }
        }

        /// <summary>
        /// Cria um novo produto
        /// </summary>
        [HttpPost]
        [ProducesResponseType(typeof(Produto), StatusCodes.Status201Created)]
        [ProducesResponseType(StatusCodes.Status400BadRequest)]
        [ProducesResponseType(StatusCodes.Status500InternalServerError)]
        public async Task<ActionResult<Produto>> Create([FromBody] ProdutoDto produtoDto)
        {
            if (!ModelState.IsValid)
            {
                return BadRequest(ModelState);
            }

            try
            {
                var produto = await _produtoService.CreateAsync(produtoDto);
                return CreatedAtAction(nameof(GetById), new { id = produto.Id }, produto);
            }
            catch (InvalidOperationException ex)
            {
                return BadRequest(new { message = ex.Message });
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Erro ao criar produto");
                return StatusCode(500, new { message = "Erro interno ao criar produto", error = ex.Message });
            }
        }
        
        /// <summary>
        /// Verifica se um código de produto já existe
        /// </summary>
        [HttpGet("verificar-codigo/{codigo}")]
        [ProducesResponseType(StatusCodes.Status200OK)]
        [ProducesResponseType(StatusCodes.Status500InternalServerError)]
        public async Task<ActionResult<object>> VerificarCodigo(string codigo, [FromQuery] int? idExcluir = null)
        {
            try
            {
                var produto = await _produtoService.GetByCodigoAsync(codigo);
                var existe = produto != null && produto.Id != idExcluir;
                return Ok(new { existe, codigo });
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, $"Erro ao verificar código {codigo}");
                return StatusCode(500, new { message = "Erro interno ao verificar código", error = ex.Message });
            }
        }

        /// <summary>
        /// Atualiza um produto existente
        /// </summary>
        [HttpPut("{id}")]
        [ProducesResponseType(typeof(Produto), StatusCodes.Status200OK)]
        [ProducesResponseType(StatusCodes.Status400BadRequest)]
        [ProducesResponseType(StatusCodes.Status404NotFound)]
        [ProducesResponseType(StatusCodes.Status409Conflict)]
        [ProducesResponseType(StatusCodes.Status500InternalServerError)]
        public async Task<ActionResult<Produto>> Update(int id, [FromBody] ProdutoDto produtoDto)
        {
            if (!ModelState.IsValid)
            {
                return BadRequest(ModelState);
            }

            try
            {
                var produto = await _produtoService.UpdateAsync(id, produtoDto);
                return Ok(produto);
            }
            catch (KeyNotFoundException ex)
            {
                return NotFound(new { message = ex.Message });
            }
            catch (InvalidOperationException ex)
            {
                return Conflict(new { message = ex.Message });
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, $"Erro ao atualizar produto {id}");
                return StatusCode(500, new { message = "Erro interno ao atualizar produto", error = ex.Message });
            }
        }

        /// <summary>
        /// Realiza baixa de estoque de múltiplos produtos (usado pelo serviço de faturamento)
        /// </summary>
        [HttpPost("baixar-estoque")]
        [ProducesResponseType(StatusCodes.Status200OK)]
        [ProducesResponseType(StatusCodes.Status400BadRequest)]
        [ProducesResponseType(StatusCodes.Status500InternalServerError)]
        public async Task<ActionResult> BaixarEstoque([FromBody] BaixarEstoqueDto baixarDto)
        {
            if (!ModelState.IsValid)
            {
                return BadRequest(ModelState);
            }

            try
            {
                var sucesso = await _produtoService.BaixarEstoqueAsync(baixarDto);
                return Ok(new { message = "Baixa de estoque realizada com sucesso", sucesso });
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
                _logger.LogError(ex, "Erro ao realizar baixa de estoque");
                return StatusCode(500, new { message = "Erro interno ao realizar baixa de estoque", error = ex.Message });
            }
        }

        /// <summary>
        /// Endpoint de health check
        /// </summary>
        [HttpGet("health")]
        [ProducesResponseType(StatusCodes.Status200OK)]
        public ActionResult Health()
        {
            return Ok(new { status = "healthy", service = "Estoque API", timestamp = DateTime.UtcNow });
        }
    }
}

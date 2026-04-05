using Microsoft.EntityFrameworkCore;
using Korp.Faturamento.Api.Data;
using Korp.Faturamento.Api.Models;
using Korp.Faturamento.Api.DTOs;

namespace Korp.Faturamento.Api.Services
{
    public interface INotaFiscalService
    {
        Task<List<NotaFiscal>> GetAllAsync();
        Task<(List<NotaFiscal> items, int totalCount, int totalAbertas, int totalFechadas)> GetPagedAsync(int page, int pageSize, int? status = null);
        Task<NotaFiscal?> GetByIdAsync(int id);
        Task<NotaFiscal> CreateAsync(CriarNotaFiscalDto criarDto);
        Task<NotaFiscal> ImprimirAsync(int notaFiscalId);
        Task<int> GetProximoNumeroAsync();
    }

    public class NotaFiscalService : INotaFiscalService
    {
        private readonly FaturamentoDbContext _context;
        private readonly IEstoqueService _estoqueService;
        private readonly ILogger<NotaFiscalService> _logger;
        private static readonly SemaphoreSlim _semaphore = new(1, 1);

        public NotaFiscalService(
            FaturamentoDbContext context,
            IEstoqueService estoqueService,
            ILogger<NotaFiscalService> logger)
        {
            _context = context;
            _estoqueService = estoqueService;
            _logger = logger;
        }

        public async Task<List<NotaFiscal>> GetAllAsync()
        {
            try
            {
                return await _context.NotasFiscais
                    .Include(nf => nf.Itens)
                    .OrderByDescending(nf => nf.Numero)
                    .ToListAsync();
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Erro ao buscar notas fiscais");
                throw new ApplicationException("Erro ao buscar notas fiscais", ex);
            }
        }

        public async Task<(List<NotaFiscal> items, int totalCount, int totalAbertas, int totalFechadas)> GetPagedAsync(
            int page, int pageSize, int? status = null)
        {
            try
            {
                var query = _context.NotasFiscais.Include(nf => nf.Itens).AsQueryable();

                if (status.HasValue)
                {
                    var statusEnum = (StatusNotaFiscal)status.Value;
                    query = query.Where(nf => nf.Status == statusEnum);
                }

                var totalCount = await query.CountAsync();
                var totalAbertas = await _context.NotasFiscais.CountAsync(nf => nf.Status == StatusNotaFiscal.Aberta);
                var totalFechadas = await _context.NotasFiscais.CountAsync(nf => nf.Status == StatusNotaFiscal.Fechada);

                var items = await query
                    .OrderByDescending(nf => nf.Numero)
                    .Skip((page - 1) * pageSize)
                    .Take(pageSize)
                    .ToListAsync();

                _logger.LogInformation($"Página {page} de notas fiscais retornada. Total filtrado: {totalCount}");

                return (items, totalCount, totalAbertas, totalFechadas);
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Erro ao buscar notas fiscais paginadas");
                throw new ApplicationException("Erro ao buscar notas fiscais", ex);
            }
        }

        public async Task<NotaFiscal?> GetByIdAsync(int id)
        {
            try
            {
                return await _context.NotasFiscais
                    .Include(nf => nf.Itens)
                    .FirstOrDefaultAsync(nf => nf.Id == id);
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, $"Erro ao buscar nota fiscal {id}");
                throw new ApplicationException($"Erro ao buscar nota fiscal {id}", ex);
            }
        }

        public async Task<NotaFiscal> CreateAsync(CriarNotaFiscalDto criarDto)
        {
            var strategy = _context.Database.CreateExecutionStrategy();
            return await strategy.ExecuteAsync(async () =>
            {
                using var transaction = await _context.Database.BeginTransactionAsync();
                try
                {
                    // Validar e buscar informações dos produtos no serviço de Estoque
                    var itens = new List<ItemNotaFiscal>();
                    foreach (var itemDto in criarDto.Itens)
                    {
                        var produto = await _estoqueService.GetProdutoByIdAsync(itemDto.ProdutoId);
                        if (produto == null)
                        {
                            throw new KeyNotFoundException($"Produto com ID {itemDto.ProdutoId} não encontrado no estoque");
                        }

                        if (produto.Saldo < itemDto.Quantidade)
                        {
                            throw new InvalidOperationException(
                                $"Saldo insuficiente para o produto {produto.Codigo}. " +
                                $"Saldo disponível: {produto.Saldo}, Quantidade solicitada: {itemDto.Quantidade}");
                        }

                        itens.Add(new ItemNotaFiscal
                        {
                            ProdutoId = itemDto.ProdutoId,
                            CodigoProduto = produto.Codigo,
                            DescricaoProduto = produto.Descricao,
                            Quantidade = itemDto.Quantidade
                        });
                    }

                    // Gerar número sequencial
                    var proximoNumero = await GetProximoNumeroAsync();

                    // Criar nota fiscal
                    var notaFiscal = new NotaFiscal
                    {
                        Numero = proximoNumero,
                        Status = StatusNotaFiscal.Aberta,
                        DataEmissao = DateTime.UtcNow,
                        Itens = itens
                    };

                    _context.NotasFiscais.Add(notaFiscal);
                    await _context.SaveChangesAsync();
                    await transaction.CommitAsync();

                    _logger.LogInformation($"Nota fiscal criada com sucesso. Número: {notaFiscal.Numero}");
                    return notaFiscal;
                }
                catch (Exception ex)
                {
                    await transaction.RollbackAsync();
                    _logger.LogError(ex, "Erro ao criar nota fiscal");
                    throw;
                }
            });
        }

        public async Task<NotaFiscal> ImprimirAsync(int notaFiscalId)
        {
            using var transaction = await _context.Database.BeginTransactionAsync();
            try
            {
                var notaFiscal = await _context.NotasFiscais
                    .Include(nf => nf.Itens)
                    .FirstOrDefaultAsync(nf => nf.Id == notaFiscalId);
                if (notaFiscal == null)
                {
                    throw new KeyNotFoundException($"Nota fiscal com ID {notaFiscalId} não encontrada");
                }

                if (notaFiscal.Status != StatusNotaFiscal.Aberta)
                {
                    throw new InvalidOperationException(
                        $"Não é possível imprimir a nota fiscal {notaFiscal.Numero}. " +
                        $"Status atual: {notaFiscal.Status}. Apenas notas abertas podem ser impressas.");
                }

                if (notaFiscal.Itens == null || !notaFiscal.Itens.Any())
                {
                    throw new InvalidOperationException("A nota fiscal não possui itens para imprimir");
                }

                _logger.LogInformation($"Iniciando impressão da nota fiscal {notaFiscal.Numero}...");

                await Task.Delay(2000);

                // Baixar estoque através do serviço de Estoque
                var baixarRequest = new BaixarEstoqueRequest
                {
                    IdempotencyKey = $"NF-{notaFiscal.Numero}-{DateTime.UtcNow:yyyyMMddHHmmss}",
                    Itens = notaFiscal.Itens.Select(i => new ItemBaixaEstoque
                    {
                        ProdutoId = i.ProdutoId,
                        Quantidade = i.Quantidade
                    }).ToList()
                };

                await _estoqueService.BaixarEstoqueAsync(baixarRequest);

                // Atualizar status da nota fiscal para Fechada
                notaFiscal.Status = StatusNotaFiscal.Fechada;
                notaFiscal.DataFechamento = DateTime.UtcNow;

                await _context.SaveChangesAsync();
                await transaction.CommitAsync();

                _logger.LogInformation(
                    $"Nota fiscal {notaFiscal.Numero} impressa com sucesso e estoque atualizado. " +
                    $"Status: {notaFiscal.Status}");

                return notaFiscal;
            }
            catch (DbUpdateConcurrencyException ex)
            {
                await transaction.RollbackAsync();
                _logger.LogWarning(ex, $"Conflito de concorrência ao imprimir nota fiscal {notaFiscalId}");
                throw new InvalidOperationException(
                    "A nota fiscal foi modificada por outro usuário. Por favor, recarregue e tente novamente.", ex);
            }
            catch (InvalidOperationException ex) when (ex.Message.Contains("indisponível"))
            {
                await transaction.RollbackAsync();
                _logger.LogError(ex, "Serviço de Estoque indisponível");
                throw new InvalidOperationException(
                    "O serviço de estoque está temporariamente indisponível. " +
                    "A impressão não foi concluída. Por favor, tente novamente em alguns instantes.", ex);
            }
            catch (Exception ex)
            {
                await transaction.RollbackAsync();
                _logger.LogError(ex, $"Erro ao imprimir nota fiscal {notaFiscalId}");
                throw;
            }
        }

        public async Task<int> GetProximoNumeroAsync()
        {
            await _semaphore.WaitAsync();
            try
            {
                var ultimaNota = await _context.NotasFiscais
                    .OrderByDescending(nf => nf.Numero)
                    .FirstOrDefaultAsync();

                return (ultimaNota?.Numero ?? 0) + 1;
            }
            finally
            {
                _semaphore.Release();
            }
        }
    }
}

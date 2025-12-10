using Microsoft.EntityFrameworkCore;
using Korp.Estoque.Api.Data;
using Korp.Estoque.Api.Models;
using Korp.Estoque.Api.DTOs;

namespace Korp.Estoque.Api.Services
{
    public interface IProdutoService
    {
        Task<List<Produto>> GetAllAsync();
        Task<Produto?> GetByIdAsync(int id);
        Task<Produto?> GetByCodigoAsync(string codigo);
        Task<Produto> CreateAsync(ProdutoDto produtoDto);
        Task<Produto> UpdateAsync(int id, ProdutoDto produtoDto);
        Task DeleteAsync(int id);
        Task<bool> BaixarEstoqueAsync(BaixarEstoqueDto baixarDto);
        Task<bool> VerificarIdempotenciaAsync(string idempotencyKey);
        Task RegistrarIdempotenciaAsync(string idempotencyKey);
    }

    public class ProdutoService : IProdutoService
    {
        private readonly EstoqueDbContext _context;
        private readonly ILogger<ProdutoService> _logger;
        private static readonly HashSet<string> _processedKeys = new(); // Cache simples para idempotência
        private static readonly SemaphoreSlim _semaphore = new(1, 1);

        public ProdutoService(EstoqueDbContext context, ILogger<ProdutoService> logger)
        {
            _context = context;
            _logger = logger;
        }

        public async Task<List<Produto>> GetAllAsync()
        {
            try
            {
                return await _context.Produtos
                    .OrderBy(p => p.Codigo)
                    .ToListAsync();
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Erro ao buscar todos os produtos");
                throw new ApplicationException("Erro ao buscar produtos", ex);
            }
        }

        public async Task<Produto?> GetByIdAsync(int id)
        {
            try
            {
                return await _context.Produtos.FindAsync(id);
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, $"Erro ao buscar produto com ID {id}");
                throw new ApplicationException($"Erro ao buscar produto com ID {id}", ex);
            }
        }

        public async Task<Produto?> GetByCodigoAsync(string codigo)
        {
            try
            {
                return await _context.Produtos
                    .FirstOrDefaultAsync(p => p.Codigo == codigo);
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, $"Erro ao buscar produto com código {codigo}");
                throw new ApplicationException($"Erro ao buscar produto com código {codigo}", ex);
            }
        }

        public async Task<Produto> CreateAsync(ProdutoDto produtoDto)
        {
            try
            {
                // Verifica se já existe produto com o mesmo código
                var produtoExistente = await GetByCodigoAsync(produtoDto.Codigo);
                if (produtoExistente != null)
                {
                    throw new InvalidOperationException($"Já existe um produto com o código {produtoDto.Codigo}");
                }

                var produto = new Produto
                {
                    Codigo = produtoDto.Codigo,
                    Descricao = produtoDto.Descricao,
                    Saldo = produtoDto.Saldo,
                    DataCriacao = DateTime.UtcNow,
                    DataAtualizacao = DateTime.UtcNow
                };

                _context.Produtos.Add(produto);
                await _context.SaveChangesAsync();

                _logger.LogInformation($"Produto criado com sucesso: {produto.Codigo}");
                return produto;
            }
            catch (DbUpdateException ex)
            {
                _logger.LogError(ex, $"Erro ao criar produto {produtoDto.Codigo}");
                throw new ApplicationException("Erro ao salvar produto no banco de dados", ex);
            }
        }

        public async Task<Produto> UpdateAsync(int id, ProdutoDto produtoDto)
        {
            try
            {
                var produto = await GetByIdAsync(id);
                if (produto == null)
                {
                    throw new KeyNotFoundException($"Produto com ID {id} não encontrado");
                }

                // Verifica se o código já existe em outro produto
                if (produto.Codigo != produtoDto.Codigo)
                {
                    var produtoComMesmoCodigo = await GetByCodigoAsync(produtoDto.Codigo);
                    if (produtoComMesmoCodigo != null && produtoComMesmoCodigo.Id != id)
                    {
                        throw new InvalidOperationException($"Já existe outro produto com o código {produtoDto.Codigo}");
                    }
                }

                produto.Codigo = produtoDto.Codigo;
                produto.Descricao = produtoDto.Descricao;
                produto.Saldo = produtoDto.Saldo;
                produto.DataAtualizacao = DateTime.UtcNow;

                await _context.SaveChangesAsync();

                _logger.LogInformation($"Produto atualizado com sucesso: {produto.Codigo}");
                return produto;
            }
            catch (DbUpdateConcurrencyException ex)
            {
                _logger.LogWarning(ex, $"Conflito de concorrência ao atualizar produto {id}");
                throw new InvalidOperationException("O produto foi modificado por outro usuário. Por favor, recarregue e tente novamente.", ex);
            }
        }

        public async Task DeleteAsync(int id)
        {
            try
            {
                var produto = await GetByIdAsync(id);
                if (produto == null)
                {
                    throw new KeyNotFoundException($"Produto com ID {id} não encontrado");
                }

                _context.Produtos.Remove(produto);
                await _context.SaveChangesAsync();

                _logger.LogInformation($"Produto deletado com sucesso: {produto.Codigo}");
            }
            catch (DbUpdateException ex)
            {
                _logger.LogError(ex, $"Erro ao deletar produto {id}");
                throw new ApplicationException("Erro ao deletar produto do banco de dados", ex);
            }
        }

        public async Task<bool> BaixarEstoqueAsync(BaixarEstoqueDto baixarDto)
        {
            // Implementa idempotência
            if (await VerificarIdempotenciaAsync(baixarDto.IdempotencyKey))
            {
                _logger.LogInformation($"Operação idempotente detectada: {baixarDto.IdempotencyKey}");
                return true; // Já foi processada
            }

            using var transaction = await _context.Database.BeginTransactionAsync();
            try
            {
                foreach (var item in baixarDto.Itens)
                {
                    var produto = await _context.Produtos
                        .FirstOrDefaultAsync(p => p.Id == item.ProdutoId);

                    if (produto == null)
                    {
                        throw new KeyNotFoundException($"Produto com ID {item.ProdutoId} não encontrado");
                    }

                    if (produto.Saldo < item.Quantidade)
                    {
                        throw new InvalidOperationException(
                            $"Saldo insuficiente para o produto {produto.Codigo}. " +
                            $"Saldo atual: {produto.Saldo}, Quantidade solicitada: {item.Quantidade}");
                    }

                    produto.Saldo -= item.Quantidade;
                    produto.DataAtualizacao = DateTime.UtcNow;

                    _logger.LogInformation(
                        $"Baixa de estoque: Produto {produto.Codigo}, " +
                        $"Quantidade: {item.Quantidade}, Novo saldo: {produto.Saldo}");
                }

                await _context.SaveChangesAsync();
                await transaction.CommitAsync();

                // Registra a chave de idempotência
                await RegistrarIdempotenciaAsync(baixarDto.IdempotencyKey);

                _logger.LogInformation($"Baixa de estoque realizada com sucesso. Key: {baixarDto.IdempotencyKey}");
                return true;
            }
            catch (Exception ex)
            {
                await transaction.RollbackAsync();
                _logger.LogError(ex, "Erro ao realizar baixa de estoque");
                throw;
            }
        }

        public async Task<bool> VerificarIdempotenciaAsync(string idempotencyKey)
        {
            await _semaphore.WaitAsync();
            try
            {
                return _processedKeys.Contains(idempotencyKey);
            }
            finally
            {
                _semaphore.Release();
            }
        }

        public async Task RegistrarIdempotenciaAsync(string idempotencyKey)
        {
            await _semaphore.WaitAsync();
            try
            {
                _processedKeys.Add(idempotencyKey);
            }
            finally
            {
                _semaphore.Release();
            }
        }
    }
}

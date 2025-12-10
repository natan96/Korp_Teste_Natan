using Polly;
using Polly.CircuitBreaker;
using Polly.Retry;
using System.Text;
using System.Text.Json;

namespace Korp.Faturamento.Api.Services
{
    public class ProdutoEstoqueDto
    {
        public int Id { get; set; }
        public string Codigo { get; set; } = string.Empty;
        public string Descricao { get; set; } = string.Empty;
        public int Saldo { get; set; }
    }

    public class BaixarEstoqueRequest
    {
        public List<ItemBaixaEstoque> Itens { get; set; } = new();
        public string IdempotencyKey { get; set; } = string.Empty;
    }

    public class ItemBaixaEstoque
    {
        public int ProdutoId { get; set; }
        public int Quantidade { get; set; }
    }

    public interface IEstoqueService
    {
        Task<ProdutoEstoqueDto?> GetProdutoByIdAsync(int id);
        Task<bool> BaixarEstoqueAsync(BaixarEstoqueRequest request);
        Task<bool> VerificarDisponibilidadeAsync();
    }

    public class EstoqueService : IEstoqueService
    {
        private readonly HttpClient _httpClient;
        private readonly ILogger<EstoqueService> _logger;
        private readonly AsyncRetryPolicy<HttpResponseMessage> _retryPolicy;
        private readonly AsyncCircuitBreakerPolicy<HttpResponseMessage> _circuitBreakerPolicy;

        public EstoqueService(HttpClient httpClient, ILogger<EstoqueService> logger)
        {
            _httpClient = httpClient;
            _logger = logger;

            // Política de retry: 3 tentativas com espera exponencial
            _retryPolicy = Policy
                .HandleResult<HttpResponseMessage>(r => !r.IsSuccessStatusCode)
                .Or<HttpRequestException>()
                .WaitAndRetryAsync(
                    retryCount: 3,
                    sleepDurationProvider: retryAttempt => TimeSpan.FromSeconds(Math.Pow(2, retryAttempt)),
                    onRetry: (outcome, timespan, retryCount, context) =>
                    {
                        _logger.LogWarning(
                            $"Tentativa {retryCount} falhou ao chamar serviço de Estoque. " +
                            $"Aguardando {timespan.TotalSeconds}s antes da próxima tentativa. " +
                            $"Status: {outcome.Result?.StatusCode}");
                    });

            // Circuit Breaker: abre após 5 falhas consecutivas e permanece aberto por 30 segundos
            _circuitBreakerPolicy = Policy
                .HandleResult<HttpResponseMessage>(r => !r.IsSuccessStatusCode)
                .Or<HttpRequestException>()
                .CircuitBreakerAsync(
                    handledEventsAllowedBeforeBreaking: 5,
                    durationOfBreak: TimeSpan.FromSeconds(30),
                    onBreak: (outcome, breakDelay) =>
                    {
                        _logger.LogError(
                            $"Circuit Breaker ABERTO! Serviço de Estoque indisponível. " +
                            $"Bloqueando requisições por {breakDelay.TotalSeconds}s");
                    },
                    onReset: () =>
                    {
                        _logger.LogInformation("Circuit Breaker FECHADO! Serviço de Estoque disponível novamente.");
                    },
                    onHalfOpen: () =>
                    {
                        _logger.LogInformation("Circuit Breaker MEIO-ABERTO! Testando serviço de Estoque...");
                    });
        }

        public async Task<ProdutoEstoqueDto?> GetProdutoByIdAsync(int id)
        {
            try
            {
                var response = await ExecuteWithPolicyAsync(async () =>
                    await _httpClient.GetAsync($"/api/produtos/{id}"));

                if (!response.IsSuccessStatusCode)
                {
                    if (response.StatusCode == System.Net.HttpStatusCode.NotFound)
                    {
                        return null;
                    }
                    throw new HttpRequestException($"Erro ao buscar produto: {response.StatusCode}");
                }

                var content = await response.Content.ReadAsStringAsync();
                return JsonSerializer.Deserialize<ProdutoEstoqueDto>(content, new JsonSerializerOptions
                {
                    PropertyNameCaseInsensitive = true
                });
            }
            catch (BrokenCircuitException ex)
            {
                _logger.LogError(ex, "Circuit Breaker aberto. Serviço de Estoque indisponível.");
                throw new InvalidOperationException("Serviço de Estoque temporariamente indisponível. Tente novamente em alguns instantes.", ex);
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, $"Erro ao buscar produto {id} no serviço de Estoque");
                throw;
            }
        }

        public async Task<bool> BaixarEstoqueAsync(BaixarEstoqueRequest request)
        {
            try
            {
                var json = JsonSerializer.Serialize(request);
                var content = new StringContent(json, Encoding.UTF8, "application/json");

                var response = await ExecuteWithPolicyAsync(async () =>
                    await _httpClient.PostAsync("/api/produtos/baixar-estoque", content));

                if (!response.IsSuccessStatusCode)
                {
                    var errorContent = await response.Content.ReadAsStringAsync();
                    _logger.LogError($"Erro ao baixar estoque: {response.StatusCode} - {errorContent}");
                    throw new HttpRequestException($"Erro ao baixar estoque: {errorContent}");
                }

                _logger.LogInformation($"Baixa de estoque realizada com sucesso. Key: {request.IdempotencyKey}");
                return true;
            }
            catch (BrokenCircuitException ex)
            {
                _logger.LogError(ex, "Circuit Breaker aberto ao tentar baixar estoque");
                throw new InvalidOperationException("Serviço de Estoque temporariamente indisponível. Tente novamente em alguns instantes.", ex);
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Erro ao baixar estoque no serviço de Estoque");
                throw;
            }
        }

        public async Task<bool> VerificarDisponibilidadeAsync()
        {
            try
            {
                var response = await _httpClient.GetAsync("/api/produtos/health");
                return response.IsSuccessStatusCode;
            }
            catch
            {
                return false;
            }
        }

        private async Task<HttpResponseMessage> ExecuteWithPolicyAsync(Func<Task<HttpResponseMessage>> action)
        {
            // Combina retry + circuit breaker
            var policyWrap = Policy.WrapAsync(_retryPolicy, _circuitBreakerPolicy);
            return await policyWrap.ExecuteAsync(action);
        }
    }
}

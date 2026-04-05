# Sistema de Emissão de Notas Fiscais - Korp

## Sumário

1. [Visão Geral](#visão-geral)
2. [Arquitetura](#arquitetura)
3. [Tecnologias Utilizadas](#tecnologias-utilizadas)
4. [Detalhamento Técnico Angular](#detalhamento-técnico-angular)
5. [Detalhamento Técnico Backend C#](#detalhamento-técnico-backend-c)
6. [Funcionalidades Implementadas](#funcionalidades-implementadas)
7. [Como Executar](#como-executar)
8. [Endpoints da API](#endpoints-da-api)
9. [Checklist de Funcionalidades](#checklist-de-funcionalidades)
10. [Exemplos de LINQ Utilizados no Projeto](#exemplos-de-linq-utilizados-no-projeto)

---

## Novas Funcionalidades Implementadas

### Angular Signals (Angular 21)

- **Estado Reativo Moderno**: Gerenciamento de estado com `signal()` e `computed()`
- **Filtros Dinâmicos**: Filtragem reativa de notas fiscais por status
- **Contadores Automáticos**: Contagem de notas abertas/fechadas sem subscrições manuais
- **Performance**: Atualizações otimizadas sem memory leaks

### Validação Assíncrona de Código

- **Endpoint de Verificação**: `GET /api/produtos/verificar-codigo/{codigo}`
- **Validação no Submit**: Verifica duplicidade de código antes de salvar
- **RxJS lastValueFrom**: Converte Observable em Promise para validação síncrona
- **Feedback Imediato**: Mensagem de erro antes de processar formulário

### Health Checks de Serviços

- **Monitoramento de Estoque**: `GET /api/produtos/health`
- **Monitoramento de Faturamento**: `GET /api/notasfiscais/health`
- **Status de Disponibilidade**: `GET /api/notasfiscais/estoque-status`
- **Feedback Visual**: Indicador de serviço disponível/indisponível na UI

### UX

- **Loading States**: Spinners contextuais durante operações
- **Computed Properties**: Cálculos reativos de totais e contadores
- **Filtros Interativos**: Filtro por status com atualização instantânea
- **Diálogos de Confirmação**: Proteção contra exclusões acidentais

---

## Visão Geral

Sistema completo de emissão de notas fiscais desenvolvido com **Angular 21** (standalone components) no frontend e **ASP.NET Core 8** no backend, implementando arquitetura de microsserviços com dois serviços independentes.

**Projeto desenvolvido como resposta ao desafio técnico da Korp**, atendendo todos os requisitos obrigatórios e alguns opcionais, com foco em:

- Arquitetura de microsserviços resiliente
- Tratamento robusto de falhas e concorrência
- Validações e persistência real em banco de dados
- Interface moderna e responsiva

### Microsserviços Implementados

- **Microsserviço de Estoque**: Gerenciamento de produtos e controle de estoque
- **Microsserviço de Faturamento**: Criação e impressão de notas fiscais

---

## Arquitetura

### Arquitetura de Microsserviços

```
┌─────────────────────────────────────────────────────────────┐
│                    Frontend Angular                          │
│                   (localhost:4200)                           │
└───────────────┬─────────────────────┬───────────────────────┘
                │                     │
                │                     │
      ┌─────────▼─────────┐ ┌────────▼──────────┐
      │  Microsserviço    │ │  Microsserviço    │
      │   de Estoque      │ │  de Faturamento   │
      │  (localhost:5001) │ │  (localhost:5002) │
      └─────────┬─────────┘ └────────┬──────────┘
                │                    │
                │                    │
                │         ┌──────────▼──────────┐
                │         │  Comunicação HTTP   │
                │         │  (Polly Resilience) │
                │         └─────────────────────┘
                │
      ┌─────────▼─────────┐
      │  SQL Server       │
      │  Database         │
      └───────────────────┘
```

### Comunicação entre Serviços

- O **Frontend Angular** comunica-se com ambos os microsserviços via HTTP REST APIs
- O **Microsserviço de Faturamento** consome o **Microsserviço de Estoque** para:
  - Validar disponibilidade de produtos
  - Consultar saldos
  - Realizar baixa de estoque ao imprimir notas fiscais
- Implementado **Circuit Breaker** e **Retry Policies** com **Polly** para resiliência

---

## Tecnologias Utilizadas

### Frontend

- **Angular 21** (standalone components, sem NgModules)
- **PrimeNG 17+** (biblioteca de componentes UI)
- **Tailwind CSS 3+** (framework CSS utility-first)
- **Angular Signals** (gerenciamento de estado reativo)
- **RxJS 7.8** (programação reativa)
- **TypeScript 5.7**
- **HTTP Client** (comunicação com APIs)

### Backend

- **ASP.NET Core 8**
- **Entity Framework Core 8.0** (ORM)
- **SQL Server** (banco de dados com migrations)
- **Polly 8.6** (resiliência e tratamento de falhas)
- **Swagger/OpenAPI** (documentação de APIs)

---

## Detalhamento Técnico Angular

### 1. Ciclos de Vida Utilizados

#### **OnInit**

Utilizado para inicialização de componentes e carregamento de dados:

```typescript
// nota-fiscal-list.component.ts
ngOnInit(): void {
  this.loadNotasFiscais();
}
```

**Finalidade**: Carregar dados iniciais quando o componente é montado.

#### **OnDestroy**

Implementado em todos os componentes para limpeza de recursos e prevenção de memory leaks:

```typescript
// produtos.component.ts
private destroy$ = new Subject<void>();

ngOnDestroy(): void {
  this.destroy$.next();
  this.destroy$.complete();
  if (this.searchTimeout) {
    clearTimeout(this.searchTimeout);
  }
}
```

**Finalidade**:

- Cancelar subscrições de observables usando `takeUntil(this.destroy$)`
- Limpar timeouts pendentes de debounce
- Prevenir memory leaks

---

### 2. Uso da Biblioteca RxJS

#### **Operators Utilizados**

##### **takeUntil**

```typescript
// produtos.component.ts
loadPage(page: number, pageSize: number, search?: string): void {
  this.loading = true;
  this.produtoService
    .getPaged(page, pageSize, search)
    .pipe(takeUntil(this.destroy$))
    .subscribe({
      next: (result) => {
        this.produtos = result.items;
        this.totalRecords = result.totalCount;
        this.loading = false;
      },
      error: (error) => {
        console.error(error);
        this.showError('Erro ao carregar produtos');
        this.loading = false;
      },
    });
}
```

**Finalidade**: Cancela automaticamente a subscrição quando o componente é destruído.

##### **tap**

```typescript
create(produto: Produto): Observable<Produto> {
  return this.http.post<Produto>(this.apiUrl, produto).pipe(
    tap(() => this.refreshList()),
    catchError(this.handleError)
  );
}
```

**Finalidade**: Executa efeitos colaterais (side effects) sem modificar o stream.

##### **retry**

```typescript
getAll(): Observable<Produto[]> {
  return this.http.get<Produto[]>(this.apiUrl).pipe(
    retry(2), // Tenta até 2 vezes em caso de erro
    tap(produtos => this.produtosSubject.next(produtos)),
    catchError(this.handleError)
  );
}
```

**Finalidade**: Retenta automaticamente requisições que falharam.

##### **retryWhen com backoff exponencial**

```typescript
imprimir(id: number): Observable<any> {
    return this.http.post<any>(`${this.apiUrl}/${id}/imprimir`, {}).pipe(
      // Retry com backoff para lidar com falhas momentâneas
      retry({
        count: 3,
        delay: (error, retryCount) => {
          // Retry apenas para erros 503 (caso o serviço esteja indisponível)
          if (error.status === 503) {
            const delayMs = Math.pow(2, retryCount) * 1000; // 1s, 2s, 4s
            console.log(`Tentativa ${retryCount} falhou. Tentando novamente em ${delayMs}ms...`);
            return timer(delayMs);
          }
          // Para outros erros, não faz retry
          return throwError(() => error);
        }
      }),
      tap(() => this.refreshList()),
      catchError(this.handleError)
    );
  }
```

**Finalidade**: Implementa retry inteligente com delays crescentes para lidar com falhas temporárias de serviço.

##### **catchError**

```typescript
private handleError(error: HttpErrorResponse): Observable<never> {
  let errorMessage = 'Ocorreu um erro desconhecido';

  if (error.status === 503) {
    errorMessage = 'Serviço temporariamente indisponível. Tente novamente.';
  }

  return throwError(() => new Error(errorMessage));
}
```

**Finalidade**: Tratamento centralizado de erros HTTP.

##### **finalize**

```typescript
imprimirNota(notaFiscal: NotaFiscal): void {
  this.imprimindoMap.set(notaFiscal.id, true);

  this.notaFiscalService.imprimir(notaFiscal.id)
    .pipe(
      takeUntil(this.destroy$),
      finalize(() => this.imprimindoMap.delete(notaFiscal.id))
    )
    .subscribe({...});
}
```

**Finalidade**: Executa código de limpeza independentemente de sucesso ou erro.

#### **BehaviorSubject**

```typescript
private produtosSubject = new BehaviorSubject<Produto[]>([]);
public produtos$ = this.produtosSubject.asObservable();
```

**Finalidade**: Compartilha estado entre componentes e mantém o último valor emitido.

---

### 4. Angular Signals

#### **O que são Signals?**

Signals são uma primitiva de reatividade moderna do Angular que oferece uma alternativa mais simples e performática aos observables para gerenciamento de estado.

#### **Signals Utilizados**

##### **signal() - Estado Reativo**

```typescript
notasFiscais = signal<NotaFiscal[]>([]);
filtroStatus = signal<number>(-1);
private imprimindoMapSignal = signal<Map<number, boolean>>(new Map());
```

**Finalidade**: Cria valores reativos que notificam automaticamente quando mudam.

##### **computed() - Valores Derivados**

```typescript
// Filtra notas por status
notasFiscaisFiltradas = computed(() => {
  let notas = this.notasFiscais();
  const status = this.filtroStatus();
  if (status !== -1) {
    notas = notas.filter((n) => n.status === status);
  }
  return notas;
});

// Conta notas abertas
countNotasAbertas = computed(
  () => this.notasFiscais().filter((n) => n.status === 0).length,
);

// Soma total de itens por nota
sumNotasItems = computed(() => {
  const keyNotasItems = new Map<number, number>();
  this.notasFiscais().forEach((nota) => {
    const totalItens =
      nota.itens?.reduce((sum, item) => sum + item.quantidade, 0) || 0;
    keyNotasItems.set(nota.id, totalItens);
  });
  return keyNotasItems;
});

// Controla estado de impressão
podeImprimirMap = computed(() => {
  const map = new Map<number, boolean>();
  const imprimindo = this.imprimindoMapSignal();
  this.notasFiscaisFiltradas().forEach((nota) => {
    map.set(nota.id, nota.status === 0 && !imprimindo.get(nota.id));
  });
  return map;
});
```

**Finalidade**: Calcula valores automaticamente quando suas dependências mudam, com memoização automática.

##### **Vantagens dos Signals**

- **Performance**: Atualiza apenas o que realmente mudou
- **Simplicidade**: Mais fácil de entender que observables complexos
- **Type-safe**: Totalmente tipado com TypeScript
- **Sem Subscrições**: Não precisa de unsubscribe, evitando memory leaks
- **Computed Memoization**: Recalcula apenas quando dependências mudam

##### **Signals vs RxJS**

```typescript
// RxJS - Usado para operações assíncronas (HTTP, eventos)
this.notaFiscalService
  .getAll()
  .pipe(takeUntil(this.destroy$))
  .subscribe((notas) => this.notasFiscais.set(notas));

// Signals - Usado para estado local e valores derivados
notasFiscaisFiltradas = computed(() => {
  return this.notasFiscais().filter((n) => n.status === this.filtroStatus());
});
```

**Uso Combinado**: Signals para estado/valores derivados, RxJS para operações assíncronas.

---

### 3. Bibliotecas Adicionais e Suas Finalidades

#### **PrimeNG**

```typescript
import { ButtonModule } from "primeng/button";
import { CardModule } from "primeng/card";
import { InputTextModule } from "primeng/inputtext";
import { TableModule } from "primeng/table";
import { TagModule } from "primeng/tag";
import { ToastModule } from "primeng/toast";
import { ProgressSpinnerModule } from "primeng/progressspinner";
import { TooltipModule } from "primeng/tooltip";
```

**Componentes Utilizados**:

- `p-table`: Tabelas avançadas com paginação, filtros e ordenação
- `p-button`: Botões estilizados com ícones e loading states
- `p-toast`: Notificações toast não-obstrutivas
- `p-tag`: Tags de status coloridas (Aberta/Fechada)
- `p-progressSpinner`: Indicadores de carregamento
- `p-tooltip`: Dicas contextuais
- `pInputText`: Inputs de texto estilizados
- `p-card`: Cards de conteúdo

**Finalidade**: Biblioteca completa de componentes UI ricos e profissionais.

#### **Tailwind CSS**

```typescript
// Configuração no tailwind.config.js
module.exports = {
  content: ["./src/**/*.{html,ts}"],
  theme: {
    extend: {
      colors: {
        primary: "#FC064C",
        secondary: "#2b485a",
        accent: "#8CB2CA",
      },
    },
  },
};
```

**Classes Utilizadas**:

- Layout: `flex`, `grid`, `max-w-7xl`, `mx-auto`
- Espaçamento: `p-6`, `mb-8`, `gap-6`, `space-y-2`
- Responsividade: `md:grid-cols-3`, `sm:px-6`, `lg:px-8`
- Cores: `bg-white`, `text-gray-700`, `border-gray-200`
- Efeitos: `shadow-lg`, `rounded-xl`, `hover:bg-gray-50`

**Finalidade**: Framework utility-first para estilização rápida e responsiva com classes CSS pré-definidas.

#### **Reactive Forms**

```typescript
import { ReactiveFormsModule } from "@angular/forms";

this.produtoForm = this.formBuilder.group({
  codigo: ["", [Validators.required, Validators.maxLength(50)]],
  descricao: ["", [Validators.required, Validators.maxLength(200)]],
  saldo: [0, [Validators.required, Validators.min(0)]],
});
```

**Finalidade**: Formulários reativos com validação integrada e tipagem forte.

#### **Validação Assíncrona de Código**

```typescript
// Service - Endpoint de verificação
verificarCodigo(codigo: string, idExcluir?: number): Observable<VerificarCodigoResponse> {
  const params = idExcluir ? `?idExcluir=${idExcluir}` : '';
  return this.http.get<VerificarCodigoResponse>(
    `${this.apiUrl}/verificar-codigo/${codigo}${params}`
  ).pipe(catchError(this.handleError));
}

// Component - Validação antes do submit
async onSubmit(): Promise<void> {
  if (this.produtoForm.invalid) {
    return;
  }

  this.loading = true;

  // Verifica se o código já existe usando lastValueFrom
  const verificarCodigo = await lastValueFrom(
    this.produtoService.verificarCodigo(
      this.produtoForm.value.codigo,
      this.editMode ? this.editingId! : undefined,
    ),
  );

  if (verificarCodigo.existe) {
    this.showError(
      `O código "${verificarCodigo.codigo}" já está em uso por outro produto.`,
    );
    this.loading = false;
    return;
  }

  // Continua com criação/atualização...
}
```

**Finalidade**: Valida código de produto de forma assíncrona usando `lastValueFrom` do RxJS antes de submeter o formulário, evitando duplicatas.

#### **RouterModule**

```typescript
RouterModule.forRoot([
  { path: "", redirectTo: "/produtos", pathMatch: "full" },
  { path: "produtos", component: ProdutosComponent },
  { path: "notas", component: NotaFiscalListComponent },
  { path: "notas/nova", component: NotaFiscalFormComponent },
]);
```

**Finalidade**: Navegação SPA (Single Page Application) entre componentes.

#### **TypeScript Path Mapping**

```typescript
// tsconfig.json
{
  "compilerOptions": {
    "baseUrl": "./src",
    "paths": {
      "@app/*": ["app/*"],
      "@models/*": ["app/models/*"],
      "@services/*": ["app/services/*"],
      "@components/*": ["app/components/*"],
      "@utils/*": ["app/utils/*"],
      "@interceptors/*": ["app/interceptors/*"]
    }
  }
}
```

**Uso nos imports:**

```typescript
// Antes (caminhos relativos)
import { Produto } from "../../models/produto";
import { ProdutoService } from "../../services/produto.service";

// Depois (path mapping)
import { Produto } from "@models/produto";
import { ProdutoService } from "@services/produto.service";
```

**Finalidade**:

- Imports mais limpos e legíveis
- Facilita refatoração e movimentação de arquivos
- Elimina confusão com `../../../`
- Melhora a manutenibilidade do código

#### **Organização de Modelos**

Os modelos foram organizados em arquivos separados por domínio:

```typescript
// produto.ts - Modelos relacionados a produtos
export interface Produto {
  id: number;
  codigo: string;
  descricao: string;
  saldo: number;
}

export interface PagedResult<T> {
  items: T[];
  totalCount: number;
  page: number;
  pageSize: number;
  totalPages: number;
}

// nota-fiscal.ts - Modelos relacionados a notas fiscais
export interface NotaFiscal {
  id: number;
  numero: number;
  status: number;
  dataEmissao: Date;
  dataFechamento?: Date;
  itens: ItemNotaFiscal[];
}

export interface ItemNotaFiscal {
  id?: number;
  produtoId: number;
  codigoProduto: string;
  descricaoProduto: string;
  quantidade: number;
}

// index.ts - Re-exporta todos os modelos
export * from "./produto";
export * from "./nota-fiscal";
```

**Finalidade**:

- Separação clara de responsabilidades
- Facilita manutenção e localização de tipos
- Permite importações específicas por domínio
- Melhora a organização do código

---

## Detalhamento Técnico Backend C#

### 1. Entity Framework Core e LINQ

#### **DbContext Configuration**

```csharp
public class EstoqueDbContext : DbContext
{
    public DbSet<Produto> Produtos { get; set; }

    protected override void OnModelCreating(ModelBuilder modelBuilder)
    {
        modelBuilder.Entity<Produto>(entity =>
        {
            entity.HasIndex(e => e.Codigo).IsUnique();
            entity.Property(e => e.RowVersion).IsRowVersion();
        });

        // Seed inicial
        modelBuilder.Entity<Produto>().HasData(
            new Produto { Id = 1, Codigo = "PROD001", Descricao = "Produto 1", Saldo = 100 }
        );
    }
}
```

#### **LINQ Queries Avançadas**

##### **Projeção e Ordenação**

```csharp
public async Task<List<Produto>> GetAllAsync()
{
    return await _context.Produtos
        .OrderBy(p => p.Codigo)
        .ToListAsync();
}
```

##### **Filtros Complexos**

```csharp
public async Task<Produto?> GetByCodigoAsync(string codigo)
{
    return await _context.Produtos
        .FirstOrDefaultAsync(p => p.Codigo == codigo);
}
```

##### **Include (Eager Loading)**

```csharp
public async Task<NotaFiscal?> GetByIdAsync(int id)
{
    return await _context.NotasFiscais
        .Include(nf => nf.Itens)  // Carrega relacionamento
        .FirstOrDefaultAsync(nf => nf.Id == id);
}
```

##### **Agregações**

```csharp
public async Task<int> GetProximoNumeroAsync()
{
    var ultimaNota = await _context.NotasFiscais
        .OrderByDescending(nf => nf.Numero)
        .FirstOrDefaultAsync();

    return (ultimaNota?.Numero ?? 0) + 1;
}
```

##### **Select (Transformação)**

```csharp
var baixarRequest = new BaixarEstoqueRequest
{
    Itens = notaFiscal.Itens.Select(i => new ItemBaixaEstoque
    {
        ProdutoId = i.ProdutoId,
        Quantidade = i.Quantidade
    }).ToList()
};
```

---

### 2. Polly - Resiliência e Circuit Breaker

#### **Política de Retry**

```csharp
private readonly AsyncRetryPolicy<HttpResponseMessage> _retryPolicy;

_retryPolicy = Policy
    .HandleResult<HttpResponseMessage>(r => !r.IsSuccessStatusCode)
    .Or<HttpRequestException>()
    .WaitAndRetryAsync(
        retryCount: 3,
        sleepDurationProvider: retryAttempt => TimeSpan.FromSeconds(Math.Pow(2, retryAttempt)),
        onRetry: (outcome, timespan, retryCount, context) =>
        {
            _logger.LogWarning($"Tentativa {retryCount} falhou. Aguardando {timespan.TotalSeconds}s");
        });
```

**Finalidade**: Retenta automaticamente requisições falhadas com backoff exponencial (2^n segundos).

#### **Circuit Breaker**

```csharp
private readonly AsyncCircuitBreakerPolicy<HttpResponseMessage> _circuitBreakerPolicy;

_circuitBreakerPolicy = Policy
    .HandleResult<HttpResponseMessage>(r => !r.IsSuccessStatusCode)
    .Or<HttpRequestException>()
    .CircuitBreakerAsync(
        handledEventsAllowedBeforeBreaking: 5,
        durationOfBreak: TimeSpan.FromSeconds(30),
        onBreak: (outcome, breakDelay) =>
        {
            _logger.LogError("Circuit Breaker ABERTO! Bloqueando requisições por 30s");
        },
        onReset: () =>
        {
            _logger.LogInformation("Circuit Breaker FECHADO! Serviço disponível novamente.");
        });
```

**Finalidade**:

- Abre o circuito após 5 falhas consecutivas
- Bloqueia requisições por 30 segundos
- Permite recuperação gradual do serviço
- Evita sobrecarga de serviços falhando

#### **Policy Wrap (Combinação)**

```csharp
private async Task<HttpResponseMessage> ExecuteWithPolicyAsync(Func<Task<HttpResponseMessage>> action)
{
    var policyWrap = Policy.WrapAsync(_retryPolicy, _circuitBreakerPolicy);
    return await policyWrap.ExecuteAsync(action);
}
```

**Finalidade**: Combina retry + circuit breaker para resiliência completa.

---

### 3. Tratamento de Erros e Exceções

#### **Hierarquia de Exceções**

```csharp
try
{
    // Operação de negócio
}
catch (KeyNotFoundException ex)
{
    return NotFound(new { message = ex.Message });
}
catch (InvalidOperationException ex)
{
    return BadRequest(new { message = ex.Message });
}
catch (DbUpdateConcurrencyException ex)
{
    return Conflict(new { message = "Conflito de concorrência detectado" });
}
catch (BrokenCircuitException ex)
{
    return StatusCode(503, new { message = "Serviço temporariamente indisponível" });
}
catch (Exception ex)
{
    _logger.LogError(ex, "Erro interno");
    return StatusCode(500, new { message = "Erro interno do servidor" });
}
```

#### **Logging Estruturado**

```csharp
_logger.LogInformation($"Produto criado com sucesso: {produto.Codigo}");
_logger.LogWarning($"Conflito de concorrência ao atualizar produto {id}");
_logger.LogError(ex, "Erro ao realizar baixa de estoque");
```

#### **Validação de Modelos**

```csharp
[Required(ErrorMessage = "O código do produto é obrigatório")]
[StringLength(50)]
public string Codigo { get; set; }

[Range(0, int.MaxValue, ErrorMessage = "O saldo não pode ser negativo")]
public int Saldo { get; set; }
```

---

### 4. Controle de Concorrência

#### **Concorrência Otimista com RowVersion**

```csharp
[Timestamp]
public byte[]? RowVersion { get; set; }

try
{
    await _context.SaveChangesAsync();
}
catch (DbUpdateConcurrencyException ex)
{
    throw new InvalidOperationException(
        "O produto foi modificado por outro usuário. Recarregue e tente novamente.", ex);
}
```

**Finalidade**: Detecta modificações concorrentes e previne sobrescrita de dados.

#### **Semaphore para Operações Críticas**

```csharp
private static readonly SemaphoreSlim _semaphore = new(1, 1);

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
```

**Finalidade**: Garante numeração sequencial única mesmo sob alta concorrência.

---

### 5. Idempotência

```csharp
private static readonly HashSet<string> _processedKeys = new();

public async Task<bool> BaixarEstoqueAsync(BaixarEstoqueDto baixarDto)
{
    // Verifica idempotência
    if (await VerificarIdempotenciaAsync(baixarDto.IdempotencyKey))
    {
        _logger.LogInformation($"Operação idempotente: {baixarDto.IdempotencyKey}");
        return true; // Já processada
    }

    // Processa operação...

    // Registra chave
    await RegistrarIdempotenciaAsync(baixarDto.IdempotencyKey);
}
```

**Finalidade**: Previne processamento duplicado de baixas de estoque, mesmo com retries.

---

### 6. Transações

```csharp
using var transaction = await _context.Database.BeginTransactionAsync();
try
{
    // Múltiplas operações
    foreach (var item in baixarDto.Itens)
    {
        var produto = await _context.Produtos.FirstOrDefaultAsync(p => p.Id == item.ProdutoId);
        produto.Saldo -= item.Quantidade;
    }

    await _context.SaveChangesAsync();
    await transaction.CommitAsync();
}
catch
{
    await transaction.RollbackAsync();
    throw;
}
```

**Finalidade**: Garante atomicidade em operações que envolvem múltiplos produtos.

---

### 7. Health Checks e Monitoramento

#### **Health Check no Serviço de Estoque**

```csharp
[HttpGet("health")]
[ProducesResponseType(StatusCodes.Status200OK)]
public ActionResult Health()
{
    return Ok(new
    {
        status = "healthy",
        service = "Korp.Estoque.Api",
        timestamp = DateTime.UtcNow
    });
}
```

#### **Verificação de Disponibilidade no Serviço de Faturamento**

```csharp
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

// Controller - Endpoint de status
[HttpGet("estoque-status")]
public async Task<ActionResult> CheckEstoqueStatus()
{
    try
    {
        var disponivel = await _estoqueService.VerificarDisponibilidadeAsync();
        return Ok(new {
            estoqueServiceDisponivel = disponivel,
            timestamp = DateTime.UtcNow
        });
    }
    catch (Exception ex)
    {
        return Ok(new {
            estoqueServiceDisponivel = false,
            error = ex.Message
        });
    }
}
```

**Finalidade**:

- Monitora saúde dos microsserviços
- Previne criação de notas quando estoque está indisponível
- Fornece feedback visual ao usuário sobre status dos serviços

---

## Funcionalidades Implementadas

### Requisitos Obrigatórios

1. **Cadastro de Produtos**
   - CRUD completo
   - Validação de campos
   - Controle de saldo
   - Código único (validação assíncrona no submit)
   - Endpoint de verificação de código disponível

2. **Cadastro de Notas Fiscais**
   - Numeração sequencial automática
   - Status (Aberta/Fechada)
   - Múltiplos produtos por nota
   - Validação de saldo disponível

3. **Impressão de Notas Fiscais**
   - Botão de impressão com loading
   - Bloqueio de notas já impressas
   - Atualização automática de status
   - Baixa de estoque integrada
   - Simulação de processamento

4. **Arquitetura de Microsserviços**
   - Serviço de Estoque (porta 5001)
   - Serviço de Faturamento (porta 5002)
   - Comunicação HTTP entre serviços

5. **Tratamento de Falhas**
   - Circuit Breaker com Polly
   - Retry com backoff exponencial
   - Feedback ao usuário
   - Logging estruturado

6. **Persistência Real**
   - Entity Framework Core
   - SQL Server com migrations automáticas
   - Banco de dados criado automaticamente na primeira execução

### Requisitos Opcionais (Diferenciais)

1. **Angular Signals & Standalone Components (Angular 21)**
   - Gerenciamento de estado reativo moderno
   - Computed properties com memoização
   - Filtros e contadores reativos
   - Performance otimizada sem memory leaks
   - Arquitetura moderna sem NgModules
   - Imports explícitos em cada componente

2. **Validação Assíncrona de Código**
   - Verificação de código duplicado antes do submit
   - Uso de `lastValueFrom` do RxJS para conversão Observable→Promise
   - Feedback visual com mensagens de erro

3. **Health Check de Serviços**
   - Endpoint `/api/produtos/health` no serviço de Estoque
   - Verificação de disponibilidade antes de criar notas
   - Feedback visual do status do serviço

4. **Tratamento de Concorrência**
   - RowVersion (concorrência otimista)
   - Semaphore para numeração sequencial
   - Detecção de conflitos

5. **Idempotência**
   - Chaves de idempotência
   - Prevenção de duplicação de baixas
   - Cache de operações processadas

---

## Como Executar

### Pré-requisitos

- Node.js 18+ e npm
- .NET 8 SDK
- Visual Studio 2022 ou VS Code

### Passo 1: Executar Microsserviço de Estoque

```powershell
cd Korp.Estoque.Api
dotnet run
```

Serviço disponível em: `http://localhost:5001`
Swagger: `http://localhost:5001/swagger`

### Passo 2: Executar Microsserviço de Faturamento

```powershell
cd Korp.Faturamento.Api
dotnet run
```

Serviço disponível em: `http://localhost:5002`
Swagger: `http://localhost:5002/swagger`

### Passo 3: Executar Frontend Angular

```powershell
cd korp_teste_natan.client
npm install
npx ng serve
```

Aplicação disponível em: `http://localhost:4200`

### Testando Circuit Breaker

Para testar a resiliência, pare um dos serviços backend e observe:

- Retries automáticos
- Abertura do circuit breaker
- Mensagens de erro amigáveis
- Recuperação automática ao reativar o serviço

---

## Endpoints da API

### Microsserviço Estoque (Port 5001)

```
GET    /api/produtos                            - Lista todos os produtos
GET    /api/produtos/{id}                       - Busca produto por ID
GET    /api/produtos/codigo/{codigo}            - Busca produto por código
GET    /api/produtos/verificar-codigo/{codigo}  - Verifica se código já existe
GET    /api/produtos/health                     - Health check do serviço
POST   /api/produtos                            - Cria novo produto
PUT    /api/produtos/{id}                       - Atualiza produto (exceto o saldo)
POST   /api/produtos/baixar-estoque             - Baixa estoque (idempotente)
```

### Microsserviço Faturamento (Port 5002)

```
GET    /api/notasfiscais                      - Lista todas as notas
GET    /api/notasfiscais/{id}                 - Busca nota por ID
GET    /api/notasfiscais/estoque-status       - Verifica status do serviço de estoque
GET    /api/notasfiscais/health               - Health check do serviço
POST   /api/notasfiscais                      - Cria nova nota
PUT    /api/notasfiscais/{id}                 - Atualiza nota
DELETE /api/notasfiscais/{id}                 - Exclui nota
POST   /api/notasfiscais/{id}/imprimir        - Imprime nota (com retry)
```

---

## Checklist de Funcionalidades

### Requisitos Obrigatórios do Desafio

#### 1. Cadastro de Produtos

- [x] Campo Código (único, validado)
- [x] Campo Descrição (nome do produto)
- [x] Campo Saldo (quantidade disponível em estoque)
- [x] CRUD completo
- [x] Validação de campos obrigatórios
- [x] Endpoint de verificação de código disponível

#### 2. Cadastro de Notas Fiscais

- [x] Numeração sequencial automática
- [x] Status: Aberta ou Fechada
- [x] Inclusão de múltiplos produtos com quantidades
- [x] Validação de saldo disponível
- [x] Persistência completa em banco de dados

#### 3. Impressão de Notas Fiscais

- [x] Botão de impressão visível e intuitivo
- [x] Indicador de processamento (loading spinner)
- [x] Atualização automática de status para Fechada
- [x] Bloqueio de impressão para notas não Abertas
- [x] Baixa de estoque automática (exemplo: saldo 10 - nota usa 2 = novo saldo 8)
- [x] Simulação de processamento de impressão

#### 4. Arquitetura de Microsserviços

- [x] Serviço de Estoque (porta 5001)
- [x] Serviço de Faturamento (porta 5002)
- [x] Comunicação HTTP entre serviços
- [x] Separação clara de responsabilidades

#### 5. Tratamento de Falhas

- [x] Circuit Breaker com Polly (abre após 5 falhas, aguarda 30s)
- [x] Retry com backoff exponencial (3 tentativas: 1s, 2s, 4s)
- [x] Feedback apropriado ao usuário sobre erros
- [x] Recuperação automática de falhas
- [x] Logging estruturado de erros

#### 6. Persistência Real

- [x] Entity Framework Core 8.0
- [x] SQL Server com migrations automáticas
- [x] Banco de dados criado automaticamente na primeira execução
- [x] Seed de dados inicial

### Requisitos Opcionais Implementados

#### a. Tratamento de Concorrência

- [x] RowVersion para concorrência otimista
- [x] Semaphore para numeração sequencial (previne duplicatas)
- [x] Detecção e notificação de conflitos
- [x] Proteção contra condições de corrida

#### c. Idempotência

- [x] Chaves de idempotência para baixa de estoque
- [x] Prevenção de processamento duplicado
- [x] Cache de operações já processadas
- [x] Operações seguras mesmo com retries

---

### Funcionalidades Adicionais (Diferenciais)

#### Frontend Avançado

- [x] Angular 21 com Signals e Standalone Components
- [x] RxJS com operadores avançados (takeUntil, retry, retryWhen, tap, catchError, finalize)
- [x] Computed properties reativos
- [x] TypeScript Path Mapping (@models, @services, @components, etc)
- [x] Interface responsiva com Tailwind CSS e PrimeNG
- [x] Validação assíncrona de código no submit
- [x] Feedback visual contextual
- [x] Diálogos de confirmação

#### Backend Avançado

- [x] LINQ com queries otimizadas
- [x] Entity Framework com migrations
- [x] Health checks de serviços
- [x] Endpoints de validação
- [x] Transações para operações atômicas

#### DevOps & Qualidade

- [x] Logging estruturado
- [x] Tratamento de exceções hierárquico
- [x] Documentação Swagger/OpenAPI
- [x] Resiliência com retry e circuit breaker

---

## Arquivos de Configuração

### Angular

**environment.ts**

```typescript
export const environment = {
  production: false,
  estoqueApiUrl: "http://localhost:5001/api/produtos",
  faturamentoApiUrl: "http://localhost:5002/api/notasfiscais",
};
```

### Backend

**appsettings.json** (Estoque)

```json
{
  "ConnectionStrings": {
    "DefaultConnection": ""
  },
  "Urls": "http://localhost:5001"
}
```

**appsettings.json** (Faturamento)

```json
{
  "ConnectionStrings": {
    "DefaultConnection": ""
  },
  "EstoqueServiceUrl": "http://localhost:5001",
  "Urls": "http://localhost:5002"
}
```

---

## Exemplos de LINQ Utilizados no Projeto

Esta seção documenta os principais exemplos de LINQ de filtro e operações utilizados nas APIs do projeto.

### 1. Filtros Básicos com `Where()`

#### Busca por Código (Estoque)

```csharp
// ProdutoService.cs - GetByCodigoAsync
return await _context.Produtos
    .FirstOrDefaultAsync(p => p.Codigo == codigo);
```

#### Filtro por Status (Faturamento)

```csharp
// NotaFiscalService.cs - GetPagedAsync
if (status.HasValue)
{
    var statusEnum = (StatusNotaFiscal)status.Value;
    query = query.Where(nf => nf.Status == statusEnum);
}
```

#### Busca com Múltiplos Critérios (Estoque)

```csharp
// ProdutoService.cs - GetPagedAsync
if (!string.IsNullOrWhiteSpace(search))
{
    var searchLower = search.ToLower();
    query = query.Where(p =>
        p.Codigo.ToLower().Contains(searchLower) ||
        p.Descricao.ToLower().Contains(searchLower));
}
```

### 2. Ordenação com `OrderBy()` e `OrderByDescending()`

#### Ordenação Crescente

```csharp
// ProdutoService.cs - GetAllAsync
return await _context.Produtos
    .OrderBy(p => p.Codigo)
    .ToListAsync();
```

#### Ordenação Decrescente

```csharp
// NotaFiscalService.cs - GetAllAsync
return await _context.NotasFiscais
    .Include(nf => nf.Itens)
    .OrderByDescending(nf => nf.Numero)
    .ToListAsync();
```

### 3. Paginação com `Skip()` e `Take()`

```csharp
// ProdutoService.cs - GetPagedAsync
var items = await query
    .OrderBy(p => p.Codigo)
    .Skip((page - 1) * pageSize)
    .Take(pageSize)
    .ToListAsync();
```

### 4. Agregações com `Count()` e `Any()`

#### Contagem Total e Condicional

```csharp
// NotaFiscalService.cs - GetPagedAsync
var totalCount = await query.CountAsync();
var totalAbertas = await _context.NotasFiscais.CountAsync(nf => nf.Status == StatusNotaFiscal.Aberta);
var totalFechadas = await _context.NotasFiscais.CountAsync(nf => nf.Status == StatusNotaFiscal.Fechada);
```

#### Verificação de Existência

```csharp
// NotaFiscalService.cs - ImprimirAsync
if (notaFiscal.Itens == null || !notaFiscal.Itens.Any())
{
    throw new InvalidOperationException("A nota fiscal não possui itens para imprimir");
}
```

### 5. Projeção com `Select()`

#### Mapeamento de Itens para DTO

```csharp
// NotaFiscalService.cs - ImprimirAsync
Itens = notaFiscal.Itens.Select(i => new ItemBaixaEstoque
{
    ProdutoId = i.ProdutoId,
    Quantidade = i.Quantidade
}).ToList()
```

### 6. Relacionamentos com `Include()`

#### Eager Loading de Itens

```csharp
// NotaFiscalService.cs - GetByIdAsync
return await _context.NotasFiscais
    .Include(nf => nf.Itens)
    .FirstOrDefaultAsync(nf => nf.Id == id);
```

### 7. Query Encadeada Completa

#### Exemplo de Busca Paginada com Múltiplos Operadores

```csharp
// NotaFiscalService.cs - GetPagedAsync
var query = _context.NotasFiscais
    .Include(nf => nf.Itens)  // Join com itens
    .AsQueryable();

// Filtro condicional
if (status.HasValue)
{
    var statusEnum = (StatusNotaFiscal)status.Value;
    query = query.Where(nf => nf.Status == statusEnum);
}

// Execução com ordenação e paginação
var items = await query
    .OrderByDescending(nf => nf.Numero)
    .Skip((page - 1) * pageSize)
    .Take(pageSize)
    .ToListAsync();
```

### 8. Operações de Busca Avançada

#### Busca do Próximo Número Sequencial

```csharp
// NotaFiscalService.cs - GetProximoNumeroAsync
var ultimaNota = await _context.NotasFiscais
    .OrderByDescending(nf => nf.Numero)
    .FirstOrDefaultAsync();

return (ultimaNota?.Numero ?? 0) + 1;
```

### Resumo dos Operadores LINQ Utilizados

| Operador                | Finalidade            | Exemplo de Uso                        |
| ----------------------- | --------------------- | ------------------------------------- |
| `Where()`               | Filtragem de dados    | Busca por código, status, ou texto    |
| `OrderBy()`             | Ordenação crescente   | Listar produtos por código            |
| `OrderByDescending()`   | Ordenação decrescente | Listar notas fiscais mais recentes    |
| `Skip()`                | Pular registros       | Paginação (pular páginas anteriores)  |
| `Take()`                | Limitar registros     | Paginação (tamanho da página)         |
| `FirstOrDefaultAsync()` | Primeiro ou nulo      | Buscar por ID ou código único         |
| `CountAsync()`          | Contar registros      | Total de registros, com ou sem filtro |
| `Any()`                 | Verificar existência  | Validar se há itens na lista          |
| `Select()`              | Projetar/mapear       | Transformar entidade em DTO           |
| `Include()`             | Eager loading         | Carregar relacionamentos (joins)      |
| `ToListAsync()`         | Executar query        | Materializar resultados em lista      |

---

## Conclusão

Este projeto demonstra:

- **Arquitetura de microsserviços** moderna e resiliente
- **Angular 21** com Signals e Standalone Components para gerenciamento de estado reativo
- **Comunicação resiliente** entre serviços com Polly
- **Frontend moderno** com RxJS e programação reativa
- **Backend robusto** com .NET 8 e Entity Framework Core
- **Tratamento avançado** de erros, falhas e concorrência
- **Validação assíncrona** e health checks
- **Interface profissional** com Tailwind CSS e PrimeNG
- **Boas práticas** de desenvolvimento e arquitetura

### Destaques Técnicos:

- **Angular Signals & Standalone Components** - API de reatividade moderna do Angular 21
- **TypeScript Path Mapping** - Imports limpos com @models, @services, @components
- **Tailwind CSS & PrimeNG** - Interface moderna com utility-first CSS e componentes ricos
- **Polly Resilience** - Circuit Breaker + Retry com backoff exponencial
- **Validação Assíncrona** - Verificação de código duplicado antes do submit
- **Health Checks** - Monitoramento de disponibilidade de serviços
- **Idempotência** - Prevenção de operações duplicadas
- **Concorrência Otimista** - RowVersion para controle de conflitos
- **LINQ Avançado** - Queries otimizadas com filtros, agregações e joins

### Atendimento aos Requisitos do Desafio:

**Todos os requisitos obrigatórios implementados**

- Cadastro completo de produtos (código, descrição, saldo)
- Cadastro de notas fiscais (numeração sequencial, status, múltiplos produtos)
- Impressão com indicador de processamento e baixa de estoque
- Arquitetura de microsserviços (Estoque + Faturamento)
- Tratamento robusto de falhas com recuperação automática
- Persistência real em SQL Server

  **Requisitos opcionais implementados**

- Tratamento de concorrência (RowVersion + Semaphore)
- Idempotência para operações críticas

  **Detalhamento técnico completo**

- Ciclos de vida do Angular (OnInit, OnDestroy)
- Uso extensivo de RxJS (takeUntil, retry, tap, catchError, finalize)
- Bibliotecas utilizadas (PrimeNG, Tailwind CSS, Polly)
- Frameworks C# (ASP.NET Core, Entity Framework Core)
- Tratamento hierárquico de exceções
- LINQ com exemplos práticos

Desenvolvido como projeto técnico para demonstração de habilidades em desenvolvimento full stack moderno.

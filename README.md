# Sistema de Emissão de Notas Fiscais - Korp

## 📋 Sumário
1. [Visão Geral](#visão-geral)
2. [Arquitetura](#arquitetura)
3. [Tecnologias Utilizadas](#tecnologias-utilizadas)
4. [Detalhamento Técnico Angular](#detalhamento-técnico-angular)
5. [Detalhamento Técnico Backend C#](#detalhamento-técnico-backend-c)
6. [Funcionalidades Implementadas](#funcionalidades-implementadas)
7. [Como Executar](#como-executar)
8. [Endpoints da API](#endpoints-da-api)
9. [Checklist de Funcionalidades](#checklist-de-funcionalidades)
10. [Demonstração em Vídeo](#demonstração-em-vídeo)

---

## 🆕 Novas Funcionalidades Implementadas

### ⚡ Angular Signals (Angular 17)
- **Estado Reativo Moderno**: Gerenciamento de estado com `signal()` e `computed()`
- **Filtros Dinâmicos**: Filtragem reativa de notas fiscais por status
- **Contadores Automáticos**: Contagem de notas abertas/fechadas sem subscrições manuais
- **Performance**: Atualizações otimizadas sem memory leaks

### ✅ Validação Assíncrona de Código
- **Endpoint de Verificação**: `GET /api/produtos/verificar-codigo/{codigo}`
- **Validação em Tempo Real**: Verifica duplicidade de código enquanto usuário digita
- **Debounce Inteligente**: Reduz chamadas à API durante digitação
- **Feedback Instantâneo**: Mensagem de erro imediata no formulário

### 🏥 Health Checks de Serviços
- **Monitoramento de Estoque**: `GET /api/produtos/health`
- **Monitoramento de Faturamento**: `GET /api/notasfiscais/health`
- **Status de Disponibilidade**: `GET /api/notasfiscais/estoque-status`
- **Feedback Visual**: Indicador de serviço disponível/indisponível na UI

### 🎨 Melhorias de UX
- **Loading States**: Spinners contextuais durante operações
- **Computed Properties**: Cálculos reativos de totais e contadores
- **Filtros Interativos**: Filtro por status com atualização instantânea
- **Diálogos de Confirmação**: Proteção contra exclusões acidentais

---

## 🎯 Visão Geral

Sistema completo de emissão de notas fiscais desenvolvido com **Angular 17** no frontend e **ASP.NET Core 8** no backend, implementando arquitetura de microsserviços com dois serviços independentes:

- **Microsserviço de Estoque**: Gerenciamento de produtos e controle de estoque
- **Microsserviço de Faturamento**: Criação e impressão de notas fiscais

---

## 🏗 Arquitetura

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

## 🛠 Tecnologias Utilizadas

### Frontend
- **Angular 17**
- **Angular Material 17** (componentes UI)
- **Angular Signals** (gerenciamento de estado reativo)
- **RxJS 7.8** (programação reativa)
- **TypeScript 5.4**
- **HTTP Client** (comunicação com APIs)

### Backend
- **ASP.NET Core 8**
- **Entity Framework Core 8.0** (ORM)
- **SQL Server** (banco de dados com migrations)
- **Polly 8.6** (resiliência e tratamento de falhas)
- **Swagger/OpenAPI** (documentação de APIs)

---

## 📱 Detalhamento Técnico Angular

### 1. Ciclos de Vida Utilizados

#### **OnInit**
Utilizado em todos os componentes para inicialização:

```typescript
// produtos.component.ts
ngOnInit(): void {
  this.loadProdutos();
  
  // Observa mudanças no subject de produtos (RxJS)
  this.produtoService.produtos$
    .pipe(takeUntil(this.destroy$))
    .subscribe(produtos => {
      this.produtos = produtos;
    });
}
```

**Finalidade**: Carregar dados iniciais e configurar observables.

#### **OnDestroy**
Implementado para limpeza de recursos e prevenção de memory leaks:

```typescript
private destroy$ = new Subject<void>();

ngOnDestroy(): void {
  this.destroy$.next();
  this.destroy$.complete();
}
```

**Finalidade**: Cancelar subscrições de observables usando `takeUntil(this.destroy$)`.

---

### 2. Uso da Biblioteca RxJS

#### **Operators Utilizados**

##### **takeUntil**
```typescript
this.produtoService.getAll()
  .pipe(takeUntil(this.destroy$))
  .subscribe({
    next: (produtos) => this.produtos = produtos,
    error: (error) => this.showError(error.message)
  });
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

### 4. Angular Signals (Novo no Angular 17)

#### **O que são Signals?**
Signals são uma nova primitiva de reatividade do Angular 17 que oferece uma alternativa mais simples e performática aos observables para gerenciamento de estado.

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
    notas = notas.filter(n => n.status === status);
  }
  return notas;
});

// Conta notas abertas
countNotasAbertas = computed(() =>
  this.notasFiscais().filter(n => n.status === 0).length
);

// Soma total de itens por nota
sumNotasItems = computed(() => {
  const keyNotasItems = new Map<number, number>();
  this.notasFiscais().forEach(nota => {
    const totalItens = nota.itens?.reduce((sum, item) => sum + item.quantidade, 0) || 0;
    keyNotasItems.set(nota.id, totalItens);
  });
  return keyNotasItems;
});

// Controla estado de impressão
podeImprimirMap = computed(() => {
  const map = new Map<number, boolean>();
  const imprimindo = this.imprimindoMapSignal();
  this.notasFiscaisFiltradas().forEach(nota => {
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
// ✅ RxJS - Usado para operações assíncronas (HTTP, eventos)
this.notaFiscalService.getAll()
  .pipe(takeUntil(this.destroy$))
  .subscribe(notas => this.notasFiscais.set(notas));

// ✅ Signals - Usado para estado local e valores derivados
notasFiscaisFiltradas = computed(() => {
  return this.notasFiscais().filter(n => n.status === this.filtroStatus());
});
```
**Uso Combinado**: Signals para estado/valores derivados, RxJS para operações assíncronas.

---

### 3. Bibliotecas Adicionais e Suas Finalidades

#### **Angular Material 17**
```typescript
import { MatToolbarModule } from '@angular/material/toolbar';
import { MatButtonModule } from '@angular/material/button';
import { MatTableModule } from '@angular/material/table';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatSelectModule } from '@angular/material/select';
import { MatSnackBarModule } from '@angular/material/snack-bar';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { MatChipsModule } from '@angular/material/chips';
import { MatIconModule } from '@angular/material/icon';
import { MatCardModule } from '@angular/material/card';
```

**Componentes Utilizados**:
- `MatToolbar`: Barra de navegação principal
- `MatTable`: Tabelas de produtos e notas fiscais
- `MatFormField`, `MatInput`, `MatSelect`: Formulários
- `MatSnackBar`: Notificações toast
- `MatProgressSpinner`: Indicadores de carregamento
- `MatChips`: Tags de status (Aberta/Fechada)
- `MatButton`: Botões estilizados
- `MatCard`: Cards de conteúdo
- `MatIcon`: Ícones Material Design

**Finalidade**: Interface moderna, responsiva e acessível seguindo Material Design.

#### **Reactive Forms**
```typescript
import { ReactiveFormsModule } from '@angular/forms';

this.produtoForm = this.formBuilder.group({
  codigo: ['', [Validators.required, Validators.maxLength(50)]],
  descricao: ['', [Validators.required, Validators.maxLength(200)]],
  saldo: [0, [Validators.required, Validators.min(0)]]
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

// Component - Validação em tempo real
verificarCodigoDisponivel(): void {
  const codigo = this.produtoForm.get('codigo')?.value?.trim();
  
  if (!codigo || codigo.length < 3) {
    this.codigoExistente = false;
    return;
  }

  // Debounce manual para evitar múltiplas chamadas
  this.produtoService.verificarCodigo(codigo, this.editingId)
    .pipe(takeUntil(this.destroy$))
    .subscribe({
      next: (response) => {
        this.codigoExistente = response.existe;
        if (this.codigoExistente) {
          this.produtoForm.get('codigo')?.setErrors({ 'codigoExistente': true });
        }
      },
      error: () => this.codigoExistente = false
    });
}
```

**Finalidade**: Valida código de produto em tempo real, evitando duplicatas antes do submit.

#### **RouterModule**
```typescript
RouterModule.forRoot([
  { path: '', redirectTo: '/produtos', pathMatch: 'full' },
  { path: 'produtos', component: ProdutosComponent },
  { path: 'notas', component: NotaFiscalListComponent },
  { path: 'notas/nova', component: NotaFiscalFormComponent }
])
```

**Finalidade**: Navegação SPA (Single Page Application) entre componentes.

---

## 🔧 Detalhamento Técnico Backend C#

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

## ✨ Funcionalidades Implementadas

### ✅ Requisitos Obrigatórios

1. **Cadastro de Produtos** ✓
   - CRUD completo
   - Validação de campos
   - Controle de saldo
   - Código único (validação em tempo real)
   - Endpoint de verificação de código disponível

2. **Cadastro de Notas Fiscais** ✓
   - Numeração sequencial automática
   - Status (Aberta/Fechada)
   - Múltiplos produtos por nota
   - Validação de saldo disponível

3. **Impressão de Notas Fiscais** ✓
   - Botão de impressão com loading
   - Bloqueio de notas já impressas
   - Atualização automática de status
   - Baixa de estoque integrada
   - Simulação de processamento

4. **Arquitetura de Microsserviços** ✓
   - Serviço de Estoque (porta 5001)
   - Serviço de Faturamento (porta 5002)
   - Comunicação HTTP entre serviços

5. **Tratamento de Falhas** ✓
   - Circuit Breaker com Polly
   - Retry com backoff exponencial
   - Feedback ao usuário
   - Logging estruturado

6. **Persistência Real** ✓
   - Entity Framework Core
   - SQL Server com migrations automáticas
   - Banco de dados criado automaticamente na primeira execução

### ⭐ Requisitos Opcionais (Diferenciais)

1. **Angular Signals (Angular 17)** ✓
   - Gerenciamento de estado reativo moderno
   - Computed properties com memoização
   - Filtros e contadores reativos
   - Performance otimizada sem memory leaks

2. **Validação Assíncrona de Código** ✓
   - Verificação em tempo real de código duplicado
   - Debounce para reduzir chamadas à API
   - Feedback visual instantâneo

3. **Health Check de Serviços** ✓
   - Endpoint `/api/produtos/health` no serviço de Estoque
   - Verificação de disponibilidade antes de criar notas
   - Feedback visual do status do serviço

4. **Tratamento de Concorrência** ✓
   - RowVersion (concorrência otimista)
   - Semaphore para numeração sequencial
   - Detecção de conflitos

5. **Idempotência** ✓
   - Chaves de idempotência
   - Prevenção de duplicação de baixas
   - Cache de operações processadas

---

## 🚀 Como Executar

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

## 📡 Endpoints da API

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

## ✅ Checklist de Funcionalidades

### Core
- [x] Cadastro completo de Produtos (CRUD)
- [x] Cadastro de Notas Fiscais com múltiplos itens
- [x] Impressão de Notas Fiscais com baixa de estoque
- [x] Arquitetura de Microsserviços
- [x] Tratamento de falhas com Polly (Circuit Breaker + Retry)
- [x] Persistência em SQL Server real

### Frontend Avançado
- [x] Angular 17 com Signals
- [x] RxJS com operadores avançados (takeUntil, retry, retryWhen, tap, catchError, finalize)
- [x] Computed properties reativos
- [x] Interface responsiva com Material Design
- [x] Validações assíncronas em tempo real
- [x] Feedback visual contextual

### Backend Avançado
- [x] LINQ com queries otimizadas
- [x] Entity Framework com migrations
- [x] Controle de concorrência otimista
- [x] Idempotência em operações críticas
- [x] Health checks de serviços
- [x] Endpoints de validação

### DevOps & Qualidade
- [x] Logging estruturado
- [x] Tratamento de exceções hierárquico
- [x] Documentação Swagger/OpenAPI
- [x] Resiliência com retry e circuit breaker

---

## 📹 Demonstração em Vídeo

https://drive.google.com/file/d/1F0rGsPmLolyORkjE3Q2yyOeLzY0h6URY/view?usp=sharing
- Telas desenvolvidas
- Funcionalidades implementadas
- Detalhamento técnico conforme descrito neste documento

---

## 📊 Arquivos de Configuração

### Angular

**environment.ts**
```typescript
export const environment = {
  production: false,
  estoqueApiUrl: 'http://localhost:5001/api/produtos',
  faturamentoApiUrl: 'http://localhost:5002/api/notasfiscais'
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

## 🎓 Conclusão

Este projeto demonstra:
- **Arquitetura de microsserviços** moderna e resiliente
- **Angular 17** com Signals para gerenciamento de estado reativo
- **Comunicação resiliente** entre serviços com Polly
- **Frontend moderno** com RxJS e programação reativa
- **Backend robusto** com .NET 8 e Entity Framework Core
- **Tratamento avançado** de erros, falhas e concorrência
- **Validações em tempo real** e health checks
- **Interface profissional** com Material Design
- **Boas práticas** de desenvolvimento e arquitetura

### Destaques Técnicos:
✨ **Angular Signals** - Nova API de reatividade do Angular 17  
✨ **Polly Resilience** - Circuit Breaker + Retry com backoff exponencial  
✨ **Validação Assíncrona** - Verificação de código em tempo real  
✨ **Health Checks** - Monitoramento de disponibilidade de serviços  
✨ **Idempotência** - Prevenção de operações duplicadas  
✨ **Concorrência Otimista** - RowVersion para controle de conflitos  

Desenvolvido como projeto técnico para demonstração de habilidades em desenvolvimento full-stack moderno.

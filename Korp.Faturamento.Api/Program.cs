using Microsoft.EntityFrameworkCore;
using Korp.Faturamento.Api.Data;
using Korp.Faturamento.Api.Services;
using Polly;
using Polly.Extensions.Http;

var builder = WebApplication.CreateBuilder(args);

// Add services to the container
builder.Services.AddControllers();
builder.Services.AddEndpointsApiExplorer();
builder.Services.AddSwaggerGen(c =>
{
    c.SwaggerDoc("v1", new() { Title = "Korp Faturamento API", Version = "v1", Description = "API de Gerenciamento de Faturamento" });
});

// Configurar banco de dados SQL Server
var connectionString = builder.Configuration.GetConnectionString("DefaultConnection");
builder.Services.AddDbContext<FaturamentoDbContext>(options =>
    options.UseSqlServer(connectionString));

// Configurar HttpClient para o serviço de Estoque com Polly
var estoqueServiceUrl = builder.Configuration.GetValue<string>("EstoqueServiceUrl") ?? "http://localhost:5001";
builder.Services.AddHttpClient<IEstoqueService, EstoqueService>(client =>
{
    client.BaseAddress = new Uri(estoqueServiceUrl);
    client.Timeout = TimeSpan.FromSeconds(30);
});

// Registrar serviços
builder.Services.AddScoped<INotaFiscalService, NotaFiscalService>();

// Configurar CORS
builder.Services.AddCors(options =>
{
    options.AddPolicy("AllowAll", policy =>
    {
        policy.AllowAnyOrigin()
              .AllowAnyMethod()
              .AllowAnyHeader();
    });
});

var app = builder.Build();

// Inicializar banco de dados - Aplicar migrations automaticamente
using (var scope = app.Services.CreateScope())
{
    var context = scope.ServiceProvider.GetRequiredService<FaturamentoDbContext>();
    var logger = scope.ServiceProvider.GetRequiredService<ILogger<Program>>();
    try
    {
        logger.LogInformation("Aplicando migrations do banco de dados...");
        context.Database.Migrate();
        logger.LogInformation("Migrations aplicadas com sucesso.");
    }
    catch (Exception ex)
    {
        logger.LogError(ex, "Erro ao aplicar migrations. Verifique a conexão com o banco de dados.");
    }
}

// Configure the HTTP request pipeline
if (app.Environment.IsDevelopment())
{
    app.UseSwagger();
    app.UseSwaggerUI();
}

app.UseCors("AllowAll");
app.UseHttpsRedirection();
app.UseAuthorization();
app.MapControllers();

app.Run();

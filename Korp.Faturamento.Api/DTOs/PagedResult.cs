namespace Korp.Faturamento.Api.DTOs
{
    public class PagedResult<T>
    {
        public List<T> Items { get; set; } = new();
        public int TotalCount { get; set; }
        public int Page { get; set; }
        public int PageSize { get; set; }
        public int TotalPages => PageSize > 0 ? (int)Math.Ceiling((double)TotalCount / PageSize) : 0;
    }

    public class NotaFiscalPagedResult : PagedResult<NotaFiscalDto>
    {
        public int TotalAbertas { get; set; }
        public int TotalFechadas { get; set; }
    }
}

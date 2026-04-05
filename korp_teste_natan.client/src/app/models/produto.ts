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

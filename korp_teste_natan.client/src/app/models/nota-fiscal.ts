import { PagedResult } from './produto';

export interface NotaFiscal {
  id: number;
  numero: number;
  status: number; // 0 = 'Aberta' | 1 = 'Fechada';
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

export interface CriarNotaFiscalDto {
  itens: ItemNotaFiscal[];
}

export interface NotaFiscalPagedResult extends PagedResult<NotaFiscal> {
  totalAbertas: number;
  totalFechadas: number;
}

export interface StatusNota {
  class: string;
  label: string;
}

import { HttpClient, HttpErrorResponse } from '@angular/common/http';
import { Injectable } from '@angular/core';
import { BehaviorSubject, Observable, throwError } from 'rxjs';
import { catchError, retry, tap } from 'rxjs/operators';
import { environment } from '../../environments/environment';
import { Produto } from '../models/models';

interface VerificarCodigoResponse {
  existe: boolean;
  codigo: string;
}

@Injectable({
  providedIn: 'root'
})
export class ProdutoService {
  private apiUrl = environment.estoqueApiUrl;
  private produtosSubject = new BehaviorSubject<Produto[]>([]);
  public produtos$ = this.produtosSubject.asObservable();

  constructor(private http: HttpClient) {}

  // CRUD Completo com RxJS operators

  getAll(): Observable<Produto[]> {
    return this.http.get<Produto[]>(this.apiUrl).pipe(
      retry(2), // Tenta até 2 vezes em caso de erro
      tap(produtos => this.produtosSubject.next(produtos)),
      catchError(this.handleError)
    );
  }

  getById(id: number): Observable<Produto> {
    return this.http.get<Produto>(`${this.apiUrl}/${id}`).pipe(
      retry(1),
      catchError(this.handleError)
    );
  }

  verificarCodigo(codigo: string, idExcluir?: number): Observable<VerificarCodigoResponse> {
    const params = idExcluir ? `?idExcluir=${idExcluir}` : '';
    return this.http.get<VerificarCodigoResponse>(`${this.apiUrl}/verificar-codigo/${codigo}${params}`).pipe(
      catchError(this.handleError)
    );
  }

  getByCodigo(codigo: string): Observable<Produto> {
    return this.http.get<Produto>(`${this.apiUrl}/codigo/${codigo}`).pipe(
      retry(1),
      catchError(this.handleError)
    );
  }

  create(produto: Omit<Produto, 'id'>): Observable<Produto> {
    return this.http.post<Produto>(this.apiUrl, produto).pipe(
      tap(() => this.refreshList()),
      catchError(this.handleError)
    );
  }

  update(id: number, produto: Omit<Produto, 'id'>): Observable<Produto> {
    return this.http.put<Produto>(`${this.apiUrl}/${id}`, produto).pipe(
      tap(() => this.refreshList()),
      catchError(this.handleError)
    );
  }

  private refreshList(): void {
    this.getAll().subscribe();
  }

  private handleError(error: HttpErrorResponse): Observable<never> {
    let errorMessage = 'Ocorreu um erro desconhecido';

    if (error.error instanceof ErrorEvent) {
      // Erro do lado do cliente
      errorMessage = `Erro: ${error.error.message}`;
    } else {
      // Erro do lado do servidor
      if (error.status === 0) {
        errorMessage = 'Não foi possível conectar ao servidor. Verifique sua conexão.';
      } else if (error.status === 404) {
        errorMessage = 'Produto não encontrado.';
      } else if (error.status === 400) {
        errorMessage = error.error?.message || 'Dados inválidos.';
      } else if (error.status === 409) {
        errorMessage = error.error?.message || 'Conflito detectado.';
      } else if (error.status === 500) {
        errorMessage = 'Erro interno do servidor.';
      } else {
        errorMessage = error.error?.message || `Erro ${error.status}: ${error.statusText}`;
      }
    }

    console.error('Erro no serviço de produtos:', error);
    return throwError(() => new Error(errorMessage));
  }
}

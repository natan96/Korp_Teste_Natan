import { HttpClient, HttpErrorResponse } from '@angular/common/http';
import { Injectable } from '@angular/core';
import { BehaviorSubject, Observable, throwError, timer } from 'rxjs';
import { catchError, retry, tap } from 'rxjs/operators';
import { environment } from '../../environments/environment';
import { CriarNotaFiscalDto, NotaFiscal } from '../models/models';

@Injectable({
  providedIn: 'root'
})
export class NotaFiscalService {
  private apiUrl = environment.faturamentoApiUrl;
  private notasSubject = new BehaviorSubject<NotaFiscal[]>([]);
  public notas$ = this.notasSubject.asObservable();

  constructor(private http: HttpClient) {}

  getAll(): Observable<NotaFiscal[]> {
    return this.http.get<NotaFiscal[]>(this.apiUrl).pipe(
      retry(2),
      tap(notas => this.notasSubject.next(notas)),
      catchError(this.handleError)
    );
  }

  getById(id: number): Observable<NotaFiscal> {
    return this.http.get<NotaFiscal>(`${this.apiUrl}/${id}`).pipe(
      retry(1),
      catchError(this.handleError)
    );
  }

  create(nota: CriarNotaFiscalDto): Observable<NotaFiscal> {
    return this.http.post<NotaFiscal>(this.apiUrl, nota).pipe(
      tap(() => this.refreshList()),
      catchError(this.handleError)
    );
  }

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

  checkEstoqueStatus(): Observable<any> {
    return this.http.get(`${this.apiUrl}/estoque/status`).pipe(
      catchError(() => throwError(() => new Error('Não foi possível verificar status')))
    );
  }

  checkHealth(): Observable<any> {
    return this.http.get(`${this.apiUrl}/health`).pipe(
      catchError(() => throwError(() => new Error('Serviço indisponível')))
    );
  }

  private refreshList(): void {
    this.getAll().subscribe();
  }

  private handleError(error: HttpErrorResponse): Observable<never> {
    let errorMessage = 'Ocorreu um erro desconhecido';

    if (error.error instanceof ErrorEvent) {
      errorMessage = `Erro: ${error.error.message}`;
    } else {
      if (error.status === 0) {
        errorMessage = 'Não foi possível conectar ao servidor de faturamento.';
      } else if (error.status === 404) {
        errorMessage = 'Nota fiscal não encontrada.';
      } else if (error.status === 400) {
        errorMessage = error.error?.message || 'Dados inválidos.';
      } else if (error.status === 503) {
        errorMessage = error.error?.message || error.error?.detail ||
                      'Serviço temporariamente indisponível. Tente novamente.';
      } else if (error.status === 500) {
        errorMessage = 'Erro interno do servidor de faturamento.';
      } else {
        errorMessage = error.error?.message || `Erro ${error.status}: ${error.statusText}`;
      }
    }

    console.error('Erro no serviço de notas fiscais:', error);
    return throwError(() => new Error(errorMessage));
  }
}

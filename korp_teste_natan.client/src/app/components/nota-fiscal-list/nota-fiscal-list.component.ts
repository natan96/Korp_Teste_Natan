import { Component, computed, inject, OnDestroy, OnInit, signal } from '@angular/core';
import { MatDialog } from '@angular/material/dialog';
import { MatSnackBar } from '@angular/material/snack-bar';
import { Subject } from 'rxjs';
import { finalize, takeUntil } from 'rxjs/operators';
import { KeyStatusClass } from 'src/app/utils/data';
import { NotaFiscal } from '../../models/models';
import { NotaFiscalService } from '../../services/nota-fiscal.service';
import { ConfirmDialogComponent } from '../dialogs/confirm-dialog/confirm-dialog.component';
import { NotaFiscalDetailDialogComponent } from '../dialogs/nota-fiscal-detail-dialog/nota-fiscal-detail-dialog.component';

@Component({
  selector: 'app-nota-fiscal-list',
  templateUrl: './nota-fiscal-list.component.html',
  styleUrls: ['./nota-fiscal-list.component.css']
})
export class NotaFiscalListComponent implements OnInit, OnDestroy {
  private snackBar = inject(MatSnackBar);
  private dialog = inject(MatDialog);
  private notaFiscalService = inject(NotaFiscalService);

  private destroy$ = new Subject<void>();

  notasFiscais = signal<NotaFiscal[]>([]);
  displayedColumns: string[] = ['numero', 'status', 'dataEmissao', 'totalItens', 'acoes'];
  loading = false;
  private imprimindoMapSignal = signal<Map<number, boolean>>(new Map());
  keyStatusClass = KeyStatusClass;

  // Filtros
  filtroStatus = signal<number>(-1);

  // Computed para notas filtradas
  notasFiscaisFiltradas = computed(() => {
    let notas = this.notasFiscais();

    // Filtro por status
    const status = this.filtroStatus();
    if (status !== -1) {
      notas = notas.filter(n => n.status === status);
    }

    return notas;
  });

  // Computed signals
  countNotasAbertas = computed(() =>
    this.notasFiscais().filter(n => n.status === 0).length
  );

  countNotasFechadas = computed(() =>
    this.notasFiscais().filter(n => n.status === 1).length
  );

  sumNotasItems = computed(() => {
    const keyNotasItems = new Map<number, number>();
    this.notasFiscais().forEach(nota => {
      const totalItens = nota.itens?.reduce((sum, item) => sum + item.quantidade, 0) || 0;
      keyNotasItems.set(nota.id, totalItens);
    });
    return keyNotasItems;
  });

  // Impressão
  isImprimindoMap = computed(() => {
    const map = new Map<number, boolean>();
    this.imprimindoMapSignal().forEach((value, key) => {
      map.set(key, value);
    });
    return map;
  });

  podeImprimirMap = computed(() => {
    const map = new Map<number, boolean>();
    const imprimindo = this.imprimindoMapSignal();
    this.notasFiscaisFiltradas().forEach(nota => {
      map.set(nota.id, nota.status === 0 && !imprimindo.get(nota.id));
    });
    return map;
  });

  isImprimindo = (id: number) => this.isImprimindoMap().get(id) || false;
  podeImprimir = (notaFiscal: NotaFiscal) => this.podeImprimirMap().get(notaFiscal.id) || false;


  ngOnInit(): void {
    this.loadNotasFiscais();

    this.notaFiscalService.notas$
      .pipe(takeUntil(this.destroy$))
      .subscribe(notas => {
        this.notasFiscais.set(notas);
      });
  }

  ngOnDestroy(): void {
    this.destroy$.next();
    this.destroy$.complete();
  }

  loadNotasFiscais(): void {
    this.loading = true;
    this.notaFiscalService.getAll()
      .pipe(
        takeUntil(this.destroy$),
        finalize(() => this.loading = false)
      )
      .subscribe({
        next: (notas) => {
          this.notasFiscais.set(notas);
        },
        error: (error) => {
          console.error(error);
          this.showError('Erro ao carregar notas fiscais');
        }
      });
  }

  onFiltroStatusChange(status: number): void {
    this.filtroStatus.set(status);
  }

  visualizarNota(notaFiscal: NotaFiscal): void {
    this.dialog.open(NotaFiscalDetailDialogComponent, {
      width: '700px',
      maxHeight: '90vh',
      data: { notaFiscal }
    });
  }

  imprimirNota(notaFiscal: NotaFiscal): void {
    if (notaFiscal.status !== 0) {
      this.showError('Apenas notas fiscais abertas podem ser impressas.');
      return;
    }

    const dialogRef = this.dialog.open(ConfirmDialogComponent, {
      width: '450px',
      data: {
        title: `Atenção`,
        message: `Confirma a impressão da Nota Fiscal ${notaFiscal.numero}?<br /><br />` +
                 `Esta ação irá:<br />` +
                 `• Atualizar o status para "Fechada"<br />` +
                 `• Baixar o estoque dos produtos<br />` +
                 `• Não poderá ser desfeita`,
        confirmText: 'Imprimir',
        cancelText: 'Cancelar'
      }
    });

    dialogRef.afterClosed().subscribe(confirmed => {
      if (!confirmed) {
        return;
      }

      this.imprimindoMapSignal.update(map => {
        const newMap = new Map(map);
        newMap.set(notaFiscal.id, true);
        return newMap;
      });
      this.showInfo('Processando impressão... Aguarde.');

      this.notaFiscalService.imprimir(notaFiscal.id)
        .pipe(
          takeUntil(this.destroy$),
          finalize(() => {
            this.imprimindoMapSignal.update(map => {
              const newMap = new Map(map);
              newMap.delete(notaFiscal.id);
              return newMap;
            });
          })
        ).subscribe({
          next: (response) => {
            this.showSuccess(
              `Nota Fiscal ${notaFiscal.numero} impressa com sucesso!\n` +
              `Status: ${this.keyStatusClass[response.notaFiscal.status].label}\n` +
              `Estoque atualizado.`
            );
          },
          error: (error) => {
            console.error(error.message);
            let errorMsg = 'Erro ao imprimir nota fiscal.';

            if (error.message.includes('indisponível')) {
              errorMsg += '\n\nO serviço de estoque está temporariamente indisponível. ' +
                         'A operação será tentada automaticamente.';
            }

            this.showError(errorMsg);
          }
        });
    });
  }

  private showSuccess(message: string): void {
    this.snackBar.open(message, 'Fechar', {
      duration: 5000,
      panelClass: ['success-snackbar']
    });
  }

  private showError(message: string): void {
    this.snackBar.open(message, 'Fechar', {
      duration: 8000,
      panelClass: ['error-snackbar']
    });
  }

  private showInfo(message: string): void {
    this.snackBar.open(message, 'Fechar', {
      duration: 3000,
      panelClass: ['info-snackbar']
    });
  }
}

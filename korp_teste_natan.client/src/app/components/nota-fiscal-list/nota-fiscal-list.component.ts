import { CommonModule } from '@angular/common';
import {
  Component,
  computed,
  inject,
  OnDestroy,
  OnInit,
  signal,
} from '@angular/core';
import { FormsModule } from '@angular/forms';
import { NotaFiscalDetailDialogComponent } from '@components/dialogs/nota-fiscal-detail-dialog/nota-fiscal-detail-dialog.component';
import { NotaFiscal } from '@models/nota-fiscal';
import { NotaFiscalService } from '@services/nota-fiscal.service';
import { KeyStatusClass } from '@utils/data';
import { ConfirmationService, MessageService } from 'primeng/api';
import { ButtonModule } from 'primeng/button';
import { CardModule } from 'primeng/card';
import { ConfirmDialogModule } from 'primeng/confirmdialog';
import { DropdownModule } from 'primeng/dropdown';
import { DialogService, DynamicDialogRef } from 'primeng/dynamicdialog';
import { ProgressSpinnerModule } from 'primeng/progressspinner';
import { TableLazyLoadEvent, TableModule } from 'primeng/table';
import { TagModule } from 'primeng/tag';
import { ToastModule } from 'primeng/toast';
import { TooltipModule } from 'primeng/tooltip';
import { Subject } from 'rxjs';
import { finalize, takeUntil } from 'rxjs/operators';

@Component({
  selector: 'app-nota-fiscal-list',
  standalone: true,
  imports: [
    CommonModule,
    FormsModule,
    CardModule,
    DropdownModule,
    TagModule,
    ProgressSpinnerModule,
    TableModule,
    ButtonModule,
    ToastModule,
    TooltipModule,
    ConfirmDialogModule,
  ],
  providers: [MessageService, DialogService, ConfirmationService],
  templateUrl: './nota-fiscal-list.component.html',
  styleUrls: ['./nota-fiscal-list.component.css'],
})
export class NotaFiscalListComponent implements OnInit, OnDestroy {
  private messageService = inject(MessageService);
  private dialogService = inject(DialogService);
  private confirmationService = inject(ConfirmationService);
  private notaFiscalService = inject(NotaFiscalService);

  private destroy$ = new Subject<void>();
  ref: DynamicDialogRef | undefined;

  notasFiscais = signal<NotaFiscal[]>([]);
  totalRecords = signal<number>(0);
  first: number = 0;
  private currentPage: number = 1;
  private currentPageSize: number = 10;
  displayedColumns: string[] = [
    'numero',
    'status',
    'dataEmissao',
    'totalItens',
    'acoes',
  ];
  loading = false;
  private imprimindoMapSignal = signal<Map<number, boolean>>(new Map());
  keyStatusClass = KeyStatusClass;

  filtroStatus = signal<number>(-1);
  filtroStatusValue: number = -1;
  statusOptions = [
    { label: 'Todas', value: -1 },
    { label: 'Abertas', value: 0 },
    { label: 'Fechadas', value: 1 },
  ];

  notasFiscaisFiltradas = computed(() => this.notasFiscais());

  countNotasAbertas = signal<number>(0);
  countNotasFechadas = signal<number>(0);

  sumNotasItems = computed(() => {
    const keyNotasItems = new Map<number, number>();
    this.notasFiscais().forEach((nota) => {
      const totalItens =
        nota.itens?.reduce((sum, item) => sum + item.quantidade, 0) || 0;
      keyNotasItems.set(nota.id, totalItens);
    });
    return keyNotasItems;
  });

  // Total de itens filtrados
  totalItensFiltrados = computed(() => {
    return this.notasFiscaisFiltradas().reduce(
      (sum, n) => sum + (this.sumNotasItems().get(n.id) || 0),
      0,
    );
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
    this.notasFiscaisFiltradas().forEach((nota) => {
      map.set(nota.id, nota.status === 0 && !imprimindo.get(nota.id));
    });
    return map;
  });

  isImprimindo = (id: number) => this.isImprimindoMap().get(id) || false;
  podeImprimir = (notaFiscal: NotaFiscal) =>
    this.podeImprimirMap().get(notaFiscal.id) || false;

  ngOnInit(): void {
    this.loadNotasFiscais();
  }

  ngOnDestroy(): void {
    this.destroy$.next();
    this.destroy$.complete();
  }

  loadNotasFiscais(): void {
    this.loadPage(1, this.currentPageSize);
  }

  onLazyLoad(event: TableLazyLoadEvent): void {
    const page = Math.floor((event.first ?? 0) / (event.rows ?? 10)) + 1;
    const pageSize = event.rows ?? 10;
    this.currentPage = page;
    this.currentPageSize = pageSize;
    this.loadPage(page, pageSize);
  }

  loadPage(page: number, pageSize: number): void {
    this.loading = true;
    const status = this.filtroStatus() !== -1 ? this.filtroStatus() : undefined;

    this.notaFiscalService
      .getPaged(page, pageSize, status)
      .pipe(
        takeUntil(this.destroy$),
        finalize(() => (this.loading = false)),
      )
      .subscribe({
        next: (result) => {
          this.notasFiscais.set(result.items);
          this.totalRecords.set(result.totalCount);
          this.countNotasAbertas.set(result.totalAbertas);
          this.countNotasFechadas.set(result.totalFechadas);
          this.currentPage = page;
          this.currentPageSize = pageSize;
        },
        error: (error) => {
          console.error(error);
          this.showError('Erro ao carregar notas fiscais');
        },
      });
  }

  onFiltroStatusChange(status: number): void {
    this.filtroStatus.set(status);
    this.filtroStatusValue = status;
    this.first = 0;
    this.loadPage(1, this.currentPageSize);
  }

  visualizarNota(notaFiscal: NotaFiscal): void {
    this.ref = this.dialogService.open(NotaFiscalDetailDialogComponent, {
      header: `Nota Fiscal ${notaFiscal.numero}`,
      width: '90vw',
      modal: true,
      dismissableMask: true,
      baseZIndex: 10000,
      styleClass: 'nota-fiscal-detail-dialog',
      data: { notaFiscal },
    });
  }

  imprimirNota(notaFiscal: NotaFiscal): void {
    if (notaFiscal.status !== 0) {
      this.showError('Apenas notas fiscais abertas podem ser impressas.');
      return;
    }

    this.confirmationService.confirm({
      message:
        `Confirma a impressão da Nota Fiscal ${notaFiscal.numero}?<br /><br />` +
        `Esta ação irá:<br />` +
        `• Atualizar o status para "Fechada"<br />` +
        `• Baixar o estoque dos produtos<br />` +
        `• Não poderá ser desfeita`,
      header: 'Atenção',
      icon: 'pi pi-exclamation-triangle',
      accept: () => {
        this.imprimindoMapSignal.update((map) => {
          const newMap = new Map(map);
          newMap.set(notaFiscal.id, true);
          return newMap;
        });
        this.showInfo('Processando impressão... Aguarde.');

        this.notaFiscalService
          .imprimir(notaFiscal.id)
          .pipe(
            takeUntil(this.destroy$),
            finalize(() => {
              this.imprimindoMapSignal.update((map) => {
                const newMap = new Map(map);
                newMap.delete(notaFiscal.id);
                return newMap;
              });
            }),
          )
          .subscribe({
            next: (response) => {
              this.showSuccess(
                `Nota Fiscal ${notaFiscal.numero} impressa com sucesso!\n` +
                  `Status: ${this.keyStatusClass[response.notaFiscal.status].label}\n` +
                  `Estoque atualizado.`,
              );
              this.loadPage(this.currentPage, this.currentPageSize);
            },
            error: (error) => {
              console.error(error.message);
              let errorMsg = 'Erro ao imprimir nota fiscal.';

              if (error.message.includes('indisponível')) {
                errorMsg +=
                  '\n\nO serviço de estoque está temporariamente indisponível. ' +
                  'A operação será tentada automaticamente.';
              }

              this.showError(errorMsg);
            },
          });
      },
    });
  }

  private showSuccess(message: string): void {
    this.messageService.add({
      severity: 'success',
      summary: 'Sucesso',
      detail: message,
      life: 5000,
    });
  }

  private showError(message: string): void {
    this.messageService.add({
      severity: 'error',
      summary: 'Erro',
      detail: message,
      life: 8000,
    });
  }

  private showInfo(message: string): void {
    this.messageService.add({
      severity: 'info',
      summary: 'Info',
      detail: message,
      life: 3000,
    });
  }
}

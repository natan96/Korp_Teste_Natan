import { CommonModule } from '@angular/common';
import { Component, inject, OnDestroy, OnInit } from '@angular/core';
import {
  FormArray,
  FormBuilder,
  FormGroup,
  FormsModule,
  ReactiveFormsModule,
  Validators,
} from '@angular/forms';
import { Router } from '@angular/router';
import { ItemNotaFiscal } from '@models/nota-fiscal';
import { Produto } from '@models/produto';
import { NotaFiscalService } from '@services/nota-fiscal.service';
import { ProdutoService } from '@services/produto.service';
import { ConfirmationService, MessageService } from 'primeng/api';
import { ButtonModule } from 'primeng/button';
import { CardModule } from 'primeng/card';
import { ConfirmDialogModule } from 'primeng/confirmdialog';
import { DropdownModule } from 'primeng/dropdown';
import { InputNumberModule } from 'primeng/inputnumber';
import { InputTextModule } from 'primeng/inputtext';
import { ProgressSpinnerModule } from 'primeng/progressspinner';
import { TagModule } from 'primeng/tag';
import { ToastModule } from 'primeng/toast';
import { TooltipModule } from 'primeng/tooltip';
import { Subject } from 'rxjs';
import { debounceTime, distinctUntilChanged, takeUntil } from 'rxjs/operators';

@Component({
  selector: 'app-nota-fiscal-form',
  standalone: true,
  imports: [
    CommonModule,
    FormsModule,
    ReactiveFormsModule,
    CardModule,
    DropdownModule,
    InputNumberModule,
    InputTextModule,
    ButtonModule,
    ProgressSpinnerModule,
    TagModule,
    ToastModule,
    TooltipModule,
    ConfirmDialogModule,
  ],
  providers: [MessageService, ConfirmationService],
  templateUrl: './nota-fiscal-form.component.html',
  styleUrls: ['./nota-fiscal-form.component.css'],
})
export class NotaFiscalFormComponent implements OnInit, OnDestroy {
  private produtoService = inject(ProdutoService);
  private notaFiscalService = inject(NotaFiscalService);
  private messageService = inject(MessageService);
  private confirmationService = inject(ConfirmationService);
  private router = inject(Router);

  private destroy$ = new Subject<void>();
  private searchSubject$ = new Subject<string>();

  notaForm = new FormBuilder().group({
    itens: new FormBuilder().array([]),
  });

  // Controle de produtos disponíveis
  produtosDisponiveis: Produto[] = [];
  searchTerm = '';
  currentPage = 1;
  pageSize = 10;
  totalProducts = 0;
  hasMoreProducts = false;
  loadingProducts = false;

  loading = false;
  estoqueDisponivel = true;
  isFormDisabled = true;

  ngOnInit(): void {
    this.checkEstoqueService();
    this.loadProdutos();

    // Setup search debounce
    this.searchSubject$
      .pipe(debounceTime(300), distinctUntilChanged(), takeUntil(this.destroy$))
      .subscribe((term) => {
        this.searchTerm = term;
        this.currentPage = 1;
        this.loadProdutos();
      });

    this.notaForm.statusChanges.pipe(takeUntil(this.destroy$)).subscribe(() => {
      setTimeout(() => this.updateFormDisabled(), 0);
    });

    setTimeout(() => this.updateFormDisabled(), 0);
  }

  ngOnDestroy(): void {
    this.destroy$.next();
    this.destroy$.complete();
  }

  get itens(): FormArray {
    return this.notaForm.get('itens') as FormArray;
  }

  private updateFormDisabled(): void {
    this.isFormDisabled =
      this.notaForm.invalid ||
      this.loading ||
      !this.estoqueDisponivel ||
      this.itens.length === 0;
  }

  onSearchChange(term: string): void {
    this.searchSubject$.next(term);
  }

  loadProdutos(loadMore = false): void {
    if (this.loadingProducts) return;

    this.loadingProducts = true;

    this.produtoService
      .getPaged(this.currentPage, this.pageSize, this.searchTerm)
      .pipe(takeUntil(this.destroy$))
      .subscribe({
        next: (result) => {
          if (loadMore) {
            this.produtosDisponiveis = [
              ...this.produtosDisponiveis,
              ...result.items,
            ];
          } else {
            this.produtosDisponiveis = result.items;
          }

          this.totalProducts = result.totalCount;
          this.hasMoreProducts =
            this.produtosDisponiveis.length < result.totalCount;
          this.loadingProducts = false;
        },
        error: (error) => {
          console.error(error);
          this.showError('Erro ao carregar produtos');
          this.loadingProducts = false;
        },
      });
  }

  loadMoreProdutos(): void {
    if (!this.hasMoreProducts || this.loadingProducts) return;

    this.currentPage++;
    this.loadProdutos(true);
  }

  checkEstoqueService(): void {
    this.notaFiscalService
      .checkEstoqueStatus()
      .pipe(takeUntil(this.destroy$))
      .subscribe({
        next: (status) => {
          this.estoqueDisponivel = status.estoqueServiceDisponivel;
          if (!this.estoqueDisponivel) {
            this.showError('Serviço de estoque indisponível. Aguarde...');
          }
        },
        error: () => {
          this.estoqueDisponivel = false;
        },
      });
  }

  createItemFormGroup(produto?: Produto): FormGroup {
    return new FormBuilder().group({
      produtoId: [produto?.id || null, Validators.required],
      codigo: [produto?.codigo || '', Validators.required],
      descricao: [produto?.descricao || '', Validators.required],
      saldoDisponivel: [produto?.saldo || 0],
      quantidade: [1, [Validators.required, Validators.min(1)]],
    });
  }

  addProdutoToNota(produto: Produto): void {
    if (this.isProdutoAdicionado(produto.id)) {
      this.showError('Produto já adicionado à nota fiscal');
      return;
    }

    if (produto.saldo < 1) {
      this.showError('Produto sem saldo disponível');
      return;
    }

    this.itens.push(this.createItemFormGroup(produto));
    this.showSuccess(`${produto.codigo} adicionado à nota fiscal`);
  }

  isProdutoAdicionado(produtoId: number): boolean {
    return this.itens.controls.some(
      (item) => item.get('produtoId')?.value === produtoId,
    );
  }

  removeItem(index: number): void {
    const item = this.itens.at(index);
    const codigo = item.get('codigo')?.value;

    this.confirmationService.confirm({
      message: `Deseja remover ${codigo} da nota fiscal?`,
      header: 'Confirmar remoção',
      icon: 'pi pi-exclamation-triangle',
      acceptLabel: 'Sim',
      rejectLabel: 'Não',
      acceptButtonStyleClass: 'p-button-danger',
      accept: () => {
        this.itens.removeAt(index);
        this.showSuccess('Produto removido da nota fiscal');
      },
    });
  }

  getSaldoDisponivel(index: number): number {
    return this.itens.at(index).get('saldoDisponivel')?.value || 0;
  }

  getCodigo(index: number): string {
    return this.itens.at(index).get('codigo')?.value || '';
  }

  getDescricao(index: number): string {
    return this.itens.at(index).get('descricao')?.value || '';
  }

  validateQuantidade(index: number): void {
    const item = this.itens.at(index);
    const quantidade = item.get('quantidade')?.value;
    const saldoDisponivel = this.getSaldoDisponivel(index);

    if (quantidade > saldoDisponivel) {
      item.get('quantidade')?.setValue(saldoDisponivel);
      this.showError(
        `Quantidade ajustada para o saldo disponível: ${saldoDisponivel}`,
      );
    }
  }

  onSubmit(): void {
    if (this.notaForm.invalid) {
      this.showError('Preencha todos os campos obrigatórios');
      return;
    }

    if (this.itens.length === 0) {
      this.showError('Adicione pelo menos um item à nota fiscal');
      return;
    }

    this.loading = true;

    const notaData = {
      itens: this.itens.value.map((item: any) => {
        return {
          produtoId: item.produtoId,
          codigoProduto: item.codigo,
          descricaoProduto: item.descricao,
          quantidade: item.quantidade,
        } as ItemNotaFiscal;
      }),
    };

    this.notaFiscalService
      .create(notaData)
      .pipe(takeUntil(this.destroy$))
      .subscribe({
        next: (nota) => {
          this.showSuccess(`Nota Fiscal ${nota.numero} criada com sucesso!`);
          setTimeout(() => {
            this.router.navigate(['/notas']);
          }, 1500);
        },
        error: (error) => {
          console.error(error);
          this.showError('Erro ao criar nota fiscal');
          this.loading = false;
        },
      });
  }

  cancel(): void {
    this.confirmationService.confirm({
      message:
        'Deseja realmente cancelar a criação da nota fiscal? Todos os dados preenchidos serão perdidos.',
      header: 'Confirmar cancelamento',
      icon: 'pi pi-exclamation-triangle',
      acceptLabel: 'Cancelar',
      rejectLabel: 'Não',
      acceptButtonStyleClass: 'p-button-danger',
      rejectButtonStyleClass: 'p-button-secondary p-button-outlined',
      accept: () => {
        this.router.navigate(['/notas']);
      },
    });
  }

  getTotalQuantidade(): number {
    return this.itens.controls.reduce((sum, item) => {
      return sum + (item.get('quantidade')?.value || 0);
    }, 0);
  }

  private showSuccess(message: string): void {
    this.messageService.add({
      severity: 'success',
      summary: 'Sucesso',
      detail: message,
      life: 3000,
    });
  }

  private showError(message: string): void {
    this.messageService.add({
      severity: 'error',
      summary: 'Erro',
      detail: message,
      life: 5000,
    });
  }
}

import { CommonModule } from '@angular/common';
import { Component, inject, OnDestroy } from '@angular/core';
import {
  FormBuilder,
  FormGroup,
  FormsModule,
  ReactiveFormsModule,
  Validators,
} from '@angular/forms';
import { Produto } from '@models/produto';
import { ProdutoService } from '@services/produto.service';
import { MessageService } from 'primeng/api';
import { ButtonModule } from 'primeng/button';
import { CardModule } from 'primeng/card';
import { InputTextModule } from 'primeng/inputtext';
import { ProgressSpinnerModule } from 'primeng/progressspinner';
import { TableLazyLoadEvent, TableModule } from 'primeng/table';
import { TagModule } from 'primeng/tag';
import { ToastModule } from 'primeng/toast';
import { TooltipModule } from 'primeng/tooltip';
import { lastValueFrom, Subject } from 'rxjs';
import { takeUntil } from 'rxjs/operators';

@Component({
  selector: 'app-produtos',
  standalone: true,
  imports: [
    CommonModule,
    ReactiveFormsModule,
    FormsModule,
    CardModule,
    InputTextModule,
    ButtonModule,
    TableModule,
    TagModule,
    ProgressSpinnerModule,
    TooltipModule,
    ToastModule,
  ],
  providers: [MessageService],
  templateUrl: './produtos.component.html',
  styleUrls: ['./produtos.component.css'],
})
export class ProdutosComponent implements OnDestroy {
  private produtoService = inject(ProdutoService);
  private messageService = inject(MessageService);

  produtos: Produto[] = [];
  totalRecords: number = 0;
  first: number = 0;
  private currentPage: number = 1;
  private currentPageSize: number = 10;
  private searchTimeout: any;
  filtro: string = '';
  produtoForm: FormGroup = new FormBuilder().group({
    codigo: ['', [Validators.required, Validators.maxLength(50)]],
    descricao: ['', [Validators.required, Validators.maxLength(200)]],
    saldo: [0, [Validators.required, Validators.min(0)]],
  });
  displayedColumns: string[] = ['codigo', 'descricao', 'saldo', 'acoes'];
  loading = false;
  editMode = false;
  editingId: number | null = null;

  private destroy$ = new Subject<void>();

  ngOnDestroy(): void {
    this.destroy$.next();
    this.destroy$.complete();
    if (this.searchTimeout) {
      clearTimeout(this.searchTimeout);
    }
  }

  onLazyLoad(event: TableLazyLoadEvent): void {
    const page = Math.floor((event.first ?? 0) / (event.rows ?? 10)) + 1;
    const pageSize = event.rows ?? 10;
    this.currentPage = page;
    this.currentPageSize = pageSize;
    this.loadPage(page, pageSize, this.filtro);
  }

  onFiltroChange(): void {
    clearTimeout(this.searchTimeout);
    this.searchTimeout = setTimeout(() => {
      this.first = 0;
      this.currentPage = 1;
      this.loadPage(1, this.currentPageSize, this.filtro);
    }, 400);
  }

  loadPage(page: number, pageSize: number, search?: string): void {
    this.loading = true;
    this.produtoService
      .getPaged(page, pageSize, search)
      .pipe(takeUntil(this.destroy$))
      .subscribe({
        next: (result) => {
          this.produtos = result.items;
          this.totalRecords = result.totalCount;
          this.loading = false;
        },
        error: (error) => {
          console.error(error);
          this.showError('Erro ao carregar produtos');
          this.loading = false;
        },
      });
  }

  async onSubmit(): Promise<void> {
    if (this.produtoForm.invalid) {
      return;
    }

    this.loading = true;

    const verificarCodigo = await lastValueFrom(
      this.produtoService.verificarCodigo(
        this.produtoForm.value.codigo,
        this.editMode ? this.editingId! : undefined,
      ),
    );

    if (verificarCodigo.existe) {
      this.showError(
        `O código "${verificarCodigo.codigo}" já está em uso por outro produto.`,
      );
      this.loading = false;
      return;
    }

    const produtoData = this.produtoForm.value;

    const operation =
      this.editMode && this.editingId
        ? this.produtoService.update(this.editingId, produtoData)
        : this.produtoService.create(produtoData);

    operation.pipe(takeUntil(this.destroy$)).subscribe({
      next: () => {
        this.showSuccess(
          this.editMode
            ? 'Produto atualizado com sucesso!'
            : 'Produto criado com sucesso!',
        );
        this.resetForm();
        this.loading = false;
        this.first = 0;
        this.currentPage = 1;
        this.loadPage(1, this.currentPageSize, this.filtro);
      },
      error: (error) => {
        console.error(error);
        this.showError('Erro ao salvar produto');
        this.loading = false;
      },
    });
  }

  editProduto(produto: Produto): void {
    this.editMode = true;
    this.editingId = produto.id;
    this.produtoForm.patchValue({
      codigo: produto.codigo,
      descricao: produto.descricao,
      saldo: produto.saldo,
    });

    Object.keys(this.produtoForm.controls).forEach((key) => {
      this.produtoForm.get(key)?.markAsTouched();
    });

    window.scrollTo({ top: 0, behavior: 'smooth' });
  }

  resetForm(): void {
    this.editMode = false;
    this.editingId = null;

    this.produtoForm.reset({
      codigo: '',
      descricao: '',
      saldo: 0,
    });

    Object.keys(this.produtoForm.controls).forEach((key) => {
      this.produtoForm.get(key)?.markAsUntouched();
      this.produtoForm.get(key)?.markAsPristine();
    });
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

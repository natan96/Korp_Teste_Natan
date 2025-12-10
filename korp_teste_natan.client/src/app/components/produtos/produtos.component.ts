import { Component, inject, OnDestroy, OnInit } from '@angular/core';
import { FormBuilder, FormGroup, Validators } from '@angular/forms';
import { MatSnackBar } from '@angular/material/snack-bar';
import { lastValueFrom, Subject } from 'rxjs';
import { takeUntil } from 'rxjs/operators';
import { Produto } from '../../models/models';
import { ProdutoService } from '../../services/produto.service';

@Component({
  selector: 'app-produtos',
  templateUrl: './produtos.component.html',
  styleUrls: ['./produtos.component.css']
})
export class ProdutosComponent implements OnInit, OnDestroy {
  private produtoService = inject(ProdutoService);
  private snackBar = inject(MatSnackBar);

  produtos: Produto[] = [];
  produtosFiltrados: Produto[] = [];
  filtro: string = '';
  produtoForm: FormGroup = new FormBuilder().group({
      codigo: ['', [Validators.required, Validators.maxLength(50)]],
      descricao: ['', [Validators.required, Validators.maxLength(200)]],
      saldo: [0, [Validators.required, Validators.min(0)]]
    });
  displayedColumns: string[] = ['codigo', 'descricao', 'saldo', 'acoes'];
  loading = false;
  editMode = false;
  editingId: number | null = null;

  private destroy$ = new Subject<void>();

  ngOnInit(): void {
    this.loadProdutos();

    // Observa mudanças no subject de produtos (RxJS)
    this.produtoService.produtos$
      .pipe(takeUntil(this.destroy$))
      .subscribe(produtos => {
        this.produtos = produtos;
        this.aplicarFiltro();
      });
  }

  ngOnDestroy(): void {
    this.destroy$.next();
    this.destroy$.complete();
  }

  aplicarFiltro(): void {
    const filtroLower = this.filtro.toLowerCase().trim();

    if (!filtroLower) {
      this.produtosFiltrados = this.produtos;
    } else {
      this.produtosFiltrados = this.produtos.filter(p =>
        p.codigo.toLowerCase().includes(filtroLower) ||
        p.descricao.toLowerCase().includes(filtroLower)
      );
    }
  }

  loadProdutos(): void {
    this.loading = true;
    this.produtoService.getAll()
      .pipe(takeUntil(this.destroy$))
      .subscribe({
        next: (produtos) => {
          this.produtos = produtos;
          this.aplicarFiltro();
          this.loading = false;
        },
        error: (error) => {
          console.error(error);
          this.showError('Erro ao carregar produtos');
          this.loading = false;
        }
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
        this.editMode ? this.editingId! : undefined
      )
    );

    if (verificarCodigo.existe) {
      this.showError(`O código "${verificarCodigo.codigo}" já está em uso por outro produto.`);
      this.loading = false;
      return;
    }

    const produtoData = this.produtoForm.value;

    const operation = this.editMode && this.editingId
      ? this.produtoService.update(this.editingId, produtoData)
      : this.produtoService.create(produtoData);

    operation
      .pipe(takeUntil(this.destroy$))
      .subscribe({
        next: () => {
          this.showSuccess(this.editMode ? 'Produto atualizado com sucesso!' : 'Produto criado com sucesso!');
          this.resetForm();
          this.loading = false;
        },
        error: (error) => {
          console.error(error);
          this.showError('Erro ao salvar produto');
          this.loading = false;
        }
      });
  }

  editProduto(produto: Produto): void {
    this.editMode = true;
    this.editingId = produto.id;
    this.produtoForm.patchValue({
      codigo: produto.codigo,
      descricao: produto.descricao,
      saldo: produto.saldo
    });

    // Rola a página para o topo
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }

  resetForm(): void {
    this.editMode = false;
    this.editingId = null;

    this.produtoForm.reset();
    this.produtoForm.patchValue({
      codigo: '',
      descricao: '',
      saldo: 0
    });

    Object.keys(this.produtoForm.controls).forEach(key => {
      this.produtoForm.get(key)?.setErrors(null);
      this.produtoForm.get(key)?.markAsUntouched();
      this.produtoForm.get(key)?.markAsPristine();
    });

    this.produtoForm.updateValueAndValidity();
  }

  private showSuccess(message: string): void {
    this.snackBar.open(message, 'Fechar', {
      duration: 3000,
      panelClass: ['success-snackbar']
    });
  }

  private showError(message: string): void {
    this.snackBar.open(message, 'Fechar', {
      duration: 5000,
      panelClass: ['error-snackbar']
    });
  }
}

import { Component, inject, OnDestroy, OnInit } from '@angular/core';
import { FormArray, FormBuilder, FormGroup, Validators } from '@angular/forms';
import { MatSnackBar } from '@angular/material/snack-bar';
import { Router } from '@angular/router';
import { Subject } from 'rxjs';
import { takeUntil } from 'rxjs/operators';
import { ItemNotaFiscal, Produto } from '../../models/models';
import { NotaFiscalService } from '../../services/nota-fiscal.service';
import { ProdutoService } from '../../services/produto.service';

@Component({
  selector: 'app-nota-fiscal-form',
  templateUrl: './nota-fiscal-form.component.html',
  styleUrls: ['./nota-fiscal-form.component.css']
})
export class NotaFiscalFormComponent implements OnInit, OnDestroy {
  private produtoService = inject(ProdutoService);
  private notaFiscalService = inject(NotaFiscalService);
  private snackBar = inject(MatSnackBar);
  private router = inject(Router);

  private destroy$ = new Subject<void>();

  notaForm = new FormBuilder().group({
      itens: new FormBuilder().array([])
    });
  produtos: Produto[] = [];
  loading = false;
  estoqueDisponivel = true;
  isFormDisabled = true;

  ngOnInit(): void {
    this.loadProdutos();
    this.checkEstoqueService();
    this.addItem();

    // Observa mudanças no formulário com debounce para evitar NG0100
    this.notaForm.statusChanges
      .pipe(takeUntil(this.destroy$))
      .subscribe(() => {
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
    this.isFormDisabled = this.notaForm.invalid || this.loading || !this.estoqueDisponivel;
  }  loadProdutos(): void {
    this.produtoService.getAll()
      .pipe(takeUntil(this.destroy$))
      .subscribe({
        next: (produtos) => {
          this.produtos = produtos;
        },
        error: (error) => {
          console.error(error);
          this.showError('Erro ao carregar produtos');
        }
      });
  }

  checkEstoqueService(): void {
    this.notaFiscalService.checkEstoqueStatus()
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
        }
      });
  }

  createItemFormGroup(): FormGroup {
    return new FormBuilder().group({
      produtoId: [null, Validators.required],
      quantidade: [1, [Validators.required, Validators.min(1)]]
    });
  }

  addItem(): void {
    this.itens.push(this.createItemFormGroup());
  }

  removeItem(index: number): void {
    if (this.itens.length > 1) {
      this.itens.removeAt(index);
    } else {
      this.showError('Deve haver pelo menos um item na nota fiscal');
    }
  }

  getProduto(produtoId: number): Produto | undefined {
    return this.produtos.find(p => p.id === produtoId);
  }

  getSaldoDisponivel(index: number): number {
    const produtoId = this.itens.at(index).get('produtoId')?.value;
    if (!produtoId) return 0;

    const produto = this.getProduto(produtoId);
    return produto?.saldo || 0;
  }

  onProdutoChange(index: number): void {
    const item = this.itens.at(index);
    const produtoId = item.get('produtoId')?.value;
    const produto = this.getProduto(produtoId);

    if (produto && produto.saldo < 1) {
      this.showError(`Produto ${produto.codigo} sem saldo disponível`);
      // Usa setTimeout para evitar mudar o valor durante o change detection
      setTimeout(() => item.get('produtoId')?.setValue(null), 0);
    }
  }

  validateQuantidade(index: number): void {
    const item = this.itens.at(index);
    const quantidade = item.get('quantidade')?.value;
    const saldoDisponivel = this.getSaldoDisponivel(index);

    if (quantidade > saldoDisponivel) {
      item.get('quantidade')?.setValue(saldoDisponivel);
      this.showError(`Quantidade ajustada para o saldo disponível: ${saldoDisponivel}`);
    }
  }

  onSubmit(): void {
    debugger;
    if (this.notaForm.invalid) {
      this.showError('Preencha todos os campos obrigatórios');
      return;
    }

    if (this.itens.length === 0) {
      this.showError('Adicione pelo menos um item à nota fiscal');
      return;
    }

    // Validar saldo antes de enviar
    let erroSaldo = false;
    this.itens.controls.forEach((item, index) => {
      const produtoId = item.get('produtoId')?.value;
      const quantidade = item.get('quantidade')?.value;
      const produto = this.getProduto(produtoId);

      if (produto && quantidade > produto.saldo) {
        this.showError(`Item ${index + 1}: Saldo insuficiente para ${produto.codigo}`);
        erroSaldo = true;
      }
    });

    if (erroSaldo) return;

    this.loading = true;

    const notaData = {
      itens: this.itens.value.map((item: any) => {
        const produto = this.getProduto(item.produtoId)!;
        return {
          produtoId: item.produtoId,
          codigoProduto: produto.codigo,
          descricaoProduto: produto.descricao,
          quantidade: item.quantidade
        } as ItemNotaFiscal;
      })
    };

    this.notaFiscalService.create(notaData)
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
        }
      });
  }

  cancel(): void {
    if (confirm('Deseja cancelar a criação da nota fiscal?')) {
      this.router.navigate(['/notas']);
    }
  }

  getTotalQuantidade(): number {
    return this.itens.controls.reduce((sum, item) => {
      return sum + (item.get('quantidade')?.value || 0);
    }, 0);
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

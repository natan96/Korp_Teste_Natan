import { CommonModule } from '@angular/common';
import { Component, computed, inject, signal } from '@angular/core';
import { NotaFiscal } from '@models/nota-fiscal';
import { KeyStatusClass } from '@utils/data';
import { ButtonModule } from 'primeng/button';
import { DynamicDialogConfig, DynamicDialogRef } from 'primeng/dynamicdialog';
import { TableModule } from 'primeng/table';
import { TagModule } from 'primeng/tag';

@Component({
  selector: 'app-nota-fiscal-detail-dialog',
  standalone: true,
  imports: [CommonModule, TagModule, TableModule, ButtonModule],
  templateUrl: './nota-fiscal-detail-dialog.component.html',
  styleUrls: ['./nota-fiscal-detail-dialog.component.css'],
})
export class NotaFiscalDetailDialogComponent {
  ref = inject(DynamicDialogRef);
  config = inject(DynamicDialogConfig);

  notaFiscal = signal(this.config.data.notaFiscal as NotaFiscal);
  displayedColumns: string[] = ['codigo', 'descricao', 'quantidade'];
  keyStatusClass = KeyStatusClass;

  totalItens = computed(
    () =>
      this.notaFiscal().itens?.reduce(
        (sum, item) => sum + item.quantidade,
        0,
      ) || 0,
  );

  onClose = () => this.ref.close();
}

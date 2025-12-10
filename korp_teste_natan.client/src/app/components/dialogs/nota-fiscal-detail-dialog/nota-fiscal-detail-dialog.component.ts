import { Component, computed, inject, signal } from '@angular/core';
import { MAT_DIALOG_DATA, MatDialogRef } from '@angular/material/dialog';
import { KeyStatusClass } from 'src/app/utils/data';
import { NotaFiscal } from '../../../models/models';

@Component({
  selector: 'app-nota-fiscal-detail-dialog',
  templateUrl: './nota-fiscal-detail-dialog.component.html',
  styleUrls: ['./nota-fiscal-detail-dialog.component.css']
})
export class NotaFiscalDetailDialogComponent {
  dialogRef = inject(MatDialogRef<NotaFiscalDetailDialogComponent>);
  private data = inject<{ notaFiscal: NotaFiscal }>(MAT_DIALOG_DATA);

  notaFiscal = signal(this.data.notaFiscal);
  displayedColumns: string[] = ['codigo', 'descricao', 'quantidade'];
  keyStatusClass = KeyStatusClass;

  totalItens = computed(() =>
    this.notaFiscal().itens?.reduce((sum, item) => sum + item.quantidade, 0) || 0
  );

  onClose = () => this.dialogRef.close();
}

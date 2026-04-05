import { Routes } from '@angular/router';
import { NotaFiscalFormComponent } from './components/nota-fiscal-form/nota-fiscal-form.component';
import { NotaFiscalListComponent } from './components/nota-fiscal-list/nota-fiscal-list.component';
import { ProdutosComponent } from './components/produtos/produtos.component';

export const routes: Routes = [
  { path: '', redirectTo: '/produtos', pathMatch: 'full' },
  { path: 'produtos', component: ProdutosComponent },
  { path: 'notas', component: NotaFiscalListComponent },
  { path: 'notas/nova', component: NotaFiscalFormComponent },
];

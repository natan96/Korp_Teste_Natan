import { HTTP_INTERCEPTORS, HttpClientModule } from '@angular/common/http';
import { LOCALE_ID, NgModule } from '@angular/core';
import { FormsModule, ReactiveFormsModule } from '@angular/forms';
import { BrowserModule } from '@angular/platform-browser';
import { BrowserAnimationsModule } from '@angular/platform-browser/animations';
import { RouterModule } from '@angular/router';

// Angular Material Modules
import { MatButtonModule } from '@angular/material/button';
import { MatCardModule } from '@angular/material/card';
import { MatChipsModule } from '@angular/material/chips';
import { MatDialogModule } from '@angular/material/dialog';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatIconModule } from '@angular/material/icon';
import { MatInputModule } from '@angular/material/input';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { MatSelectModule } from '@angular/material/select';
import { MatSnackBarModule } from '@angular/material/snack-bar';
import { MatTableModule } from '@angular/material/table';
import { MatToolbarModule } from '@angular/material/toolbar';

import { AppComponent } from './app.component';
import { ConfirmDialogComponent } from './components/dialogs/confirm-dialog/confirm-dialog.component';
import { NotaFiscalDetailDialogComponent } from './components/dialogs/nota-fiscal-detail-dialog/nota-fiscal-detail-dialog.component';
import { NotaFiscalFormComponent } from './components/nota-fiscal-form/nota-fiscal-form.component';
import { NotaFiscalListComponent } from './components/nota-fiscal-list/nota-fiscal-list.component';
import { ProdutosComponent } from './components/produtos/produtos.component';

import { registerLocaleData } from '@angular/common';
import localePt from '@angular/common/locales/pt';
import { DateInterceptor } from './interceptors/date.interceptor';

registerLocaleData(localePt, 'pt-BR');

@NgModule({
  declarations: [
    AppComponent,
    ProdutosComponent,
    NotaFiscalListComponent,
    NotaFiscalFormComponent,
    ConfirmDialogComponent,
    NotaFiscalDetailDialogComponent
  ],
  imports: [
    BrowserModule,
    HttpClientModule,
    BrowserAnimationsModule,
    FormsModule,
    ReactiveFormsModule,
    RouterModule.forRoot([
      { path: '', redirectTo: '/produtos', pathMatch: 'full' },
      { path: 'produtos', component: ProdutosComponent },
      { path: 'notas', component: NotaFiscalListComponent },
      { path: 'notas/nova', component: NotaFiscalFormComponent }
    ]),
    // Material Modules
    MatToolbarModule,
    MatButtonModule,
    MatCardModule,
    MatInputModule,
    MatFormFieldModule,
    MatTableModule,
    MatIconModule,
    MatSelectModule,
    MatSnackBarModule,
    MatProgressSpinnerModule,
    MatDialogModule,
    MatChipsModule
  ],
  providers: [
    { provide: LOCALE_ID, useValue: 'pt-BR' },
    { provide: HTTP_INTERCEPTORS, useClass: DateInterceptor, multi: true }
  ],
  bootstrap: [AppComponent]
})
export class AppModule { }

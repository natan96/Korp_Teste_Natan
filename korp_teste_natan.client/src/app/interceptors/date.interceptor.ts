import { Injectable } from '@angular/core';
import { HttpEvent, HttpInterceptor, HttpHandler, HttpRequest, HttpResponse } from '@angular/common/http';
import { Observable } from 'rxjs';
import { map } from 'rxjs/operators';

@Injectable()
export class DateInterceptor implements HttpInterceptor {
  // Regex para detectar strings no formato ISO 8601
  private iso8601 = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(\.\d+)?$/;

  intercept(req: HttpRequest<any>, next: HttpHandler): Observable<HttpEvent<any>> {
    return next.handle(req).pipe(
      map((event: HttpEvent<any>) => {
        if (event instanceof HttpResponse) {
          const body = event.body;
          this.convertDates(body);
        }
        return event;
      })
    );
  }

  private convertDates(object: any): void {
    if (!object || typeof object !== 'object') {
      return;
    }

    for (const key of Object.keys(object)) {
      const value = object[key];

      if (typeof value === 'string' && this.iso8601.test(value)) {
        // Adiciona 'Z' para forçar interpretação como UTC
        object[key] = new Date(value + 'Z');
      } else if (typeof value === 'object') {
        this.convertDates(value);
      }
    }
  }
}

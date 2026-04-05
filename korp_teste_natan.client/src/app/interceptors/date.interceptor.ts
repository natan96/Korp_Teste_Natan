import { HttpInterceptorFn, HttpResponse } from '@angular/common/http';
import { map } from 'rxjs/operators';

// Regex para detectar strings no formato ISO 8601
const iso8601 = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(\.\d+)?$/;

function convertDates(object: any): void {
  if (!object || typeof object !== 'object') {
    return;
  }

  for (const key of Object.keys(object)) {
    const value = object[key];

    if (typeof value === 'string' && iso8601.test(value)) {
      // Adiciona 'Z' para forçar interpretação como UTC
      object[key] = new Date(value + 'Z');
    } else if (typeof value === 'object') {
      convertDates(value);
    }
  }
}

export const dateInterceptor: HttpInterceptorFn = (req, next) => {
  return next(req).pipe(
    map((event) => {
      if (event instanceof HttpResponse) {
        const body = event.body;
        convertDates(body);
      }
      return event;
    }),
  );
};

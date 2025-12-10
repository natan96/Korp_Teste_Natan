import { StatusNota } from '../models/models';

export const KeyStatusClass: Record<number, StatusNota> = {
    0: { class: 'status-aberta', label: 'Aberta' },
    1: { class: 'status-fechada', label: 'Fechada' }
  };

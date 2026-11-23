import type { LabelReading } from '../../domain/food/label';

const LABEL: Record<string, string> = {
  kcal: 'kcal',
  protein: 'proteine',
  carbs: 'carboidrati',
  fiber: 'fibre',
  fat: 'grassi',
};

export function readingNotice(r: LabelReading): string {
  const parts = ['Letto dalla foto: controlla nome e valori prima di salvare.'];
  if (r.unreadable.length) parts.push(`Non leggibili: ${r.unreadable.map((k) => LABEL[k]).join(', ')}.`);
  if (r.notes) parts.push(r.notes);
  return parts.join(' ');
}

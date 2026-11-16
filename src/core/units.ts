// Formatação de unidades e números (pt-BR).
export const fmt = (v: number, d = 2): string => (Number.isFinite(v) ? (Math.round(v * 10 ** d) / 10 ** d).toString() : '—');
export const fmtMM = (v: number, d = 2): string => `${fmt(v, d)} mm`;
export const brl = (v: number): string => 'R$ ' + (Number.isFinite(v) ? v : 0).toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
export const grams = (g: number): string => (g >= 1000 ? `${(g / 1000).toLocaleString('pt-BR', { maximumFractionDigits: 3 })} kg` : `${g.toLocaleString('pt-BR', { maximumFractionDigits: g < 10 ? 2 : 1 })} g`);
export const inchToMM = (i: number): number => i * 25.4;

/** Unidades aceitas na importação, com o fator para mm. */
export const IMPORT_UNITS: { id: string; label: string; toMM: number }[] = [
  { id: 'm', label: 'Metros (padrão glTF)', toMM: 1000 },
  { id: 'cm', label: 'Centímetros', toMM: 10 },
  { id: 'mm', label: 'Milímetros (CAD)', toMM: 1 },
  { id: 'in', label: 'Polegadas', toMM: 25.4 },
];

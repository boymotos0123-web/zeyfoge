// Lista de materiais (BOM), massa total e precificação.
import type { Cable, DocNode, Pricing, ZDocument } from './types';
import { isEffectivelyVisible } from './document';
import { materialOf } from './materials-db';

export interface BomRow {
  key: string;
  name: string;
  category: string;
  partNumber: string;
  supplier: string;
  qty: number;
  unitCost: number;
  unitMass: number;
  ids: string[];
}

export interface BomResult {
  rows: BomRow[];
  totalCost: number;
  totalMass: number;
  partCount: number;
  cableCount: number;
  cableLength: number;
}

export interface BomContext {
  /** categoria/nome do tipo de componente */
  describe: (n: DocNode) => { category: string };
  /** massa unitária (g) já resolvida (manual > biblioteca > volume×densidade) */
  massOf: (n: DocNode) => number;
  /** comprimento do cabo (mm) */
  cableLength: (c: Cable) => number;
}

/** Custo estimado de cabo por comprimento (R$). */
export function cableCost(c: Cable, lengthMM: number): number {
  if (c.cost != null) return c.cost;
  const m = lengthMM / 1000;
  switch (c.kind) {
    case 'fpc': return 2.5 + m * (c.conductors * 0.9 + 18);   // FPC sob medida: setup + por condutor
    case 'ribbon': return 1.5 + m * c.conductors * 0.35;
    case 'usb': return 8 + m * 12;
    default: return 0.15 + m * 1.2;                            // fio jumper / AWG 24
  }
}

/** Massa estimada de cabo (g) a partir das dimensões e materiais. */
export function cableMass(c: Cable, lengthMM: number): number {
  const L = lengthMM / 10; // cm
  if (c.kind === 'fpc') {
    const area = (c.width / 10) * (c.thickness / 10);
    return area * L * (materialOf('poliimida').density * 0.75 + materialOf('cobre').density * 0.25);
  }
  if (c.kind === 'ribbon') return (c.width / 10) * (c.thickness / 10) * L * 1.9;
  const r = c.thickness / 20;
  const copperR = r * 0.45;
  return Math.PI * L * (copperR * copperR * materialOf('cobre').density + (r * r - copperR * copperR) * 1.38);
}

export function buildBom(doc: ZDocument, ctx: BomContext): BomResult {
  const rows = new Map<string, BomRow>();
  let partCount = 0;
  for (const n of doc.nodes) {
    if (n.kind === 'assembly' || !isEffectivelyVisible(doc, n)) continue;
    const { category } = ctx.describe(n);
    const mass = ctx.massOf(n);
    const k = [n.type, n.name, JSON.stringify(n.params), n.cost, n.partNumber, n.mat.preset].join('|');
    const r = rows.get(k) ?? { key: k, name: n.name, category, partNumber: n.partNumber, supplier: n.supplier, qty: 0, unitCost: +n.cost || 0, unitMass: mass, ids: [] };
    r.qty += Math.max(1, n.qty || 1);
    r.ids.push(n.id);
    rows.set(k, r);
    partCount += Math.max(1, n.qty || 1);
  }
  let cableLength = 0;
  for (const c of doc.cables) {
    if (!c.visible) continue;
    const len = ctx.cableLength(c);
    cableLength += len;
    const k = `cable|${c.id}`;
    rows.set(k, { key: k, name: `${c.name} · ${len.toFixed(1)} mm`, category: 'Cabos e flex', partNumber: '', supplier: '', qty: 1, unitCost: cableCost(c, len), unitMass: cableMass(c, len), ids: [c.id] });
  }
  const list = [...rows.values()].sort((a, b) => b.unitCost * b.qty - a.unitCost * a.qty);
  return {
    rows: list,
    totalCost: list.reduce((s, r) => s + r.unitCost * r.qty, 0),
    totalMass: list.reduce((s, r) => s + r.unitMass * r.qty, 0),
    partCount, cableCount: doc.cables.length, cableLength,
  };
}

export interface PriceResult { base: number; price: number; profit: number; taxes: number }

export function computePrice(componentsCost: number, p: Pricing): PriceResult {
  const base = componentsCost + p.assembly + p.packaging + p.shipping;
  const denom = 1 - (p.tax + p.margin) / 100;
  const price = denom > 0 ? base / denom : NaN;
  const taxes = price * p.tax / 100;
  return { base, price, profit: price - base - taxes, taxes };
}

export function bomToCSV(b: BomResult): string {
  const esc = (v: unknown) => '"' + String(v).replace(/"/g, '""') + '"';
  const num = (v: number) => v.toFixed(2).replace('.', ',');
  const lines = [['Item', 'Categoria', 'Part number', 'Fornecedor', 'Qtd', 'Massa unit. (g)', 'Massa total (g)', 'Custo unit. (R$)', 'Subtotal (R$)'].map(esc).join(';')];
  b.rows.forEach(r => lines.push([r.name, r.category, r.partNumber, r.supplier, r.qty, num(r.unitMass), num(r.unitMass * r.qty), num(r.unitCost), num(r.unitCost * r.qty)].map(esc).join(';')));
  lines.push(['TOTAL', '', '', '', b.partCount, '', num(b.totalMass), '', num(b.totalCost)].map(esc).join(';'));
  return '﻿' + lines.join('\n');
}

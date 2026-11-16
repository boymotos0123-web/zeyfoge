// Gerador de texturas de PCB: plano de cobre sob a máscara, trilhas com curvas de 45°, vias, pads ENIG/HASL,
// furos metalizados e silkscreen (textos, contornos, pino 1). Coordenadas locais da placa: x → direita, z → frente.
import * as THREE from 'three';
import { canvasTexture, makeCanvas, rng, shade } from './canvas';
import { quality } from '../quality';

export interface PcbPad { x: number; z: number; w: number; d: number; shape?: 'rect' | 'circle' | 'oval'; rot?: number }
export interface PcbHole { x: number; z: number; r: number; ring?: number; plated?: boolean }
export interface PcbText { text: string; x: number; z: number; size: number; rot?: number; align?: CanvasTextAlign; weight?: number; color?: string }
export interface PcbOutline { x: number; z: number; w: number; d: number; rot?: number; pin1?: boolean; corner?: number }
export interface PcbLine { pts: [number, number][]; width: number }

export interface PcbSpec {
  w: number; d: number;
  mask: string;
  finish?: 'enig' | 'hasl';
  seed: number;
  pads?: PcbPad[];
  holes?: PcbHole[];
  silk?: PcbText[];
  outlines?: PcbOutline[];
  /** trilhas explícitas (além das decorativas) */
  traces?: PcbLine[];
  /** densidade de trilhas decorativas 0..1 */
  traceDensity?: number;
  pour?: boolean;
  /** áreas sem cobre/silk (antena, etc.) */
  keepouts?: { x: number; z: number; w: number; d: number }[];
  silkColor?: string;
}

export interface PcbMaps { map: THREE.Texture; rm: THREE.Texture; bump: THREE.Texture; key: string }

const cache = new Map<string, PcbMaps>();

export function pcbMaps(spec: PcbSpec): PcbMaps {
  const q = quality();
  const key = JSON.stringify(spec) + '|' + q.pcbPxPerMM + '|' + q.maxTexture;
  const hit = cache.get(key);
  if (hit) return hit;

  let ppmm = q.pcbPxPerMM;
  const maxDim = Math.max(spec.w, spec.d) * ppmm;
  if (maxDim > q.maxTexture) ppmm = q.maxTexture / Math.max(spec.w, spec.d);
  const W = Math.round(spec.w * ppmm), H = Math.round(spec.d * ppmm);
  const P = (x: number, z: number): [number, number] => [(x + spec.w / 2) * ppmm, (z + spec.d / 2) * ppmm];
  const R = rng(spec.seed);

  const base = spec.mask;
  const overCu = shade(base, 0.07, 0.08);
  const metal = spec.finish === 'hasl' ? '#d4d8dc' : '#e9b85c';

  const col = makeCanvas(W, H), rm = makeCanvas(W, H), bp = makeCanvas(W, H);
  const C = col.getContext('2d')!, M = rm.getContext('2d')!, B = bp.getContext('2d')!;
  const all = [C, M, B];
  const fillAll = (c: string, m: string, b: string) => { C.fillStyle = c; M.fillStyle = m; B.fillStyle = b; };
  const strokeAll = (c: string, m: string, b: string) => { C.strokeStyle = c; M.strokeStyle = m; B.strokeStyle = b; };
  const maskRM = 'rgb(0,72,0)', silkRM = 'rgb(0,200,0)', padRM = 'rgb(0,45,255)';

  // 1) substrato com máscara
  fillAll(base, maskRM, '#000'); all.forEach(g => g.fillRect(0, 0, W, H));

  // 2) plano de terra (cobre sob a máscara) com margem
  const traces: PcbLine[] = [...(spec.traces || [])];
  const pads = spec.pads || [];
  if (spec.pour !== false) {
    const m = 0.8 * ppmm;
    fillAll(overCu, maskRM, '#3a3a3a');
    all.forEach(g => g.fillRect(m, m, W - 2 * m, H - 2 * m));
  }
  // keepouts (ex.: antena) removem cobre
  (spec.keepouts || []).forEach(k => { const [x, y] = P(k.x - k.w / 2, k.z - k.d / 2); fillAll(base, maskRM, '#000'); all.forEach(g => g.fillRect(x, y, k.w * ppmm, k.d * ppmm)); });

  // 3) trilhas decorativas entre pads (roteamento ortogonal com 45°)
  const density = spec.traceDensity ?? 0.6;
  const n = Math.round(density * Math.min(140, pads.length * 1.2 + spec.w * spec.d / 90));
  const inKeepout = (x: number, z: number) => (spec.keepouts || []).some(k => Math.abs(x - k.x) < k.w / 2 && Math.abs(z - k.z) < k.d / 2);
  for (let i = 0; i < n; i++) {
    const a = pads.length ? pads[Math.floor(R() * pads.length)] : { x: (R() - 0.5) * spec.w, z: (R() - 0.5) * spec.d };
    let bx: number, bz: number;
    if (pads.length > 1 && R() < 0.75) { const b = pads[Math.floor(R() * pads.length)]; bx = b.x; bz = b.z; }
    else { bx = a.x + (R() - 0.5) * spec.w * 0.6; bz = a.z + (R() - 0.5) * spec.d * 0.6; }
    bx = Math.max(-spec.w / 2 + 1.2, Math.min(spec.w / 2 - 1.2, bx)); bz = Math.max(-spec.d / 2 + 1.2, Math.min(spec.d / 2 - 1.2, bz));
    if (inKeepout(a.x, a.z) || inKeepout(bx, bz)) continue;
    const dx = bx - a.x, dz = bz - a.z;
    const pts: [number, number][] = [[a.x, a.z]];
    if (Math.abs(dx) > Math.abs(dz)) pts.push([bx - Math.sign(dx) * Math.abs(dz), a.z]);
    else pts.push([a.x, bz - Math.sign(dz) * Math.abs(dx)]);
    pts.push([bx, bz]);
    traces.push({ pts, width: [0.15, 0.2, 0.25, 0.3, 0.5][Math.floor(R() * 5)] });
  }
  // folga (clearance) no plano + trilha
  const strokeLine = (l: PcbLine, extra: number) => all.forEach(g => {
    g.lineWidth = (l.width + extra) * ppmm; g.lineJoin = 'round'; g.lineCap = 'round';
    g.beginPath(); l.pts.forEach(([x, z], i) => { const [px, py] = P(x, z); i ? g.lineTo(px, py) : g.moveTo(px, py); }); g.stroke();
  });
  if (spec.pour !== false) { strokeAll(base, maskRM, '#000'); traces.forEach(l => strokeLine(l, 0.5)); }
  strokeAll(overCu, 'rgb(0,64,0)', '#5a5a5a'); traces.forEach(l => strokeLine(l, 0));

  // 4) vias (tampadas pela máscara) — costura do plano e nas pontas das trilhas
  const vias: [number, number][] = traces.filter(() => R() < 0.35).map(l => l.pts[l.pts.length - 1]);
  if (spec.pour !== false) for (let k = 0; k < spec.w * spec.d / 60; k++) vias.push([(R() - 0.5) * (spec.w - 3), (R() - 0.5) * (spec.d - 3)]);
  vias.filter(([x, z]) => !inKeepout(x, z)).forEach(([x, z]) => {
    const [px, py] = P(x, z);
    fillAll(shade(overCu, 0.04), 'rgb(0,60,0)', '#6e6e6e'); all.forEach(g => { g.beginPath(); g.arc(px, py, 0.32 * ppmm, 0, Math.PI * 2); g.fill(); });
    fillAll(shade(base, -0.04), 'rgb(0,90,0)', '#303030'); all.forEach(g => { g.beginPath(); g.arc(px, py, 0.14 * ppmm, 0, Math.PI * 2); g.fill(); });
  });

  // 5) pads expostos (ENIG/HASL) com folga
  const drawPad = (p: PcbPad, grow: number) => all.forEach(g => {
    const [px, py] = P(p.x, p.z);
    g.save(); g.translate(px, py); if (p.rot) g.rotate(-p.rot);
    const w = (p.w + grow) * ppmm, d = (p.d + grow) * ppmm;
    g.beginPath();
    if (p.shape === 'circle') g.arc(0, 0, w / 2, 0, Math.PI * 2);
    else if (p.shape === 'oval') g.roundRect(-w / 2, -d / 2, w, d, Math.min(w, d) / 2);
    else g.rect(-w / 2, -d / 2, w, d);
    g.fill(); g.restore();
  });
  fillAll(base, maskRM, '#000'); pads.forEach(p => drawPad(p, 0.25));
  fillAll(metal, padRM, '#8c8c8c'); pads.forEach(p => drawPad(p, 0));

  // 6) furos metalizados (anel)
  (spec.holes || []).forEach(h => {
    const [px, py] = P(h.x, h.z);
    if (h.plated !== false) { fillAll(metal, padRM, '#8c8c8c'); all.forEach(g => { g.beginPath(); g.arc(px, py, (h.r + (h.ring ?? 0.6)) * ppmm, 0, Math.PI * 2); g.fill(); }); }
    fillAll('#050505', 'rgb(0,240,0)', '#000'); all.forEach(g => { g.beginPath(); g.arc(px, py, h.r * ppmm, 0, Math.PI * 2); g.fill(); });
  });

  // 7) silkscreen
  const silk = spec.silkColor || '#f4f4ef';
  (spec.outlines || []).forEach(o => all.forEach((g, gi) => {
    const [px, py] = P(o.x, o.z);
    g.save(); g.translate(px, py); if (o.rot) g.rotate(-o.rot);
    g.strokeStyle = gi === 0 ? silk : gi === 1 ? silkRM : '#a0a0a0';
    g.fillStyle = g.strokeStyle;
    g.lineWidth = 0.15 * ppmm;
    const w = o.w * ppmm, d = o.d * ppmm, c = (o.corner ?? 0) * ppmm;
    g.beginPath(); c ? g.roundRect(-w / 2, -d / 2, w, d, c) : g.rect(-w / 2, -d / 2, w, d); g.stroke();
    if (o.pin1) { g.beginPath(); g.arc(-w / 2 - 0.5 * ppmm, -d / 2 - 0.2 * ppmm, 0.22 * ppmm, 0, Math.PI * 2); g.fill(); }
    g.restore();
  }));
  (spec.silk || []).forEach(t => all.forEach((g, gi) => {
    const [px, py] = P(t.x, t.z);
    g.save(); g.translate(px, py); if (t.rot) g.rotate(-t.rot);
    g.fillStyle = gi === 0 ? (t.color || silk) : gi === 1 ? silkRM : '#a0a0a0';
    g.font = `${t.weight ?? 700} ${Math.max(4, t.size * ppmm)}px "Inter","DejaVu Sans","Helvetica Neue",Arial,sans-serif`;
    g.textAlign = t.align ?? 'center'; g.textBaseline = 'middle';
    g.fillText(t.text, 0, 0);
    g.restore();
  }));

  const a = q.anisotropy;
  const maps: PcbMaps = { map: canvasTexture(col, true, a), rm: canvasTexture(rm, false, a), bump: canvasTexture(bp, false, a), key };
  [maps.map, maps.rm, maps.bump].forEach(t => { t.repeat.set(1 / spec.w, 1 / spec.d); t.offset.set(0.5, 0.5); t.wrapS = t.wrapT = THREE.ClampToEdgeWrapping; });
  cache.set(key, maps);
  if (cache.size > 64) { const first = cache.keys().next().value as string; const m = cache.get(first)!; m.map.dispose(); m.rm.dispose(); m.bump.dispose(); cache.delete(first); }
  return maps;
}

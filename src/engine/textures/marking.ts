// Marcações: gravação a laser em chips, etiquetas em blindagens metálicas, logos e Data Matrix.
import * as THREE from 'three';
import { canvasTexture, hashString, makeCanvas, rng } from './canvas';
import { quality } from '../quality';

export interface LabelLine { text: string; size: number; weight?: number; dy?: number; align?: CanvasTextAlign; font?: 'sans' | 'mono' }
export interface LabelSpec {
  w: number; d: number;
  lines: LabelLine[];
  /** cor de fundo (null = transparente, para decalques) */
  bg: string | null;
  ink: string;
  /** pino 1 (círculo rebaixado) */
  dot?: boolean;
  /** código Data Matrix no canto */
  matrix?: boolean;
  /** logo circular simples (ex.: marca do fabricante) */
  logo?: string;
  rot?: number;
}

const cache = new Map<string, { map: THREE.Texture; rough?: THREE.Texture }>();

export function labelTexture(spec: LabelSpec): { map: THREE.Texture; rough?: THREE.Texture } {
  const q = quality();
  const key = JSON.stringify(spec) + q.level;
  const hit = cache.get(key);
  if (hit) return hit;
  const ppmm = Math.min(48, Math.max(16, 1024 / Math.max(spec.w, spec.d)));
  const W = Math.round(spec.w * ppmm), H = Math.round(spec.d * ppmm);
  const c = makeCanvas(W, H), g = c.getContext('2d')!;
  const rc = spec.bg ? makeCanvas(W, H) : null, r = rc?.getContext('2d');
  if (spec.bg) { g.fillStyle = spec.bg; g.fillRect(0, 0, W, H); }
  if (r) { r.fillStyle = 'rgb(0,110,0)'; r.fillRect(0, 0, W, H); }
  const draw = (ctx: CanvasRenderingContext2D, ink: string) => {
    ctx.save();
    if (spec.rot) { ctx.translate(W / 2, H / 2); ctx.rotate(spec.rot); ctx.translate(-W / 2, -H / 2); }
    ctx.fillStyle = ink;
    ctx.textBaseline = 'middle';
    let y = H / 2 - (spec.lines.reduce((s, l) => s + l.size * 1.25 + (l.dy || 0), 0) * ppmm) / 2;
    for (const l of spec.lines) {
      const fs = l.size * ppmm;
      y += (fs * 1.25) / 2 + (l.dy || 0) * ppmm;
      ctx.font = `${l.weight ?? 600} ${fs}px ${l.font === 'mono' ? '"JetBrains Mono","DejaVu Sans Mono",monospace' : '"Inter","DejaVu Sans",Arial,sans-serif'}`;
      ctx.textAlign = l.align ?? 'center';
      const x = l.align === 'left' ? W * 0.08 : l.align === 'right' ? W * 0.92 : W / 2;
      ctx.fillText(l.text, x, y);
      y += (fs * 1.25) / 2;
    }
    if (spec.dot) { ctx.beginPath(); ctx.arc(W * 0.12, H * 0.16, Math.min(W, H) * 0.05, 0, Math.PI * 2); ctx.fill(); }
    if (spec.matrix) {
      const R = rng(hashString(spec.lines.map(l => l.text).join()));
      const n = 12, s = Math.min(W, H) * 0.26, cs = s / n, x0 = W - s - W * 0.06, y0 = H - s - H * 0.08;
      for (let i = 0; i < n; i++) for (let j = 0; j < n; j++) {
        const border = i === 0 || j === n - 1 || (j === 0 && i % 2 === 0) || (i === n - 1 && j % 2 === 1);
        if (border || R() > 0.55) ctx.fillRect(x0 + i * cs, y0 + j * cs, cs * 0.95, cs * 0.95);
      }
    }
    if (spec.logo) {
      const s = Math.min(W, H) * 0.18, x = W * 0.14, y = H * 0.8;
      ctx.lineWidth = s * 0.12; ctx.strokeStyle = ink; ctx.beginPath(); ctx.arc(x, y, s / 2, 0, Math.PI * 2); ctx.stroke();
      ctx.font = `800 ${s * 0.55}px "Inter",Arial,sans-serif`; ctx.textAlign = 'center'; ctx.fillText(spec.logo, x, y + s * 0.02);
    }
    ctx.restore();
  };
  draw(g, spec.ink);
  if (r) draw(r, 'rgb(0,200,0)');
  const out = { map: canvasTexture(c, true, q.anisotropy), rough: rc ? canvasTexture(rc, false, q.anisotropy) : undefined };
  cache.set(key, out);
  return out;
}

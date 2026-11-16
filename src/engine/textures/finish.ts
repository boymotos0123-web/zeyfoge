// Micro-acabamentos de superfície (tileáveis, mapeados em mm): escovado, jateado, fino e fibra de carbono.
import * as THREE from 'three';
import type { Finish } from '@/core/materials-db';
import { blurWrap, dataTexture, heightToNormal, normalize01, rng } from './canvas';

export interface FinishMaps { normal: THREE.DataTexture; roughness: THREE.DataTexture; color?: THREE.DataTexture; tileMM: number; normalScale: number }

const cache = new Map<string, FinishMaps>();

/** Tamanho do ladrilho em mm para cada acabamento. */
const TILE: Record<Finish, number> = { none: 1, brushed: 36, bead: 8, fine: 20, carbon: 8, knurl: 3 };

export function finishMaps(finish: Finish, baseRoughness: number, strength: number, size: number): FinishMaps | null {
  if (finish === 'none') return null;
  const key = `${finish}|${baseRoughness.toFixed(3)}|${strength.toFixed(2)}|${size}`;
  const hit = cache.get(key);
  if (hit) return hit;
  const w = size, h = size, R = rng(1337 + size);
  let height: Float32Array = new Float32Array(w * h);
  let color: Uint8Array | undefined;

  if (finish === 'brushed') {
    for (let i = 0; i < height.length; i++) height[i] = R();
    height = blurWrap(height, w, h, Math.round(w / 10), 0);       // estrias longas no eixo U
    const fine = new Float32Array(w * h); for (let i = 0; i < fine.length; i++) fine[i] = R();
    const fb = blurWrap(fine, w, h, Math.round(w / 48), 0);
    for (let i = 0; i < height.length; i++) height[i] = height[i] * 0.65 + fb[i] * 0.35;
    // riscos ocasionais mais profundos
    for (let k = 0; k < size / 6; k++) { const y = Math.floor(R() * h), x0 = Math.floor(R() * w), len = Math.floor(w * (0.2 + R() * 0.6)); for (let x = 0; x < len; x++) height[y * w + (x0 + x) % w] -= 0.25 * R(); }
  } else if (finish === 'bead') {
    for (let i = 0; i < height.length; i++) height[i] = R();
    const a = blurWrap(height, w, h, 1, 1), b = blurWrap(height, w, h, 3, 3);
    for (let i = 0; i < height.length; i++) height[i] = a[i] * 0.7 + b[i] * 0.3;
  } else if (finish === 'fine') {
    for (let i = 0; i < height.length; i++) height[i] = R();
    height = blurWrap(height, w, h, 2, 2);
  } else if (finish === 'knurl') {
    for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) height[y * w + x] = Math.abs(Math.sin((x + y) / w * Math.PI * 8)) * Math.abs(Math.sin((x - y) / w * Math.PI * 8));
  } else if (finish === 'carbon') {
    // trama sarja 2x2 (twill) de fibra 3K: 8x8 células por ladrilho
    color = new Uint8Array(w * h * 4);
    const cells = 8, cs = w / cells;
    for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
      const cx = Math.floor(x / cs), cy = Math.floor(y / cs);
      const horiz = ((cx + cy) % 4) < 2;
      const lx = (x % cs) / cs, ly = (y % cs) / cs;
      const across = horiz ? ly : lx, along = horiz ? lx : ly;
      const bundle = Math.sin(across * Math.PI);                      // perfil do feixe
      const fibers = 0.5 + 0.5 * Math.sin((horiz ? y : x) * 2.1);      // fibras individuais
      const v = bundle * (0.8 + 0.2 * fibers) * (0.85 + 0.15 * Math.sin(along * Math.PI));
      height[y * w + x] = v;
      const shadeV = 18 + v * 26 + (horiz ? 8 : 0);
      const i = (y * w + x) * 4; color[i] = shadeV; color[i + 1] = shadeV + 1; color[i + 2] = shadeV + 3; color[i + 3] = 255;
    }
  }
  normalize01(height);

  const normal = dataTexture(heightToNormal(height, w, h, finish === 'carbon' ? 6 : finish === 'brushed' ? 3.5 : 2.5), w, h);
  const rough = new Uint8Array(w * h * 4);
  const variation = (finish === 'brushed' ? 0.18 : finish === 'carbon' ? 0.25 : 0.12) * strength;
  for (let i = 0; i < height.length; i++) {
    const r = Math.min(1, Math.max(0.02, baseRoughness + (height[i] - 0.5) * variation));
    rough[i * 4] = rough[i * 4 + 1] = rough[i * 4 + 2] = r * 255; rough[i * 4 + 3] = 255;
  }
  const maps: FinishMaps = {
    normal, roughness: dataTexture(rough, w, h), color: color ? dataTexture(color, w, h, true) : undefined,
    tileMM: TILE[finish], normalScale: (finish === 'brushed' ? 0.35 : finish === 'carbon' ? 0.6 : finish === 'bead' ? 0.25 : 0.15) * strength,
  };
  [maps.normal, maps.roughness, maps.color].forEach(t => t && t.repeat.set(1 / maps.tileMM, 1 / maps.tileMM));
  cache.set(key, maps);
  return maps;
}

export function clearFinishCache(): void { cache.forEach(m => { m.normal.dispose(); m.roughness.dispose(); m.color?.dispose(); }); cache.clear(); }

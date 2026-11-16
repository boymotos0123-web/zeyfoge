// HDRI de estúdio procedural (equirretangular, HDR em half-float). Serve para o render em tempo real (via PMREM)
// e para o path tracer. Softboxes retangulares com borda suave reproduzem os reflexos longos de fotos de produto.
import * as THREE from 'three';

export type EnvPreset = 'studio' | 'soft' | 'dark' | 'day';

export const ENV_PRESETS: Record<EnvPreset, string> = {
  studio: 'Estúdio de produto (faixas de luz)',
  soft: 'Softbox suave',
  dark: 'Escuro dramático',
  day: 'Luz do dia',
};

interface Box { az: number; el: number; w: number; h: number; I: number; color?: [number, number, number]; soft?: number }
interface PresetDef { top: [number, number, number]; horizon: [number, number, number]; floor: [number, number, number]; boxes: Box[]; sun?: { az: number; el: number; r: number; I: number } }

const DEFS: Record<EnvPreset, PresetDef> = {
  studio: {
    top: [0.42, 0.43, 0.46], horizon: [0.16, 0.165, 0.18], floor: [0.025, 0.026, 0.03],
    boxes: [
      { az: -62, el: 22, w: 9, h: 38, I: 22 },               // faixa principal esquerda
      { az: 58, el: 18, w: 7, h: 34, I: 14 },                // faixa direita
      { az: 5, el: 72, w: 42, h: 22, I: 7 },                 // teto (softbox grande)
      { az: 178, el: 12, w: 34, h: 6, I: 12, color: [0.95, 0.97, 1.05] }, // recorte traseiro
      { az: 110, el: 2, w: 20, h: 3, I: 5 },                 // faixa baixa (borda)
      { az: -120, el: 35, w: 14, h: 14, I: 4, color: [1.05, 1, 0.95] },
    ],
  },
  soft: {
    top: [0.75, 0.76, 0.8], horizon: [0.45, 0.46, 0.5], floor: [0.12, 0.12, 0.13],
    boxes: [{ az: 0, el: 60, w: 70, h: 40, I: 5, soft: 0.6 }, { az: -70, el: 15, w: 30, h: 30, I: 3, soft: 0.5 }, { az: 80, el: 20, w: 25, h: 30, I: 2, soft: 0.5 }],
  },
  dark: {
    top: [0.02, 0.02, 0.025], horizon: [0.008, 0.008, 0.01], floor: [0.002, 0.002, 0.003],
    boxes: [{ az: -100, el: 10, w: 5, h: 45, I: 30 }, { az: 95, el: 14, w: 4, h: 40, I: 24, color: [0.9, 0.95, 1.1] }, { az: 0, el: 80, w: 20, h: 10, I: 3 }],
  },
  day: {
    top: [0.35, 0.55, 1.0], horizon: [0.95, 0.97, 1.0], floor: [0.16, 0.14, 0.12],
    boxes: [], sun: { az: 40, el: 48, r: 0.8, I: 2500 },
  },
};

const D2R = Math.PI / 180;
const smooth = (e0: number, e1: number, x: number) => { const t = Math.min(1, Math.max(0, (x - e0) / (e1 - e0))); return t * t * (3 - 2 * t); };

function dirFrom(az: number, el: number): THREE.Vector3 {
  const a = az * D2R, e = el * D2R;
  // convenção equirretangular do three: u = atan2(z, x)
  return new THREE.Vector3(Math.cos(e) * Math.cos(a), Math.sin(e), Math.cos(e) * Math.sin(a));
}

const cache = new Map<string, THREE.DataTexture>();

export function studioHDRI(preset: EnvPreset, width: number): THREE.DataTexture {
  const key = preset + width;
  const hit = cache.get(key);
  if (hit) return hit;
  const W = width, H = width / 2;
  const def = DEFS[preset];
  const data = new Uint16Array(W * H * 4);
  const boxes = def.boxes.map(b => {
    const f = dirFrom(90 - b.az, b.el); // az 0 = frente (+Z), az 90 = direita (+X)
    const r = new THREE.Vector3().crossVectors(new THREE.Vector3(0, 1, 0), f).normalize();
    if (r.lengthSq() < 1e-6) r.set(1, 0, 0);
    const u = new THREE.Vector3().crossVectors(f, r).normalize();
    return { f, r, u, tw: Math.tan(b.w * D2R / 2), th: Math.tan(b.h * D2R / 2), I: b.I, c: b.color || [1, 1, 1], soft: b.soft ?? 0.12 };
  });
  const sun = def.sun ? { d: dirFrom(90 - def.sun.az, def.sun.el), cos: Math.cos(def.sun.r * D2R), I: def.sun.I } : null;
  const d = new THREE.Vector3();
  for (let j = 0; j < H; j++) {
    const el = ((j + 0.5) / H - 0.5) * Math.PI;
    for (let i = 0; i < W; i++) {
      const az = ((i + 0.5) / W - 0.5) * Math.PI * 2;
      d.set(Math.cos(el) * Math.cos(az), Math.sin(el), Math.cos(el) * Math.sin(az));
      // gradiente de fundo
      const y = d.y;
      let r: number, g: number, b: number;
      if (y >= 0) { const t = Math.pow(y, 0.6); r = def.horizon[0] + (def.top[0] - def.horizon[0]) * t; g = def.horizon[1] + (def.top[1] - def.horizon[1]) * t; b = def.horizon[2] + (def.top[2] - def.horizon[2]) * t; }
      else { const t = smooth(0, 0.25, -y); r = def.horizon[0] + (def.floor[0] - def.horizon[0]) * t; g = def.horizon[1] + (def.floor[1] - def.horizon[1]) * t; b = def.horizon[2] + (def.floor[2] - def.horizon[2]) * t; }
      for (const bx of boxes) {
        const fd = d.dot(bx.f);
        if (fd <= 0.05) continue;
        const x = Math.abs(d.dot(bx.r) / fd) / bx.tw, yy = Math.abs(d.dot(bx.u) / fd) / bx.th;
        const m = (1 - smooth(1 - bx.soft, 1, x)) * (1 - smooth(1 - bx.soft, 1, yy));
        if (m > 0) { const falloff = 0.85 + 0.15 * (1 - Math.min(1, x * x + yy * yy)); r += bx.I * bx.c[0] * m * falloff; g += bx.I * bx.c[1] * m * falloff; b += bx.I * bx.c[2] * m * falloff; }
      }
      if (sun) { const c = d.dot(sun.d); if (c > sun.cos) { r += sun.I; g += sun.I * 0.96; b += sun.I * 0.88; } else if (c > sun.cos - 0.02) { const k = (c - sun.cos + 0.02) / 0.02; r += sun.I * 0.02 * k; g += sun.I * 0.019 * k; b += sun.I * 0.017 * k; } }
      const o = (j * W + i) * 4;
      data[o] = THREE.DataUtils.toHalfFloat(r); data[o + 1] = THREE.DataUtils.toHalfFloat(g); data[o + 2] = THREE.DataUtils.toHalfFloat(b); data[o + 3] = THREE.DataUtils.toHalfFloat(1);
    }
  }
  const tex = new THREE.DataTexture(data, W, H, THREE.RGBAFormat, THREE.HalfFloatType);
  tex.mapping = THREE.EquirectangularReflectionMapping;
  tex.colorSpace = THREE.LinearSRGBColorSpace;
  tex.magFilter = THREE.LinearFilter; tex.minFilter = THREE.LinearFilter;
  tex.generateMipmaps = false;
  tex.needsUpdate = true;
  cache.set(key, tex);
  return tex;
}

/** Direção da luz-chave do preset (para alinhar a sombra direcional com o reflexo principal). */
export function keyLightDirection(preset: EnvPreset): THREE.Vector3 {
  const def = DEFS[preset];
  if (def.sun) return dirFrom(90 - def.sun.az, def.sun.el);
  const k = def.boxes.reduce((a, b) => (b.I * b.w * b.h > a.I * a.w * a.h ? b : a), def.boxes[0]);
  return dirFrom(90 - k.az, Math.max(35, k.el));
}

/** Fundo do viewport: gradiente radial discreto. */
export function backgroundTexture(top: string, bottom: string): THREE.CanvasTexture {
  const c = document.createElement('canvas'); c.width = 16; c.height = 512;
  const g = c.getContext('2d')!;
  const gr = g.createLinearGradient(0, 0, 0, 512); gr.addColorStop(0, top); gr.addColorStop(1, bottom);
  g.fillStyle = gr; g.fillRect(0, 0, 16, 512);
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; return t;
}

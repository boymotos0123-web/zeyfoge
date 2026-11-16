// Utilidades para texturas procedurais: RNG determinístico, ruído, blur e normal map a partir de altura.
import * as THREE from 'three';

export function rng(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a |= 0; a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export function hashString(s: string): number {
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 16777619); }
  return h >>> 0;
}

export function makeCanvas(w: number, h: number): HTMLCanvasElement {
  const c = document.createElement('canvas');
  c.width = Math.max(1, Math.round(w)); c.height = Math.max(1, Math.round(h));
  return c;
}

/** Blur separável com wrap (tileável). rx/ry em pixels. */
export function blurWrap(src: Float32Array, w: number, h: number, rx: number, ry: number): Float32Array {
  const tmp = new Float32Array(w * h), out = new Float32Array(w * h);
  if (rx > 0) {
    const n = rx * 2 + 1;
    for (let y = 0; y < h; y++) {
      let acc = 0;
      for (let k = -rx; k <= rx; k++) acc += src[y * w + ((k % w) + w) % w];
      for (let x = 0; x < w; x++) {
        tmp[y * w + x] = acc / n;
        acc += src[y * w + (x + rx + 1) % w] - src[y * w + ((x - rx) % w + w) % w];
      }
    }
  } else tmp.set(src);
  if (ry > 0) {
    const n = ry * 2 + 1;
    for (let x = 0; x < w; x++) {
      let acc = 0;
      for (let k = -ry; k <= ry; k++) acc += tmp[(((k % h) + h) % h) * w + x];
      for (let y = 0; y < h; y++) {
        out[y * w + x] = acc / n;
        acc += tmp[((y + ry + 1) % h) * w + x] - tmp[(((y - ry) % h + h) % h) * w + x];
      }
    }
  } else out.set(tmp);
  return out;
}

export function normalize01(a: Float32Array): Float32Array {
  let mn = Infinity, mx = -Infinity;
  for (const v of a) { if (v < mn) mn = v; if (v > mx) mx = v; }
  const r = mx - mn || 1;
  for (let i = 0; i < a.length; i++) a[i] = (a[i] - mn) / r;
  return a;
}

/** Converte mapa de altura (0..1) em normal map RGBA (tangent space), com wrap. */
export function heightToNormal(hgt: Float32Array, w: number, h: number, strength: number): Uint8Array {
  const out = new Uint8Array(w * h * 4);
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
    const l = hgt[y * w + (x - 1 + w) % w], r = hgt[y * w + (x + 1) % w];
    const u = hgt[((y - 1 + h) % h) * w + x], d = hgt[((y + 1) % h) * w + x];
    let nx = (l - r) * strength, ny = (d - u) * strength, nz = 1;
    const len = Math.hypot(nx, ny, nz); nx /= len; ny /= len; nz /= len;
    const i = (y * w + x) * 4;
    out[i] = (nx * 0.5 + 0.5) * 255; out[i + 1] = (ny * 0.5 + 0.5) * 255; out[i + 2] = (nz * 0.5 + 0.5) * 255; out[i + 3] = 255;
  }
  return out;
}

export function dataTexture(data: Uint8Array, w: number, h: number, srgb = false, repeat = true): THREE.DataTexture {
  const t = new THREE.DataTexture(data, w, h, THREE.RGBAFormat, THREE.UnsignedByteType);
  t.wrapS = t.wrapT = repeat ? THREE.RepeatWrapping : THREE.ClampToEdgeWrapping;
  t.magFilter = THREE.LinearFilter;
  t.minFilter = THREE.LinearMipmapLinearFilter;
  t.generateMipmaps = true;
  t.colorSpace = srgb ? THREE.SRGBColorSpace : THREE.NoColorSpace;
  t.needsUpdate = true;
  return t;
}

export function canvasTexture(c: HTMLCanvasElement, srgb: boolean, anisotropy: number): THREE.CanvasTexture {
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = srgb ? THREE.SRGBColorSpace : THREE.NoColorSpace;
  t.anisotropy = anisotropy;
  t.generateMipmaps = true;
  t.minFilter = THREE.LinearMipmapLinearFilter;
  t.needsUpdate = true;
  return t;
}

export function hexToRgb(hex: string): [number, number, number] {
  const c = new THREE.Color(hex);
  return [c.r * 255, c.g * 255, c.b * 255];
}

export function shade(hex: string, lightness: number, saturation = 0): string {
  const c = new THREE.Color(hex);
  const hsl = { h: 0, s: 0, l: 0 };
  c.getHSL(hsl);
  c.setHSL(hsl.h, Math.min(1, Math.max(0, hsl.s + saturation)), Math.min(1, Math.max(0, hsl.l + lightness)));
  return '#' + c.getHexString();
}

// Construtor de placas (PCB): contorno com furos, núcleo FR4 aparente na borda, face superior com
// textura gerada (cobre, trilhas, pads, silkscreen) a partir dos footprints das peças posicionadas.
import * as THREE from 'three';
import { extrudeUp, roundedRectShape, circlePath, shapeTop, mesh } from './primitives';
import { mat, pcbMaterial, buildMaterial } from '@/engine/materials';
import { pcbMaps, type PcbHole, type PcbOutline, type PcbPad, type PcbSpec, type PcbText, type PcbLine } from '@/engine/textures/pcb';
import type { Footprint } from './parts';

export interface BoardOptions {
  w: number; d: number; t?: number; corner?: number;
  mask?: string; // chave de material (fr4_verde, fr4_preto…)
  finish?: 'enig' | 'hasl';
  seed?: number;
  holes?: PcbHole[];
  traceDensity?: number;
  pour?: boolean;
  keepouts?: PcbSpec['keepouts'];
  silkColor?: string;
  shape?: THREE.Shape;
}

export class Board {
  readonly parts = new THREE.Group();
  readonly t: number;
  private pads: PcbPad[] = [];
  private outlines: PcbOutline[] = [];
  private texts: PcbText[] = [];
  private lines: PcbLine[] = [];
  private holes: PcbHole[];

  constructor(readonly o: BoardOptions) {
    this.t = o.t ?? 1.6;
    this.holes = [...(o.holes || [])];
  }

  /** Posiciona uma peça sobre a placa (x,z locais, rotação em Y) e registra seu footprint. */
  add(part: THREE.Object3D, x: number, z: number, rotY = 0, opts: { ref?: string; refDx?: number; refDz?: number; outline?: boolean; refSize?: number; y?: number } = {}): THREE.Object3D {
    part.position.set(x, opts.y ?? this.t, z);
    part.rotation.y = rotY;
    this.parts.add(part);
    const f = part.userData.fp as Footprint | undefined;
    if (f) {
      const c = Math.cos(rotY), s = Math.sin(rotY);
      const tr = (px: number, pz: number): [number, number] => [x + px * c + pz * s, z - px * s + pz * c];
      f.pads.forEach(p => { const [px, pz] = tr(p.x, p.z); const swap = Math.abs(Math.sin(rotY)) > 0.7; this.pads.push({ ...p, x: px, z: pz, w: swap ? p.d : p.w, d: swap ? p.w : p.d }); });
      f.holes?.forEach(h => { const [hx, hz] = tr(h.x, h.z); this.holes.push({ x: hx, z: hz, r: h.r, plated: true, ring: 0.35 }); });
      if (f.outline && opts.outline !== false) {
        const swap = Math.abs(Math.sin(rotY)) > 0.7;
        this.outlines.push({ x, z, w: swap ? f.outline.d : f.outline.w, d: swap ? f.outline.w : f.outline.d, pin1: true });
      }
      if (opts.ref) {
        const ow = f.outline ? (Math.abs(Math.sin(rotY)) > 0.7 ? f.outline.d : f.outline.w) : 2;
        this.texts.push({ text: opts.ref, x: x + (opts.refDx ?? 0), z: z + (opts.refDz ?? -(f.outline ? (Math.abs(Math.sin(rotY)) > 0.7 ? f.outline.w : f.outline.d) / 2 + 0.7 : 1.2)), size: opts.refSize ?? Math.min(1.0, Math.max(0.6, ow * 0.18)) });
      }
    }
    return part;
  }

  silk(text: string, x: number, z: number, size = 1, opts: Partial<PcbText> = {}): void { this.texts.push({ text, x, z, size, ...opts }); }
  outline(o: PcbOutline): void { this.outlines.push(o); }
  pad(p: PcbPad): void { this.pads.push(p); }
  trace(pts: [number, number][], width = 0.25): void { this.lines.push({ pts, width }); }
  hole(h: PcbHole): void { this.holes.push(h); }

  /** Gera a placa (geometria + texturas) e devolve o grupo final com as peças. */
  build(): THREE.Group {
    const o = this.o;
    const mask = o.mask ?? 'fr4_verde';
    const shape = o.shape ?? roundedRectShape(o.w, o.d, o.corner ?? 0.5);
    const cutHoles = this.holes.filter(h => h.r >= 0.3);
    cutHoles.forEach(h => shape.holes.push(circlePath(h.r, h.x, -h.z)));
    const maskPlain = buildMaterial(mask);
    const board = extrudeUp(shape, this.t, [maskPlain, mat('fr4_borda')] as unknown as THREE.Material[], 0, 32);
    board.userData.matKey = mask;
    const maps = pcbMaps({
      w: o.w, d: o.d, mask: '#' + maskPlain.color.getHexString(), finish: o.finish ?? 'enig', seed: o.seed ?? 7,
      pads: this.pads, holes: this.holes, silk: this.texts, outlines: this.outlines, traces: this.lines,
      traceDensity: o.traceDensity, pour: o.pour, keepouts: o.keepouts, silkColor: o.silkColor,
    });
    const top = shapeTop(shape, this.t + 0.004, pcbMaterial(maps, mask));
    top.receiveShadow = true;
    const g = new THREE.Group();
    g.add(board, top, this.parts);
    g.userData.boardThickness = this.t;
    return g;
  }
}

export { mesh };

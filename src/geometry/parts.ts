// Sub-peças eletrônicas detalhadas e reutilizáveis (SMD, CIs, conectores, blindagens, soldas).
// Cada peça define userData.fp (footprint: pads em coordenadas locais x,z) para gerar a PCB automaticamente.
import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { box, rbox, cyl, cylX, cylZ, mesh, group, at, extrudeUp, roundedRectShape, circlePath, instanced, T, lathe, mmUV, DEG } from './primitives';
import { labelMaterial, mat } from '@/engine/materials';
import { labelTexture, type LabelLine } from '@/engine/textures/marking';
import type { PcbPad } from '@/engine/textures/pcb';

export interface Footprint { pads: PcbPad[]; outline?: { w: number; d: number }; holes?: { x: number; z: number; r: number }[] }
export const fp = (o: THREE.Object3D, f: Footprint): THREE.Object3D => { o.userData.fp = f; return o; };

/* ---------------- Solda ---------------- */

/** Filete de solda (prisma triangular): base no pad, rampa subindo até a terminação. Comprimento em X, sobe em +X. */
export function fillet(len: number, h: number, width: number): THREE.Mesh {
  const s = new THREE.Shape();
  s.moveTo(0, 0); s.lineTo(len, 0); s.quadraticCurveTo(len * 0.15, h * 0.15, 0, h); s.closePath();
  const g = new THREE.ExtrudeGeometry(s, { depth: width, bevelEnabled: false, curveSegments: 6 });
  g.translate(0, 0, -width / 2);
  return mesh(g, 'estanho');
}

/** Menisco de solda em volta de um pino PTH (cone côncavo). */
export function solderCone(rPin: number, rPad: number, h: number): THREE.Mesh {
  return lathe([[rPad, 0], [rPad * 0.9, h * 0.08], [rPin + (rPad - rPin) * 0.35, h * 0.35], [rPin * 1.05, h], [rPin * 0.01, h]], 'estanho', 20);
}

/* ---------------- Passivos SMD ---------------- */

const CHIP: Record<string, [number, number, number]> = { '0402': [1.0, 0.5, 0.35], '0603': [1.6, 0.8, 0.45], '0805': [2.0, 1.25, 0.5], '1206': [3.2, 1.6, 0.55] };

export function smdPassive(code: keyof typeof CHIP | string, kind: 'res' | 'cap' | 'led' | 'ind', ledMat = 'led_verde'): THREE.Object3D {
  const [L, W, H] = CHIP[code] || CHIP['0603'];
  const term = L * 0.22;
  const g = new THREE.Group();
  if (kind === 'res') {
    g.add(box(L - 2 * term * 0.6, H * 0.85, W, 'ceramica'));
    g.add(box(L - 2 * term, 0.03, W * 0.96, 'resistor_smd', 0, H * 0.85));
  } else if (kind === 'cap') {
    g.add(rbox(L - 0.02, H, W, Math.min(W, H) * 0.12, 'ceramica_mlcc'));
  } else if (kind === 'ind') {
    g.add(rbox(L - 0.02, H, W, Math.min(W, H) * 0.12, 'ferrite'));
  } else {
    g.add(box(L - 2 * term * 0.6, H * 0.6, W, 'abs_branco'));
    g.add(rbox(L * 0.5, H * 0.45, W * 0.8, 0.08, ledMat, 0, H * 0.55));
  }
  for (const sx of [-1, 1]) {
    g.add(rbox(term, H, W, Math.min(term, H) * 0.25, 'niquel', sx * (L / 2 - term / 2), 0));
    const f = fillet(term * 0.9, H * 0.7, W * 0.92); f.position.set(sx * (L / 2) , 0, 0); f.scale.x = sx; g.add(f);
  }
  return fp(g, { pads: [-1, 1].map(sx => ({ x: sx * (L / 2 - term * 0.3), z: 0, w: term * 1.9, d: W * 1.15 })) });
}

/* ---------------- Circuitos integrados ---------------- */

function markedTop(w: number, d: number, lines: LabelLine[], extra: { dot?: boolean; matrix?: boolean; logo?: string } = {}): THREE.Material {
  const t = labelTexture({ w, d, lines, bg: '#141517', ink: '#7c7f84', ...extra });
  return labelMaterial(t.map, 'encapsulamento', t.rough);
}

/** Corpo de CI com marcação a laser no topo (Box com material no grupo +Y). */
export function icBody(w: number, d: number, h: number, lines: LabelLine[], extra: { dot?: boolean; matrix?: boolean; logo?: string } = {}, y = 0): THREE.Mesh {
  const body = mat('encapsulamento');
  const top = markedTop(w, d, lines, { dot: true, ...extra });
  const o = mesh(new THREE.BoxGeometry(w, h, d), [body, body, top, body, body, body]);
  o.position.y = y + h / 2;
  return o;
}

/** Terminal gull-wing (perna de SOIC/QFP) como geometria única, apontando para +Z. */
function gullWingGeometry(width: number, standoff: number, bodyH: number, reach: number): THREE.BufferGeometry {
  const t = 0.15;
  const a = new THREE.BoxGeometry(width, t, reach * 0.4); a.translate(0, bodyH * 0.45, reach * 0.2);
  const b = new THREE.BoxGeometry(width, bodyH * 0.45, t); b.translate(0, bodyH * 0.225 + t / 2, reach * 0.42);
  const c = new THREE.BoxGeometry(width, t, reach * 0.45); c.translate(0, t / 2, reach * 0.62);
  return mmUV(mergeGeometries([a.toNonIndexed(), b.toNonIndexed(), c.toNonIndexed()]));
}

export function qfn(w: number, d: number, h: number, pinsPerSide: number, lines: LabelLine[], pitch = 0.5): THREE.Object3D {
  const g = new THREE.Group();
  g.add(icBody(w, d, h, lines, {}, 0.02));
  const pads: PcbPad[] = [{ x: 0, z: 0, w: w * 0.6, d: d * 0.6 }];
  const mats: THREE.Matrix4[] = [];
  const span = (pinsPerSide - 1) * pitch;
  for (let s = 0; s < 4; s++) for (let i = 0; i < pinsPerSide; i++) {
    const o = -span / 2 + i * pitch;
    const [x, z, r] = s === 0 ? [o, d / 2, 0] : s === 1 ? [w / 2, o, Math.PI / 2] : s === 2 ? [o, -d / 2, 0] : [-w / 2, o, Math.PI / 2];
    mats.push(T(x, 0.1, z, r));
    pads.push({ x: x * 1.04, z: z * 1.04, w: r ? 0.8 : pitch * 0.55, d: r ? pitch * 0.55 : 0.8 });
  }
  g.add(instanced(new THREE.BoxGeometry(pitch * 0.5, 0.2, 0.42), 'estanho', mats));
  return fp(g, { pads, outline: { w: w + 0.6, d: d + 0.6 } });
}

export function qfp(w: number, d: number, h: number, pinsPerSide: number, lines: LabelLine[], pitch = 0.5, sides: 2 | 4 = 4): THREE.Object3D {
  const g = new THREE.Group();
  const standoff = 0.1;
  g.add(icBody(w, d, h, lines, {}, standoff));
  const reach = 1.0;
  const lead = gullWingGeometry(Math.min(0.3, pitch * 0.55), standoff, h, reach);
  const mats: THREE.Matrix4[] = [];
  const pads: PcbPad[] = [];
  const span = (pinsPerSide - 1) * pitch;
  const sidesList = sides === 4 ? [0, 1, 2, 3] : [0, 2];
  for (const s of sidesList) for (let i = 0; i < pinsPerSide; i++) {
    const o = -span / 2 + i * pitch;
    const rot = [0, Math.PI / 2, Math.PI, -Math.PI / 2][s];
    const [x, z] = s === 0 ? [o, d / 2] : s === 1 ? [w / 2, -o] : s === 2 ? [-o, -d / 2] : [-w / 2, o];
    mats.push(T(x, 0, z, rot));
    const px = x + Math.sin(rot) * reach * 0.62, pz = z + Math.cos(rot) * reach * 0.62;
    pads.push({ x: px, z: pz, w: s % 2 ? 1.4 : pitch * 0.6, d: s % 2 ? pitch * 0.6 : 1.4 });
  }
  g.add(instanced(lead, 'estanho', mats));
  return fp(g, { pads, outline: { w: w + 0.4, d: d + 0.4 } });
}

export const soic = (pins: number, lines: LabelLine[], bodyW = 3.9, pitch = 1.27) => qfp(pins / 2 * pitch + 0.6, bodyW, 1.5, pins / 2, lines, pitch, 2);

export function sot23(lines: LabelLine[], leads = 3): THREE.Object3D {
  const g = new THREE.Group();
  g.add(icBody(2.9, 1.3, 1.0, lines, { dot: false }, 0.05));
  const lead = gullWingGeometry(0.4, 0.05, 1.0, 0.7);
  const pos: [number, number, number][] = leads === 3 ? [[-0.95, 0.65, 0], [0.95, 0.65, 0], [0, -0.65, Math.PI]] : [[-0.95, 0.65, 0], [0, 0.65, 0], [0.95, 0.65, 0], [-0.95, -0.65, Math.PI], [0, -0.65, Math.PI], [0.95, -0.65, Math.PI]];
  g.add(instanced(lead, 'estanho', pos.map(([x, z, r]) => T(x, 0, z, r))));
  return fp(g, { pads: pos.map(([x, z]) => ({ x, z: z * 1.7, w: 0.6, d: 1.0 })) });
}

export function sot223(lines: LabelLine[]): THREE.Object3D {
  const g = new THREE.Group();
  g.add(icBody(6.5, 3.5, 1.6, lines, { dot: false }, 0.05));
  const lead = gullWingGeometry(0.7, 0.05, 1.6, 1.2);
  g.add(instanced(lead, 'estanho', [-2.3, 0, 2.3].map(x => T(x, 0, 1.75))));
  g.add(instanced(gullWingGeometry(3.0, 0.05, 1.6, 1.2), 'estanho', [T(0, 0, -1.75, Math.PI)]));
  return fp(g, { pads: [...[-2.3, 0, 2.3].map(x => ({ x, z: 2.9, w: 1.0, d: 1.8 })), { x: 0, z: -2.9, w: 3.4, d: 1.8 }] });
}

export function bga(w: number, d: number, h: number, lines: LabelLine[], lid: 'mold' | 'metal' = 'mold', substrate = '#0e2a1c'): THREE.Object3D {
  const g = new THREE.Group();
  const sub = new THREE.MeshPhysicalMaterial({ color: substrate, roughness: 0.4, clearcoat: 0.6 });
  g.add(box(w, 0.35, d, sub, 0, 0.25));
  if (lid === 'metal') {
    const t = labelTexture({ w: w * 0.9, d: d * 0.9, lines, bg: '#b9bdc2', ink: '#3a3c40', matrix: true });
    const top = labelMaterial(t.map, 'aco_inox', undefined);
    top.metalness = 1; top.roughness = 0.32;
    const m = mat('aco_inox');
    const o = mesh(new THREE.BoxGeometry(w * 0.9, h - 0.6, d * 0.9), [m, m, top, m, m, m]); o.position.y = 0.6 + (h - 0.6) / 2; g.add(o);
  } else g.add(icBody(w * 0.94, d * 0.94, h - 0.6, lines, { matrix: true }, 0.6));
  g.add(box(w, 0.25, d, 'estanho', 0, 0));
  return fp(g, { pads: [], outline: { w: w + 0.5, d: d + 0.5 } });
}

/* ---------------- Cristais, botões ---------------- */

export function crystalSMD(w = 3.2, d = 2.5, lines: LabelLine[] = [{ text: '40.000', size: 0.55 }]): THREE.Object3D {
  const t = labelTexture({ w, d, lines, bg: '#c9cdd2', ink: '#4a4d52' });
  const top = labelMaterial(t.map, 'aco_inox'); top.metalness = 1; top.roughness = 0.25;
  const m = mat('aco_inox');
  const g = group(box(w, 0.3, d, 'ceramica'), at(mesh(new THREE.BoxGeometry(w - 0.3, 0.5, d - 0.3), [m, m, top, m, m, m]), 0, 0.55, 0));
  return fp(g, { pads: [[-1, -1], [1, -1], [1, 1], [-1, 1]].map(([a, b]) => ({ x: a * w * 0.3, z: b * d * 0.3, w: w * 0.32, d: d * 0.32 })) });
}

export function crystalHC49(): THREE.Object3D {
  const s = roundedRectShape(11, 4.6, 2.25);
  return fp(group(extrudeUp(s, 0.5, 'aco_inox'), at(extrudeUp(roundedRectShape(10.6, 4.2, 2.05), 3, 'aco_inox', 0.2), 0, 0.5, 0)), { pads: [-2.44, 2.44].map(x => ({ x, z: 0, w: 1.6, d: 1.6, shape: 'circle' as const })) });
}

export function tactSwitch(size: 6 | 4 | 3 = 6, cap = 'pbt_preto', h = 1.5): THREE.Object3D {
  const S = size, H = size === 6 ? 3.5 : 1.6;
  const g = group(box(S, H * 0.7, S, 'pbt_preto'), box(S, 0.25, S, 'aco_estampado', 0, H * 0.7));
  g.add(cyl(S * 0.29, h, cap, 0, H * 0.7 + 0.25, 0, 24));
  const legs = [[-1, -1], [1, -1], [-1, 1], [1, 1]] as const;
  legs.forEach(([a, b]) => g.add(box(0.7, 0.3, 1.2, 'estanho', a * (S / 2 + 0.3), 0, b * S * 0.32)));
  return fp(g, { pads: legs.map(([a, b]) => ({ x: a * (S / 2 + 0.5), z: b * S * 0.32, w: 1.4, d: 1.2 })), outline: { w: S + 0.4, d: S + 0.4 } });
}

/* ---------------- Barras de pinos ---------------- */

export function header(n: number, rows: number, female: boolean, pitch = 2.54, opts: { below?: number; above?: number; solder?: boolean } = {}): THREE.Object3D {
  const g = new THREE.Group();
  const L = n * pitch, Wd = rows * pitch;
  const pinMats: THREE.Matrix4[] = [], solderMats: THREE.Matrix4[] = [];
  const pads: PcbPad[] = [];
  const x0 = -(n - 1) * pitch / 2, z0 = -(rows - 1) * pitch / 2;
  const below = opts.below ?? 3.0, above = opts.above ?? (female ? 0 : 6.1);
  for (let i = 0; i < n; i++) for (let r = 0; r < rows; r++) {
    const x = x0 + i * pitch, z = z0 + r * pitch;
    pinMats.push(T(x, 0, z));
    solderMats.push(T(x, 0, z));
    pads.push({ x, z, w: 1.7, d: 1.7, shape: i === 0 && r === 0 ? 'rect' : 'circle' });
  }
  if (female) {
    const housingH = 8.5;
    const hs = roundedRectShape(L - 0.1, Wd - 0.1, 0.3);
    g.add(extrudeUp(hs, housingH, 'pbt_preto', 0.15));
    g.add(instanced(new THREE.BoxGeometry(1.0, 0.05, 1.0), new THREE.MeshBasicMaterial({ color: '#050505' }), pinMats.map(m => m.clone().setPosition(new THREE.Vector3().setFromMatrixPosition(m).setY(housingH + 0.01)))));
    const pin = new THREE.BoxGeometry(0.6, below, 0.3); pin.translate(0, -below / 2, 0);
    g.add(instanced(pin, 'ouro', pinMats));
  } else {
    g.add(extrudeUp(roundedRectShape(L - 0.1, Wd - 0.1, 0.25), 2.5, 'pbt_preto', 0.2));
    const total = below + 2.5 + above;
    const pin = new THREE.BoxGeometry(0.64, total - 0.6, 0.64); pin.translate(0, -below + (total - 0.6) / 2 + 0.3, 0);
    const tipTop = new THREE.CylinderGeometry(0.05, 0.42, 0.3, 4); tipTop.rotateY(Math.PI / 4); tipTop.translate(0, 2.5 + above - 0.15, 0);
    const tipBot = new THREE.CylinderGeometry(0.42, 0.05, 0.3, 4); tipBot.rotateY(Math.PI / 4); tipBot.translate(0, -below + 0.15, 0);
    g.add(instanced(mergeGeometries([pin.toNonIndexed(), tipTop.toNonIndexed(), tipBot.toNonIndexed()]), 'ouro', pinMats));
  }
  if (opts.solder !== false) {
    const cone = new THREE.LatheGeometry([[0.85, 0], [0.75, 0.1], [0.45, 0.45], [0.34, 1.0], [0.01, 1.0]].map(([a, b]) => new THREE.Vector2(a, b)), 16);
    cone.rotateX(Math.PI); cone.translate(0, -1.6, 0); // menisco no lado de baixo da placa (y = -espessura)
    g.add(instanced(cone, 'estanho', solderMats));
  }
  return fp(g, { pads, outline: { w: L, d: Wd }, holes: pads.map(p => ({ x: p.x, z: p.z, r: 0.5 })) });
}

/* ---------------- Conectores ---------------- */

/** USB-C receptáculo (SMT, abertura voltada para +Z). */
export function usbCReceptacle(): THREE.Object3D {
  const g = new THREE.Group();
  const s = roundedRectShape(8.94, 3.26, 1.63); s.holes.push(new THREE.Path(roundedRectShape(8.34, 2.66, 1.33).getPoints(32).reverse()));
  const shell = extrudeUp(s, 7.35, 'aco_inox', 0, 32);
  shell.rotation.x = Math.PI / 2; shell.position.set(0, 1.63, -3.675);
  g.add(shell);
  g.add(box(8.3, 0.05, 6.9, 'aco_preto', 0, 0.32, -0.2));
  const tongue = box(6.69, 0.7, 4.45, 'lcp_preto', 0, 1.28, 0.8); g.add(tongue);
  const cmats: THREE.Matrix4[] = [];
  for (let i = 0; i < 12; i++) { const x = -2.75 + i * 0.5; cmats.push(T(x, 1.99, 1.6)); cmats.push(T(x, 1.27, 1.6)); }
  g.add(instanced(new THREE.BoxGeometry(0.25, 0.02, 2.4), 'ouro', cmats));
  [-1, 1].forEach(sx => g.add(box(0.6, 1.6, 1.1, 'aco_inox', sx * 4.6, -0.8, -2.3)));
  const pads: PcbPad[] = [];
  for (let i = 0; i < 12; i++) pads.push({ x: -2.75 + i * 0.5, z: -4.2, w: 0.3, d: 1.1 });
  [-1, 1].forEach(sx => pads.push({ x: sx * 4.32, z: -2.3, w: 1.0, d: 1.8, shape: 'oval' }, { x: sx * 4.32, z: 1.6, w: 1.0, d: 1.6, shape: 'oval' }));
  return fp(g, { pads });
}

export function microUsb(): THREE.Object3D {
  const g = new THREE.Group();
  const s = new THREE.Shape(); s.moveTo(-3.75, 0); s.lineTo(3.75, 0); s.lineTo(3.75, 1.9); s.lineTo(3.0, 2.6); s.lineTo(-3.0, 2.6); s.lineTo(-3.75, 1.9); s.closePath();
  const hole = new THREE.Path(); hole.moveTo(-3.4, 0.3); hole.lineTo(-2.8, 2.3); hole.lineTo(2.8, 2.3); hole.lineTo(3.4, 0.3); hole.closePath();
  s.holes.push(hole);
  const shell = extrudeUp(s, 5.0, 'aco_inox', 0, 8); shell.rotation.x = Math.PI / 2; shell.position.set(0, 0, -2.5); g.add(shell);
  g.add(box(6.6, 0.25, 4.6, 'aco_inox', 0, 0, 0));
  g.add(box(5.2, 0.6, 3.6, 'lcp_preto', 0, 1.3, 0.3));
  const cm: THREE.Matrix4[] = []; for (let i = 0; i < 5; i++) cm.push(T(-1.3 + i * 0.65, 1.28, 0.8));
  g.add(instanced(new THREE.BoxGeometry(0.3, 0.02, 2.2), 'ouro', cm));
  const pads: PcbPad[] = []; for (let i = 0; i < 5; i++) pads.push({ x: -1.3 + i * 0.65, z: -2.6, w: 0.4, d: 1.35 });
  [-1, 1].forEach(sx => pads.push({ x: sx * 3.1, z: -2.4, w: 1.6, d: 1.4 }, { x: sx * 3.6, z: 0.4, w: 1.8, d: 1.9 }));
  return fp(g, { pads });
}

/** USB-A (empilhado opcional). Abertura para +Z. tongue: cor da língua (azul = USB 3). */
export function usbA(stacked: boolean, tongue = 'plastico_azul'): THREE.Object3D {
  const g = new THREE.Group();
  const H = stacked ? 15.6 : 7.0, W = 14.5, D = 17.5;
  const s = new THREE.Shape(); s.moveTo(-W / 2, 0); s.lineTo(W / 2, 0); s.lineTo(W / 2, H); s.lineTo(-W / 2, H); s.closePath();
  const ports = stacked ? [1.2, 9.0] : [0.6];
  ports.forEach(y => s.holes.push(holeRect(-6.3, y, 12.6, 5.4)));
  const shell = extrudeUp(s, D, 'aco_estampado', 0, 8); shell.rotation.x = Math.PI / 2; shell.position.set(0, 0, -D / 2); g.add(shell);
  g.add(box(W - 0.3, H - 0.3, 0.3, 'aco_preto', 0, 0.15, -D / 2 + 0.3));
  ports.forEach(y => { g.add(box(11, 1.8, D - 4, tongue, 0, y + 1.0, 1)); const cm: THREE.Matrix4[] = []; for (let i = 0; i < 4; i++) cm.push(T(-3.5 + i * 2.33, y + 2.81, 4)); g.add(instanced(new THREE.BoxGeometry(1.0, 0.03, 5), 'ouro', cm)); });
  return fp(g, { pads: [], holes: [-1, 1].map(sx => ({ x: sx * 6.6, z: -5, r: 1.1 })) });
}

function holeRect(x: number, y: number, w: number, h: number): THREE.Path {
  const p = new THREE.Path(); p.moveTo(x, y); p.lineTo(x, y + h); p.lineTo(x + w, y + h); p.lineTo(x + w, y); p.closePath(); return p;
}

export function rj45(): THREE.Object3D {
  const W = 15.9, H = 13.5, D = 21.3;
  const g = new THREE.Group();
  const s = new THREE.Shape(); s.moveTo(-W / 2, 0); s.lineTo(W / 2, 0); s.lineTo(W / 2, H); s.lineTo(-W / 2, H); s.closePath();
  const hole = new THREE.Path(); hole.moveTo(-5.8, 1.6); hole.lineTo(5.8, 1.6); hole.lineTo(5.8, 8.6); hole.lineTo(2.2, 8.6); hole.lineTo(2.2, 10.2); hole.lineTo(-2.2, 10.2); hole.lineTo(-2.2, 8.6); hole.lineTo(-5.8, 8.6); hole.closePath();
  s.holes.push(hole);
  const shell = extrudeUp(s, D, 'aco_estampado', 0, 8); shell.rotation.x = Math.PI / 2; shell.position.set(0, 0, -D / 2); g.add(shell);
  g.add(box(W - 0.4, H - 0.4, D - 6, 'pbt_preto', 0, 0.2, -3));
  const cm: THREE.Matrix4[] = []; for (let i = 0; i < 8; i++) cm.push(T(-3.57 + i * 1.02, 8.0, 3.5));
  g.add(instanced(new THREE.BoxGeometry(0.4, 0.3, 5), 'ouro', cm));
  g.add(box(2.6, 1.6, 0.4, 'led_verde', -5.5, 10.8, D / 2 - 0.1));
  g.add(box(2.6, 1.6, 0.4, 'led_ambar', 5.5, 10.8, D / 2 - 0.1));
  return fp(g, { pads: [], holes: [-1, 1].map(sx => ({ x: sx * 5.7, z: -4, r: 1.6 })) });
}

export function microHdmi(): THREE.Object3D {
  const g = new THREE.Group();
  const s = new THREE.Shape(); s.moveTo(-3.2, 0); s.lineTo(3.2, 0); s.lineTo(3.2, 2.0); s.lineTo(2.6, 3.0); s.lineTo(-2.6, 3.0); s.lineTo(-3.2, 2.0); s.closePath();
  const h = new THREE.Path(); h.moveTo(-2.9, 0.3); h.lineTo(-2.9, 1.9); h.lineTo(-2.4, 2.7); h.lineTo(2.4, 2.7); h.lineTo(2.9, 1.9); h.lineTo(2.9, 0.3); h.closePath(); s.holes.push(h);
  const shell = extrudeUp(s, 7.5, 'aco_inox', 0, 8); shell.rotation.x = Math.PI / 2; shell.position.set(0, 0, -3.75); g.add(shell);
  g.add(box(4.8, 0.6, 5, 'lcp_preto', 0, 1.2, 0.5));
  return fp(g, { pads: Array.from({ length: 10 }, (_, i) => ({ x: -2.0 + i * 0.4 + 0.2, z: -4.2, w: 0.22, d: 1.0 })) });
}

export function audioJack(): THREE.Object3D {
  const g = group(box(6, 5, 12, 'pbt_preto', 0, 0, -1));
  const t = cylZ(3, 2.5, 'pbt_preto', 0, 2.5, 6.2); g.add(t);
  g.add(cylZ(1.8, 0.2, new THREE.MeshBasicMaterial({ color: '#050505' }), 0, 2.5, 7.46));
  return fp(g, { pads: [], holes: [[-2.3, -4], [2.3, -4], [0, 2]].map(([x, z]) => ({ x, z, r: 0.6 })) });
}

/** Conector FPC/FFC ZIF com flip-lock. Abertura para +Z (o flat entra pela frente). */
export function zifConnector(pins: number, pitch: number, opts: { color?: string; actuator?: string; vertical?: boolean } = {}): THREE.Object3D {
  const g = new THREE.Group();
  const W = pins * pitch + (pitch >= 1 ? 4.5 : 2.4), D = pitch >= 1 ? 4.6 : 3.4, H = pitch >= 1 ? 2.5 : 1.0;
  if (opts.vertical) {
    // tipo vertical (Raspberry Pi): o flat entra por cima; trava deslizante no topo
    const Hv = 5.6, Dv = 3.0;
    const body = new THREE.Shape(); body.moveTo(-W / 2, -Dv / 2); body.lineTo(W / 2, -Dv / 2); body.lineTo(W / 2, Dv / 2); body.lineTo(-W / 2, Dv / 2); body.closePath();
    body.holes.push(holeFromRect(pins * pitch + 0.6, 0.5));
    g.add(extrudeUp(body, Hv, opts.color ?? 'nylon_bege', 0.1, 8));
    g.add(rbox(W - 0.3, 1.1, Dv + 0.6, 0.15, opts.actuator ?? 'pbt_preto', 0, Hv, 0));
    const cm: THREE.Matrix4[] = []; const x0 = -(pins - 1) * pitch / 2;
    for (let i = 0; i < pins; i++) cm.push(T(x0 + i * pitch, 0.05, (i % 2 ? 1 : -1) * 2.2));
    g.add(instanced(new THREE.BoxGeometry(pitch * 0.4, 0.1, 1.0), 'estanho', cm));
    const pads: PcbPad[] = [];
    for (let i = 0; i < pins; i++) pads.push({ x: x0 + i * pitch, z: (i % 2 ? 1 : -1) * 2.4, w: pitch * 0.5, d: 1.2 });
    const o = fp(g, { pads, outline: { w: W, d: Dv + 1 } });
    o.userData.socketY = Hv + 1.1; o.userData.width = W;
    return o;
  }
  g.add(rbox(W, H * 0.75, D * 0.7, 0.15, opts.color ?? 'nylon_bege', 0, 0, -D * 0.15));
  // atuador (flip-lock) levemente inclinado
  const act = rbox(W - 0.4, H * 0.3, D * 0.45, 0.1, opts.actuator ?? 'pbt_preto', 0, 0, 0);
  const piv = new THREE.Group(); act.position.set(0, 0, -D * 0.22); piv.add(act); piv.position.set(0, H * 0.72, D * 0.05); piv.rotation.x = -6 * DEG; g.add(piv);
  const cm: THREE.Matrix4[] = [];
  const x0 = -(pins - 1) * pitch / 2;
  for (let i = 0; i < pins; i++) cm.push(T(x0 + i * pitch, 0.05, D * 0.32));
  g.add(instanced(new THREE.BoxGeometry(pitch * 0.45, 0.1, 0.9), 'estanho', cm));
  [-1, 1].forEach(sx => g.add(box(0.9, H * 0.6, 1.4, 'aco_inox', sx * (W / 2 + 0.2), 0, -D * 0.1)));
  const pads: PcbPad[] = [];
  for (let i = 0; i < pins; i++) pads.push({ x: x0 + i * pitch, z: D * 0.4, w: pitch * 0.55, d: 1.2 });
  [-1, 1].forEach(sx => pads.push({ x: sx * (W / 2 + 0.2), z: -D * 0.1, w: 1.4, d: 1.8 }));
  const o = fp(g, { pads, outline: { w: W, d: D } });
  o.userData.socketY = H * 0.35; o.userData.socketZ = D * 0.5; o.userData.width = W;
  return o;
}

/** Conector board-to-board (receptáculo fêmea ou plug macho). Duas fileiras, encaixe vertical (+Y). */
export function btbConnector(pins: number, pitch: number, kind: 'recept' | 'plug'): THREE.Object3D {
  const per = Math.ceil(pins / 2);
  const L = per * pitch + 1.6, W = kind === 'recept' ? 2.5 : 1.9, H = kind === 'recept' ? 0.85 : 0.6;
  const g = new THREE.Group();
  const s = roundedRectShape(L, W, 0.3);
  if (kind === 'recept') s.holes.push(holeFromRect(per * pitch + 0.3, W - 1.2));
  g.add(extrudeUp(s, H, 'lcp_preto', 0.05, 12));
  if (kind === 'plug') g.add(box(per * pitch + 0.1, H * 0.6, 0.7, 'lcp_preto', 0, H, 0));
  const cm: THREE.Matrix4[] = [];
  const x0 = -(per - 1) * pitch / 2;
  for (let i = 0; i < per; i++) for (const sz of [-1, 1]) cm.push(T(x0 + i * pitch, 0.02, sz * (W / 2 - 0.15)));
  g.add(instanced(new THREE.BoxGeometry(pitch * 0.5, 0.12, 0.55), 'ouro', cm));
  [-1, 1].forEach(sx => g.add(box(0.5, H + 0.05, W * 0.9, 'aco_inox', sx * (L / 2 - 0.25), 0, 0)));
  const pads: PcbPad[] = [];
  for (let i = 0; i < per; i++) for (const sz of [-1, 1]) pads.push({ x: x0 + i * pitch, z: sz * (W / 2 + 0.25), w: pitch * 0.55, d: 0.7 });
  [-1, 1].forEach(sx => pads.push({ x: sx * (L / 2 - 0.25), z: 0, w: 0.7, d: W * 0.9 }));
  const o = fp(g, { pads, outline: { w: L + 0.3, d: W + 0.9 } });
  o.userData.height = H; o.userData.length = L;
  return o;
}

function holeFromRect(w: number, d: number): THREE.Path { const p = new THREE.Path(); p.moveTo(-w / 2, -d / 2); p.lineTo(-w / 2, d / 2); p.lineTo(w / 2, d / 2); p.lineTo(w / 2, -d / 2); p.closePath(); return p; }

export function jstPH(pins: number, vertical = true): THREE.Object3D {
  const pitch = 2.0, W = (pins - 1) * pitch + 3.9;
  const g = new THREE.Group();
  const s = roundedRectShape(W, 4.5, 0.3); s.holes.push(holeFromRect(W - 1.4, 3.0));
  g.add(extrudeUp(s, 6.0, 'nylon_bege', 0.1, 8));
  g.add(box(W, 0.8, 4.5, 'nylon_bege'));
  const cm: THREE.Matrix4[] = []; for (let i = 0; i < pins; i++) cm.push(T(-(pins - 1) * pitch / 2 + i * pitch, 0.8, 0));
  const pin = new THREE.BoxGeometry(0.5, 4.5, 0.5); pin.translate(0, 2.25, 0);
  g.add(instanced(pin, 'estanho', cm));
  return fp(g, { pads: cm.map(m => { const v = new THREE.Vector3().setFromMatrixPosition(m); return { x: v.x, z: v.z, w: 1.2, d: 1.7, shape: 'oval' as const }; }) });
}

/* ---------------- Blindagem RF, indutor, antena ---------------- */

export function rfShield(w: number, d: number, h: number, label?: { lines: LabelLine[] }): THREE.Object3D {
  const g = new THREE.Group();
  const m = mat('aco_estampado');
  let top: THREE.Material = m;
  if (label) { const t = labelTexture({ w, d, lines: label.lines, bg: '#c2c6ca', ink: '#2e3034', matrix: true }); const lm = labelMaterial(t.map, 'aco_estampado'); lm.metalness = 1; lm.roughness = 0.34; top = lm; }
  const o = mesh(new THREE.BoxGeometry(w, h, d), [m, m, top, m, m, m]); o.position.y = h / 2 + 0.05; g.add(o);
  g.add(box(w + 0.15, 0.25, d + 0.15, 'aco_estampado', 0, 0));
  return fp(g, { pads: [{ x: 0, z: d / 2, w, d: 0.5 }, { x: 0, z: -d / 2, w, d: 0.5 }, { x: w / 2, z: 0, w: 0.5, d }, { x: -w / 2, z: 0, w: 0.5, d }], outline: { w: w + 0.5, d: d + 0.5 } });
}

export function powerInductor(s = 4, h = 2, label = '4R7'): THREE.Object3D {
  const t = labelTexture({ w: s, d: s, lines: [{ text: label, size: s * 0.28 }], bg: '#2b2c2e', ink: '#9a9da2' });
  const top = labelMaterial(t.map, 'ferrite');
  const m = mat('ferrite');
  const g = group(at(mesh(new THREE.BoxGeometry(s, h, s), [m, m, top, m, m, m]), 0, h / 2, 0));
  return fp(g, { pads: [-1, 1].map(sx => ({ x: sx * s * 0.35, z: 0, w: s * 0.3, d: s * 0.8 })) });
}

/** Capacitor eletrolítico radial com respiro em cruz e faixa do negativo. */
export function electrolytic(dia: number, h: number, sleeve = 'plastico_azul', smd = false): THREE.Object3D {
  const g = new THREE.Group();
  const r = dia / 2;
  g.add(cyl(r, h - 0.4, sleeve, 0, smd ? 1.2 : 0, 0, 40));
  g.add(cyl(r - 0.35, 0.4, 'aluminio', 0, (smd ? 1.2 : 0) + h - 0.4, 0, 40));
  g.add(box(dia * 0.7, 0.05, 0.12, 'aco_preto', 0, (smd ? 1.2 : 0) + h - 0.01, 0));
  g.add(box(0.12, 0.05, dia * 0.7, 'aco_preto', 0, (smd ? 1.2 : 0) + h - 0.01, 0));
  const stripe = new THREE.Mesh(new THREE.CylinderGeometry(r + 0.01, r + 0.01, h - 0.6, 24, 1, true, -0.5, 1.0), new THREE.MeshStandardMaterial({ color: '#d8dde4', roughness: 0.5 }));
  stripe.position.y = (smd ? 1.2 : 0) + (h - 0.4) / 2; g.add(stripe);
  if (smd) g.add(box(dia + 0.3, 1.2, dia + 0.3, 'pbt_preto'));
  return fp(g, { pads: smd ? [-1, 1].map(sx => ({ x: sx * dia * 0.38, z: 0, w: dia * 0.3, d: 1.2 })) : [-1, 1].map(sx => ({ x: sx * 1.25, z: 0, w: 1.4, d: 1.4, shape: 'circle' as const })) });
}

export { box, rbox, cyl, cylX, cylZ, mesh, group, at, extrudeUp, roundedRectShape, circlePath, instanced, T };

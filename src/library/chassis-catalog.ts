// Chassis, carcaças e primitivas paramétricas.
import * as THREE from 'three';
import type { ComponentDef } from './types';
import { bool, num, sel, socket, mountSockets } from './types';
import { box, rbox, cyl, cylZ, group, at, extrudeUp, roundedRectShape, squircleShape, circlePath, holeFromShape, mesh, instanced, T as TM, sphere, DEG } from '@/geometry/primitives';
import { screenDims } from './modules/modules';
import { mat } from '@/engine/materials';

const STRUCT: [string, string][] = [['titanio', 'Titânio grau 5'], ['titanio_natural', 'Titânio natural'], ['aluminio', 'Alumínio escovado'], ['aluminio_jateado', 'Alumínio jateado'], ['aluminio_preto', 'Alumínio grafite'], ['aco_inox', 'Aço inox']];

/* ---------------- Celular ---------------- */
export const phoneFrame: ComponentDef = {
  type: 'phone_frame', name: 'Moldura de celular (frame + midframe)', category: 'Chassi e carcaça', defaultMat: null, partNumber: 'FRM',
  description: 'Moldura usinada em CNC com cantos de curvatura contínua, divisões de antena, botões e placa média.',
  cost: p => (p.mat.startsWith('titanio') ? 160 : 70),
  params: {
    w: num('Largura', 71.5, 40, 120), l: num('Altura', 147.6, 80, 220), t: num('Espessura', 8.25, 4, 15), r: num('Raio de canto', 11, 0, 40),
    wall: num('Parede', 1.6, 0.6, 5), mat: sel('Material', 'titanio', STRUCT), mid: num('Altura da placa média', 1.9, 0, 12), midframe: bool('Placa média', true),
    antenna: bool('Divisões de antena', true), buttons: bool('Botões', true), ports: bool('Furos (USB, alto-falante)', true),
  },
  build: p => {
    const outer = squircleShape(p.w, p.l, p.r);
    outer.holes.push(holeFromShape(squircleShape(p.w - 2 * p.wall, p.l - 2 * p.wall, Math.max(0.5, p.r - p.wall)), 96));
    const g = group(extrudeUp(outer, p.t, p.mat, 0.45));
    if (p.midframe) { const mid = extrudeUp(squircleShape(p.w - 2 * p.wall - 0.02, p.l - 2 * p.wall - 0.02, Math.max(0.5, p.r - p.wall)), 0.6, p.mat === 'titanio' ? 'aluminio_jateado' : p.mat); mid.position.y = p.mid; g.add(mid); }
    if (p.antenna) {
      const band = new THREE.MeshPhysicalMaterial({ color: '#2a2b2e', roughness: 0.5 }); band.userData.matKey = 'abs_preto';
      [[p.l * 0.5 - p.r * 1.4, 1], [p.l * 0.5 - p.r * 1.4, -1], [-(p.l * 0.5 - p.r * 1.4), 1], [-(p.l * 0.5 - p.r * 1.4), -1]].forEach(([z, s]) => g.add(box(p.wall + 0.06, p.t - 0.9, 1.1, band, s * (p.w / 2 - p.wall / 2), 0.45, z)));
      g.add(box(1.1, p.t - 0.9, p.wall + 0.06, band, p.w * 0.22, 0.45, p.l / 2 - p.wall / 2));
    }
    if (p.buttons) {
      const btn = (x: number, z: number, len: number) => g.add(rbox(1.0, 2.6, len, 0.5, p.mat, x, p.t / 2 - 1.3, z));
      btn(p.w / 2 + 0.45, -p.l * 0.14, 16); btn(-p.w / 2 - 0.45, -p.l * 0.2, 10); btn(-p.w / 2 - 0.45, -p.l * 0.12, 10); btn(-p.w / 2 - 0.45, -p.l * 0.29, 5);
    }
    if (p.ports) {
      const dark = new THREE.MeshBasicMaterial({ color: '#030303' });
      const usb = rbox(9.2, 3.4, 0.4, 1.6, dark, 0, p.t / 2 - 1.7, p.l / 2 + 0.05); usb.userData.noMass = true; g.add(usb);
      const holes: THREE.Matrix4[] = []; for (let i = 0; i < 6; i++) { holes.push(TM(-17 + i * 2.2, p.t / 2, p.l / 2 + 0.06)); holes.push(TM(9 + i * 2.2, p.t / 2, p.l / 2 + 0.06)); }
      const hg = new THREE.CylinderGeometry(0.6, 0.6, 0.3, 16); hg.rotateX(Math.PI / 2);
      const im = instanced(hg, dark, holes); im.userData.noMass = true; g.add(im);
    }
    return g;
  },
};

export const backPanel: ComponentDef = {
  type: 'back_panel', name: 'Tampa traseira (vidro / policarbonato)', category: 'Chassi e carcaça', defaultMat: null, partNumber: 'BACK',
  description: 'Painel traseiro com recorte ou platô de câmeras. Pode ser vidro, policarbonato transparente, safira ou fibra.',
  cost: p => (p.mat === 'vidro' || p.mat === 'vidro_fosco' ? 45 : 25),
  params: {
    w: num('Largura', 68.2), l: num('Altura', 144.3), t: num('Espessura', 0.8, 0.3, 4), r: num('Raio de canto', 9.4, 0, 40),
    mat: sel('Material', 'policarbonato', [['policarbonato', 'Policarbonato transparente'], ['vidro', 'Vidro temperado'], ['vidro_fosco', 'Vidro fosco'], ['vidro_fume', 'Vidro fumê'], ['fibra_carbono', 'Fibra de carbono'], ['aluminio_preto', 'Alumínio']]),
    cam: sel('Câmeras', 'hole', [['none', 'Sem recorte'], ['hole', 'Recorte'], ['plateau', 'Platô elevado']]),
    cw: num('Recorte largura', 18), cl: num('Recorte altura', 40), cx: num('Recorte X', -22, -60, 60), cz: num('Recorte Z', -50, -110, 110), cr: num('Recorte raio', 6, 0, 20),
  },
  build: p => {
    const sh = squircleShape(p.w, p.l, p.r);
    const camShape = roundedRectShape(p.cw, p.cl, p.cr, p.cx, -p.cz);
    if (p.cam === 'hole') sh.holes.push(holeFromShape(camShape, 48));
    const g = group(extrudeUp(sh, p.t, p.mat, Math.min(0.2, p.t / 3)));
    if (p.cam === 'plateau') { const plat = extrudeUp(roundedRectShape(p.cw + 3, p.cl + 3, p.cr + 1.5, p.cx, -p.cz), 1.2, p.mat, 0.3); plat.position.y = p.t; g.add(plat); }
    return g;
  },
};

export const enclosure: ComponentDef = {
  type: 'enclosure', name: 'Gabinete para impressão 3D', category: 'Chassi e carcaça', defaultMat: null, partNumber: 'ENC',
  description: 'Caixa com paredes, torres para parafusos M3 e tampa — pronta para exportar em STL.',
  cost: p => ((((p.w + 2 * p.wall) * (p.d + 2 * p.wall) * p.wall * 2 + (p.w + p.d) * 2 * p.h * p.wall) / 1000) * 1.24 / 1000) * 110 + 2,
  params: { w: num('Largura interna', 80), d: num('Profundidade interna', 50), h: num('Altura', 32), wall: num('Parede', 2, 0.8, 10), r: num('Raio', 4, 0, 30), lid: bool('Tampa', false), towers: bool('Torres M3', true), mat: sel('Material', 'pla_cinza', [['pla_cinza', 'PLA cinza'], ['petg_preto', 'PETG preto'], ['abs_branco', 'ABS branco'], ['aluminio_preto', 'Alumínio usinado']]) },
  sockets: p => p.towers ? mountSockets([[1, 1], [-1, 1], [1, -1], [-1, -1]].map(([a, c]) => [a * (p.w / 2 - 4), c * (p.d / 2 - 4)]), p.wall + 6, 't').filter(s => s.kind === 'mount-top').map(s => ({ ...s, kind: 'standoff-top' as const })) : [],
  build: p => {
    const g = new THREE.Group(); const W = p.w + 2 * p.wall, D = p.d + 2 * p.wall;
    const ring = roundedRectShape(W, D, p.r + p.wall); ring.holes.push(holeFromShape(roundedRectShape(p.w, p.d, p.r)));
    g.add(at(extrudeUp(ring, p.h - p.wall, p.mat, 0.4), 0, p.wall, 0));
    g.add(extrudeUp(roundedRectShape(W, D, p.r + p.wall), p.wall + 0.01, p.mat, 0.4));
    if (p.towers) [[1, 1], [-1, 1], [1, -1], [-1, -1]].forEach(([a, c]) => { const s = new THREE.Shape(); s.absarc(0, 0, 3, 0, Math.PI * 2); s.holes.push(circlePath(1.25)); g.add(at(extrudeUp(s, 6, p.mat), a * (p.w / 2 - 4), p.wall, c * (p.d / 2 - 4))); });
    if (p.lid) g.add(at(extrudeUp(roundedRectShape(W, D, p.r + p.wall), p.wall, p.mat, 0.4), 0, p.h + 0.3, 0));
    return g;
  },
};

export const laptopBase: ComponentDef = {
  type: 'laptop_base', name: 'Chassi base de notebook (unibody)', category: 'Chassi e carcaça', defaultMat: null, cost: 320, partNumber: 'NB-BASE',
  params: { size: num('Tela', 14, 10, 18, 0.1, 'pol'), h: num('Espessura', 15.5, 8, 30), mat: sel('Material', 'aluminio_jateado', STRUCT), keyboard: bool('Teclado e touchpad', true) },
  build: p => {
    const [L] = screenDims(p.size, '16:10'); const W = L + 14, D = W * 0.69;
    const g = group(extrudeUp(squircleShape(W, D, 9), p.h, p.mat, 1.2));
    if (p.keyboard) {
      const well = box(W * 0.86, 0.4, D * 0.44, 'aco_preto', 0, p.h - 0.35, -D * 0.12); g.add(well);
      const kw = (W * 0.86) / 15; const mats: THREE.Matrix4[] = [];
      for (let r = 0; r < 6; r++) for (let c = 0; c < 15; c++) mats.push(TM(-W * 0.43 + kw / 2 + c * kw, p.h - 0.1, -D * 0.12 - D * 0.22 + kw * 0.5 + r * ((D * 0.44) / 6)));
      const key = new THREE.BoxGeometry(kw * 0.84, 0.9, kw * 0.84); key.translate(0, 0.45, 0);
      g.add(instanced(key, 'abs_preto', mats));
      g.add(rbox(W * 0.38, 0.3, D * 0.28, 2, 'vidro_fosco', 0, p.h - 0.2, D * 0.3));
    }
    return g;
  },
};

export const laptopLid: ComponentDef = {
  type: 'laptop_lid', name: 'Tampa de notebook com tela', category: 'Chassi e carcaça', defaultMat: null, cost: 700, partNumber: 'NB-LID',
  params: { size: num('Tela', 14, 10, 18, 0.1, 'pol'), angle: num('Abertura', 110, 0, 180, 1, '°'), t: num('Espessura', 5, 2.5, 12), mat: sel('Material', 'aluminio_jateado', STRUCT) },
  build: p => {
    const [L, S] = screenDims(p.size, '16:10'); const W = L + 14, H = S + 16;
    const panel = new THREE.MeshPhysicalMaterial({ color: '#05070b', emissive: '#1d3b8f', emissiveIntensity: 0.8, roughness: 0.1, clearcoat: 1 });
    const lid = group(extrudeUp(squircleShape(W, H, 8), p.t, p.mat, 0.8), box(L, 0.2, S, panel, 0, p.t, -1), box(W - 2, 0.3, H - 2, 'vidro', 0, p.t + 0.2, 0));
    lid.position.z = -H / 2;
    const piv = new THREE.Group(); piv.add(lid); piv.rotation.x = (180 - p.angle) * DEG;
    return group(piv);
  },
};

/* ---------------- Primitivas ---------------- */
const PRIM_MATS: [string, string][] = [['pla_cinza', 'PLA cinza'], ['aluminio', 'Alumínio'], ['aco_inox', 'Inox'], ['titanio', 'Titânio'], ['abs_preto', 'ABS preto'], ['acrilico', 'Acrílico'], ['vidro', 'Vidro'], ['fibra_carbono', 'Carbono']];

export const primBox: ComponentDef = {
  type: 'box', name: 'Caixa', category: 'Primitivas', cost: 0, defaultMat: 'pla_cinza',
  params: { w: num('Largura (X)', 40), h: num('Altura (Y)', 20), d: num('Profundidade (Z)', 30), r: num('Raio de borda', 0, 0, 200) },
  build: p => (p.r > 0 ? rbox(p.w, p.h, p.d, p.r, 'pla_cinza', 0, 0, 0, 5) : box(p.w, p.h, p.d, 'pla_cinza')),
};
export const primCyl: ComponentDef = {
  type: 'cylinder', name: 'Cilindro', category: 'Primitivas', cost: 0, defaultMat: 'pla_cinza',
  params: { r: num('Raio', 10), h: num('Altura', 20), seg: num('Segmentos', 64, 3, 256, 1, '') },
  build: p => cyl(p.r, p.h, 'pla_cinza', 0, 0, 0, Math.round(p.seg)),
};
export const primSphere: ComponentDef = {
  type: 'sphere', name: 'Esfera', category: 'Primitivas', cost: 0, defaultMat: 'pla_cinza',
  params: { r: num('Raio', 10) }, build: p => sphere(p.r, 'pla_cinza', 0, p.r, 0, 64),
};
export const primTube: ComponentDef = {
  type: 'tube', name: 'Tubo', category: 'Primitivas', cost: 0, defaultMat: 'aluminio',
  params: { ro: num('Raio externo', 10), ri: num('Raio interno', 8), h: num('Altura', 30) },
  build: p => { const s = new THREE.Shape(); s.absarc(0, 0, p.ro, 0, Math.PI * 2); s.holes.push(circlePath(Math.min(p.ri, p.ro - 0.05))); return extrudeUp(s, p.h, 'aluminio'); },
};
export const primCone: ComponentDef = {
  type: 'cone', name: 'Cone / tronco', category: 'Primitivas', cost: 0, defaultMat: 'pla_cinza',
  params: { r1: num('Raio base', 12), r2: num('Raio topo', 0, 0), h: num('Altura', 24) }, build: p => cyl(p.r1, p.h, 'pla_cinza', 0, 0, 0, 64, p.r2),
};
export const primTorus: ComponentDef = {
  type: 'torus', name: 'Toro / anel', category: 'Primitivas', cost: 0, defaultMat: 'pla_cinza',
  params: { R: num('Raio maior', 15), r: num('Raio do tubo', 3) },
  build: p => { const m = mesh(new THREE.TorusGeometry(p.R, p.r, 32, 96), 'pla_cinza'); m.rotation.x = Math.PI / 2; m.position.y = p.r; return m; },
};
export const primProfile: ComponentDef = {
  type: 'profile', name: 'Perfil extrudado', category: 'Primitivas', cost: 0, defaultMat: 'aluminio',
  params: {
    shape: sel('Perfil', 'squircle', [['rrect', 'Retângulo arredondado'], ['squircle', 'Squircle (G2)'], ['circle', 'Círculo / elipse'], ['poly', 'Polígono regular'], ['L', 'Cantoneira L'], ['slot', 'Oblongo']]),
    w: num('Largura', 60), d: num('Profundidade', 30), h: num('Extrusão', 8), r: num('Raio de canto', 6, 0), sides: num('Lados', 6, 3, 64, 1, ''), wall: num('Parede (0 = sólido)', 0, 0), bevel: num('Chanfro', 0.3, 0, 20),
  },
  build: p => {
    const make = (w: number, d: number, r: number): THREE.Shape => {
      switch (p.shape) {
        case 'squircle': return squircleShape(w, d, r);
        case 'circle': { const c = new THREE.Shape(); c.absellipse(0, 0, w / 2, d / 2, 0, Math.PI * 2, false, 0); return c; }
        case 'poly': { const c = new THREE.Shape(); const k = Math.round(p.sides); for (let i = 0; i <= k; i++) { const a = (i / k) * Math.PI * 2; i ? c.lineTo(Math.cos(a) * w / 2, Math.sin(a) * d / 2) : c.moveTo(w / 2, 0); } return c; }
        case 'L': { const c = new THREE.Shape(); const t = Math.max(1, r || w / 4); c.moveTo(-w / 2, -d / 2); c.lineTo(w / 2, -d / 2); c.lineTo(w / 2, -d / 2 + t); c.lineTo(-w / 2 + t, -d / 2 + t); c.lineTo(-w / 2 + t, d / 2); c.lineTo(-w / 2, d / 2); c.closePath(); return c; }
        case 'slot': return roundedRectShape(w, d, Math.min(w, d) / 2 - 0.001);
        default: return roundedRectShape(w, d, r);
      }
    };
    const sh = make(p.w, p.d, p.r);
    if (p.wall > 0 && p.shape !== 'L') sh.holes.push(holeFromShape(make(Math.max(0.1, p.w - 2 * p.wall), Math.max(0.1, p.d - 2 * p.wall), Math.max(0, p.r - p.wall)), 64));
    return extrudeUp(sh, p.h, 'aluminio', p.bevel);
  },
};

export { mat, cylZ, socket };

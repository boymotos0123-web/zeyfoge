// Módulos: tela de celular (camadas ópticas + flex MIPI-DSI), câmeras (lentes multicamadas + flex CSI),
// bateria Li-Po com placa de proteção (BMS), células, bobina Qi, OLED 0,96", placas de celular com conectores BTB.
import * as THREE from 'three';
import type { ComponentDef } from '../types';
import { bool, num, sel, socket, inferPinType, mountSockets } from '../types';
import { box, rbox, cyl, cylZ, group, at, extrudeUp, roundedRectShape, squircleShape, shapeTop, circlePath, mesh, lathe, DEG } from '@/geometry/primitives';
import { Board } from '@/geometry/board';
import { bga, btbConnector, header, qfn, rfShield, smdPassive, sot23, usbCReceptacle, zifConnector, icBody, powerInductor, fp } from '@/geometry/parts';
import { mat, clipPlanes } from '@/engine/materials';
import { canvasTexture, makeCanvas } from '@/engine/textures/canvas';
import { OLED_I2C } from '../pinouts';
import type { Vec3 } from '@/core/types';

export function screenDims(diag: number, aspect: string): [number, number] {
  const [a, c] = aspect.split(':').map(Number);
  const k = (diag * 25.4) / Math.hypot(a, c);
  return [a * k, c * k];
}

const wallCache = new Map<string, THREE.Texture>();
function wallpaper(style: string, w: number, l: number): THREE.Texture {
  const key = style + w.toFixed(1) + l.toFixed(1);
  const hit = wallCache.get(key); if (hit) return hit;
  const s = 1024 / l, W = Math.round(w * s), H = 1024;
  const c = makeCanvas(W, H), g = c.getContext('2d')!;
  const palettes: Record<string, string[]> = { aurora: ['#0b1026', '#3a1c71', '#d76d77', '#ffaf7b'], oceano: ['#020617', '#0c4a6e', '#0ea5e9', '#a5f3fc'], grafite: ['#050505', '#1f2937', '#4b5563', '#9ca3af'] };
  const p = palettes[style] || palettes.aurora;
  const gr = g.createLinearGradient(0, 0, W * 0.3, H); p.forEach((col, i) => gr.addColorStop(i / (p.length - 1), col));
  g.fillStyle = gr; g.fillRect(0, 0, W, H);
  for (let i = 0; i < 5; i++) { const rg = g.createRadialGradient(W * (0.2 + i * 0.17), H * (0.35 + (i % 2) * 0.3), 0, W * (0.2 + i * 0.17), H * (0.35 + (i % 2) * 0.3), W * 0.6); rg.addColorStop(0, p[(i + 2) % p.length] + '88'); rg.addColorStop(1, '#00000000'); g.fillStyle = rg; g.fillRect(0, 0, W, H); }
  g.fillStyle = 'rgba(255,255,255,0.95)'; g.textAlign = 'center';
  g.font = `200 ${W * 0.26}px "Inter","Helvetica Neue",Arial,sans-serif`; g.fillText('12:07', W / 2, H * 0.2);
  g.font = `500 ${W * 0.045}px "Inter",Arial,sans-serif`; g.fillText('segunda-feira, 16 de novembro', W / 2, H * 0.1);
  g.fillStyle = 'rgba(255,255,255,0.55)'; g.beginPath(); g.roundRect(W * 0.35, H * 0.975, W * 0.3, H * 0.006, H * 0.003); g.fill();
  g.fillStyle = '#000'; g.beginPath(); g.roundRect(W / 2 - W * 0.13, H * 0.018, W * 0.26, H * 0.032, H * 0.016); g.fill(); // ilha da câmera frontal
  const t = canvasTexture(c, true, 8);
  t.repeat.set(1 / w, 1 / l); t.offset.set(0.5, 0.5); t.wrapS = t.wrapT = THREE.ClampToEdgeWrapping;
  wallCache.set(key, t);
  return t;
}

/* ---------------- Tela de celular ---------------- */
export const phoneDisplay: ComponentDef = {
  type: 'phone_display', name: 'Tela OLED de celular (módulo)', category: 'Telas e câmeras', partNumber: 'OLED-LTPO',
  description: 'Vidro temperado 2.5D + polarizador + painel OLED + dissipador de grafite/cobre, com flex MIPI-DSI e driver (DDIC).',
  cost: 280, mass: p => { const [L, S] = screenDims(p.diag, p.aspect); return L * S * (0.6 * 2.42 + 0.8 * 1.6) / 1000 + 2; },
  params: {
    diag: num('Diagonal', 6.1, 1, 14, 0.01, 'pol'), aspect: sel('Proporção', '19.5:9', [['19.5:9', '19,5:9'], ['20:9', '20:9'], ['19:9', '19:9'], ['16:9', '16:9'], ['4:3', '4:3 (tablet)']]),
    r: num('Raio de canto', 9.5, 0, 30), on: bool('Ligada', true), wall: sel('Papel de parede', 'aurora', [['aurora', 'Aurora'], ['oceano', 'Oceano'], ['grafite', 'Grafite']]),
  },
  sockets: p => { const [L] = screenDims(p.diag, p.aspect); return [socket({ id: 'DSI', label: 'Flex MIPI-DSI (34 vias)', kind: 'mipi-dsi', pins: 34, pitch: 0.35, pos: [18, -0.35, L / 2 - 8], normal: [0, -1, 0], axis: [1, 0, 0], termination: 'solder' })]; },
  build: p => {
    const [L, S] = screenDims(p.diag, p.aspect);
    const w = S, l = L;
    const g = new THREE.Group();
    const sh = (dw: number, r: number) => squircleShape(w + dw, l + dw, r);
    g.add(extrudeUp(sh(-1.2, Math.max(0.5, p.r - 0.6)), 0.12, 'cobre'));
    g.add(at(extrudeUp(sh(0, p.r), 0.6, 'tela_off'), 0, 0.12, 0));
    if (p.on) {
      const panel = new THREE.MeshPhysicalMaterial({ color: '#000000', emissive: '#ffffff', emissiveMap: wallpaper(p.wall, w, l), emissiveIntensity: 1.25, roughness: 0.25, clearcoat: 1 });
      panel.clippingPlanes = clipPlanes; panel.userData.matKey = 'tela_on';
      const top = shapeTop(sh(-1.6, Math.max(0.5, p.r - 0.8)), 0.725, panel); top.userData.noMass = true; g.add(top);
    }
    g.add(at(extrudeUp(sh(0, p.r), 0.12, 'polarizador'), 0, 0.73, 0));
    g.add(at(extrudeUp(sh(0.4, p.r + 0.2), 0.6, 'vidro', 0.22), 0, 0.85, 0));
    // cauda do flex dobrada por baixo com o DDIC
    const tail = group(box(22, 0.1, 14, 'poliimida', 18, -0.12, l / 2 - 9), icBody(16, 1.4, 0.25, [{ text: 'DDIC', size: 0.8 }], {}, -0.38));
    tail.children[1].position.set(18, -0.38 - 0.125, l / 2 - 11);
    g.add(tail);
    return g;
  },
};

/* ---------------- Câmera de celular ---------------- */
function lensStack(r: number, h: number, ois: boolean): THREE.Group {
  const g = new THREE.Group();
  g.add(lathe([[r + 0.9, 0], [r + 0.9, h * 0.7], [r + 0.55, h], [r + 0.15, h], [r + 0.15, h * 0.85], [r * 0.95, h * 0.8], [r * 0.95, h * 0.2], [0.01, h * 0.2]], ois ? 'aco_inox' : 'pbt_preto', 48));
  g.add(cyl(r * 0.92, 0.25, 'lente', 0, h * 0.45, 0, 48));
  g.add(cyl(r * 0.75, 0.25, 'lente', 0, h * 0.3, 0, 48));
  g.add(cyl(r * 0.55, 0.1, 'sensor_cmos', 0, h * 0.21, 0, 32));
  const cover = cyl(r + 0.1, 0.35, 'safira', 0, h - 0.4, 0, 64); g.add(cover);
  const ar = lathe([[r * 0.98, 0], [r * 0.75, 0.02], [0.01, 0.03]], 'lente', 48); ar.position.y = h - 0.05; g.add(ar);
  return g;
}

export const phoneCamera: ComponentDef = {
  type: 'phone_camera', name: 'Módulo de câmera (celular)', category: 'Telas e câmeras', partNumber: 'CAM-MOD',
  description: 'Sensor CMOS + pilha de lentes com tratamento antirreflexo, vidro de safira e flex MIPI-CSI.', cost: p => (p.ois ? 120 : 60), mass: p => p.w * p.d * p.h * 0.0022,
  params: { w: num('Largura', 11, 4, 30), d: num('Profundidade', 11, 4, 30), h: num('Altura', 5.2, 2, 15), lens: num('Ø da lente', 7.5, 1, 25), ois: bool('Estabilizador óptico (OIS)', true) },
  sockets: p => [socket({ id: 'CSI', label: 'Flex MIPI-CSI (24 vias)', kind: 'mipi-csi', pins: 24, pitch: 0.35, pos: [p.w / 2 + 0.5, 0.3, 0], normal: [1, 0, 0], axis: [0, 0, 1], termination: 'solder' })],
  build: p => {
    const g = new THREE.Group();
    const baseH = p.h * 0.55;
    g.add(rbox(p.w, baseH, p.d, 0.4, p.ois ? 'aco_estampado' : 'pbt_preto'));
    g.add(box(p.w - 0.6, 0.05, p.d - 0.6, 'aco_preto', 0, baseH));
    const ls = lensStack(p.lens / 2, p.h - baseH + 0.3, p.ois); ls.position.y = baseH - 0.3; g.add(ls);
    g.add(box(1.2, 0.2, Math.min(8, p.d * 0.7), 'poliimida', p.w / 2 + 0.4, 0.2, 0));
    return g;
  },
};

/* ---------------- Câmera Raspberry Pi v2 ---------------- */
export const rpiCamera: ComponentDef = {
  type: 'rpi_camera_v2', name: 'Câmera Raspberry Pi v2 (8 MP)', category: 'Telas e câmeras', partNumber: 'RPI-CAM-V2',
  description: 'Sensor IMX219 8 MP, lente de foco fixo, conector FFC de 15 vias (CSI-2).', cost: 160, mass: 3,
  params: {},
  sockets: () => [socket({ id: 'CSI', label: 'CSI (FFC 15 vias)', kind: 'mipi-csi', pins: 15, pitch: 1.0, pos: [0, -0.6, 12 + 1.8], normal: [0, 0, 1], axis: [1, 0, 0], termination: 'zif' }), ...mountSockets([[-10.5, -10.5], [10.5, -10.5], [-10.5, 2], [10.5, 2]], 1)],
  build: () => {
    const holes = [[-10.5, -10.5], [10.5, -10.5], [-10.5, 2], [10.5, 2]].map(([x, z]) => ({ x, z, r: 1.1, ring: 0.6 }));
    const b = new Board({ w: 25, d: 24, t: 1.0, corner: 1, mask: 'fr4_verde', seed: 219, holes, traceDensity: 0.4 });
    const cam = group(box(8.5, 2.6, 8.5, 'pbt_preto'));
    const ls = lensStack(2.2, 2.6, false); ls.position.y = 2.6; cam.add(ls);
    b.add(fp(cam, { pads: [], outline: { w: 9, d: 9 } }), 0, -2.5, 0, { ref: 'J1' });
    b.add(fp(group(box(9, 0.1, 6, 'poliimida')), { pads: [] }), 0, 3.6, 0);
    [[-7, 7], [-5, 7], [5, 7], [7, 7], [-8, 3], [8, 3]].forEach(([x, z], i) => b.add(smdPassive('0402', i % 2 ? 'cap' : 'res'), x, z));
    b.silk('CAMERA V2.1', 0, 9.6, 1.0, { weight: 700 });
    const o = b.build();
    const zif = zifConnector(15, 1.0, { color: 'pbt_preto', actuator: 'nylon_bege' });
    zif.rotation.x = Math.PI; zif.position.set(0, 0, 12 - 2.3); o.add(zif);
    return o;
  },
};

/* ---------------- Bateria Li-Po com BMS ---------------- */
export const lipoBattery: ComponentDef = {
  type: 'lipo', name: 'Bateria Li-Po (pouch) com BMS', category: 'Energia', partNumber: 'LP-POUCH',
  description: 'Célula pouch de lítio-polímero 3,85 V com placa de proteção (DW01A + FS8205A) sob fita de poliimida.',
  cost: p => 8 + p.mah * 0.012, mass: p => p.mah * 0.0185 + 1.5,
  params: { w: num('Largura', 60, 10, 300), l: num('Comprimento', 68, 15, 300), h: num('Espessura', 3.9, 0.8, 30), mah: num('Capacidade', 4000, 50, 30000, 50, 'mAh'), conn: sel('Saída', 'btb', [['btb', 'Flex com BTB (celular)'], ['jst', 'Fios + JST-PH 2 vias']]) },
  sockets: p => p.conn === 'btb'
    ? [socket({ id: 'BMS', label: 'Saída BMS (6 vias)', kind: 'bms', pins: 6, pitch: 0.4, pos: [0, p.h * 0.5, p.l / 2 + 0.2], normal: [0, 0, 1], axis: [1, 0, 0], pinNames: ['BAT+', 'BAT+', 'NTC', 'ID', 'GND', 'GND'], pinTypes: ['vbat', 'vbat', 'signal', 'signal', 'gnd', 'gnd'], termination: 'solder' })]
    : [socket({ id: 'JST', label: 'JST-PH (BAT+, GND)', kind: 'jst', pins: 2, pitch: 2.0, pos: [0, p.h * 0.5, p.l / 2 + 0.2], normal: [0, 0, 1], axis: [1, 0, 0], pinNames: ['BAT+', 'GND'], pinTypes: ['vbat', 'gnd'], termination: 'solder' })],
  build: p => {
    const g = new THREE.Group();
    const cellL = p.l - 5.5;
    g.add(rbox(p.w, p.h, cellL, Math.min(1.4, p.h / 2.3), 'bateria_pouch', 0, 0, -2.75));
    g.add(box(p.w - 0.4, 0.15, 2.5, 'bateria_pouch', 0, p.h * 0.45, cellL / 2 - 2.75 + 1.2));
    [-1, 1].forEach(sx => g.add(box(0.6, p.h * 0.9, cellL - 2, 'bateria_pouch', sx * (p.w / 2 + 0.25), p.h * 0.05, -2.75)));
    // placa de proteção (PCM)
    const pcm = new Board({ w: p.w * 0.72, d: 4.2, t: 0.6, corner: 0.3, mask: 'fr4_verde', seed: 8205, traceDensity: 0.5, pour: false });
    pcm.add(sot23([{ text: 'DW01A', size: 0.5 }], 6), -p.w * 0.12, 0, 0);
    pcm.add(sot23([{ text: '8205A', size: 0.5 }], 6), p.w * 0.06, 0, 0);
    pcm.add(smdPassive('0402', 'res'), -p.w * 0.22, 0.8); pcm.add(smdPassive('0402', 'cap'), p.w * 0.2, -0.8);
    const pcmObj = pcm.build(); pcmObj.position.set(0, p.h * 0.5 - 0.3, p.l / 2 - 2.6); g.add(pcmObj);
    [-1, 1].forEach(sx => g.add(box(3.5, 0.12, 2.6, sx < 0 ? 'aluminio' : 'niquel', sx * p.w * 0.3, p.h * 0.5 + 0.3, p.l / 2 - 3.6)));
    const tape = box(p.w * 0.8, 0.06, 5.0, 'poliimida', 0, p.h * 0.5 + 0.62, p.l / 2 - 2.6); tape.userData.noMass = true; g.add(tape);
    const lbl = makeCanvas(512, 256); const c = lbl.getContext('2d')!; c.fillStyle = '#9da3ab'; c.fillRect(0, 0, 512, 256); c.fillStyle = '#1f2125'; c.font = '700 54px Inter, Arial'; c.fillText(`Li-Po ${p.mah} mAh`, 30, 80); c.font = '500 34px Inter, Arial'; c.fillText(`3.85 V · ${(p.mah * 3.85 / 1000).toFixed(2)} Wh`, 30, 140); c.fillText('NÃO PERFURAR · NÃO AQUECER', 30, 200);
    const lt = canvasTexture(lbl, true, 8); const lm = new THREE.MeshPhysicalMaterial({ map: lt, metalness: 0.6, roughness: 0.4 }); lm.clippingPlanes = clipPlanes;
    const label = new THREE.Mesh(new THREE.PlaneGeometry(p.w * 0.7, p.w * 0.35), lm); label.rotation.x = -Math.PI / 2; label.position.set(0, p.h + 0.01, -p.l * 0.1); label.userData.noMass = true; g.add(label);
    if (p.conn === 'jst') g.add(box(4, 1.2, 3, 'nylon_bege', 0, p.h * 0.5 - 0.6, p.l / 2 - 0.5));
    else g.add(box(Math.min(8, p.w * 0.25), 0.12, 2.5, 'poliimida', 0, p.h * 0.5, p.l / 2 - 1));
    return g;
  },
};

export const cell18650: ComponentDef = {
  type: 'cell18650', name: 'Célula 18650', category: 'Energia', partNumber: 'INR18650', cost: 22, mass: 46,
  description: 'Célula cilíndrica Li-ion 18 × 65 mm, 3,6 V nominal.',
  params: { color: sel('Capa', 'plastico_azul', [['plastico_azul', 'Azul'], ['plastico_vermelho', 'Vermelha'], ['abs_preto', 'Preta']]) },
  sockets: () => [socket({ id: 'P', label: 'Polo +', kind: 'custom', pos: [32.5, 9, 0], normal: [1, 0, 0], pinTypes: ['vbat'], termination: 'solder' }), socket({ id: 'N', label: 'Polo −', kind: 'custom', pos: [-32.5, 9, 0], normal: [-1, 0, 0], pinTypes: ['gnd'], termination: 'solder' })],
  build: p => {
    const g = new THREE.Group();
    const body = group(cyl(9, 64.2, p.color, 0, 0, 0, 48), cyl(8.4, 0.4, 'niquel', 0, 64.2, 0, 48), cyl(3.2, 0.6, 'niquel', 0, 64.4, 0, 32), cyl(7.5, 0.3, 'abs_branco', 0, 64.1, 0, 48), cyl(8.7, 0.3, 'niquel', 0, -0.3, 0, 48));
    body.rotation.z = -Math.PI / 2; body.position.set(-32.2, 9, 0); g.add(body);
    return g;
  },
};

export const qiCoil: ComponentDef = {
  type: 'qi_coil', name: 'Bobina de carregamento sem fio (Qi)', category: 'Energia', cost: 18, partNumber: 'QI-RX-COIL',
  description: 'Bobina receptora em espiral sobre ferrite, com anel de ímãs opcional (alinhamento magnético).',
  params: { ro: num('Raio externo', 20, 5, 60), ri: num('Raio interno', 8, 1, 50), magnets: bool('Anel de ímãs', true) },
  build: p => {
    const g = new THREE.Group();
    const f = new THREE.Shape(); f.absarc(0, 0, p.ro + 1, 0, Math.PI * 2); g.add(extrudeUp(f, 0.25, 'ferrite', 0, 64));
    const turns = Math.max(1, Math.floor((p.ro - p.ri) / 0.75));
    const pts: THREE.Vector3[] = [];
    for (let i = 0; i <= turns * 96; i++) { const a = (i / 96) * Math.PI * 2; const r = p.ri + (p.ro - p.ri) * (i / (turns * 96)); pts.push(new THREE.Vector3(Math.cos(a) * r, 0.5, Math.sin(a) * r)); }
    const wire = mesh(new THREE.TubeGeometry(new THREE.CatmullRomCurve3(pts), turns * 96, 0.28, 6), 'cobre'); g.add(wire);
    if (p.magnets) { const ring = new THREE.Shape(); ring.absarc(0, 0, p.ro + 6, 0, Math.PI * 2); ring.holes.push(circlePath(p.ro + 2.5)); g.add(extrudeUp(ring, 0.55, 'aco_preto', 0, 96)); }
    g.add(box(4, 0.15, 6, 'poliimida', p.ro * 0.4, 0.4, p.ro + 3));
    return g;
  },
};

export const oled096: ComponentDef = {
  type: 'oled096', name: 'Módulo OLED 0,96" I²C (SSD1306)', category: 'Telas e câmeras', cost: 18, mass: 3, partNumber: 'SSD1306-128x64',
  description: 'Display OLED monocromático 128×64, I²C, 3,3–5 V.',
  params: { on: bool('Ligada', true) },
  sockets: () => [socket({ id: 'I2C', label: 'GND · VCC · SCL · SDA', kind: 'header-male', pins: 4, pitch: 2.54, pos: [0, 1.2 + 8.6, -27.8 / 2 + 1.5], normal: [0, 1, 0], axis: [1, 0, 0], pinNames: OLED_I2C, pinTypes: OLED_I2C.map(inferPinType), logicVoltage: 5, termination: 'pin' })],
  build: p => {
    const W = 27.3, D = 27.8;
    const holes = [[1, 1], [-1, 1], [1, -1], [-1, -1]].map(([a, c]) => ({ x: a * (W / 2 - 2), z: c * (D / 2 - 2), r: 1.0, ring: 0.5 }));
    const b = new Board({ w: W, d: D, t: 1.2, corner: 0.6, mask: 'fr4_azul', seed: 1306, holes, traceDensity: 0.3 });
    b.add(header(4, 1, false), 0, -D / 2 + 1.5, 0, { outline: false });
    OLED_I2C.forEach((n, i) => b.silk(n, -3.81 + i * 2.54, -D / 2 + 4.2, 0.8));
    const o = b.build();
    o.add(box(26.7, 1.5, 19.3, 'vidro_fume', 0, 1.2, 1.2));
    if (p.on) {
      const c = makeCanvas(256, 128), g = c.getContext('2d')!; g.fillStyle = '#000'; g.fillRect(0, 0, 256, 128); g.fillStyle = '#7fd3ff'; g.font = '700 30px monospace'; g.fillText('ZeyForge', 50, 50); g.font = '20px monospace'; g.fillText('T:24.6C H:51%', 34, 96);
      const m = new THREE.MeshBasicMaterial({ map: canvasTexture(c, true, 4) }); m.clippingPlanes = clipPlanes;
      const s = new THREE.Mesh(new THREE.PlaneGeometry(21.7, 10.9), m); s.rotation.x = -Math.PI / 2; s.position.set(0, 2.72, 0.5); s.userData.noMass = true; o.add(s);
    }
    return o;
  },
};

/* ---------------- Placas de celular (logic board + sub-board) ---------------- */
export const PHONE_BOARD = { w: 42, d: 54 };
const BTB_Y = 0.8 + 0.85;

export const phoneLogicBoard: ComponentDef = {
  type: 'phone_logicboard', name: 'Placa principal de celular (HDI 10 camadas)', category: 'Placas de celular', partNumber: 'LB-HDI10',
  description: 'SoC com RAM empilhada (PoP), UFS, PMIC, modem 5G sob blindagens e receptáculos board-to-board para tela, câmeras, bateria e sub-placa.',
  cost: 690, params: {},
  sockets: () => [
    socket({ id: 'DSI', label: 'Tela (MIPI-DSI 34p)', kind: 'mipi-dsi', pins: 34, pitch: 0.35, pos: [6, BTB_Y, -6], normal: [0, 0, -1], axis: [1, 0, 0], termination: 'btb' }),
    socket({ id: 'CSI1', label: 'Câmera principal (CSI 24p)', kind: 'mipi-csi', pins: 24, pitch: 0.35, pos: [-17.5, BTB_Y, -22], normal: [-1, 0, 0], axis: [0, 0, 1], termination: 'btb' }),
    socket({ id: 'CSI2', label: 'Ultra-wide (CSI 24p)', kind: 'mipi-csi', pins: 24, pitch: 0.35, pos: [-17.5, BTB_Y, -10], normal: [-1, 0, 0], axis: [0, 0, 1], termination: 'btb' }),
    socket({ id: 'CSI3', label: 'Tele (CSI 24p)', kind: 'mipi-csi', pins: 24, pitch: 0.35, pos: [-17.5, BTB_Y, 2], normal: [-1, 0, 0], axis: [0, 0, 1], termination: 'btb' }),
    socket({ id: 'BMS', label: 'Bateria (BMS 6p)', kind: 'bms', pins: 6, pitch: 0.4, pos: [-12, BTB_Y, 24], normal: [0, 0, 1], axis: [1, 0, 0], pinNames: ['BAT+', 'BAT+', 'NTC', 'ID', 'GND', 'GND'], pinTypes: ['vbat', 'vbat', 'signal', 'signal', 'gnd', 'gnd'], termination: 'btb' }),
    socket({ id: 'SUB', label: 'Sub-placa USB (FPC 30p)', kind: 'fpc', pins: 30, pitch: 0.3, pos: [4, BTB_Y, 24], normal: [0, 0, 1], axis: [1, 0, 0], termination: 'btb' }),
  ],
  build: () => {
    const { w, d } = PHONE_BOARD;
    const b = new Board({ w, d, t: 0.8, corner: 2.5, mask: 'fr4_preto', seed: 8810, traceDensity: 0.9, holes: [[-17, -23], [17, -23], [-17, 21], [12, 15]].map(([x, z]) => ({ x, z, r: 0.7, ring: 0.6 })) });
    b.add(bga(13, 13, 1.25, [{ text: 'ZF-1 PRO', size: 1.3, weight: 700 }, { text: 'N3E · 2425', size: 0.8, font: 'mono' }, { text: 'LPDDR5X 12GB', size: 0.75 }]), 3, -16, 0, { ref: 'U1000' });
    b.add(bga(11.5, 13, 1.0, [{ text: 'UFS 4.0', size: 1.1, weight: 700 }, { text: '512GB', size: 0.9 }]), -8, 6, 0, { ref: 'U2000' });
    b.add(rfShield(14, 11, 1.1, { lines: [{ text: '5G NR', size: 1.4, weight: 800 }, { text: 'SUB-6 / mmW', size: 0.8 }] }), 9, 8, 0, { ref: 'SH1' });
    b.add(qfn(6, 6, 0.75, 12, [{ text: 'PMIC', size: 1.0, weight: 700 }, { text: 'ZP-7', size: 0.7 }], 0.4), -10, -6, 0, { ref: 'U3000' });
    b.add(qfn(4, 4, 0.6, 8, [{ text: 'AUD', size: 0.8 }], 0.4), 14, -18, 0, { ref: 'U4000' });
    b.add(rfShield(7, 7, 0.9, { lines: [{ text: 'WIFI 7', size: 0.9, weight: 700 }] }), -9, -21, 0, { ref: 'SH2' });
    for (let i = 0; i < 70; i++) { const x = -18 + ((i * 7.31) % 36), z = -24 + ((i * 11.7) % 48); if (Math.abs(x - 3) < 8 && Math.abs(z + 16) < 8) continue; if (Math.abs(x - 6) < 5 && Math.abs(z + 4.5) < 2.5) continue; if (Math.abs(x + 8) < 7 && Math.abs(z - 6) < 8) continue; if (Math.abs(x - 9) < 8 && Math.abs(z - 8) < 7) continue; if (Math.abs(x + 9) < 5 && Math.abs(z + 21) < 5) continue; if (Math.abs(x + 10) < 4 && Math.abs(z + 6) < 4) continue; if (z > 20 || x < -15.5) continue; b.add(smdPassive('0402', i % 3 === 0 ? 'res' : 'cap'), x, z, i % 2 ? Math.PI / 2 : 0); }
    b.add(powerInductor(2.5, 1.0, '1R0'), -14, 12, 0); b.add(powerInductor(2.5, 1.0, '2R2'), -14, 16, 0);
    // receptáculos board-to-board
    const recept = (pins: number, pitch: number, x: number, z: number, rot: number, ref: string) => b.add(btbConnector(pins, pitch, 'recept'), x, z, rot, { ref, refSize: 0.7 });
    recept(34, 0.35, 6, -6 + 1.5, 0, 'J-DSI');
    recept(24, 0.35, -17.5 + 1.5, -22, Math.PI / 2, 'J-CAM1'); recept(24, 0.35, -17.5 + 1.5, -10, Math.PI / 2, 'J-CAM2'); recept(24, 0.35, -17.5 + 1.5, 2, Math.PI / 2, 'J-CAM3');
    recept(6, 0.4, -12, 24 - 1.5, 0, 'J-BAT'); recept(30, 0.3, 4, 24 - 1.5, 0, 'J-SUB');
    b.silk('ZEYFORGE LB-HDI10 REV A', 0, 18, 0.9, { weight: 700 });
    return b.build();
  },
};

export const phoneSubBoard: ComponentDef = {
  type: 'phone_subboard', name: 'Sub-placa USB-C de celular', category: 'Placas de celular', partNumber: 'SB-USBC', cost: 45,
  description: 'Placa inferior com USB-C, microfone MEMS, alto-falante e receptáculo FPC para a placa principal.',
  params: {},
  sockets: () => [
    socket({ id: 'SUB', label: 'FPC para placa principal (30p)', kind: 'fpc', pins: 30, pitch: 0.3, pos: [16, 0.6 + 0.85, -2.5], normal: [0, 0, -1], axis: [1, 0, 0], termination: 'btb' }),
    socket({ id: 'USB', label: 'USB-C', kind: 'usb-c', pos: [0, 0.6 + 1.63, 6.6], normal: [0, 0, 1], axis: [1, 0, 0], pinTypes: ['5v'], termination: 'pin' }),
  ],
  build: () => {
    const b = new Board({ w: 40, d: 10, t: 0.6, corner: 1.5, mask: 'fr4_preto', seed: 6060, traceDensity: 0.6 });
    b.add(usbCReceptacle(), 0, 2.9, 0, { ref: 'J1' });
    b.add(btbConnector(30, 0.3, 'recept'), 16, -1.0, 0, { ref: 'J2' });
    b.add(fp(group(box(3.5, 1.0, 2.6, 'aco_estampado'), cyl(0.3, 0.02, new THREE.MeshBasicMaterial({ color: '#000' }), 0, 1.0, 0)), { pads: [] }), -12, -1, 0, { ref: 'MIC1' });
    b.add(qfn(3, 3, 0.6, 5, [{ text: 'PD', size: 0.7 }], 0.4), -6, -2.5, 0, { ref: 'U1' });
    [[-16, 2], [-15, -3], [6, -3], [8, 2.5], [-3, 3]].forEach(([x, z], i) => b.add(smdPassive('0402', i % 2 ? 'cap' : 'res'), x, z, 0));
    return b.build();
  },
};

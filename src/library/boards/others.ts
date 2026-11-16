// Raspberry Pi Pico, Arduino Uno R3, Arduino Nano, PCB personalizada e protoboard.
import * as THREE from 'three';
import type { ComponentDef } from '../types';
import { bool, num, sel, socket, mountSockets, inferPinType } from '../types';
import { Board } from '@/geometry/board';
import { box, group, cyl, rbox, instanced, T as TM, extrudeUp, roundedRectShape } from '@/geometry/primitives';
import { header, microUsb, qfn, qfp, soic, sot223, sot23, smdPassive, tactSwitch, crystalSMD, crystalHC49, electrolytic, icBody, fp } from '@/geometry/parts';
import { PICO_LEFT, PICO_RIGHT, UNO_ANALOG, UNO_DIGITAL_HIGH, UNO_DIGITAL_LOW, UNO_ICSP, UNO_POWER, NANO_A, NANO_D } from '../pinouts';
import { canvasTexture, makeCanvas } from '@/engine/textures/canvas';
import { labelMaterial, mat } from '@/engine/materials';
import type { Vec3 } from '@/core/types';

const MASKS: [string, string][] = [['fr4_verde', 'Verde'], ['fr4_preto', 'Preta'], ['fr4_azul', 'Azul'], ['fr4_roxo', 'Roxa'], ['fr4_teal', 'Teal']];

/* ---------------- Raspberry Pi Pico ---------------- */
const PW = 51, PD = 21;
export const rpiPico: ComponentDef = {
  type: 'rpi_pico', name: 'Raspberry Pi Pico', category: 'Placas de desenvolvimento', partNumber: 'SC0915',
  description: 'RP2040 dual-core Cortex-M0+ 133 MHz, 2 MB flash, 26 GPIO de 3,3 V, pads castelados.',
  cost: 35, mass: p => (p.pins ? 5 : 3), tags: ['rp2040', 'pico', 'microcontrolador'],
  params: { pins: bool('Barras de pinos soldadas', false) },
  sockets: p => {
    const y = p.pins ? -8.6 : 0;
    const mk = (id: string, label: string, z: number, names: string[], reverse: boolean) => socket({
      id, label, kind: 'header-male', pins: 20, pitch: 2.54, pos: [0, y, z], normal: [0, -1, 0], axis: [1, 0, 0],
      pinNames: names, pinTypes: names.map(inferPinType), logicVoltage: 3.3, termination: p.pins ? 'pin' : 'solder',
      pinOffsets: names.map((_, i) => [(-PW / 2 + 1.61 + (reverse ? 19 - i : i) * 2.54), 0, 0] as Vec3),
    });
    return [mk('L', 'Pinos 1–20', PD / 2 - 1.61, PICO_LEFT, false), mk('R', 'Pinos 21–40', -PD / 2 + 1.61, PICO_RIGHT, true)];
  },
  build: p => {
    const holes = [[PW / 2 - 2, 5.7], [PW / 2 - 2, -5.7], [-PW / 2 + 2, 5.7], [-PW / 2 + 2, -5.7]].map(([x, z]) => ({ x, z, r: 1.05, ring: 0.6 }));
    const b = new Board({ w: PW, d: PD, t: 1.0, corner: 0.5, mask: 'fr4_verde', seed: 2040, holes, traceDensity: 0.6 });
    for (let i = 0; i < 20; i++) { const x = -PW / 2 + 1.61 + i * 2.54; b.hole({ x, z: PD / 2 - 1.61, r: 0.5, ring: 0.6 }); b.hole({ x, z: -PD / 2 + 1.61, r: 0.5, ring: 0.6 }); b.pad({ x, z: PD / 2 - 0.4, w: 1.6, d: 0.8 }); b.pad({ x, z: -PD / 2 + 0.4, w: 1.6, d: 0.8 }); }
    b.add(microUsb(), -PW / 2 + 2.5, 0, -Math.PI / 2, { outline: false });
    b.add(qfn(7, 7, 0.9, 14, [{ text: 'RP2-B2', size: 1.0, weight: 700 }, { text: '21/24', size: 0.8 }, { text: 'P64M15.00', size: 0.6, font: 'mono' }], 0.4), 2, 0, 0, { ref: 'U1' });
    b.add(soic(8, [{ text: 'W25Q16JV', size: 0.6, weight: 700 }, { text: '2419', size: 0.5 }], 3.9, 1.27), 12.5, 0, Math.PI / 2, { ref: 'U2' });
    b.add(tactSwitch(4, 'abs_branco'), -12, 0, 0, { ref: 'BOOTSEL', refDz: 3.5 });
    b.add(crystalSMD(3.2, 2.5, [{ text: '12.000', size: 0.5 }]), 8, 6.2, 0, { ref: 'Y1' });
    b.add(smdPassive('0603', 'led', 'led_verde'), -19, -6, 0, { ref: 'LED' });
    b.add(sot23([{ text: 'RT6150', size: 0.45 }], 6), -6, -6, 0, { ref: 'U3' });
    [[-5, 5], [-3, 6], [6, -5], [8, -6], [16, 6], [18, -6], [-8, 4], [-17, 4], [-16, -3], [20, 3]].forEach(([x, z], i) => b.add(smdPassive('0402', i % 2 ? 'cap' : 'res'), x, z, i % 3 ? 0 : Math.PI / 2));
    b.silk('RP2040 · 2MB', 4, -3.8, 0.9, { weight: 600 });
    PICO_LEFT.forEach((n, i) => i % 2 === 0 && b.silk(n, -PW / 2 + 1.61 + i * 2.54, PD / 2 - 3.4, 0.55));
    if (p.pins) for (const z of [PD / 2 - 1.61, -PD / 2 + 1.61]) { const h = header(20, 1, false); const w = new THREE.Group(); h.rotation.x = Math.PI; w.add(h); b.parts.add(w); w.position.set(0, 0, z); }
    return b.build();
  },
};

/* ---------------- Arduino Uno R3 ---------------- */
const UW = 68.6, UD = 53.3;
const uc = (bx: number, by: number): [number, number] => [bx - UW / 2, UD / 2 - by];
const UNO_HOLES: [number, number][] = [[13.97, 2.54], [15.24, 50.8], [66.04, 7.62], [66.04, 35.56]].map(([x, y]) => uc(x, y));

export const arduinoUno: ComponentDef = {
  type: 'arduino_uno', name: 'Arduino Uno R3', category: 'Placas de desenvolvimento', partNumber: 'A000066',
  description: 'ATmega328P 16 MHz, ATmega16U2 USB, 14 E/S digitais (6 PWM), 6 analógicas. Lógica de 5 V.',
  cost: 45, mass: 25, tags: ['arduino', 'atmega328p', 'microcontrolador'],
  params: {},
  sockets: () => {
    const y = 1.6 + 8.5;
    const row = (id: string, label: string, cx: number, cy: number, names: string[]) => {
      const [x, z] = uc(cx, cy);
      return socket({ id, label, kind: 'header-female', pins: names.length, pitch: 2.54, pos: [x, y, z], normal: [0, 1, 0], axis: [1, 0, 0], pinNames: names, pinTypes: names.map(inferPinType), logicVoltage: 5, termination: 'pin' });
    };
    const [ix, iz] = uc(64.4, 27.9);
    return [
      row('DH', 'Digital D8–D13 / I²C', 29.72, 50.8, UNO_DIGITAL_HIGH), row('DL', 'Digital D0–D7', 54.61, 50.8, UNO_DIGITAL_LOW),
      row('PWR', 'Alimentação', 36.83, 2.54, UNO_POWER), row('AN', 'Analógicas A0–A5', 57.15, 2.54, UNO_ANALOG),
      socket({ id: 'ICSP', label: 'ICSP', kind: 'header-male', pins: 6, pitch: 2.54, pos: [ix, 1.6 + 8.6, iz], normal: [0, 1, 0], axis: [0, 0, 1], pinNames: UNO_ICSP, pinTypes: UNO_ICSP.map(inferPinType), logicVoltage: 5, pinOffsets: UNO_ICSP.map((_, k) => [k % 2 ? 1.27 : -1.27, 0, -2.54 + Math.floor(k / 2) * 2.54] as Vec3), termination: 'pin' }),
      ...mountSockets(UNO_HOLES, 1.6),
    ];
  },
  build: () => {
    const b = new Board({ w: UW, d: UD, t: 1.6, corner: 0.8, mask: 'fr4_teal', seed: 328, holes: UNO_HOLES.map(([x, z]) => ({ x, z, r: 1.6, ring: 0.8 })), traceDensity: 0.65, finish: 'hasl' });
    let [x, z] = uc(6.35, 38.1);
    const usbB = group(box(16, 10.9, 12, 'aco_estampado'), box(14.4, 0.05, 10.4, 'aco_preto', 0, 10.9));
    usbB.add(box(0.3, 7.6, 8.4, new THREE.MeshBasicMaterial({ color: '#060606' }), -8.01, 1.6)); usbB.add(box(0.4, 5, 6, 'pbt_preto', -7.6, 2.8));
    b.add(fp(usbB, { pads: [], holes: [] }), x - 0.6, z, 0, { outline: false });
    [x, z] = uc(4.5, 7.6);
    const jack = group(box(14, 11, 9, 'pbt_preto')); const bore = cyl(3.1, 0.5, new THREE.MeshBasicMaterial({ color: '#040404' }), 0, 0, 0, 24); bore.rotation.z = Math.PI / 2; bore.position.set(-7.02, 6.2, 0); jack.add(bore);
    b.add(fp(jack, { pads: [] }), x - 1.5, z, 0, { outline: false });
    // ATmega328P DIP-28 no soquete
    [x, z] = uc(48, 12);
    const dip = new THREE.Group();
    dip.add(box(36, 1.2, 9.6, 'pbt_preto'));
    dip.add(icBody(35.4, 7.4, 3.6, [{ text: 'ATMEGA328P-PU', size: 1.8, weight: 700 }, { text: '2423  e3', size: 1.3, font: 'mono' }], { dot: true }, 2.2));
    const legs: THREE.Matrix4[] = []; for (let i = 0; i < 14; i++) for (const s of [-1, 1]) legs.push(TM(-16.51 + i * 2.54, 1.2, s * 3.81));
    dip.add(instanced(new THREE.BoxGeometry(0.5, 1.5, 0.3), 'estanho', legs));
    b.add(fp(dip, { pads: legs.map(m => { const v = new THREE.Vector3().setFromMatrixPosition(m); return { x: v.x, z: v.z, w: 1.6, d: 1.6, shape: 'oval' as const }; }), outline: { w: 36.5, d: 10.2 } }), x, z, 0, { ref: 'IC1' });
    [x, z] = uc(22, 38); b.add(qfn(5, 5, 0.9, 8, [{ text: 'ATMEGA', size: 0.6, weight: 700 }, { text: '16U2', size: 0.75, weight: 700 }]), x, z, Math.PI / 4, { ref: 'U3' });
    [x, z] = uc(28, 31); b.add(crystalHC49(), x, z, 0, { ref: 'Y1' });
    [x, z] = uc(6, 50); b.add(tactSwitch(6), x, z, 0, { ref: 'RESET', refDz: 4.5 });
    [x, z] = uc(9, 22); b.add(sot223([{ text: 'NCP1117', size: 0.8, weight: 700 }, { text: '5.0 V', size: 0.7 }]), x, z, Math.PI / 2, { ref: 'U1' });
    [x, z] = uc(14, 14); b.add(electrolytic(6.3, 7, 'pbt_preto', true), x, z, 0, { ref: 'C2' });
    [x, z] = uc(14, 23); b.add(electrolytic(6.3, 7, 'pbt_preto', true), x, z, 0, { ref: 'C3' });
    [[25, 44, 'led_ambar', 'L'], [25, 41.5, 'led_ambar', 'TX'], [25, 39, 'led_ambar', 'RX'], [60, 18, 'led_verde', 'ON']].forEach(([bx, by, m, r]) => { const [px, pz] = uc(bx as number, by as number); b.add(smdPassive('0805', 'led', m as string), px, pz, 0, { ref: r as string, refDz: 0, refDx: -2.8 }); });
    [[30, 40], [32, 36], [34, 40], [18, 30], [20, 33], [36, 30], [40, 27], [52, 28], [56, 24], [44, 22], [20, 18], [30, 22]].forEach(([bx, by], i) => { const [px, pz] = uc(bx, by); b.add(smdPassive('0603', i % 2 ? 'cap' : 'res'), px, pz, i % 3 ? 0 : Math.PI / 2); });
    const hdr = (cx: number, cy: number, n: number, names: string[], below: boolean) => { const [hx, hz] = uc(cx, cy); b.add(header(n, 1, true), hx, hz, 0, { outline: false }); names.forEach((nm, i) => b.silk(nm, hx - (n - 1) * 1.27 + i * 2.54, hz + (below ? 3.4 : -3.4), 0.85, { rot: Math.PI / 2 })); };
    hdr(29.72, 50.8, 10, UNO_DIGITAL_HIGH, true); hdr(54.61, 50.8, 8, UNO_DIGITAL_LOW, true);
    hdr(36.83, 2.54, 8, UNO_POWER, false); hdr(57.15, 2.54, 6, UNO_ANALOG, false);
    [x, z] = uc(64.4, 27.9); b.add(header(3, 2, false), x, z, Math.PI / 2, { ref: 'ICSP', refDx: -4.5, refDz: 0 });
    [x, z] = uc(18, 44); b.add(header(3, 2, false), x, z, 0, { ref: 'ICSP1', refDz: -3.6 });
    b.silk('UNO', ...uc(40, 30), 4.0, { weight: 900 });
    b.silk('DIGITAL (PWM~)', ...uc(44, 44.2), 1.2, { weight: 700 });
    b.silk('POWER', ...uc(37, 9.2), 1.2, { weight: 700 }); b.silk('ANALOG IN', ...uc(57, 9.2), 1.2, { weight: 700 });
    return b.build();
  },
};

/* ---------------- Arduino Nano ---------------- */
const NW = 43.18, ND = 17.78;
export const arduinoNano: ComponentDef = {
  type: 'arduino_nano', name: 'Arduino Nano', category: 'Placas de desenvolvimento', partNumber: 'A000005',
  description: 'ATmega328P em formato compacto para protoboard. Lógica de 5 V.', cost: 30, mass: 7, tags: ['arduino', 'nano'],
  params: { pins: bool('Barras de pinos soldadas', true) },
  sockets: p => {
    const y = p.pins ? -8.6 : 0;
    const mk = (id: string, z: number, names: string[]) => socket({ id, label: id === 'D' ? 'Lado D13/A0' : 'Lado D12/TX', kind: 'header-male', pins: 15, pitch: 2.54, pos: [0, y, z], normal: [0, -1, 0], axis: [1, 0, 0], pinNames: names, pinTypes: names.map(inferPinType), logicVoltage: 5, termination: p.pins ? 'pin' : 'solder', pinOffsets: names.map((_, i) => [-17.78 + i * 2.54, 0, 0] as Vec3) });
    return [mk('D', ND / 2 - 1.27, NANO_D), mk('A', -ND / 2 + 1.27, NANO_A)];
  },
  build: p => {
    const b = new Board({ w: NW, d: ND, t: 1.6, corner: 0.4, mask: 'fr4_azul', seed: 55, holes: [[1, 1], [1, -1], [-1, 1], [-1, -1]].map(([a, c]) => ({ x: a * (NW / 2 - 1.27), z: c * (ND / 2 - 1.27), r: 0.85, ring: 0.5 })), traceDensity: 0.6 });
    b.add(group(box(9, 4, 7.6, 'aco_inox'), box(0.2, 2.2, 6.2, 'pbt_preto', -4.5, 0.9)), -NW / 2 + 3.6, 0, 0, { outline: false });
    b.add(qfp(7, 7, 1.0, 8, [{ text: 'ATMEGA', size: 0.7, weight: 700 }, { text: '328P', size: 0.9, weight: 700 }, { text: 'AU 2422', size: 0.55 }], 0.8), 4, 0, Math.PI / 4, { ref: 'U1' });
    b.add(tactSwitch(4), NW / 2 - 8, 0, 0, { ref: 'RST', refDz: 3 });
    b.add(crystalSMD(3.2, 2.5, [{ text: '16.000', size: 0.5 }]), -8, 4.5, 0);
    [[-6, 5, 'led_verde'], [-6, -5, 'led_vermelho']].forEach(([x, z, m]) => b.add(smdPassive('0603', 'led', m as string), x as number, z as number, 0));
    if (p.pins) for (const z of [ND / 2 - 1.27, -ND / 2 + 1.27]) { const h = header(15, 1, false); const w = new THREE.Group(); h.rotation.x = Math.PI; w.add(h); b.parts.add(w); w.position.set(0, 0, z); }
    else for (const z of [ND / 2 - 1.27, -ND / 2 + 1.27]) for (let i = 0; i < 15; i++) b.hole({ x: -17.78 + i * 2.54, z, r: 0.5 });
    b.silk('NANO V3', 12, -2.6, 1.2, { weight: 800 });
    return b.build();
  },
};

/* ---------------- PCB personalizada ---------------- */
export const pcbCustom: ComponentDef = {
  type: 'pcb', name: 'PCB personalizada', category: 'Placas de desenvolvimento', cost: p => 4 + (p.w * p.d) / 600 * (+p.layers / 2), tags: ['pcb', 'placa'],
  description: 'Placa de circuito impresso sob medida (FR4), com plano de terra, trilhas e furos de fixação.',
  params: {
    w: num('Largura', 60, 5, 500), d: num('Profundidade', 40, 5, 500), t: num('Espessura', 1.6, 0.4, 3.2, 0.1), r: num('Raio de canto', 2, 0, 50),
    mask: sel('Máscara de solda', 'fr4_verde', MASKS), finish: sel('Acabamento', 'enig', [['enig', 'ENIG (ouro)'], ['hasl', 'HASL (estanho)']]),
    holes: bool('Furos de fixação', true), holeD: num('Ø furo', 3.2, 1, 8), inset: num('Distância da borda', 3.5, 1, 30),
    layers: sel('Camadas', '2', [['1', '1'], ['2', '2'], ['4', '4'], ['6', '6'], ['8', '8 (HDI, celular)'], ['10', '10']]),
    traces: num('Densidade de trilhas', 0.6, 0, 1, 0.05, ''), seed: num('Semente do layout', 1, 1, 9999, 1, ''),
  },
  sockets: p => p.holes ? mountSockets([[1, 1], [-1, 1], [1, -1], [-1, -1]].map(([a, c]) => [a * (p.w / 2 - p.inset), c * (p.d / 2 - p.inset)]), p.t) : [],
  build: p => {
    const holes = p.holes ? [[1, 1], [-1, 1], [1, -1], [-1, -1]].map(([a, c]) => ({ x: a * (p.w / 2 - p.inset), z: c * (p.d / 2 - p.inset), r: p.holeD / 2, ring: 0.8 })) : [];
    const b = new Board({ w: p.w, d: p.d, t: p.t, corner: p.r, mask: p.mask, finish: p.finish, seed: p.seed, holes, traceDensity: p.traces });
    return b.build();
  },
};

/* ---------------- Protoboard ---------------- */
function breadboardTexture(cols: number, W: number, D: number) {
  const ppmm = 8, c = makeCanvas(W * ppmm, D * ppmm), g = c.getContext('2d')!;
  g.fillStyle = '#ecebe6'; g.fillRect(0, 0, c.width, c.height);
  const x0 = (W - (cols - 1) * 2.54) / 2;
  g.fillStyle = '#c62828'; g.fillRect(3 * ppmm, 2.0 * ppmm, (W - 6) * ppmm, 0.5 * ppmm); g.fillRect(3 * ppmm, (D - 8.4) * ppmm, (W - 6) * ppmm, 0.5 * ppmm);
  g.fillStyle = '#1e5bd8'; g.fillRect(3 * ppmm, 8.0 * ppmm, (W - 6) * ppmm, 0.5 * ppmm); g.fillRect(3 * ppmm, (D - 2.4) * ppmm, (W - 6) * ppmm, 0.5 * ppmm);
  g.fillStyle = '#6d6d6a'; g.font = `600 ${1.6 * ppmm}px Arial`; g.textAlign = 'center'; g.textBaseline = 'middle';
  for (let i = 0; i < cols; i += 5) g.fillText(String(i + 1), (x0 + i * 2.54) * ppmm, (D / 2 - 0.2) * ppmm);
  'jihgf'.split('').forEach((l, i) => g.fillText(l, 1.6 * ppmm, (D / 2 - 6.5 - i * 2.54 + 0) * ppmm));
  'edcba'.split('').forEach((l, i) => g.fillText(l, 1.6 * ppmm, (D / 2 + 6.5 + i * 2.54) * ppmm));
  return canvasTexture(c, true, 8);
}
export const protoboard: ComponentDef = {
  type: 'protoboard', name: 'Protoboard', category: 'Placas de desenvolvimento', cost: p => (p.size === '830' ? 18 : 12), mass: p => (p.size === '830' ? 90 : 45), tags: ['breadboard', 'protoboard'],
  params: { size: sel('Tamanho', '400', [['400', '400 pontos (82×55)'], ['830', '830 pontos (165×55)']]) },
  build: p => {
    const big = p.size === '830', W = big ? 165 : 82, D = 55, H = 8.5, cols = big ? 63 : 30;
    const g = new THREE.Group();
    const tex = breadboardTexture(cols, W, D);
    const topMat = labelMaterial(tex, 'abs_branco');
    const s = roundedRectShape(W, D, 1.2);
    const body = extrudeUp(s, H, 'abs_branco', 0.3);
    g.add(body);
    const top = new THREE.Mesh(new THREE.PlaneGeometry(W - 0.6, D - 0.6), topMat); top.rotation.x = -Math.PI / 2; top.position.y = H + 0.01; top.receiveShadow = true; top.userData.noMass = true; g.add(top);
    const holeMats: THREE.Matrix4[] = [];
    const x0 = -(cols - 1) * 2.54 / 2;
    const zs = [-6.5, -9.04, -11.58, -14.12, -16.66, 6.5, 9.04, 11.58, 14.12, 16.66];
    for (let i = 0; i < cols; i++) zs.forEach(z => holeMats.push(TM(x0 + i * 2.54, H + 0.02, z)));
    for (let i = 0; i < cols; i++) { if (i % 6 === 5) continue; [-21.6, -24.1, 21.6, 24.1].forEach(z => holeMats.push(TM(x0 + i * 2.54, H + 0.02, z))); }
    const hole = new THREE.BoxGeometry(1.0, 0.04, 1.0);
    const im = instanced(hole, new THREE.MeshBasicMaterial({ color: '#2a2a28' }), holeMats); im.castShadow = false; im.userData.noMass = true; g.add(im);
    g.add(box(W - 3, 0.3, 2.4, new THREE.MeshStandardMaterial({ color: '#d9d8d3', roughness: 0.6 }), 0, H - 0.29, 0));
    return g;
  },
};

export { rbox, mat };

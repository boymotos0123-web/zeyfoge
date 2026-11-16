// Conectores, passivos, CIs e mecânica.
import * as THREE from 'three';
import type { ComponentDef } from './types';
import { bool, num, sel, socket, inferPinType } from './types';
import { box, rbox, cyl, cylX, group, at, extrudeUp, roundedRectShape, circlePath, mesh, lathe, instanced, T as TM, DEG } from '@/geometry/primitives';
import { btbConnector, header, jstPH, qfn, qfp, bga, smdPassive, tactSwitch, crystalHC49, electrolytic, usbCReceptacle, zifConnector, icBody } from '@/geometry/parts';
import type { Vec3 } from '@/core/types';

/* ============================== CONECTORES ============================== */

export const zifComp: ComponentDef = {
  type: 'zif', name: 'Conector FPC/FFC (ZIF)', category: 'Conectores', cost: p => 1 + p.pins * 0.05, mass: 0.3, partNumber: 'FPC-ZIF',
  description: 'Conector ZIF com trava flip-lock para flat flex. Passos de 0,3 a 1,0 mm.',
  params: { pins: num('Vias', 24, 4, 80, 1, ''), pitch: sel('Passo', '0.5', [['0.3', '0,3 mm'], ['0.5', '0,5 mm'], ['1', '1,0 mm']]), vertical: bool('Entrada vertical', false) },
  sockets: p => {
    const pitch = +p.pitch;
    return [socket({ id: 'FPC', label: `FPC ${p.pins}p × ${pitch} mm`, kind: 'fpc', pins: p.pins, pitch, pos: p.vertical ? [0, 6.7, 0] : [0, pitch >= 1 ? 0.9 : 0.4, pitch >= 1 ? 2.3 : 1.7], normal: p.vertical ? [0, 1, 0] : [0, 0, 1], axis: [1, 0, 0], termination: 'zif' })];
  },
  build: p => zifConnector(p.pins, +p.pitch, { vertical: p.vertical }),
};

export const btbComp: ComponentDef = {
  type: 'btb', name: 'Conector board-to-board (BTB)', category: 'Conectores', cost: p => 0.8 + p.pins * 0.03, mass: 0.1, partNumber: 'BTB-0.35',
  description: 'Par de conectores placa-a-placa de perfil baixo (celulares). Encaixe magnético plug ↔ receptáculo.',
  params: { pins: num('Vias', 24, 4, 80, 2, ''), pitch: sel('Passo', '0.35', [['0.3', '0,3 mm'], ['0.35', '0,35 mm'], ['0.4', '0,4 mm']]), kind: sel('Tipo', 'recept', [['recept', 'Receptáculo (fêmea)'], ['plug', 'Plug (macho)']]) },
  sockets: p => [socket({ id: 'BTB', label: 'Encaixe BTB', kind: p.kind === 'plug' ? 'btb-plug' : 'btb-recept', pins: p.pins, pitch: +p.pitch, pos: [0, p.kind === 'plug' ? 0 : 0.85, 0], normal: p.kind === 'plug' ? [0, -1, 0] : [0, 1, 0], axis: [1, 0, 0] })],
  build: p => { const o = btbConnector(p.pins, +p.pitch, p.kind); if (p.kind === 'plug') { const w = new THREE.Group(); o.rotation.x = Math.PI; o.position.y = 0.6; w.add(o); return w; } return o; },
};

export const usbCComp: ComponentDef = {
  type: 'usb_c', name: 'USB-C receptáculo (SMT)', category: 'Conectores', cost: 1.8, mass: 0.6, partNumber: 'USB-C-16P',
  params: {},
  sockets: () => [socket({ id: 'USB', label: 'USB-C', kind: 'usb-c', pos: [0, 1.63, 3.7], normal: [0, 0, 1], axis: [1, 0, 0], pinTypes: ['5v'], termination: 'pin' })],
  build: () => usbCReceptacle(),
};

export const headerComp: ComponentDef = {
  type: 'header', name: 'Barra de pinos 2,54 mm', category: 'Conectores', cost: p => 0.08 * p.n * p.rows, mass: p => 0.12 * p.n * p.rows, partNumber: 'HDR-2.54',
  params: { n: num('Pinos por fileira', 10, 1, 40, 1, ''), rows: num('Fileiras', 1, 1, 2, 1, ''), female: bool('Fêmea', false) },
  sockets: p => {
    const n = Math.round(p.n), rows = Math.round(p.rows);
    const names = Array.from({ length: n * rows }, (_, i) => String(i + 1));
    return [socket({ id: 'H', label: `Barra ${n}×${rows}`, kind: p.female ? 'header-female' : 'header-male', pins: n * rows, pitch: 2.54, pos: [0, p.female ? 8.5 : 8.6, 0], normal: [0, 1, 0], axis: [1, 0, 0], pinNames: names, pinTypes: names.map(() => 'signal'), pinOffsets: names.map((_, k) => (rows === 2 ? [-(n - 1) * 1.27 + Math.floor(k / 2) * 2.54, 0, k % 2 ? -1.27 : 1.27] : [-(n - 1) * 1.27 + k * 2.54, 0, 0]) as Vec3), termination: 'pin' })];
  },
  build: p => header(Math.round(p.n), Math.round(p.rows), p.female, 2.54, { solder: false }),
};

export const jstComp: ComponentDef = {
  type: 'jst', name: 'Conector JST-PH 2,0 mm', category: 'Conectores', cost: 0.5, mass: 0.2, partNumber: 'JST-PH',
  params: { pins: num('Vias', 2, 2, 8, 1, '') },
  sockets: p => [socket({ id: 'J', label: `JST-PH ${p.pins}p`, kind: 'jst', pins: p.pins, pitch: 2.0, pos: [0, 6, 0], normal: [0, 1, 0], axis: [1, 0, 0], pinNames: p.pins === 2 ? ['BAT+', 'GND'] : undefined, pinTypes: p.pins === 2 ? ['vbat', 'gnd'] : undefined, termination: 'pin' })],
  build: p => jstPH(p.pins),
};

/* ============================== PASSIVOS ============================== */

const BAND = ['#151515', '#7a4a1e', '#d32020', '#f07a10', '#f2d21b', '#22a33a', '#2357d6', '#8e3bd1', '#8a8a8a', '#f4f4f4'];
export const resistorTHT: ComponentDef = {
  type: 'resistor', name: 'Resistor PTH 1/4 W', category: 'Passivos', cost: 0.1, mass: 0.25, partNumber: 'CFR-25',
  params: { value: sel('Valor', '220', [['10', '10 Ω'], ['100', '100 Ω'], ['220', '220 Ω'], ['330', '330 Ω'], ['1000', '1 kΩ'], ['4700', '4,7 kΩ'], ['10000', '10 kΩ'], ['100000', '100 kΩ']]), pitch: num('Passo dos terminais', 10.16, 5, 30, 0.01) },
  sockets: p => [-1, 1].map((s, i) => socket({ id: `T${i + 1}`, label: `Terminal ${i + 1}`, kind: 'custom', pos: [s * p.pitch / 2, -3, 0], normal: [0, -1, 0], termination: 'pin' })),
  build: p => {
    const g = new THREE.Group(); const y = 2.6;
    const body = lathe([[0.01, -3.2], [0.9, -3.2], [1.25, -2.6], [1.15, -1.8], [1.05, -1.4], [1.05, 1.4], [1.15, 1.8], [1.25, 2.6], [0.9, 3.2], [0.01, 3.2]], new THREE.MeshPhysicalMaterial({ color: '#d9c49b', roughness: 0.5, clearcoat: 0.6 }), 32);
    body.rotation.z = Math.PI / 2; body.position.y = y; g.add(body);
    const v = String(Number(p.value)); const d1 = +v[0], d2 = +(v[1] || 0), mul = Math.max(0, v.length - 2);
    [[-1.9, BAND[d1]], [-1.0, BAND[d2]], [-0.1, BAND[mul]], [1.9, '#c9a227']].forEach(([x, col]) => {
      const m = new THREE.Mesh(new THREE.CylinderGeometry(1.27, 1.27, 0.45, 32), new THREE.MeshPhysicalMaterial({ color: col as string, roughness: 0.45, clearcoat: 0.6 }));
      m.rotation.z = Math.PI / 2; m.position.set(x as number, y, 0); g.add(m);
    });
    g.add(cylX(0.3, p.pitch - 1.2, 'estanho', 0, y, 0, 12));
    for (const s of [-1, 1]) { g.add(cyl(0.3, y + 3, 'estanho', s * p.pitch / 2, -3, 0, 12)); const elbow = mesh(new THREE.TorusGeometry(0.6, 0.3, 8, 12, Math.PI / 2), 'estanho'); elbow.position.set(s * (p.pitch / 2 - 0.6), y - 0.6, 0); elbow.rotation.z = s > 0 ? 0 : Math.PI / 2; g.add(elbow); }
    return g;
  },
};

export const ledTHT: ComponentDef = {
  type: 'led', name: 'LED PTH', category: 'Passivos', cost: 0.2, mass: 0.35, partNumber: 'LED-5MM',
  params: { d: sel('Diâmetro', '5', [['3', '3 mm'], ['5', '5 mm'], ['10', '10 mm']]), color: sel('Cor', 'led_vermelho', [['led_vermelho', 'Vermelho'], ['led_verde', 'Verde'], ['led_azul', 'Azul'], ['led_branco', 'Branco']]), leads: num('Terminais', 6, 0, 30) },
  sockets: p => [socket({ id: 'A', label: 'Ânodo (+)', kind: 'custom', pos: [1.27, -p.leads - 1.5, 0], normal: [0, -1, 0], pinTypes: ['signal'], termination: 'pin' }), socket({ id: 'K', label: 'Cátodo (−)', kind: 'custom', pos: [-1.27, -p.leads, 0], normal: [0, -1, 0], pinTypes: ['gnd'], termination: 'pin' })],
  build: p => {
    const r = +p.d / 2, H = +p.d * 1.7, g = new THREE.Group();
    g.add(lathe([[0.01, 0], [r + 0.45, 0], [r + 0.45, 1.0], [r, 1.0], [r, H - r], ...Array.from({ length: 10 }, (_, i) => { const a = (i + 1) / 10 * Math.PI / 2; return [Math.cos(a) * r, H - r + Math.sin(a) * r] as [number, number]; })], p.color, 40));
    g.add(box(0.5, 2.2, 0.6, 'aco_inox', -0.6, 1.2, 0)); g.add(box(0.8, 1.6, 0.5, 'aco_inox', 0.5, 1.2, 0));
    g.add(cyl(0.25, p.leads + 1, 'estanho', -1.27, -p.leads, 0, 8)); g.add(cyl(0.25, p.leads + 2.5, 'estanho', 1.27, -p.leads - 1.5, 0, 8));
    return g;
  },
};

export const smdComp: ComponentDef = {
  type: 'smd', name: 'Passivo SMD (R/C/L/LED)', category: 'Passivos', cost: 0.02, mass: 0.01, partNumber: 'SMD',
  params: { code: sel('Encapsulamento', '0603', [['0402', '0402'], ['0603', '0603'], ['0805', '0805'], ['1206', '1206']]), kind: sel('Tipo', 'res', [['res', 'Resistor'], ['cap', 'Capacitor MLCC'], ['ind', 'Indutor'], ['led', 'LED']]) },
  build: p => smdPassive(p.code, p.kind),
};

export const electrolyticComp: ComponentDef = {
  type: 'cap_elec', name: 'Capacitor eletrolítico', category: 'Passivos', cost: 0.3, partNumber: 'ECAP',
  params: { d: num('Diâmetro', 6.3, 3, 40), h: num('Altura', 11, 4, 80), sleeve: sel('Capa', 'plastico_azul', [['plastico_azul', 'Azul'], ['pbt_preto', 'Preta']]), smd: bool('SMD', false) },
  build: p => electrolytic(p.d, p.h, p.sleeve, p.smd),
};

export const tactComp: ComponentDef = {
  type: 'button', name: 'Chave táctil', category: 'Passivos', cost: 0.3, mass: 0.3, partNumber: 'TS-6x6',
  params: { size: sel('Tamanho', '6', [['6', '6×6 mm'], ['4', '4×4 mm'], ['3', '3×4 mm']]), h: num('Altura do atuador', 1.5, 0.3, 10) },
  build: p => tactSwitch(+p.size as 6 | 4 | 3, 'pbt_preto', p.h),
};

export const crystalComp: ComponentDef = { type: 'crystal', name: 'Cristal HC-49/S', category: 'Passivos', cost: 0.5, mass: 0.4, params: {}, build: () => crystalHC49() };

/* ============================== CIRCUITOS INTEGRADOS ============================== */

export const icComp: ComponentDef = {
  type: 'ic', name: 'Circuito integrado (genérico)', category: 'Circuitos integrados', cost: 5, partNumber: 'IC',
  params: {
    style: sel('Encapsulamento', 'qfp', [['qfn', 'QFN'], ['qfp', 'LQFP'], ['bga', 'BGA'], ['bga_lid', 'BGA com tampa metálica']]),
    w: num('Largura', 7, 1, 60), d: num('Profundidade', 7, 1, 60), h: num('Altura', 1.2, 0.3, 6), pins: num('Pinos por lado', 12, 2, 64, 1, ''),
    pitch: num('Passo', 0.5, 0.3, 2.54, 0.05), mark: sel('Marcação', 'STM32F7', [['STM32F7', 'STM32F7'], ['ESP32-S3', 'ESP32-S3'], ['RP2040', 'RP2040'], ['ATMEGA328P', 'ATmega328P'], ['FPGA', 'FPGA'], ['DRV', 'Driver']]),
  },
  build: p => {
    const lines = [{ text: p.mark, size: Math.max(0.5, Math.min(p.w, p.d) * 0.16), weight: 700 }, { text: '2425 · e4', size: Math.max(0.4, Math.min(p.w, p.d) * 0.1), font: 'mono' as const }];
    if (p.style === 'qfn') return qfn(p.w, p.d, p.h, Math.round(p.pins), lines, p.pitch);
    if (p.style === 'bga' || p.style === 'bga_lid') return bga(p.w, p.d, p.h, lines, p.style === 'bga_lid' ? 'metal' : 'mold');
    return qfp(p.w, p.d, p.h, Math.round(p.pins), lines, p.pitch);
  },
};

/* ============================== MECÂNICA ============================== */

export const screwComp: ComponentDef = {
  type: 'screw', name: 'Parafuso métrico', category: 'Mecânica', cost: 0.3, partNumber: 'ISO-4762',
  params: { m: sel('Rosca', '3', [['1.2', 'M1.2 (celular)'], ['1.6', 'M1.6'], ['2', 'M2'], ['2.5', 'M2.5'], ['3', 'M3'], ['4', 'M4'], ['5', 'M5']]), len: num('Comprimento', 8, 1, 100), head: sel('Cabeça', 'allen', [['allen', 'Allen (DIN 912)'], ['panela', 'Panela Phillips'], ['escareada', 'Escareada'], ['torx', 'Torx de celular']]), mat: sel('Material', 'aco_inox', [['aco_inox', 'Inox A2'], ['aco_preto', 'Aço preto 12.9'], ['titanio', 'Titânio'], ['latao', 'Latão']]) },
  sockets: () => [socket({ id: 'S', label: 'Assento da cabeça', kind: 'screw', pos: [0, 0, 0], normal: [0, -1, 0] })],
  build: p => {
    const M = +p.m, g = new THREE.Group();
    g.add(cyl(M / 2 * 0.92, p.len, p.mat, 0, -p.len, 0, 20));
    const turns = Math.max(2, Math.round(p.len / (M * 0.2 + 0.15)));
    const pts: THREE.Vector3[] = []; for (let i = 0; i <= turns * 16; i++) { const a = i / 16 * Math.PI * 2; pts.push(new THREE.Vector3(Math.cos(a) * M * 0.46, -p.len + 0.3 + (i / (turns * 16)) * (p.len - 0.8), Math.sin(a) * M * 0.46)); }
    g.add(mesh(new THREE.TubeGeometry(new THREE.CatmullRomCurve3(pts), turns * 16, M * 0.06, 4), p.mat));
    if (p.head === 'allen') { g.add(lathe([[0.01, M], [M * 0.3, M], [M * 0.3, M * 0.6], [M * 0.75, M * 0.6], [M * 0.75, M], [M * 0.8, M * 0.95], [M * 0.8, 0.05], [M * 0.75, 0], [0.01, 0]].map(([r, y]) => [r, y] as [number, number]), p.mat, 32)); }
    else if (p.head === 'panela') g.add(lathe([[0.01, 0], [M, 0], [M, M * 0.35], [M * 0.85, M * 0.62], [0.01, M * 0.62]], p.mat, 32));
    else if (p.head === 'torx') g.add(lathe([[0.01, 0], [M * 1.05, 0], [M * 1.05, M * 0.25], [M * 0.9, M * 0.4], [0.01, M * 0.4]], p.mat, 32));
    else g.add(lathe([[0.01, 0], [M / 2, 0], [M, M * 0.5], [M, M * 0.55], [0.01, M * 0.55]], p.mat, 32));
    return g;
  },
};

export const standoffComp: ComponentDef = {
  type: 'standoff', name: 'Espaçador sextavado', category: 'Mecânica', cost: 0.5, partNumber: 'SPACER-HEX',
  params: { m: sel('Rosca', '3', [['2', 'M2'], ['2.5', 'M2.5'], ['3', 'M3']]), len: num('Comprimento', 10, 2, 60), mat: sel('Material', 'latao', [['latao', 'Latão'], ['pbt_preto', 'Nylon preto'], ['aluminio', 'Alumínio']]) },
  sockets: p => [socket({ id: 'T', label: 'Topo', kind: 'standoff-top', pos: [0, p.len, 0], normal: [0, 1, 0] }), socket({ id: 'B', label: 'Base', kind: 'standoff-bottom', pos: [0, 0, 0], normal: [0, -1, 0] })],
  build: p => { const M = +p.m; const s = new THREE.Shape(); for (let i = 0; i <= 6; i++) { const a = i / 6 * Math.PI * 2 + Math.PI / 6; const x = Math.cos(a) * M * 0.95, y = Math.sin(a) * M * 0.95; i ? s.lineTo(x, y) : s.moveTo(x, y); } s.holes.push(circlePath(M / 2 * 0.85)); return extrudeUp(s, p.len, p.mat, 0.15, 6); },
};

export const nutComp: ComponentDef = {
  type: 'nut', name: 'Porca sextavada', category: 'Mecânica', cost: 0.1, partNumber: 'ISO-4032',
  params: { m: sel('Rosca', '3', [['2', 'M2'], ['2.5', 'M2.5'], ['3', 'M3'], ['4', 'M4'], ['5', 'M5']]) },
  build: p => { const M = +p.m; const s = new THREE.Shape(); for (let i = 0; i <= 6; i++) { const a = i / 6 * Math.PI * 2; const x = Math.cos(a) * M, y = Math.sin(a) * M; i ? s.lineTo(x, y) : s.moveTo(x, y); } s.holes.push(circlePath(M / 2)); return extrudeUp(s, M * 0.8, 'aco_inox', 0.12, 6); },
};

export const heatsinkComp: ComponentDef = {
  type: 'heatsink', name: 'Dissipador aletado', category: 'Mecânica', cost: 5, partNumber: 'HS',
  params: { w: num('Largura', 20), d: num('Profundidade', 20), h: num('Altura', 10), fins: num('Aletas', 8, 2, 40, 1, ''), base: num('Base', 2, 0.5, 10), mat: sel('Material', 'aluminio_preto', [['aluminio_preto', 'Alumínio anodizado'], ['aluminio', 'Alumínio natural'], ['cobre', 'Cobre']]) },
  build: p => { const g = group(box(p.w, p.base, p.d, p.mat)); const k = Math.round(p.fins), ft = Math.max(0.4, (p.w / k) * 0.35); for (let i = 0; i < k; i++) g.add(rbox(ft, p.h - p.base, p.d, ft * 0.45, p.mat, -p.w / 2 + ft / 2 + (i * (p.w - ft)) / (k - 1), p.base, 0)); return g; },
};

export const fanComp: ComponentDef = {
  type: 'fan', name: 'Ventoinha / cooler', category: 'Mecânica', cost: 15, partNumber: 'FAN',
  params: { size: sel('Tamanho', '40', [['25', '25 mm'], ['30', '30 mm'], ['40', '40 mm'], ['60', '60 mm'], ['80', '80 mm'], ['120', '120 mm']]), t: num('Espessura', 10, 3, 38), blower: bool('Tipo blower (notebook)', false) },
  build: p => {
    const S = +p.size, g = new THREE.Group();
    if (!p.blower) { const fr = roundedRectShape(S, S, S * 0.08); fr.holes.push(circlePath(S * 0.47)); [[1, 1], [1, -1], [-1, 1], [-1, -1]].forEach(([a, c]) => fr.holes.push(circlePath(S * 0.04, a * S * 0.4, c * S * 0.4))); g.add(extrudeUp(fr, p.t, 'pbt_preto', 0.3)); }
    else { const s = roundedRectShape(S, S, S * 0.3); g.add(extrudeUp(s, p.t * 0.15, 'pbt_preto')); g.add(at(extrudeUp(s, p.t * 0.1, 'aco_preto'), 0, p.t * 0.9, 0)); }
    g.add(cyl(S * 0.17, p.t * 0.9, 'pbt_preto', 0, p.t * 0.05, 0, 32));
    const nb = p.blower ? 33 : 7;
    for (let i = 0; i < nb; i++) { const piv = new THREE.Group(); const bl = box(S * (p.blower ? 0.12 : 0.3), p.t * 0.7, S * 0.025, 'pbt_preto', S * (p.blower ? 0.33 : 0.31), p.t * 0.12, 0); bl.rotation.x = p.blower ? 0 : 28 * DEG; bl.rotation.y = p.blower ? 0.5 : 0; piv.add(bl); piv.rotation.y = (i / nb) * Math.PI * 2; g.add(piv); }
    return g;
  },
};

export const carbonComp: ComponentDef = {
  type: 'carbon_plate', name: 'Placa de fibra de carbono', category: 'Mecânica', cost: p => 5 + p.w * p.d * p.t * 0.0004, defaultMat: 'fibra_carbono', partNumber: 'CF-3K',
  params: { w: num('Largura', 100), d: num('Profundidade', 40), t: num('Espessura', 3, 0.5, 8), r: num('Raio de canto', 5, 0) },
  build: p => extrudeUp(roundedRectShape(p.w, p.d, p.r), p.t, 'fibra_carbono', Math.min(0.3, p.t / 4)),
};

export const servoComp: ComponentDef = {
  type: 'servo_sg90', name: 'Servo SG90', category: 'Mecânica', cost: 15, mass: 9, partNumber: 'SG90',
  params: { angle: num('Ângulo do braço', 0, -90, 90, 1, '°') },
  sockets: () => [socket({ id: 'W', label: 'Cabo (GND · 5V · SINAL)', kind: 'header-female', pins: 3, pitch: 2.54, pos: [-11.3, 6, 0], normal: [-1, 0, 0], axis: [0, 0, 1], pinNames: ['GND', '5V', 'PWM'], pinTypes: ['gnd', '5v', 'gpio'], logicVoltage: 5, termination: 'pin' })],
  build: p => {
    const g = group(rbox(22.5, 22.7, 12.2, 0.6, 'plastico_azul'), rbox(32.3, 2.5, 12.2, 0.4, 'plastico_azul', 0, 15.9), cyl(5.9, 4, 'plastico_azul', 5.9 - 22.5 / 2 + 0.1, 22.7), cyl(2.4, 3.2, 'abs_branco', -5.35, 26.7));
    const arm = group(cyl(3.5, 1.5, 'abs_branco'), rbox(16, 1.5, 4, 0.8, 'abs_branco', 7, 0, 0)); arm.position.set(-5.35, 29.9, 0); arm.rotation.y = p.angle * DEG; g.add(arm);
    return g;
  },
};

export const motorComp: ComponentDef = {
  type: 'motor_bl', name: 'Motor brushless (FPV)', category: 'Mecânica', cost: 75, mass: p => ({ '1404': 9, '2004': 19, '2207': 32, '2806': 45 } as Record<string, number>)[p.size] ?? 30, partNumber: 'BLDC',
  params: { size: sel('Tamanho', '2207', [['1404', '1404 (3")'], ['2004', '2004 (4")'], ['2207', '2207 (5")'], ['2806', '2806.5 (7")']]) },
  build: p => {
    const st = +p.size.slice(0, 2), sh = +p.size.slice(2, 4), R = st / 2 + 2.2, H = sh + 6.5;
    const g = group(cyl(R, 2, 'aluminio_preto', 0, 0, 0, 48), cyl(R, H - 3.5, 'aluminio_azul', 0, 2, 0, 48), cyl(R * 0.72, 1.5, 'aluminio_preto', 0, H - 1.5, 0, 48), cyl(2.5, 7, 'aco_inox', 0, H, 0, 24));
    const mats: THREE.Matrix4[] = []; for (let i = 0; i < 12; i++) { const a = (i / 12) * Math.PI * 2; mats.push(TM(Math.cos(a) * (R - 0.05), 2.2, Math.sin(a) * (R - 0.05), -a)); }
    g.add(instanced(new THREE.BoxGeometry(0.4, H - 4, 2.4), 'aluminio_preto', mats));
    return g;
  },
};

export const propComp: ComponentDef = {
  type: 'propeller', name: 'Hélice', category: 'Mecânica', cost: 5, mass: 4.5, partNumber: 'PROP',
  params: { inch: num('Diâmetro', 5.1, 2, 10, 0.1, 'pol'), blades: num('Pás', 3, 2, 4, 1, ''), color: sel('Cor', 'plastico_laranja', [['plastico_laranja', 'Laranja'], ['plastico_vermelho', 'Vermelha'], ['abs_preto', 'Preta'], ['policarbonato', 'Transparente']]) },
  build: p => {
    const R = (p.inch * 25.4) / 2, g = group(cyl(5, 6, p.color, 0, 0, 0, 32));
    for (let i = 0; i < Math.round(p.blades); i++) {
      const sh = new THREE.Shape(); sh.moveTo(0, -4); sh.quadraticCurveTo(R * 0.5, -9.5, R, -2.5); sh.quadraticCurveTo(R * 0.62, 4.5, 0, 4); sh.closePath();
      const bl = extrudeUp(sh, 1.0, p.color, 0.25); const piv = new THREE.Group(); bl.rotation.x = 12 * DEG; bl.position.y = 2.5; piv.add(bl); piv.rotation.y = (i / Math.round(p.blades)) * Math.PI * 2; g.add(piv);
    }
    return g;
  },
};

export const hingeComp: ComponentDef = {
  type: 'hinge', name: 'Dobradiça de notebook', category: 'Mecânica', cost: 20, partNumber: 'HINGE',
  params: { len: num('Comprimento', 30, 10, 80), r: num('Raio', 3, 1, 8) },
  build: p => group(cylX(p.r, p.len, mat2('aco_inox'), 0, p.r, 0), box(p.len * 0.8, 1.2, 14, 'aco_inox', 0, 0, 8)),
};
import { mat as mat2 } from '@/engine/materials';
export { icBody, btbConnector };

// ESP32 DevKit V1 (DOIT, 30 pinos) — 51,8 × 28,2 mm. Módulo ESP32-WROOM-32 com blindagem e antena de PCB.
import * as THREE from 'three';
import type { ComponentDef } from '../types';
import { bool, sel, socket, mountSockets, inferPinType } from '../types';
import { Board } from '@/geometry/board';
import { box, group } from '@/geometry/primitives';
import { header, microUsb, qfn, sot223, smdPassive, tactSwitch, rfShield, crystalSMD, fp } from '@/geometry/parts';
import { ESP32_DEVKIT_A, ESP32_DEVKIT_B } from '../pinouts';

const W = 51.8, D = 28.2;
const ROW_Z = D / 2 - 1.3;
const PIN_X0 = -0.8 - 7 * 2.54; // pino mais próximo do USB; o pino 1 (EN / D23) fica do lado da antena
const HOLES: [number, number][] = [[W / 2 - 2.2, D / 2 - 2.2], [-W / 2 + 2.2, D / 2 - 2.2], [W / 2 - 2.2, -D / 2 + 2.2], [-W / 2 + 2.2, -D / 2 + 2.2]];

/** Módulo ESP32-WROOM-32: 18 × 25,5 × 3,1 mm, 38 pads castelados. Eixo longo em X, antena em +X. */
export function wroomModule(): THREE.Object3D {
  const L = 25.5, Wm = 18;
  const b = new Board({ w: L, d: Wm, t: 0.8, corner: 0.2, mask: 'fr4_preto', seed: 32, pour: true, traceDensity: 0.25, keepouts: [{ x: L / 2 - 3.4, z: 0, w: 6.4, d: Wm }] });
  // antena meandro (F invertido) na área sem cobre
  const ax = L / 2 - 0.8;
  const meander: [number, number][] = [[ax - 5.6, -7.5], [ax - 5.6, 7.2], [ax - 4.2, 7.2], [ax - 4.2, -6.5], [ax - 2.8, -6.5], [ax - 2.8, 7.2], [ax - 1.4, 7.2], [ax - 1.4, -6.5], [ax, -6.5], [ax, 7.2]];
  b.trace(meander, 0.5);
  for (let i = 0; i < 14; i++) { const x = -L / 2 + 1.5 + i * 1.27; b.pad({ x, z: Wm / 2 - 0.45, w: 0.9, d: 0.9 }); b.pad({ x, z: -Wm / 2 + 0.45, w: 0.9, d: 0.9 }); }
  for (let i = 0; i < 10; i++) b.pad({ x: -L / 2 + 0.45, z: -5.7 + i * 1.27, w: 0.9, d: 0.9 });
  b.add(rfShield(17.6, 15.8, 2.2, { lines: [{ text: 'ESP32-WROOM-32', size: 1.5, weight: 700 }, { text: '4MB · Wi-Fi + BT/BLE', size: 0.9, weight: 500, dy: 0.3 }, { text: 'R3 2425', size: 0.8, weight: 500, font: 'mono', dy: 0.2 }] }), -L / 2 + 0.6 + 8.8, 0, 0, { outline: false });
  const o = b.build();
  // faces douradas dos pads castelados
  const gold = new THREE.Group();
  for (let i = 0; i < 14; i++) { const x = -L / 2 + 1.5 + i * 1.27; gold.add(box(0.7, 0.8, 0.04, 'ouro', x, 0, Wm / 2 + 0.01)); gold.add(box(0.7, 0.8, 0.04, 'ouro', x, 0, -Wm / 2 - 0.01)); }
  o.add(gold);
  return o;
}

export const esp32DevKit: ComponentDef = {
  type: 'esp32_devkit', name: 'ESP32 DevKit V1 (30 pinos)', category: 'Placas de desenvolvimento', partNumber: 'ESP32-DEVKIT-V1',
  description: 'ESP32-WROOM-32, Wi-Fi + Bluetooth, CP2102, regulador AMS1117 3,3 V. Lógica de 3,3 V (não tolerante a 5 V).',
  cost: 40, mass: p => (p.pins ? 10 : 7.5), tags: ['esp32', 'wifi', 'bluetooth', 'microcontrolador'],
  params: { pins: bool('Barras de pinos soldadas', true), mask: sel('Cor da placa', 'fr4_preto', [['fr4_preto', 'Preta'], ['fr4_azul', 'Azul'], ['fr4_verde', 'Verde']]) },
  sockets: p => {
    const y = p.pins ? -8.6 : 0;
    const mk = (id: string, label: string, z: number, names: string[]) => socket({
      id, label, kind: 'header-male', pins: 15, pitch: 2.54, pos: [-0.8, y, z], normal: [0, -1, 0], axis: [1, 0, 0],
      pinNames: names, pinTypes: names.map(inferPinType), logicVoltage: 3.3, termination: p.pins ? 'pin' : 'solder',
      pinOffsets: names.map((_, i) => [PIN_X0 + (14 - i) * 2.54 + 0.8, 0, 0] as [number, number, number]),
    });
    return [mk('J1', 'Lado EN (J1)', ROW_Z, ESP32_DEVKIT_A), mk('J2', 'Lado 3V3 (J2)', -ROW_Z, ESP32_DEVKIT_B), ...mountSockets(HOLES, 1.6)];
  },
  build: p => {
    const b = new Board({ w: W, d: D, t: 1.6, corner: 0.8, mask: p.mask, seed: 1032, holes: HOLES.map(([x, z]) => ({ x, z, r: 1.4, ring: 0.8 })), traceDensity: 0.55 });
    b.add(wroomModule(), W / 2 - 12.75 - 0.2, 0, 0, { outline: false, y: 1.6 });
    b.add(microUsb(), -W / 2 + 2.0, 0, -Math.PI / 2, { ref: 'J3' });
    b.add(qfn(5, 5, 0.9, 7, [{ text: 'CP2102', size: 0.75, weight: 700 }, { text: 'DCL00X', size: 0.55 }, { text: '2418', size: 0.55, font: 'mono' }]), -14.5, 3.2, 0, { ref: 'U2' });
    b.add(sot223([{ text: 'AMS1117', size: 0.9, weight: 700 }, { text: '3.3  2405', size: 0.7 }]), -11.5, -6.6, Math.PI, { ref: 'U3' });
    b.add(tactSwitch(4), -19.8, 8.3, 0, { ref: 'EN', refDz: -3.2 });
    b.add(tactSwitch(4), -19.8, -8.3, 0, { ref: 'BOOT', refDz: 3.2 });
    b.add(crystalSMD(3.2, 2.5, [{ text: '24.000', size: 0.55 }]), -8.6, 4.8, 0, { ref: 'Y1' });
    b.add(smdPassive('0603', 'led', 'led_vermelho'), -4.6, -9.6, 0, { ref: 'PWR' });
    b.add(smdPassive('0603', 'led', 'led_azul'), -1.8, -9.6, 0, { ref: 'D2' });
    const diode = group(box(2.7, 1.1, 1.6, 'encapsulamento'), box(0.4, 0.02, 1.6, 'abs_branco', -1.0, 1.1));
    b.add(fp(diode, { pads: [{ x: -1.6, z: 0, w: 0.9, d: 1.2 }, { x: 1.6, z: 0, w: 0.9, d: 1.2 }], outline: { w: 3.6, d: 1.9 } }), -18.6, 1.0, Math.PI / 2, { ref: 'D1' });
    const passives: [string, 'res' | 'cap', number, number, number][] = [
      ['0603', 'cap', -16.8, -2.6, 0], ['0603', 'cap', -12.2, 0.4, 0], ['0402', 'res', -11.0, 4.6, Math.PI / 2], ['0402', 'res', -11.0, 6.3, Math.PI / 2],
      ['0603', 'res', -6.6, -4.5, 0], ['0603', 'res', -6.6, -6.4, 0], ['0805', 'cap', -6.0, 1.6, Math.PI / 2], ['0805', 'cap', -15.0, -9.6, 0],
      ['0603', 'res', -2.0, 6.6, 0], ['0603', 'cap', -2.0, 3.8, 0], ['0402', 'cap', -4.2, 7.8, 0], ['0603', 'res', -22.6, 5.2, Math.PI / 2],
      ['0603', 'res', -22.6, -5.2, Math.PI / 2], ['0402', 'cap', -9.2, -2.2, 0], ['0603', 'cap', 0.2, -3.2, Math.PI / 2], ['0603', 'res', 1.8, -6.4, 0],
    ];
    passives.forEach(([c, k, x, z, r], i) => b.add(smdPassive(c, k), x, z, r, { ref: (k === 'res' ? 'R' : 'C') + (i + 1), refSize: 0.6 }));
    // furos e legendas das barras de pinos
    const rows: [number, string[], number][] = [[ROW_Z, ESP32_DEVKIT_A, -1], [-ROW_Z, ESP32_DEVKIT_B, 1]];
    for (const [z, names, side] of rows) names.forEach((nm, i) => b.silk(nm, PIN_X0 + (14 - i) * 2.54, z + side * 2.0, 0.78, { rot: 0 }));
    b.silk('ESP32 DEVKIT V1', 2, -2.4, 1.2, { weight: 800 });
    b.silk('3V3 LOGIC', 2, 1.0, 0.8, { weight: 600 });
    if (p.pins) {
      for (const z of [ROW_Z, -ROW_Z]) { const h = header(15, 1, false); const wrap = new THREE.Group(); h.rotation.x = Math.PI; wrap.add(h); wrap.userData.fp = h.userData.fp; b.add(wrap, -0.8, z, 0, { outline: false, y: 0 }); }
    } else {
      for (const z of [ROW_Z, -ROW_Z]) for (let i = 0; i < 15; i++) b.hole({ x: PIN_X0 + i * 2.54, z, r: 0.5, ring: 0.45 });
    }
    return b.build();
  },
};

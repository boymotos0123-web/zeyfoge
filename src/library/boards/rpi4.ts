// Raspberry Pi 4 Modelo B — 85 × 56 × 1,4 mm, posições pelo desenho mecânico oficial.
// Ethernet ao lado do GPIO; USB 3.0 (língua azul) no meio; USB 2.0 na ponta. CSI/DSI com conector FFC de 15 vias (1 mm).
import * as THREE from 'three';
import type { ComponentDef } from '../types';
import { bool, socket, mountSockets, inferPinType } from '../types';
import { Board } from '@/geometry/board';
import { box, group, cyl } from '@/geometry/primitives';
import { header, usbCReceptacle, usbA, rj45, microHdmi, audioJack, bga, qfn, smdPassive, zifConnector, rfShield, powerInductor, crystalSMD, sot23, fp } from '@/geometry/parts';
import { RPI_40 } from '../pinouts';
import type { Vec3 } from '@/core/types';

const W = 85, D = 56, T = 1.4;
const c = (bx: number, by: number): [number, number] => [bx - W / 2, D / 2 - by];
const HOLES: [number, number][] = [[3.5, 3.5], [61.5, 3.5], [3.5, 52.5], [61.5, 52.5]].map(([x, y]) => c(x, y));

// header de 40 pinos: centro em (32.5, 52.5). Pinos ímpares na fileira interna, pares na borda.
const HDR = c(32.5, 52.5);
const pinOffset = (k: number): Vec3 => { const col = Math.floor(k / 2), row = k % 2; return [-(19 * 2.54) / 2 + col * 2.54, 0, row === 0 ? 1.27 : -1.27]; };

export const rpi4: ComponentDef = {
  type: 'rpi4', name: 'Raspberry Pi 4 Model B', category: 'Placas de desenvolvimento', partNumber: 'RPI4-MODBP',
  description: 'BCM2711 quad-core 1,8 GHz, LPDDR4, Wi-Fi 5 / BT 5, Gigabit Ethernet, 2× USB 3.0, 2× micro-HDMI 4K, CSI/DSI. GPIO 3,3 V.',
  cost: 450, mass: 46, tags: ['raspberry', 'linux', 'sbc', 'computador'],
  params: { heatsink: bool('Dissipadores no SoC e RAM', false) },
  sockets: () => [
    socket({ id: 'GPIO', label: 'GPIO 40 pinos', kind: 'header-male', pins: 40, pitch: 2.54, pos: [HDR[0], T + 8.5, HDR[1]], normal: [0, 1, 0], axis: [1, 0, 0], pinNames: RPI_40, pinTypes: RPI_40.map(inferPinType), logicVoltage: 3.3, pinOffsets: RPI_40.map((_, k) => pinOffset(k)), termination: 'pin' }),
    socket({ id: 'CSI', label: 'Câmera (CSI, FFC 15 vias)', kind: 'mipi-csi', pins: 15, pitch: 1.0, pos: [c(45, 11.5)[0], T + 6.7, c(45, 11.5)[1]], normal: [0, 1, 0], axis: [0, 0, 1], termination: 'zif' }),
    socket({ id: 'DSI', label: 'Display (DSI, FFC 15 vias)', kind: 'mipi-dsi', pins: 15, pitch: 1.0, pos: [c(3.5, 28)[0] + 1.2, T + 6.7, c(3.5, 28)[1]], normal: [0, 1, 0], axis: [0, 0, 1], termination: 'zif' }),
    socket({ id: 'USBC', label: 'Alimentação USB-C', kind: 'usb-c', pos: [c(11.2, 0)[0], T + 1.63, D / 2 + 1.3], normal: [0, 0, 1], axis: [1, 0, 0], pinTypes: ['5v'], termination: 'pin' }),
    ...mountSockets(HOLES, T),
  ],
  build: p => {
    const b = new Board({ w: W, d: D, t: T, corner: 3, mask: 'fr4_verde', seed: 2711, holes: HOLES.map(([x, z]) => ({ x, z, r: 1.375, ring: 1.3 })), traceDensity: 0.8 });
    let [x, z] = c(25.75, 32.5);
    b.add(bga(15, 15, 2.3, [{ text: 'BCM2711B0', size: 1.4, weight: 700 }, { text: 'IFBG', size: 1.0 }, { text: '2422 P11', size: 0.9, font: 'mono' }], 'metal'), x, z, 0, { ref: 'U1' });
    [x, z] = c(41.5, 32);
    b.add(bga(14, 10, 1.1, [{ text: 'LPDDR4 4GB', size: 1.1, weight: 700 }, { text: 'D9WHZ 2419', size: 0.8, font: 'mono' }]), x, z, Math.PI / 2, { ref: 'U3' });
    [x, z] = c(60, 22); b.add(qfn(6, 6, 0.85, 10, [{ text: 'VL805', size: 1.0, weight: 700 }, { text: 'USB 3.0', size: 0.7 }]), x, z, 0, { ref: 'U4' });
    [x, z] = c(63, 42); b.add(qfn(7, 7, 0.85, 12, [{ text: 'BCM54213', size: 0.85, weight: 700 }, { text: 'PE GbE', size: 0.7 }]), x, z, 0, { ref: 'U5' });
    [x, z] = c(19, 15); b.add(qfn(5, 5, 0.85, 8, [{ text: 'MXL7704', size: 0.75, weight: 700 }, { text: 'PMIC', size: 0.6 }]), x, z, 0, { ref: 'U6' });
    [x, z] = c(12.5, 42); b.add(rfShield(10, 12, 1.4, { lines: [{ text: 'Wi-Fi / BT', size: 1.0, weight: 700 }, { text: 'CYW43455', size: 0.8 }] }), x, z, 0, { ref: 'U7' });
    [x, z] = c(5, 50); b.add(fp(group(box(3.2, 0.6, 1.2, 'ceramica'), box(1.2, 0.02, 0.8, 'ouro', 0.8, 0.6)), { pads: [] }), x, z, Math.PI / 2);
    // conectores
    [x, z] = c(11.2, 0); b.add(usbCReceptacle(), x, D / 2 - 2.4, 0, { ref: 'J1' });
    [x, z] = c(26, 0); b.add(microHdmi(), x, D / 2 - 2.9, 0, { ref: 'HDMI0' });
    [x, z] = c(39.5, 0); b.add(microHdmi(), x, D / 2 - 2.9, 0, { ref: 'HDMI1' });
    [x, z] = c(53.5, 0); b.add(audioJack(), x, D / 2 - 6.2, 0, { ref: 'J7' });
    [x, z] = c(85 - 10.65 + 2.2, 45.75); b.add(rj45(), x, z, Math.PI / 2, { outline: false });
    [x, z] = c(85 - 8.75 + 2.4, 27); b.add(usbA(true, 'plastico_azul'), x, z, Math.PI / 2, { outline: false });
    [x, z] = c(85 - 8.75 + 2.4, 9); b.add(usbA(true, 'pbt_preto'), x, z, Math.PI / 2, { outline: false });
    [x, z] = c(45, 11.5); b.add(zifConnector(15, 1.0, { color: 'nylon_bege', actuator: 'pbt_preto', vertical: true }), x, z, Math.PI / 2, { ref: 'CAMERA', refDx: 3.6, refDz: 0 });
    [x, z] = c(3.5, 28); b.add(zifConnector(15, 1.0, { color: 'nylon_bege', actuator: 'pbt_preto', vertical: true }), x + 1.2, z, Math.PI / 2, { ref: 'DISPLAY', refDx: 4.2, refDz: 0 });
    b.add(header(20, 2, false), HDR[0], HDR[1], 0, { outline: false });
    [x, z] = c(64, 50); b.add(header(2, 2, false), x, z, 0, { ref: 'POE', refDz: 3.6 });
    // passivos e reguladores
    const pts: [number, number, number][] = [[14, 22, 0], [16, 22, 0], [18, 22, 0], [22, 22, 1], [30, 22, 0], [32, 23, 1], [34, 22, 0], [36, 24, 1], [48, 24, 0], [50, 26, 1], [52, 37, 0], [54, 36, 1], [34, 42, 0], [36, 43, 1], [20, 30, 1], [21, 36, 0], [24, 41, 0], [28, 42, 1], [48, 40, 0], [56, 30, 1], [8, 20, 0], [8, 24, 1], [10, 30, 0], [44, 18, 0], [55, 15, 1]];
    pts.forEach(([bx, by, r], i) => { const [px, pz] = c(bx, by); b.add(smdPassive(i % 3 ? '0402' : '0603', i % 2 ? 'cap' : 'res'), px, pz, r ? Math.PI / 2 : 0); });
    [[24, 12], [28, 15], [14, 28]].forEach(([bx, by], i) => { const [px, pz] = c(bx, by); b.add(powerInductor(4, 2, ['1R0', '2R2', '4R7'][i]), px, pz, 0, { ref: 'L' + (i + 1) }); });
    [x, z] = c(36, 15); b.add(crystalSMD(3.2, 2.5, [{ text: '54.000', size: 0.5 }]), x, z, 0, { ref: 'X1' });
    [x, z] = c(50, 46); b.add(sot23([{ text: 'A7', size: 0.6 }], 6), x, z, 0);
    [x, z] = c(2.5, 8); b.add(smdPassive('0603', 'led', 'led_vermelho'), x, z, Math.PI / 2, { ref: 'PWR' });
    [x, z] = c(2.5, 12); b.add(smdPassive('0603', 'led', 'led_verde'), x, z, Math.PI / 2, { ref: 'ACT' });
    if (p.heatsink) {
      [x, z] = c(25.75, 32.5);
      const hs = new THREE.Group(); hs.add(box(14, 1.2, 14, 'aluminio_preto')); for (let i = 0; i < 6; i++) hs.add(box(14, 6, 0.9, 'aluminio_preto', 0, 1.2, -5.8 + i * 2.32));
      hs.position.set(x, T + 2.3, z); b.parts.add(hs);
    }
    // legendas
    b.silk('BCM2711', ...c(25.75, 22.5), 1.0);
    b.silk('GPIO', ...c(32.5, 47.5), 1.2, { weight: 800 });
    b.silk('1', ...c(7.2, 50.6), 0.9);
    b.silk('40', ...c(57.8, 54.3), 0.9);
    b.silk('MODEL B · 4GB', ...c(42, 6.5), 1.4, { weight: 800 });
    b.silk('© 2019', ...c(42, 4.2), 0.8);
    return b.build();
  },
};

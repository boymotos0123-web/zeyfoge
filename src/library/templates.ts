// Montagens prontas — incluem conexões reais (flex, FFC e fios pino a pino).
import type { Id, Vec3, ZDocument } from '@/core/types';
import { createNode, type NodeInit } from '@/core/document';
import { createPart, connect } from './factory';
import { screenDims } from './modules/modules';

export interface Template { id: string; name: string; desc: string; build(doc: ZDocument): Id }

function kit(doc: ZDocument) {
  const add = (type: string, init: NodeInit = {}) => { const n = createPart(type, init); doc.nodes.push(n); return n.id; };
  const grp = (name: string, parent: Id | null = null, pos: Vec3 = [0, 0, 0]) => { const n = createNode('assembly', { name, parent, pos, kind: 'assembly' }); n.expanded = parent === null; doc.nodes.push(n); return n.id; };
  return { add, grp };
}

export const TEMPLATES: Template[] = [
  {
    id: 'phone', name: 'Celular transparente 6,1"',
    desc: 'Moldura de titânio, traseira transparente, placa HDI 10 camadas, 3 câmeras, Qi — com flex MIPI-DSI, CSI, BMS e FPC roteados',
    build(doc) {
      const { add, grp } = kit(doc);
      const root = grp('Celular transparente');
      const [L] = screenDims(6.1, '19.5:9');
      const display = add('phone_display', { parent: root, pos: [0, 1.45, 0], rot: [180, 0, 0], params: { diag: 6.1, on: true } });
      add('phone_frame', { parent: root, params: { mat: 'titanio' } });
      const board = add('phone_logicboard', { parent: root, pos: [12, 2.5, -40] });
      const cams = grp('Câmeras', root);
      const c1 = add('phone_camera', { name: 'Câmera principal 50 MP', parent: cams, pos: [-22, 2.5, -62], params: { lens: 8, ois: true } });
      const c2 = add('phone_camera', { name: 'Câmera ultra-wide 48 MP', parent: cams, pos: [-22, 2.5, -50], params: { lens: 7, ois: false } });
      const c3 = add('phone_camera', { name: 'Câmera tele 5x', parent: cams, pos: [-22, 2.5, -38], params: { lens: 6.5, ois: true, w: 10, d: 10 } });
      const bat = add('lipo', { name: 'Bateria 4000 mAh', parent: root, pos: [0, 2.5, 27], rot: [0, 180, 0], params: { w: 60, l: 62, h: 3.9, mah: 4000, conn: 'btb' } });
      add('qi_coil', { name: 'Bobina Qi + ímãs', parent: root, pos: [0, 6.62, 22], params: { ro: 18, ri: 7, magnets: true } });
      const sub = add('phone_subboard', { parent: root, pos: [0, 2.5, 64.5] });
      add('box', { name: 'Alto-falante', parent: root, pos: [-13, 3.1, 64.5], params: { w: 10, h: 2.6, d: 6, r: 0.4 }, mat: 'aco_preto', cost: 9 });
      add('back_panel', { name: 'Traseira transparente', parent: root, pos: [0, 7.45, 0], params: { mat: 'policarbonato', cam: 'hole', cw: 18, cl: 40, cx: -22, cz: -50, cr: 6 } });
      const screws = grp('Parafusos', root);
      [[-5, -63], [29, -63], [-5, -19], [24, -25]].forEach(([x, z], i) => add('screw', { name: `Parafuso Torx ${i + 1}`, parent: screws, pos: [x, 3.3, z], params: { m: '1.2', len: 2, head: 'torx', mat: 'aco_preto' } }));
      const flexes = grp('Flex e cabos', root);
      void flexes;
      connect(doc, { node: display, socket: 'DSI' }, { node: board, socket: 'DSI' }, { name: 'Flex da tela (MIPI-DSI)', lead: 2, slack: 0.05 });
      connect(doc, { node: c1, socket: 'CSI' }, { node: board, socket: 'CSI1' }, { name: 'Flex câmera principal', lead: 1.5, slack: 0.1 });
      connect(doc, { node: c2, socket: 'CSI' }, { node: board, socket: 'CSI2' }, { name: 'Flex ultra-wide', lead: 1.5, slack: 0.1 });
      connect(doc, { node: c3, socket: 'CSI' }, { node: board, socket: 'CSI3' }, { name: 'Flex tele', lead: 1.5, slack: 0.1 });
      connect(doc, { node: bat, socket: 'BMS' }, { node: board, socket: 'BMS' }, { name: 'Flex da bateria (BMS)', lead: 2, slack: 0.05 });
      connect(doc, { node: sub, socket: 'SUB' }, { node: board, socket: 'SUB' }, { name: 'Flex longo sub-placa', lead: 3, slack: 0, waypoints: [[16, 6.5, 50], [16, 6.5, -6]] });
      void L;
      return root;
    },
  },
  {
    id: 'rpi-cam-oled', name: 'Raspberry Pi 4 + câmera + OLED',
    desc: 'FFC de 15 vias na porta CSI e fios Dupont pino a pino (3V3, GND, SDA, SCL) com validação elétrica',
    build(doc) {
      const { add, grp } = kit(doc);
      const root = grp('Raspberry Pi 4 + periféricos');
      const pi = add('rpi4', { parent: root, params: { heatsink: true } });
      const cam = add('rpi_camera_v2', { parent: root, pos: [1.9, 46.9, 16.5], rot: [90, 0, 90] });
      const oled = add('oled096', { parent: root, pos: [-20, 0, -68] });
      connect(doc, { node: cam, socket: 'CSI' }, { node: pi, socket: 'CSI' }, { name: 'FFC câmera 15 vias', lead: 4, slack: 0.15 });
      const wires: [number, number][] = [[0, 1], [5, 0], [2, 3], [4, 2]]; // 3V3→VCC, GND→GND, GPIO2(SDA)→SDA, GPIO3(SCL)→SCL
      wires.forEach(([pp, op]) => connect(doc, { node: pi, socket: 'GPIO', pin: pp }, { node: oled, socket: 'I2C', pin: op }, { slack: 0.35, lead: 4 }));
      return root;
    },
  },
  {
    id: 'esp32-box', name: 'ESP32 em gabinete com bateria',
    desc: 'Gabinete impresso em 3D, ESP32 DevKit, célula 18650, USB-C e tampa de acrílico',
    build(doc) {
      const { add, grp } = kit(doc);
      const root = grp('Dispositivo ESP32');
      add('enclosure', { parent: root, params: { w: 80, d: 50, h: 32, wall: 2, r: 4, lid: false, towers: true } });
      add('esp32_devkit', { parent: root, pos: [6, 19, 8] });
      add('cell18650', { parent: root, pos: [0, 2, -12] });
      add('usb_c', { parent: root, pos: [-36.5, 8, 8], rot: [0, -90, 0] });
      add('box', { name: 'Tampa de acrílico', parent: root, pos: [0, 32.3, 0], params: { w: 84, h: 2, d: 54, r: 6 }, mat: 'acrilico', cost: 15 });
      return root;
    },
  },
  {
    id: 'arduino', name: 'Arduino Uno + protoboard',
    desc: 'Uno R3, protoboard de 400 pontos, LED e resistor de 220 Ω',
    build(doc) {
      const { add, grp } = kit(doc);
      const root = grp('Kit Arduino');
      add('arduino_uno', { parent: root, pos: [-45, 0, 0] });
      add('protoboard', { parent: root, pos: [45, 0, 0] });
      add('led', { parent: root, pos: [40.6, 8.5, -9], params: { leads: 6 } });
      add('resistor', { parent: root, pos: [48, 8.5, -16], rot: [0, 90, 0], params: { value: '220', pitch: 7.62 } });
      return root;
    },
  },
  {
    id: 'fpv', name: 'Drone FPV 5"',
    desc: 'Frame X de carbono 220 mm, motores 2207, hélices 5", stack 30,5 mm, câmera e Li-Po 6S',
    build(doc) {
      const { add, grp } = kit(doc);
      const root = grp('Drone FPV 5"');
      add('carbon_plate', { name: 'Braço 1', parent: root, rot: [0, 45, 0], params: { w: 234, d: 14, t: 5, r: 7 } });
      add('carbon_plate', { name: 'Braço 2', parent: root, rot: [0, -45, 0], params: { w: 234, d: 14, t: 5, r: 7 } });
      add('carbon_plate', { name: 'Placa superior', parent: root, pos: [0, 30, 0], rot: [0, 90, 0], params: { w: 90, d: 40, t: 2, r: 6 } });
      [[1, 1], [1, -1], [-1, 1], [-1, -1]].forEach(([a, c], i) => {
        add('motor_bl', { name: `Motor ${i + 1}`, parent: root, pos: [a * 77.8, 5, c * 77.8] });
        add('propeller', { name: `Hélice ${i + 1}`, parent: root, pos: [a * 77.8, 17, c * 77.8], rot: [0, i * 37, 0] });
        add('standoff', { name: `Espaçador ${i + 1}`, parent: root, pos: [a * 15.25, 5, c * 15.25], params: { m: '3', len: 25, mat: 'aluminio' } });
      });
      add('pcb', { name: 'ESC 4 em 1', parent: root, pos: [0, 9, 0], cost: 280, params: { w: 36, d: 36, t: 1.6, r: 3, mask: 'fr4_preto', inset: 2.75, seed: 4 } });
      add('pcb', { name: 'Controladora de voo (FC)', parent: root, pos: [0, 17, 0], cost: 250, params: { w: 36, d: 36, t: 1.6, r: 3, mask: 'fr4_azul', inset: 2.75, seed: 7 } });
      add('ic', { name: 'MCU STM32F7', parent: root, pos: [0, 18.6, 0], params: { style: 'qfp', w: 7, d: 7, pins: 12, mark: 'STM32F7' } });
      add('lipo', { name: 'Li-Po 6S 1300 mAh', parent: root, pos: [0, 32, 0], params: { w: 35, l: 75, h: 34, mah: 1300, conn: 'jst' }, cost: 230 });
      return root;
    },
  },
  {
    id: 'laptop', name: 'Notebook 14"',
    desc: 'Unibody de alumínio, tela 16:10, placa-mãe, bateria e ventoinhas blower',
    build(doc) {
      const { add, grp } = kit(doc);
      const root = grp('Notebook 14"');
      add('laptop_base', { parent: root });
      add('laptop_lid', { parent: root, pos: [0, 15.5, -108.9] });
      const inside = grp('Interno', root, [0, 1.5, 0]);
      add('pcb', { name: 'Placa-mãe', parent: inside, pos: [0, 0, -55], params: { w: 200, d: 80, t: 1.2, r: 4, mask: 'fr4_verde', layers: '10', seed: 14 }, cost: 900 });
      add('ic', { name: 'Processador', parent: inside, pos: [0, 1.2, -55], params: { style: 'bga_lid', w: 30, d: 25, h: 1.8, mark: 'FPGA' }, cost: 1200 });
      add('heatsink', { name: 'Dissipador de cobre', parent: inside, pos: [0, 3, -55], params: { w: 60, d: 30, h: 8, fins: 18, base: 1.5, mat: 'cobre' } });
      add('fan', { name: 'Ventoinha esquerda', parent: inside, pos: [-75, 1.2, -60], params: { size: '60', t: 8, blower: true } });
      add('fan', { name: 'Ventoinha direita', parent: inside, pos: [75, 1.2, -60], params: { size: '60', t: 8, blower: true } });
      add('lipo', { name: 'Bateria 70 Wh', parent: inside, pos: [0, 0, 55], params: { w: 250, l: 80, h: 6, mah: 18000, conn: 'jst' }, cost: 450 });
      return root;
    },
  },
];

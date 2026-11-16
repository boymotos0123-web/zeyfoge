// Registro central da biblioteca de componentes.
import * as THREE from 'three';
import type { ComponentDef, Params } from './types';
import type { SocketDef } from '@/core/types';
import { esp32DevKit } from './boards/esp32-devkit';
import { rpi4 } from './boards/rpi4';
import { rpiPico, arduinoUno, arduinoNano, pcbCustom, protoboard } from './boards/others';
import { phoneDisplay, phoneCamera, rpiCamera, lipoBattery, cell18650, qiCoil, oled096, phoneLogicBoard, phoneSubBoard } from './modules/modules';
import * as P from './parts-catalog';
import * as C from './chassis-catalog';

export const LIBRARY: ComponentDef[] = [
  esp32DevKit, rpi4, rpiPico, arduinoUno, arduinoNano, pcbCustom, protoboard,
  phoneLogicBoard, phoneSubBoard,
  phoneDisplay, phoneCamera, rpiCamera, oled096,
  lipoBattery, cell18650, qiCoil,
  P.zifComp, P.btbComp, P.usbCComp, P.headerComp, P.jstComp,
  P.resistorTHT, P.ledTHT, P.smdComp, P.electrolyticComp, P.tactComp, P.crystalComp,
  P.icComp,
  P.screwComp, P.standoffComp, P.nutComp, P.heatsinkComp, P.fanComp, P.carbonComp, P.servoComp, P.motorComp, P.propComp, P.hingeComp,
  C.phoneFrame, C.backPanel, C.enclosure, C.laptopBase, C.laptopLid,
  C.primBox, C.primCyl, C.primSphere, C.primTube, C.primCone, C.primTorus, C.primProfile,
];

export const CATEGORY_ORDER = ['Placas de desenvolvimento', 'Placas de celular', 'Telas e câmeras', 'Energia', 'Conectores', 'Passivos', 'Circuitos integrados', 'Mecânica', 'Chassi e carcaça', 'Primitivas'];
export const CATEGORIES = CATEGORY_ORDER.filter(c => LIBRARY.some(d => d.category === c));

export const byType: Record<string, ComponentDef> = Object.fromEntries(LIBRARY.map(d => [d.type, d]));

export function defaults(type: string): Params {
  const d = byType[type]; if (!d) return {};
  return Object.fromEntries(Object.entries(d.params).map(([k, v]) => [k, v.value]));
}

export function resolveParams(type: string, params: Record<string, unknown>): Params { return { ...defaults(type), ...params }; }

export function buildComponent(type: string, params: Record<string, unknown>): THREE.Object3D {
  const d = byType[type];
  if (!d) {
    const missing = new THREE.Mesh(new THREE.BoxGeometry(10, 10, 10), new THREE.MeshStandardMaterial({ color: '#ff00aa', wireframe: true }));
    missing.position.y = 5; missing.name = `Componente desconhecido: ${type}`;
    return missing;
  }
  return d.build(resolveParams(type, params));
}

export function socketsOf(type: string, params: Record<string, unknown>, custom: SocketDef[] = []): SocketDef[] {
  const d = byType[type];
  const base = d?.sockets ? d.sockets(resolveParams(type, params)) : [];
  return [...base, ...custom];
}

export function costOf(type: string, params: Record<string, unknown>): number {
  const d = byType[type]; if (!d) return 0;
  return typeof d.cost === 'function' ? +d.cost(resolveParams(type, params)).toFixed(2) : d.cost;
}

export function fixedMass(type: string, params: Record<string, unknown>): number | null {
  const d = byType[type]; if (!d || d.mass == null) return null;
  return typeof d.mass === 'function' ? d.mass(resolveParams(type, params)) : d.mass;
}

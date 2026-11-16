// Contrato dos componentes da biblioteca.
import type * as THREE from 'three';
import type { PinType, SocketDef, SocketKind, Vec3 } from '@/core/types';

export type ParamDef =
  | { t: 'num'; label: string; value: number; min: number; max: number; step: number; unit?: string }
  | { t: 'sel'; label: string; value: string; options: [string, string][] }
  | { t: 'bool'; label: string; value: boolean };

export type Params = Record<string, any>;

export interface ComponentDef {
  type: string;
  name: string;
  category: string;
  description?: string;
  /** custo unitário estimado (R$) */
  cost: number | ((p: Params) => number);
  /** massa (g). Se omitida, é calculada por volume × densidade dos materiais. */
  mass?: number | ((p: Params) => number);
  /** material aplicado ao nó por padrão (peças estruturais); null = materiais próprios do componente */
  defaultMat?: string | null;
  partNumber?: string;
  tags?: string[];
  params: Record<string, ParamDef>;
  sockets?: (p: Params) => SocketDef[];
  build: (p: Params) => THREE.Object3D;
}

export const num = (label: string, value: number, min = 0, max = 1000, step = 0.1, unit = 'mm'): ParamDef => ({ t: 'num', label, value, min, max, step, unit });
export const sel = (label: string, value: string, options: [string, string][]): ParamDef => ({ t: 'sel', label, value, options });
export const bool = (label: string, value: boolean): ParamDef => ({ t: 'bool', label, value });

export interface SocketInit {
  id: string; label: string; kind: SocketKind; pins?: number; pitch?: number;
  pos: Vec3; normal: Vec3; axis?: Vec3;
  pinNames?: string[]; pinTypes?: PinType[]; logicVoltage?: number; pinOffsets?: Vec3[];
  termination?: SocketDef['termination'];
}

export const socket = (o: SocketInit): SocketDef => ({ pins: 1, pitch: 0, axis: [1, 0, 0], ...o });

/** Furos de fixação → encaixes de topo e base (para parafusos e espaçadores). */
export function mountSockets(holes: [number, number][], thickness: number, prefix = 'm'): SocketDef[] {
  return holes.flatMap(([x, z], i) => [
    socket({ id: `${prefix}${i + 1}t`, label: `Furo ${i + 1} (topo)`, kind: 'mount-top', pos: [x, thickness, z], normal: [0, 1, 0] }),
    socket({ id: `${prefix}${i + 1}b`, label: `Furo ${i + 1} (base)`, kind: 'mount-bottom', pos: [x, 0, z], normal: [0, -1, 0] }),
  ]);
}

/** Converte nomes de pinos em tipos elétricos por convenção. */
export function inferPinType(name: string): PinType {
  const n = name.toUpperCase();
  if (n === 'GND' || n === 'G' || n.startsWith('GND')) return 'gnd';
  if (n === '3V3' || n === '3.3V' || n === '3V3(OUT)' || n === '3V') return '3v3';
  if (n === '5V' || n === 'VBUS' || n === '5V0') return '5v';
  if (n === 'VIN' || n === 'VSYS') return 'vin';
  if (n === 'VCC') return 'vcc';
  if (n === 'VBAT' || n === 'BAT+' || n === 'B+') return 'vbat';
  if (n === 'NC' || n === 'IOREF' || n === 'ADC_VREF' || n === 'AREF') return 'nc';
  if (n === 'RESET' || n === 'RST' || n === 'RUN' || n === 'EN') return 'reset';
  if (n.includes('SDA') || n.includes('SCL')) return 'i2c';
  if (n.includes('TX') || n.includes('RX')) return 'uart';
  if (n.includes('MOSI') || n.includes('MISO') || n.includes('SCK') || n.includes('CS')) return 'spi';
  if (/^A\d/.test(n) || n.startsWith('VP') || n.startsWith('VN') || n.includes('ADC')) return 'analog';
  return 'gpio';
}

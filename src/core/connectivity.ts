// Regras de conexão: compatibilidade de encaixes, encaixe magnético, netlist e validação elétrica/mecânica.
import type { Cable, CableKind, Endpoint, Issue, PinType, SocketDef, SocketKind, ZDocument } from './types';
import { getNode } from './document';

export const SOCKET_KIND_LABEL: Record<SocketKind, string> = {
  'fpc': 'FPC/FFC (ZIF)', 'mipi-dsi': 'MIPI-DSI (display)', 'mipi-csi': 'MIPI-CSI (câmera)', 'bms': 'BMS (bateria)',
  'btb-plug': 'Board-to-board (macho)', 'btb-recept': 'Board-to-board (fêmea)', 'header-male': 'Barra de pinos macho',
  'header-female': 'Barra de pinos fêmea', 'usb-c': 'USB-C', 'jst': 'JST', 'mount-top': 'Furo de fixação (topo)',
  'mount-bottom': 'Furo de fixação (base)', 'screw': 'Parafuso', 'standoff-top': 'Espaçador (topo)', 'standoff-bottom': 'Espaçador (base)', 'custom': 'Personalizado',
};

export const SOCKET_KIND_COLOR: Record<SocketKind, string> = {
  'fpc': '#ffb547', 'mipi-dsi': '#ff7ad9', 'mipi-csi': '#62d0ff', 'bms': '#ff5d5d', 'btb-plug': '#c18bff', 'btb-recept': '#c18bff',
  'header-male': '#7dff9b', 'header-female': '#7dff9b', 'usb-c': '#9fb3ff', 'jst': '#ffe17d', 'mount-top': '#cfd6e0', 'mount-bottom': '#cfd6e0',
  'screw': '#cfd6e0', 'standoff-top': '#cfd6e0', 'standoff-bottom': '#cfd6e0', 'custom': '#ffffff',
};

/** Encaixes que se ligam por CABO (roteamento) e o tipo de cabo padrão. */
const CABLE_RULES: { a: SocketKind[]; b: SocketKind[]; cable: CableKind; strictPins: boolean; strictPitch: boolean }[] = [
  { a: ['fpc'], b: ['fpc'], cable: 'fpc', strictPins: true, strictPitch: true },
  { a: ['mipi-dsi'], b: ['mipi-dsi'], cable: 'fpc', strictPins: true, strictPitch: true },
  { a: ['mipi-csi'], b: ['mipi-csi'], cable: 'fpc', strictPins: true, strictPitch: true },
  { a: ['bms'], b: ['bms'], cable: 'fpc', strictPins: true, strictPitch: false },
  { a: ['header-male', 'header-female'], b: ['header-male', 'header-female'], cable: 'ribbon', strictPins: true, strictPitch: true },
  { a: ['usb-c'], b: ['usb-c'], cable: 'usb', strictPins: false, strictPitch: false },
  { a: ['jst'], b: ['jst'], cable: 'wire', strictPins: true, strictPitch: false },
  { a: ['custom'], b: ['custom', 'fpc', 'mipi-dsi', 'mipi-csi', 'bms', 'header-male', 'header-female', 'jst', 'usb-c'], cable: 'fpc', strictPins: false, strictPitch: false },
];

/** Pares que se ENCAIXAM diretamente (snapping magnético, sem cabo). */
const MATE_RULES: [SocketKind, SocketKind][] = [
  ['btb-plug', 'btb-recept'],
  ['header-male', 'header-female'],
  ['mount-top', 'screw'],
  ['mount-bottom', 'standoff-top'],
  ['standoff-bottom', 'mount-top'],
  ['custom', 'custom'],
];

/** Conectores que aceitam fio individual pino a pino. */
export const WIREABLE: SocketKind[] = ['header-male', 'header-female', 'jst', 'bms', 'custom'];

export function cableRule(a: SocketKind, b: SocketKind) {
  return CABLE_RULES.find(r => (r.a.includes(a) && r.b.includes(b)) || (r.a.includes(b) && r.b.includes(a)));
}

export function canMate(a: SocketKind, b: SocketKind): boolean {
  return MATE_RULES.some(([x, y]) => (x === a && y === b) || (x === b && y === a));
}

export interface ConnectCheck { ok: boolean; cable?: CableKind; reason?: string; warning?: string }

export function checkBusConnection(sa: SocketDef, sb: SocketDef): ConnectCheck {
  const rule = cableRule(sa.kind, sb.kind);
  if (!rule) return { ok: false, reason: `${SOCKET_KIND_LABEL[sa.kind]} não conecta em ${SOCKET_KIND_LABEL[sb.kind]}` };
  if (rule.strictPins && sa.pins !== sb.pins) return { ok: false, reason: `Número de pinos diferente: ${sa.pins} × ${sb.pins}` };
  if (rule.strictPitch && Math.abs(sa.pitch - sb.pitch) > 0.01) return { ok: false, reason: `Passo diferente: ${sa.pitch} mm × ${sb.pitch} mm` };
  return { ok: true, cable: rule.cable };
}

export function checkWireConnection(sa: SocketDef, pa: number, sb: SocketDef, pb: number): ConnectCheck {
  if (!WIREABLE.includes(sa.kind) || !WIREABLE.includes(sb.kind)) return { ok: false, reason: 'Fio individual só liga em barras de pinos, JST ou pads' };
  const ta = pinType(sa, pa), tb = pinType(sb, pb);
  const r = electricalRule(ta, tb, sa, sb);
  if (r && r.severity === 'error') return { ok: false, reason: r.message };
  return { ok: true, cable: 'wire', warning: r?.message };
}

export function pinType(s: SocketDef, pin: number): PinType {
  return s.pinTypes?.[pin] ?? 'signal';
}
export function pinName(s: SocketDef, pin: number): string {
  return s.pinNames?.[pin] ?? `${pin + 1}`;
}

const POWER: PinType[] = ['3v3', '5v', 'vin', 'vbat'];
/** 'vcc' = entrada de alimentação que aceita a tensão do sistema (curto com GND, mas não conflita com outra fonte). */
const SUPPLY: PinType[] = [...POWER, 'vcc'];
const LOGIC: PinType[] = ['gpio', 'analog', 'i2c', 'spi', 'uart', 'signal'];
const POWER_LABEL: Record<string, string> = { '3v3': '3,3 V', '5v': '5 V', 'vin': 'VIN', 'vbat': 'VBAT', 'vcc': 'VCC' };

function electricalRule(ta: PinType, tb: PinType, sa: SocketDef, sb: SocketDef): { severity: 'error' | 'warning'; message: string } | null {
  if ((SUPPLY.includes(ta) && tb === 'gnd') || (SUPPLY.includes(tb) && ta === 'gnd')) return { severity: 'error', message: `Curto-circuito: ${POWER_LABEL[SUPPLY.includes(ta) ? ta : tb]} ligado ao GND` };
  if (POWER.includes(ta) && POWER.includes(tb) && ta !== tb) return { severity: 'error', message: `Duas fontes diferentes ligadas: ${POWER_LABEL[ta]} × ${POWER_LABEL[tb]}` };
  const hv = (t: PinType) => t === '5v' || t === 'vin';
  if (hv(ta) && LOGIC.includes(tb) && (sb.logicVoltage ?? 5) < 4) return { severity: 'warning', message: `${POWER_LABEL[ta]} em GPIO de ${sb.logicVoltage} V (não tolerante a 5 V) — use divisor ou level shifter` };
  if (hv(tb) && LOGIC.includes(ta) && (sa.logicVoltage ?? 5) < 4) return { severity: 'warning', message: `${POWER_LABEL[tb]} em GPIO de ${sa.logicVoltage} V (não tolerante a 5 V) — use divisor ou level shifter` };
  if (ta === 'nc' || tb === 'nc') return { severity: 'warning', message: 'Pino NC (não conectado internamente)' };
  return null;
}

/** Sugestão de geometria/especificação do cabo a partir dos encaixes. */
export function defaultCableSpec(kind: CableKind, sa: SocketDef, sb?: SocketDef) {
  const pins = Math.max(sa.pins, sb?.pins ?? 0);
  const pitch = sa.pitch || 0.5;
  if (kind === 'fpc') return { width: +(pins * pitch + 0.8).toFixed(2), thickness: 0.12, conductors: pins, pitch, layers: 1 };
  if (kind === 'ribbon') return { width: +(pins * 1.27).toFixed(2), thickness: 0.9, conductors: pins, pitch: 1.27, layers: 1 };
  if (kind === 'usb') return { width: 3.8, thickness: 3.8, conductors: 4, pitch: 0, layers: 1 };
  return { width: 1.4, thickness: 1.4, conductors: 1, pitch: 0, layers: 1 };
}

/** Cor convencional de fio pelo tipo do pino. */
export function wireColor(t: PinType): string {
  switch (t) {
    case 'gnd': return '#1c1c1e';
    case '5v': case 'vin': return '#e0242b';
    case '3v3': return '#ff8a1f';
    case 'vbat': return '#c2185b';
    case 'i2c': return '#2bb3ff';
    case 'uart': return '#2ed573';
    case 'spi': return '#a55eea';
    case 'analog': return '#ffd32a';
    default: return '#f1f2f6';
  }
}

/** Raio mínimo de dobra recomendado (IPC-2223, flex estático) em mm. */
export function minBendRadius(thickness: number, layers: number): number {
  const factor = layers <= 1 ? 6 : layers === 2 ? 10 : 15;
  return thickness * factor;
}

/* ---------------- Netlist ---------------- */

export type SocketResolver = (e: Endpoint) => SocketDef | undefined;

export interface NetPin { node: string; socket: string; pin: number; type: PinType; name: string; logicVoltage?: number }
export interface Net { id: number; pins: NetPin[] }

const key = (node: string, socket: string, pin: number) => `${node}|${socket}|${pin}`;

export function buildNets(doc: ZDocument, resolve: SocketResolver): Net[] {
  const parent = new Map<string, string>();
  const info = new Map<string, NetPin>();
  const find = (k: string): string => { let p = parent.get(k) ?? k; if (p !== k) { p = find(p); parent.set(k, p); } return p; };
  const union = (x: string, y: string) => { const a = find(x), b = find(y); if (a !== b) parent.set(a, b); };
  const reg = (e: Endpoint, s: SocketDef, pin: number) => {
    const k = key(e.node, e.socket, pin);
    if (!parent.has(k)) parent.set(k, k);
    if (!info.has(k)) info.set(k, { node: e.node, socket: e.socket, pin, type: pinType(s, pin), name: pinName(s, pin), logicVoltage: s.logicVoltage });
    return k;
  };
  for (const c of doc.cables) {
    const sa = resolve(c.a), sb = resolve(c.b);
    if (!sa || !sb) continue;
    if (c.kind === 'wire' || c.a.pin != null || c.b.pin != null) {
      union(reg(c.a, sa, c.a.pin ?? 0), reg(c.b, sb, c.b.pin ?? 0));
    } else {
      const n = Math.min(sa.pins, sb.pins);
      for (let i = 0; i < n; i++) union(reg(c.a, sa, i), reg(c.b, sb, i));
    }
  }
  const groups = new Map<string, NetPin[]>();
  for (const k of parent.keys()) { const r = find(k); if (!groups.has(r)) groups.set(r, []); groups.get(r)!.push(info.get(k)!); }
  return [...groups.values()].filter(g => g.length > 1).map((pins, i) => ({ id: i + 1, pins }));
}

/* ---------------- Validação ---------------- */

export interface CableGeom { length: number; minRadius: number; inPlaneRadius: number }

export function validate(doc: ZDocument, resolve: SocketResolver, geom: Map<string, CableGeom>): Issue[] {
  const issues: Issue[] = [];
  const busUse = new Map<string, string>();

  for (const c of doc.cables) {
    const na = getNode(doc, c.a.node), nb = getNode(doc, c.b.node);
    const sa = resolve(c.a), sb = resolve(c.b);
    if (!na || !nb || !sa || !sb) { issues.push({ severity: 'error', cable: c.id, message: `${c.name}: extremidade sem encaixe (peça removida ou parâmetro alterado)` }); continue; }
    const where = `${c.name} (${na.name} ↔ ${nb.name})`;
    if (c.kind === 'wire') {
      const r = checkWireConnection(sa, c.a.pin ?? 0, sb, c.b.pin ?? 0);
      if (!r.ok) issues.push({ severity: 'error', cable: c.id, message: `${where}: ${r.reason}` });
      else if (r.warning) issues.push({ severity: 'warning', cable: c.id, message: `${where}: ${r.warning}` });
    } else {
      const r = checkBusConnection(sa, sb);
      if (!r.ok) issues.push({ severity: 'error', cable: c.id, message: `${where}: ${r.reason}` });
      for (const [e, s] of [[c.a, sa], [c.b, sb]] as const) {
        const k = e.node + '|' + e.socket;
        if (busUse.has(k)) issues.push({ severity: 'error', cable: c.id, message: `${where}: encaixe "${s.label}" já ocupado por outro cabo` });
        busUse.set(k, c.id);
      }
      if (c.kind === 'fpc') {
        const need = Math.max(sa.pins, sb.pins) * Math.max(sa.pitch, 0.1);
        if (c.width + 0.01 < need) issues.push({ severity: 'warning', cable: c.id, message: `${where}: largura ${c.width} mm menor que o conector (${need.toFixed(2)} mm)` });
        if (c.conductors !== Math.max(sa.pins, sb.pins)) issues.push({ severity: 'warning', cable: c.id, message: `${where}: ${c.conductors} condutores para conector de ${Math.max(sa.pins, sb.pins)} pinos` });
      }
    }
    const g = geom.get(c.id);
    if (g && (c.kind === 'fpc' || c.kind === 'ribbon')) {
      const min = minBendRadius(c.thickness, c.layers);
      if (g.minRadius < min) issues.push({ severity: 'warning', cable: c.id, message: `${where}: raio de dobra ${g.minRadius.toFixed(2)} mm abaixo do recomendado (${min.toFixed(2)} mm, IPC-2223) — risco de trincar trilhas` });
      if (g.inPlaneRadius < c.width * 4) issues.push({ severity: 'warning', cable: c.id, message: `${where}: curva lateral no plano da fita (raio ${g.inPlaneRadius.toFixed(1)} mm) — flex não dobra de lado; use uma dobra a 45° ou um flex em L` });
    }
  }

  // Regras de rede (curtos e fontes conflitantes, inclusive através de vários cabos)
  for (const net of buildNets(doc, resolve)) {
    const types = new Set(net.pins.map(p => p.type));
    const powers = [...types].filter(t => POWER.includes(t));
    const supplies = [...types].filter(t => SUPPLY.includes(t));
    if (types.has('gnd') && supplies.length) issues.push({ severity: 'error', message: `Rede ${net.id}: curto-circuito entre ${supplies.map(p => POWER_LABEL[p]).join(', ')} e GND (${describeNet(doc, net)})` });
    else if (powers.length > 1) issues.push({ severity: 'error', message: `Rede ${net.id}: fontes diferentes interligadas (${powers.map(p => POWER_LABEL[p]).join(' × ')})` });
  }
  return issues;
}

export function describeNet(doc: ZDocument, net: Net): string {
  return net.pins.slice(0, 4).map(p => `${getNode(doc, p.node)?.name ?? '?'}:${p.name}`).join(', ') + (net.pins.length > 4 ? '…' : '');
}

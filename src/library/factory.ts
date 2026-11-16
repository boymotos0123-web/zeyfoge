// Cria nós e cabos a partir da biblioteca (aplica nome, custo, material e part number padrão).
import type { Cable, CableKind, DocNode, Endpoint, ZDocument } from '@/core/types';
import { createCable, createNode, getNode, type CableInit, type NodeInit } from '@/core/document';
import { checkBusConnection, checkWireConnection, defaultCableSpec, pinType, wireColor } from '@/core/connectivity';
import { byType, costOf, defaults, socketsOf } from './registry';

export function createPart(type: string, init: NodeInit = {}): DocNode {
  const d = byType[type];
  const params = { ...defaults(type), ...(init.params || {}) };
  return createNode(type, {
    ...init,
    name: init.name ?? d?.name ?? type,
    params,
    cost: init.cost ?? costOf(type, params),
    mat: init.mat !== undefined ? init.mat : d?.defaultMat ?? null,
    partNumber: init.partNumber ?? d?.partNumber ?? '',
  });
}

export function socketOf(doc: ZDocument, e: Endpoint) {
  const n = getNode(doc, e.node); if (!n) return undefined;
  return socketsOf(n.type, n.params, n.customSockets).find(s => s.id === e.socket);
}

export interface ConnectResult { cable?: Cable; error?: string; warning?: string }

/** Cria um cabo validado entre dois encaixes (barramento) ou dois pinos (fio). */
export function connect(doc: ZDocument, a: Endpoint, b: Endpoint, init: CableInit & { kind?: CableKind } = {}): ConnectResult {
  const sa = socketOf(doc, a), sb = socketOf(doc, b);
  if (!sa || !sb) return { error: 'Encaixe não encontrado' };
  const wire = a.pin != null || b.pin != null;
  if (wire) {
    const r = checkWireConnection(sa, a.pin ?? 0, sb, b.pin ?? 0);
    if (!r.ok) return { error: r.reason };
    const color = init.color ?? wireColor(pinType(sa, a.pin ?? 0) === 'signal' ? pinType(sb, b.pin ?? 0) : pinType(sa, a.pin ?? 0));
    const c = createCable('wire', a, b, { ...defaultCableSpec('wire', sa), ...init, color, name: init.name ?? `Fio ${sa.pinNames?.[a.pin ?? 0] ?? ''} → ${sb.pinNames?.[b.pin ?? 0] ?? ''}`.trim() });
    doc.cables.push(c);
    return { cable: c, warning: r.warning };
  }
  const r = checkBusConnection(sa, sb);
  if (!r.ok) return { error: r.reason };
  const kind = init.kind ?? r.cable!;
  const c = createCable(kind, a, b, { ...defaultCableSpec(kind, sa, sb), ...init });
  doc.cables.push(c);
  return { cable: c };
}

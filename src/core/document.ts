// Operações puras sobre o documento (sem three.js / DOM).
import type { Cable, CableKind, DocNode, Endpoint, Id, NodeKind, Pricing, Vec3, ZDocument } from './types';

let seq = 0;
export const uid = (): Id => Date.now().toString(36) + (seq++).toString(36) + Math.random().toString(36).slice(2, 6);

export const FORMAT_VERSION = 2;

export const DEFAULT_PRICING: Pricing = { assembly: 15, packaging: 8, shipping: 0, tax: 6, margin: 35 };

export function newDocument(name = 'Projeto sem nome'): ZDocument {
  const now = new Date().toISOString();
  return { app: 'ZeyForge', format: FORMAT_VERSION, name, units: 'mm', created: now, modified: now, nodes: [], cables: [], pricing: { ...DEFAULT_PRICING }, assets: {} };
}

export interface NodeInit {
  name?: string;
  kind?: NodeKind;
  params?: Record<string, unknown>;
  pos?: Vec3;
  rot?: Vec3;
  scl?: Vec3;
  mat?: string | null;
  color?: string | null;
  opacity?: number;
  parent?: Id | null;
  cost?: number;
  asset?: Id | null;
  massOverride?: number | null;
  partNumber?: string;
}

export function createNode(type: string, init: NodeInit = {}): DocNode {
  return {
    id: uid(),
    name: init.name ?? type,
    kind: init.kind ?? (type === 'assembly' ? 'assembly' : 'part'),
    type,
    params: { ...(init.params || {}) },
    pos: init.pos ? [...init.pos] as Vec3 : [0, 0, 0],
    rot: init.rot ? [...init.rot] as Vec3 : [0, 0, 0],
    scl: init.scl ? [...init.scl] as Vec3 : [1, 1, 1],
    mat: { preset: init.mat ?? null, color: init.color ?? null, opacity: init.opacity ?? 1 },
    visible: true,
    locked: false,
    parent: init.parent ?? null,
    expanded: false,
    cost: init.cost ?? 0,
    qty: 1,
    massOverride: init.massOverride ?? null,
    supplier: '',
    partNumber: init.partNumber ?? '',
    notes: '',
    asset: init.asset ?? null,
    customSockets: [],
  };
}

export interface CableInit {
  name?: string;
  width?: number;
  thickness?: number;
  conductors?: number;
  pitch?: number;
  layers?: number;
  color?: string | null;
  waypoints?: Vec3[];
  lead?: number;
  slack?: number;
}

export function createCable(kind: CableKind, a: Endpoint, b: Endpoint, init: CableInit = {}): Cable {
  const isWire = kind === 'wire';
  return {
    id: uid(),
    name: init.name ?? (isWire ? 'Fio' : kind === 'ribbon' ? 'Fita IDC' : kind === 'usb' ? 'Cabo USB' : 'Flat flex (FPC)'),
    kind, a: { ...a }, b: { ...b },
    width: init.width ?? (isWire ? 1.4 : 6),
    thickness: init.thickness ?? (isWire ? 1.4 : kind === 'ribbon' ? 0.9 : 0.12),
    conductors: init.conductors ?? 1,
    pitch: init.pitch ?? 0.5,
    layers: init.layers ?? 1,
    color: init.color ?? null,
    waypoints: init.waypoints ? init.waypoints.map(w => [...w] as Vec3) : [],
    lead: init.lead ?? (isWire ? 6 : 3),
    slack: init.slack ?? (isWire ? 0.25 : 0.08),
    stiffener: kind === 'fpc',
    visible: true,
    cost: null,
    notes: '',
  };
}

/* ---------------- Consultas de árvore ---------------- */

export const getNode = (doc: ZDocument, id: Id | null | undefined): DocNode | undefined => (id ? doc.nodes.find(n => n.id === id) : undefined);
export const childrenOf = (doc: ZDocument, id: Id | null): DocNode[] => doc.nodes.filter(n => n.parent === id);
export const roots = (doc: ZDocument): DocNode[] => doc.nodes.filter(n => !n.parent);

export function descendants(doc: ZDocument, id: Id): DocNode[] {
  const out: DocNode[] = [];
  const walk = (pid: Id) => childrenOf(doc, pid).forEach(c => { out.push(c); walk(c.id); });
  walk(id);
  return out;
}

export function ancestors(doc: ZDocument, id: Id): DocNode[] {
  const out: DocNode[] = [];
  let n = getNode(doc, id);
  while (n && n.parent) { const p = getNode(doc, n.parent); if (!p) break; out.push(p); n = p; }
  return out;
}

export function depth(doc: ZDocument, n: DocNode): number { return ancestors(doc, n.id).length; }

export function isEffectivelyVisible(doc: ZDocument, n: DocNode): boolean {
  if (!n.visible) return false;
  return ancestors(doc, n.id).every(a => a.visible);
}

/** Remove os ids que são descendentes de outros ids da lista. */
export function topLevel(doc: ZDocument, ids: Id[]): Id[] {
  const set = new Set(ids);
  return ids.filter(id => !ancestors(doc, id).some(a => set.has(a.id)));
}

/** Ordena nós de forma que pais venham antes de filhos. */
export function sortedByDepth(doc: ZDocument): DocNode[] {
  return [...doc.nodes].sort((a, b) => depth(doc, a) - depth(doc, b));
}

/* ---------------- Mutações ---------------- */

export function removeNodes(doc: ZDocument, ids: Id[]): void {
  const kill = new Set<Id>();
  ids.forEach(id => { kill.add(id); descendants(doc, id).forEach(d => kill.add(d.id)); });
  doc.nodes = doc.nodes.filter(n => !kill.has(n.id));
  doc.cables = doc.cables.filter(c => !kill.has(c.a.node) && !kill.has(c.b.node));
}

/** Clona nós (e descendentes). Retorna ids das novas raízes. Cabos internos ao conjunto também são clonados. */
export function cloneNodes(doc: ZDocument, ids: Id[], offset: Vec3 = [0, 0, 0]): Id[] {
  const tops = topLevel(doc, ids);
  const all: DocNode[] = [];
  tops.forEach(id => { const n = getNode(doc, id); if (n) { all.push(n); all.push(...descendants(doc, id)); } });
  const map = new Map<Id, Id>();
  all.forEach(n => map.set(n.id, uid()));
  const newRoots: Id[] = [];
  all.forEach(n => {
    const c: DocNode = structuredClone(n);
    c.id = map.get(n.id)!;
    if (n.parent && map.has(n.parent)) c.parent = map.get(n.parent)!;
    else { c.pos = c.pos.map((v, i) => v + offset[i]) as Vec3; newRoots.push(c.id); }
    doc.nodes.push(c);
  });
  doc.cables.filter(cb => map.has(cb.a.node) && map.has(cb.b.node)).forEach(cb => {
    const c: Cable = structuredClone(cb);
    c.id = uid(); c.a.node = map.get(cb.a.node)!; c.b.node = map.get(cb.b.node)!;
    c.waypoints = c.waypoints.map(w => w.map((v, i) => v + offset[i]) as Vec3);
    doc.cables.push(c);
  });
  return newRoots;
}

export function cablesOfNode(doc: ZDocument, id: Id): Cable[] {
  const ids = new Set([id, ...descendants(doc, id).map(d => d.id)]);
  return doc.cables.filter(c => ids.has(c.a.node) || ids.has(c.b.node));
}

export function touch(doc: ZDocument): void { doc.modified = new Date().toISOString(); }

// Formato de arquivo .zeyforge (contêiner ZIP):
//   project.json        documento (sem bytes de assets)
//   assets/<id>.glb     modelos importados
//   assets/<id>.zfm     malhas binárias (booleanas / STL)
//   thumbnail.png       miniatura (opcional)
// Também abre projetos .zeyforge.json da v0.1 (migração automática).
import { zipSync, unzipSync, strToU8, strFromU8 } from 'fflate';
import type { Asset, DocNode, ZDocument } from './types';
import { DEFAULT_PRICING, FORMAT_VERSION, newDocument, uid } from './document';

export const FILE_EXT = 'zeyforge';
export const MIME = 'application/x-zeyforge';

export function encodeProject(doc: ZDocument, thumbnail?: Uint8Array): Uint8Array {
  const assetsMeta: Record<string, Omit<Asset, 'data'> & { file: string }> = {};
  const files: Record<string, Uint8Array> = {};
  for (const a of Object.values(doc.assets)) {
    const file = `assets/${a.id}.${a.type === 'glb' ? 'glb' : 'zfm'}`;
    files[file] = a.data;
    assetsMeta[a.id] = { id: a.id, name: a.name, type: a.type, unitScale: a.unitScale, file };
  }
  const { assets, ...rest } = doc;
  files['project.json'] = strToU8(JSON.stringify({ ...rest, format: FORMAT_VERSION, assets: assetsMeta }, null, 1));
  if (thumbnail) files['thumbnail.png'] = thumbnail;
  return zipSync(files, { level: 6 });
}

export function decodeProject(bytes: Uint8Array): ZDocument {
  const isZip = bytes[0] === 0x50 && bytes[1] === 0x4b;
  if (!isZip) return migrateJSON(JSON.parse(strFromU8(bytes)));
  const files = unzipSync(bytes);
  if (!files['project.json']) throw new Error('Arquivo .zeyforge sem project.json');
  const data = JSON.parse(strFromU8(files['project.json']));
  const assets: Record<string, Asset> = {};
  for (const [id, meta] of Object.entries<Record<string, unknown>>(data.assets || {})) {
    const f = files[meta.file as string];
    if (f) assets[id] = { id, name: String(meta.name), type: meta.type as Asset['type'], unitScale: Number(meta.unitScale) || 1, data: f };
  }
  return normalize({ ...data, assets });
}

/** Garante campos novos em documentos antigos/incompletos. */
export function normalize(d: Partial<ZDocument> & Record<string, unknown>): ZDocument {
  const doc = Object.assign(newDocument(String(d.name || 'Projeto')), d) as ZDocument;
  doc.format = FORMAT_VERSION;
  doc.pricing = { ...DEFAULT_PRICING, ...(d.pricing || {}) };
  doc.cables = (d.cables as ZDocument['cables']) || [];
  doc.assets = (d.assets as ZDocument['assets']) || {};
  const base = { massOverride: null, partNumber: '', supplier: '', notes: '', customSockets: [], asset: null, expanded: false, qty: 1, cost: 0 };
  doc.nodes = (d.nodes || []).map(n => {
    const node = Object.assign({}, base, n) as DocNode;
    node.mat = Object.assign({ preset: null, color: null, opacity: 1 }, (n as DocNode).mat);
    return node;
  });
  return doc;
}

/* ---------------- Malha binária (.zfm) ---------------- */

const MAGIC = 0x314d465a; // 'ZFM1'

export function encodeMesh(pos: Float32Array, nor: Float32Array | null, idx: Uint32Array | null): Uint8Array {
  const header = new Uint32Array([MAGIC, pos.length / 3, idx ? idx.length : 0, nor ? 1 : 0]);
  const parts = [header, pos, ...(nor ? [nor] : []), ...(idx ? [idx] : [])];
  const total = parts.reduce((s, p) => s + p.byteLength, 0);
  const out = new Uint8Array(total);
  let o = 0;
  for (const p of parts) { out.set(new Uint8Array(p.buffer, p.byteOffset, p.byteLength), o); o += p.byteLength; }
  return out;
}

export function decodeMesh(bytes: Uint8Array): { pos: Float32Array; nor: Float32Array | null; idx: Uint32Array | null } {
  const buf = bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength);
  const h = new Uint32Array(buf, 0, 4);
  if (h[0] !== MAGIC) throw new Error('Malha inválida');
  const vc = h[1], ic = h[2], hasN = h[3] === 1;
  let o = 16;
  const pos = new Float32Array(buf, o, vc * 3); o += vc * 12;
  const nor = hasN ? new Float32Array(buf, o, vc * 3) : null; if (hasN) o += vc * 12;
  const idx = ic ? new Uint32Array(buf, o, ic) : null;
  return { pos, nor, idx };
}

/* ---------------- Migração v0.1 (.zeyforge.json) ---------------- */

const fromB64 = (b64: string): Uint8Array => { const s = atob(b64); const u = new Uint8Array(s.length); for (let i = 0; i < s.length; i++) u[i] = s.charCodeAt(i); return u; };

function migrateJSON(data: Record<string, any>): ZDocument {
  if (data.format === FORMAT_VERSION) return normalize(data);
  const doc = newDocument(data.name || 'Projeto importado (v0.1)');
  const RENAME: Record<string, string> = { group: 'assembly', esp32_devkit: 'esp32_devkit', arduino_uno: 'arduino_uno', rpi4: 'rpi4', rpi_pico: 'rpi_pico' };
  for (const n of data.nodes || []) {
    let asset: string | null = null;
    if (n.type === 'mesh' && n.blob && data.blobs?.[n.blob]) {
      const b = data.blobs[n.blob];
      const pos = new Float32Array(fromB64(b.pos).buffer);
      const nor = b.nor ? new Float32Array(fromB64(b.nor).buffer) : null;
      const idx = b.idx ? new Uint32Array(fromB64(b.idx).buffer) : null;
      asset = uid();
      doc.assets[asset] = { id: asset, name: n.name, type: 'mesh', unitScale: 1, data: encodeMesh(pos, nor, idx) };
    }
    const type = RENAME[n.type] ?? n.type;
    doc.nodes.push({
      id: n.id, name: n.name, kind: type === 'assembly' ? 'assembly' : n.type === 'mesh' ? 'mesh' : 'part', type,
      params: n.params || {}, pos: n.pos || [0, 0, 0], rot: n.rot || [0, 0, 0], scl: n.scl || [1, 1, 1],
      mat: { preset: n.mat?.preset ?? null, color: n.mat?.color ?? null, opacity: n.mat?.opacity ?? 1 },
      visible: n.visible !== false, locked: !!n.locked, parent: n.parent ?? null, expanded: false,
      cost: +n.cost || 0, qty: n.qty || 1, massOverride: null, supplier: n.supplier || '', partNumber: '', notes: n.notes || '', asset, customSockets: [],
    });
  }
  if (data.pricing) doc.pricing = { ...DEFAULT_PRICING, ...data.pricing };
  return doc;
}

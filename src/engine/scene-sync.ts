// Sincroniza o documento com a cena three.js: peças (holders), cabos roteados, materiais, vista explodida e massa.
import * as THREE from 'three';
import type { Cable, DocNode, Endpoint, Id, SocketDef, ZDocument } from '@/core/types';
import { getNode, isEffectivelyVisible, sortedByDepth } from '@/core/document';
import { decodeMesh } from '@/core/fileformat';
import { buildComponent, fixedMass, socketsOf } from '@/library/registry';
import { buildMaterial, cloneMaterial, clipPlanes, mat } from './materials';
import { massProperties, type MassProps } from '@/geometry/mass';
import { buildRoute, type Route, type SocketFrame } from '@/connect/route';
import { buildCableObject } from '@/geometry/cable';
import { mergeByMaterial } from '@/geometry/optimize';
import type { Viewport } from './Viewport';

const DEG = Math.PI / 180;
export type ExplodeMode = 'radial' | 'y' | 'x' | 'z';

export class SceneSync {
  readonly holders = new Map<Id, THREE.Group>();
  readonly cableObjs = new Map<Id, THREE.Group>();
  readonly routes = new Map<Id, Route>();
  private massCache = new Map<Id, { key: string; props: MassProps }>();
  private glbCache = new Map<Id, Promise<THREE.Group>>();
  explode = { f: 0, mode: 'radial' as ExplodeMode, cache: null as Map<Id, THREE.Vector3> | null };
  display = { xray: false, wire: false };
  onAsyncLoaded: () => void = () => {};

  constructor(private vp: Viewport, private doc: () => ZDocument) {}

  /* ---------------- construção ---------------- */

  rebuildAll(): void {
    this.vp.attachGizmo(null);
    this.holders.forEach(h => dispose(h));
    this.vp.model.clear();
    this.holders.clear();
    const d = this.doc();
    for (const n of sortedByDepth(d)) {
      const h = this.buildHolder(n);
      this.holders.set(n.id, h);
      (n.parent ? this.holders.get(n.parent) : null)?.add(h) ?? this.vp.model.add(h);
    }
    this.explode.cache = null;
    if (this.explode.f > 0) this.applyExplode();
    this.vp.model.updateMatrixWorld(true);
    this.updateCables();
    this.vp.updateSceneBounds();
    this.vp.contact.dirty = true;
  }

  rebuildNode(id: Id): void {
    const n = getNode(this.doc(), id), h = this.holders.get(id);
    if (!n || !h) return;
    const old = h.userData.content as THREE.Object3D | undefined;
    if (old) { h.remove(old); dispose(old); }
    const c = this.buildContent(n);
    if (c) { h.add(c); h.userData.content = c; }
    h.name = n.name;
    this.applyTransform(n, h); this.applyMaterials(n, h);
    this.massCache.delete(id);
    this.explode.cache = null; if (this.explode.f > 0) this.applyExplode();
    this.vp.model.updateMatrixWorld(true);
    this.updateCables([id]);
    this.vp.contact.dirty = true;
  }

  private buildHolder(n: DocNode): THREE.Group {
    const h = new THREE.Group();
    h.name = n.name; h.userData.nodeId = n.id;
    const c = this.buildContent(n);
    if (c) { h.add(c); h.userData.content = c; }
    this.applyTransform(n, h); this.applyMaterials(n, h);
    return h;
  }

  private buildContent(n: DocNode): THREE.Object3D | null {
    if (n.kind === 'assembly') return null;
    const d = this.doc();
    if (n.kind === 'mesh' && n.asset && d.assets[n.asset]) {
      const a = decodeMesh(d.assets[n.asset].data);
      const g = new THREE.BufferGeometry();
      g.setAttribute('position', new THREE.BufferAttribute(a.pos, 3));
      if (a.nor) g.setAttribute('normal', new THREE.BufferAttribute(a.nor, 3)); else g.computeVertexNormals();
      if (a.idx) g.setIndex(new THREE.BufferAttribute(a.idx, 1));
      const m = new THREE.Mesh(g, mat(n.mat.preset || 'aluminio'));
      m.castShadow = m.receiveShadow = true;
      return m;
    }
    if (n.kind === 'import' && n.asset && d.assets[n.asset]) {
      const holder = new THREE.Group();
      const asset = d.assets[n.asset];
      const off = (n.params.offset as number[]) || [0, 0, 0];
      this.loadGLB(asset.id, asset.data).then(src => {
        const clone = src.clone(true);
        clone.scale.setScalar(asset.unitScale);
        clone.position.set(off[0], off[1], off[2]);
        clone.traverse(o => {
          const mm = o as THREE.Mesh;
          if (!mm.isMesh) return;
          mm.castShadow = mm.receiveShadow = true;
          const ms = Array.isArray(mm.material) ? mm.material : [mm.material];
          const cl = ms.map(x => { const c = cloneMaterial(x); c.userData.matKey = c.userData.matKey || 'abs_preto'; return c; });
          mm.material = Array.isArray(mm.material) ? cl : cl[0];
        });
        holder.add(clone);
        const node = getNode(this.doc(), n.id), h = this.holders.get(n.id);
        if (node && h) this.applyMaterials(node, h);
        this.massCache.delete(n.id);
        this.vp.model.updateMatrixWorld(true);
        this.updateCables([n.id]);
        this.vp.updateSceneBounds();
        this.vp.contact.dirty = true;
        this.onAsyncLoaded();
      }).catch(err => console.error('GLB', err));
      return holder;
    }
    try { return mergeByMaterial(buildComponent(n.type, n.params)); }
    catch (e) { console.error(e); return new THREE.Group(); }
  }

  private loadGLB(id: Id, data: Uint8Array): Promise<THREE.Group> {
    let p = this.glbCache.get(id);
    if (!p) {
      p = import('three/addons/loaders/GLTFLoader.js').then(async ({ GLTFLoader }) => {
        const buf = data.buffer.slice(data.byteOffset, data.byteOffset + data.byteLength) as ArrayBuffer;
        const gltf = await new GLTFLoader().parseAsync(buf, '');
        return gltf.scene as unknown as THREE.Group;
      });
      this.glbCache.set(id, p);
    }
    return p;
  }

  /* ---------------- transformações e materiais ---------------- */

  applyTransform(n: DocNode, h = this.holders.get(n.id)): void {
    if (!h) return;
    h.position.set(n.pos[0], n.pos[1], n.pos[2]);
    const off = this.explode.f > 0 ? this.explode.cache?.get(n.id) : undefined;
    if (off) h.position.addScaledVector(off, this.explode.f * 1.6);
    h.rotation.set(n.rot[0] * DEG, n.rot[1] * DEG, n.rot[2] * DEG);
    h.scale.set(n.scl[0], n.scl[1], n.scl[2]);
    h.visible = n.visible;
  }

  applyAllTransforms(): void { this.doc().nodes.forEach(n => this.applyTransform(n)); this.vp.model.updateMatrixWorld(true); }

  applyMaterials(n: DocNode, h = this.holders.get(n.id)): void {
    const content = h?.userData.content as THREE.Object3D | undefined;
    if (!content) return;
    const { xray, wire } = this.display;
    content.traverse(o => {
      const m = o as THREE.Mesh;
      if (!m.isMesh) return;
      if (!m.userData.baseMat) m.userData.baseMat = m.material;
      let mats = (Array.isArray(m.userData.baseMat) ? m.userData.baseMat : [m.userData.baseMat]) as THREE.Material[];
      if (n.mat.preset) { const pm = buildMaterial(n.mat.preset, n.mat.color); mats = mats.map(x => (x.userData.decal ? x : pm)); }
      else if (n.mat.color) mats = mats.map(x => { if (x.userData.decal) return x; const c = cloneMaterial(x) as THREE.MeshStandardMaterial; c.color?.set(n.mat.color!); return c; });
      const op = n.mat.opacity ?? 1;
      if (op < 1 || xray || wire) mats = mats.map(x => {
        const c = cloneMaterial(x) as THREE.MeshPhysicalMaterial;
        if (op < 1 || xray) { c.transparent = true; c.opacity = xray ? Math.min(op, 0.18) : op; c.depthWrite = false; if ('transmission' in c) c.transmission = 0; }
        if (wire) c.wireframe = true;
        return c;
      });
      mats.forEach(x => { x.clippingPlanes = clipPlanes; if (clipPlanes.length) x.side = THREE.DoubleSide; });
      m.material = Array.isArray(m.userData.baseMat) ? mats : mats[0];
    });
  }

  refreshMaterials(): void { this.doc().nodes.forEach(n => this.applyMaterials(n)); }

  /* ---------------- vista explodida ---------------- */

  setExplode(f: number, mode?: ExplodeMode): void {
    if (mode && mode !== this.explode.mode) { this.explode.mode = mode; this.explode.cache = null; }
    this.explode.f = f;
    this.applyExplode();
  }

  applyExplode(): void {
    const d = this.doc();
    if (this.explode.f > 0 && !this.explode.cache) {
      const f = this.explode.f; this.explode.f = 0;
      d.nodes.forEach(n => this.applyTransform(n));
      this.vp.model.updateMatrixWorld(true);
      const groups = new Map<Id | null, Id[]>();
      d.nodes.forEach(n => { if (!n.visible) return; const k = n.parent; if (!groups.has(k)) groups.set(k, []); groups.get(k)!.push(n.id); });
      const cache = new Map<Id, THREE.Vector3>();
      const tmp = new THREE.Box3(), inv = new THREE.Matrix4();
      groups.forEach((ids, pid) => {
        if (ids.length < 2) return;
        const parent = pid ? this.holders.get(pid) : null;
        if (parent) inv.copy(parent.matrixWorld).invert(); else inv.identity();
        const centers = ids.map(id => { const o = this.holders.get(id); if (!o) return null; tmp.setFromObject(o); return tmp.isEmpty() ? null : tmp.getCenter(new THREE.Vector3()).applyMatrix4(inv); });
        const valid = centers.filter(Boolean) as THREE.Vector3[];
        if (!valid.length) return;
        const mid = valid.reduce((a, v) => a.add(v), new THREE.Vector3()).divideScalar(valid.length);
        const span = Math.max(20, new THREE.Box3().setFromPoints(valid).getSize(new THREE.Vector3()).length());
        if (this.explode.mode === 'radial') ids.forEach((id, i) => { if (centers[i]) cache.set(id, centers[i]!.clone().sub(mid)); });
        else {
          const ax = this.explode.mode;
          const order = ids.map((id, i) => ({ id, v: centers[i] ? centers[i]![ax] : 0 })).sort((a, b) => a.v - b.v);
          order.forEach((o, rank) => { const v = new THREE.Vector3(); v[ax] = (rank - (order.length - 1) / 2) * span * 0.16; cache.set(o.id, v); });
        }
      });
      this.explode.cache = cache;
      this.explode.f = f;
    }
    this.applyAllTransforms();
    this.updateCables();
    this.vp.contact.dirty = true;
  }

  /* ---------------- encaixes ---------------- */

  socketDefs(n: DocNode): SocketDef[] { return n.kind === 'part' || n.kind === 'import' || n.kind === 'mesh' ? socketsOf(n.type, n.params, n.customSockets) : n.customSockets; }

  socketDef(e: Endpoint): SocketDef | undefined {
    const n = getNode(this.doc(), e.node);
    return n ? this.socketDefs(n).find(s => s.id === e.socket) : undefined;
  }

  /** Referencial do encaixe (ou de um pino) em coordenadas do mundo. */
  socketFrame(e: Endpoint, def = this.socketDef(e)): SocketFrame | null {
    const h = this.holders.get(e.node);
    if (!h || !def) return null;
    h.updateWorldMatrix(true, false);
    const local = new THREE.Vector3(...def.pos);
    if (e.pin != null) {
      if (def.pinOffsets?.[e.pin]) local.add(new THREE.Vector3(...def.pinOffsets[e.pin]));
      else if (def.pins > 1) local.addScaledVector(new THREE.Vector3(...def.axis), (e.pin - (def.pins - 1) / 2) * def.pitch);
    }
    const m = h.matrixWorld;
    const nm = new THREE.Matrix3().getNormalMatrix(m);
    return {
      pos: local.applyMatrix4(m),
      normal: new THREE.Vector3(...def.normal).applyMatrix3(nm).normalize(),
      axis: new THREE.Vector3(...def.axis).applyMatrix3(nm).normalize(),
    };
  }

  /* ---------------- cabos ---------------- */

  updateCables(nodeIds?: Id[]): void {
    const d = this.doc();
    const affected = nodeIds ? new Set(nodeIds.flatMap(id => [id, ...this.descendantIds(id)])) : null;
    const keep = new Set(d.cables.map(c => c.id));
    for (const [id, o] of this.cableObjs) if (!keep.has(id)) { this.vp.cables.remove(o); dispose(o); this.cableObjs.delete(id); this.routes.delete(id); }
    for (const c of d.cables) {
      if (affected && !affected.has(c.a.node) && !affected.has(c.b.node) && this.cableObjs.has(c.id)) continue;
      this.buildCable(c);
    }
  }

  buildCable(c: Cable): void {
    const old = this.cableObjs.get(c.id);
    if (old) { this.vp.cables.remove(old); dispose(old); this.cableObjs.delete(c.id); }
    const d = this.doc();
    const na = getNode(d, c.a.node), nb = getNode(d, c.b.node);
    const sa = this.socketDef(c.a), sb = this.socketDef(c.b);
    if (!na || !nb || !sa || !sb) { this.routes.delete(c.id); return; }
    const A = this.socketFrame(c.a, sa), B = this.socketFrame(c.b, sb);
    if (!A || !B) return;
    const off = (s: SocketDef) => {
      const t = s.termination ?? (c.kind === 'wire' ? 'pin' : 'zif');
      if (c.kind === 'wire') return t === 'pin' ? 14 : 0.6;
      if (c.kind === 'usb') return 14.5;
      if (c.kind === 'ribbon') return 0;
      return t === 'btb' ? -1.5 : t === 'zif' ? -2 : 0;
    };
    const route = buildRoute(c, A, B, { startOffset: off(sa), endOffset: off(sb), step: c.kind === 'fpc' ? 0.5 : 0.8 });
    this.routes.set(c.id, route);
    const obj = buildCableObject(c, route, { socket: sa }, { socket: sb });
    obj.visible = c.visible && isEffectivelyVisible(d, na) && isEffectivelyVisible(d, nb);
    if (this.display.xray || this.display.wire) obj.traverse(o => { const m = o as THREE.Mesh; if (m.isMesh) { const cm = cloneMaterial(m.material as THREE.Material) as THREE.MeshStandardMaterial; if (this.display.xray) { cm.transparent = true; cm.opacity = 0.5; } if (this.display.wire) cm.wireframe = true; m.material = cm; } });
    this.cableObjs.set(c.id, obj);
    this.vp.cables.add(obj);
  }

  private descendantIds(id: Id): Id[] {
    const d = this.doc(); const out: Id[] = [];
    const walk = (pid: Id) => d.nodes.forEach(n => { if (n.parent === pid) { out.push(n.id); walk(n.id); } });
    walk(id); return out;
  }

  cableLength(c: Cable): number { return this.routes.get(c.id)?.length ?? 0; }

  /* ---------------- massa ---------------- */

  massProps(n: DocNode): MassProps | null {
    const h = this.holders.get(n.id);
    const content = h?.userData.content as THREE.Object3D | undefined;
    if (!content) return null;
    const key = JSON.stringify([n.type, n.params, n.mat.preset, n.asset, n.scl, content.children.length]);
    const hit = this.massCache.get(n.id);
    if (hit && hit.key === key) return hit.props;
    const props = massProperties(content, n.mat.preset ? this.densityOf(n.mat.preset) : null);
    const s = Math.abs(n.scl[0] * n.scl[1] * n.scl[2]);
    if (s !== 1) { props.mass *= s; props.volume *= s; }
    this.massCache.set(n.id, { key, props });
    return props;
  }

  private densityOf(key: string): number { return densityLookup(key); }

  /** Massa unitária em gramas: manual > biblioteca (quando sem troca de material) > volume × densidade. */
  massOf(n: DocNode): number {
    if (n.massOverride != null) return n.massOverride;
    if (n.kind === 'assembly') return 0;
    if (!n.mat.preset) { const f = fixedMass(n.type, n.params); if (f != null) return f; }
    return this.massProps(n)?.mass ?? 0;
  }

  /** Centro de massa do conjunto (mundo). */
  centerOfMass(ids: Id[]): { mass: number; center: THREE.Vector3 } {
    const d = this.doc(); let total = 0; const c = new THREE.Vector3();
    for (const id of ids) {
      const n = getNode(d, id); if (!n || n.kind === 'assembly' || !isEffectivelyVisible(d, n)) continue;
      const h = this.holders.get(id); if (!h) continue;
      const m = this.massOf(n) * Math.max(1, n.qty);
      const props = this.massProps(n);
      const local = props && props.mass > 0 ? props.centroid.clone() : new THREE.Box3().setFromObject(h.userData.content || h).getCenter(new THREE.Vector3()).applyMatrix4(new THREE.Matrix4().copy(h.matrixWorld).invert());
      c.addScaledVector(local.applyMatrix4(h.matrixWorld), m); total += m;
    }
    if (total > 0) c.divideScalar(total);
    return { mass: total, center: c };
  }
}

import { materialOf } from '@/core/materials-db';
function densityLookup(key: string): number { return materialOf(key).density; }

function dispose(o: THREE.Object3D): void {
  o.traverse(x => { const m = x as THREE.Mesh; if (m.isMesh && m.geometry && !m.geometry.userData.shared) m.geometry.dispose(); });
}

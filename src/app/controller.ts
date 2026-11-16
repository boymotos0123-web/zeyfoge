// Controlador da aplicação: estado reativo (signals), comandos de edição, ferramentas e arquivos.
import * as THREE from 'three';
import { signal, computed, batch } from '@preact/signals';
import type { Cable, DocNode, Endpoint, Id, Issue, SocketDef, Vec3, ZDocument } from '@/core/types';
import { cloneNodes, createNode, descendants, getNode, newDocument, removeNodes, roots, topLevel, touch, uid, childrenOf, isEffectivelyVisible } from '@/core/document';
import { History } from '@/core/history';
import { validate, WIREABLE, cableRule, type CableGeom } from '@/core/connectivity';
import { buildBom, bomToCSV, type BomResult } from '@/core/bom';
import { decodeProject, encodeProject, encodeMesh } from '@/core/fileformat';
import { IMPORT_UNITS } from '@/core/units';
import { Viewport, type ViewName, type BackgroundMode, type PickHit } from '@/engine/Viewport';
import { SceneSync, type ExplodeMode } from '@/engine/scene-sync';
import { ViewCube } from '@/engine/viewcube';
import { SocketMarkers, type MarkerEntry } from '@/engine/sockets-view';
import { invalidateMaterials } from '@/engine/materials';
import { defaultQuality, setQuality, quality, PROFILES, type QualityLevel } from '@/engine/quality';
import type { EnvPreset } from '@/engine/environment';
import { findSnap } from '@/connect/snapping';
import { byType } from '@/library/registry';
import { createPart, connect } from '@/library/factory';
import { TEMPLATES, type Template } from '@/library/templates';
import { platform, initPlatform } from '@/platform';
import { analyzeModel, toGLB, type ImportAnalysis } from '@/io/import';
import { idbGet, idbSet, lsGet, lsSet } from './storage';

export type Tool = 'select' | 'translate' | 'rotate' | 'scale' | 'measure' | 'cable' | 'socket';
export type Toast = { id: number; msg: string; kind: '' | 'ok' | 'err' | 'warn' };
const DEG = Math.PI / 180;

class Controller {
  doc: ZDocument = newDocument();
  readonly history = new History();
  vp!: Viewport;
  sync!: SceneSync;
  markers = new SocketMarkers();

  // ---- estado reativo
  readonly version = signal(0);
  readonly selection = signal<Id[]>([]);
  readonly cableSel = signal<Id | null>(null);
  readonly tool = signal<Tool>('translate');
  readonly cableMode = signal<'bus' | 'wire'>('bus');
  readonly cableStart = signal<MarkerEntry | null>(null);
  readonly hoverInfo = signal<string>('');
  readonly snap = signal(true);
  readonly magnetic = signal(true);
  readonly xray = signal(false);
  readonly wire = signal(false);
  readonly grid = signal(true);
  readonly ortho = signal(false);
  readonly explode = signal<{ f: number; mode: ExplodeMode }>({ f: 0, mode: 'radial' });
  readonly clip = signal<{ axis: '' | 'x' | 'y' | 'z'; t: number; flip: boolean }>({ axis: '', t: 0.5, flip: false });
  readonly qualityLevel = signal<QualityLevel>(defaultQuality());
  readonly env = signal<{ preset: EnvPreset; intensity: number; rotation: number; exposure: number; bg: BackgroundMode }>(lsGet('zeyforge.env', { preset: 'studio', intensity: 1, rotation: 0, exposure: 1, bg: 'dark' }));
  readonly issues = signal<Issue[]>([]);
  readonly toasts = signal<Toast[]>([]);
  readonly importDialog = signal<{ analysis: ImportAnalysis; unit: string; data: Uint8Array } | null>(null);
  readonly dialog = signal<'' | 'settings' | 'render' | 'about' | 'array' | 'shortcuts'>('');
  readonly photo = signal<{ running: boolean; samples: number; target: number }>({ running: false, samples: 0, target: 0 });
  readonly file = signal<{ name: string; path: string | null; dirty: boolean }>({ name: 'Sem título.zeyforge', path: null, dirty: false });
  readonly leftTab = signal<'library' | 'scene'>('library');
  readonly rightTab = signal<'props' | 'connections' | 'bom'>('props');
  readonly snapHint = signal<string>('');
  readonly ready = signal(false);

  readonly bom = computed<BomResult>(() => {
    this.version.value;
    if (!this.sync) return { rows: [], totalCost: 0, totalMass: 0, partCount: 0, cableCount: 0, cableLength: 0 };
    return buildBom(this.doc, {
      describe: n => ({ category: byType[n.type]?.category ?? (n.kind === 'import' ? 'Modelos importados' : 'Malhas') }),
      massOf: n => this.sync.massOf(n),
      cableLength: c => this.sync.cableLength(c),
    });
  });

  private waypointProxy = new THREE.Object3D();
  private waypointIndex = -1;
  private waypointHandles = new THREE.Group();
  private snapLine: THREE.Line | null = null;
  private saveTimer = 0;
  private validateTimer = 0;
  private toastSeq = 0;

  /* ============================== inicialização ============================== */

  async init(viewEl: HTMLElement, cubeEl: HTMLElement): Promise<void> {
    setQuality(this.qualityLevel.value);
    await initPlatform();
    this.vp = new Viewport(viewEl);
    this.sync = new SceneSync(this.vp, () => this.doc);
    this.sync.onAsyncLoaded = () => this.bump();
    this.vp.overlay.add(this.markers.group, this.waypointHandles, this.waypointProxy);
    this.vp.pickTargets = [this.vp.model, this.vp.cables];
    this.vp.onPick = (h, e) => this.handlePick(h, e);
    this.vp.onHover = (h) => this.handleHover(h);
    this.vp.onTransform = o => this.handleTransform(o);
    this.vp.onTransformEnd = o => this.handleTransformEnd(o);
    this.vp.onPhotoProgress = (s, t) => { this.photo.value = { running: this.vp.photoRunning, samples: s, target: t }; };
    new ViewCube(cubeEl, () => this.vp.camera).onView = v => this.vp.view(v);
    this.applyEnv();
    void this.vp.applyQuality(quality());
    this.applySnap();

    const startup = await platform().startupFile();
    if (startup) { this.loadBytes(startup.data, startup.name, startup.path ?? null); }
    else {
      const saved = await idbGet<Uint8Array>('autosave');
      let restored = false;
      if (saved) { try { this.loadBytes(saved, lsGet('zeyforge.autosaveName', 'Recuperado.zeyforge'), null, false); restored = true; this.toast('Projeto restaurado do salvamento automático'); } catch { restored = false; } }
      if (!restored) { this.doc = newDocument('Celular transparente'); TEMPLATES[0].build(this.doc); this.history.reset(this.doc); this.file.value = { name: 'Celular transparente.zeyforge', path: null, dirty: false }; this.sync.rebuildAll(); this.vp.fit(null, new THREE.Vector3(1, 0.9, 1.15), false); this.bump(); this.revalidate(); this.toast('Bem-vindo ao ZeyForge v0.2 — explore o celular: Raio-X, Explodir, Corte e Render'); }
    }
    this.ready.value = true;
  }

  /* ============================== núcleo de edição ============================== */

  private bump(): void { this.version.value++; }

  commit(label: string, opts: { rebuild?: boolean | Id[]; cables?: boolean } = {}): void {
    touch(this.doc);
    if (opts.rebuild === true) this.sync.rebuildAll();
    else if (Array.isArray(opts.rebuild)) opts.rebuild.forEach(id => this.sync.rebuildNode(id));
    if (opts.cables) this.sync.updateCables();
    this.history.commit(this.doc, label);
    this.file.value = { ...this.file.value, dirty: true };
    this.bump();
    this.refreshSelectionVisuals();
    this.scheduleAutosave();
    this.revalidate();
  }

  private scheduleAutosave(): void {
    clearTimeout(this.saveTimer);
    this.saveTimer = window.setTimeout(() => { void idbSet('autosave', encodeProject(this.doc)); lsSet('zeyforge.autosaveName', this.file.value.name); }, 800);
  }

  revalidate(): void {
    clearTimeout(this.validateTimer);
    this.validateTimer = window.setTimeout(() => {
      const geom = new Map<string, CableGeom>();
      this.sync.routes.forEach((r, id) => geom.set(id, { length: r.length, minRadius: r.minRadius, inPlaneRadius: r.inPlaneRadius }));
      this.issues.value = validate(this.doc, e => this.sync.socketDef(e), geom);
    }, 120);
  }

  undo(): void { const l = this.history.undo(this.doc); if (l) { this.afterHistory(); this.toast(`Desfeito: ${l}`); } }
  redo(): void { const l = this.history.redo(this.doc); if (l) { this.afterHistory(); this.toast(`Refeito: ${l}`); } }
  private afterHistory(): void {
    this.selection.value = this.selection.value.filter(id => getNode(this.doc, id));
    if (this.cableSel.value && !this.doc.cables.some(c => c.id === this.cableSel.value)) this.cableSel.value = null;
    this.sync.rebuildAll(); this.bump(); this.refreshSelectionVisuals(); this.scheduleAutosave(); this.revalidate();
  }

  node(id: Id | null | undefined): DocNode | undefined { return getNode(this.doc, id); }
  cable(id: Id | null | undefined): Cable | undefined { return id ? this.doc.cables.find(c => c.id === id) : undefined; }

  /* ============================== seleção ============================== */

  select(ids: Id[], additive = false): void {
    let next = ids.filter(Boolean);
    if (additive) { const cur = [...this.selection.value]; next.forEach(id => { const i = cur.indexOf(id); i >= 0 ? cur.splice(i, 1) : cur.push(id); }); next = cur; }
    batch(() => { this.selection.value = next; if (next.length) this.cableSel.value = null; });
    if (next.length && this.rightTab.value === 'connections' && !additive) this.rightTab.value = 'props';
    this.refreshSelectionVisuals();
  }

  selectCable(id: Id | null): void {
    batch(() => { this.cableSel.value = id; if (id) this.selection.value = []; });
    this.refreshSelectionVisuals();
  }

  refreshSelectionVisuals(): void {
    if (!this.vp) return;
    const objs = this.selection.value.map(id => this.sync.holders.get(id)).filter(Boolean) as THREE.Object3D[];
    const cab = this.cableSel.value ? this.sync.cableObjs.get(this.cableSel.value) : undefined;
    this.vp.showSelection(cab ? [cab] : objs, cab ? 0xffb547 : 0x4da3ff);
    this.updateWaypointHandles();
    const primary = this.node(this.selection.value[0]);
    const t = this.tool.value;
    const movable = primary && !primary.locked && this.explode.value.f === 0 && (t === 'translate' || t === 'rotate' || t === 'scale');
    if (this.waypointIndex >= 0 && cab) this.vp.attachGizmo(this.waypointProxy);
    else this.vp.attachGizmo(movable ? this.sync.holders.get(primary!.id) ?? null : null);
    if (['translate', 'rotate', 'scale'].includes(t)) this.vp.gizmo.setMode(t as 'translate' | 'rotate' | 'scale');
  }

  setTool(t: Tool): void {
    if (t !== 'cable') this.cableStart.value = null;
    this.tool.value = t;
    if (t !== 'measure') this.vp.cancelMeasure();
    this.vp.renderer.domElement.style.cursor = t === 'measure' || t === 'socket' ? 'crosshair' : t === 'cable' ? 'cell' : '';
    this.updateMarkers();
    this.refreshSelectionVisuals();
  }

  setCableMode(m: 'bus' | 'wire'): void { this.cableMode.value = m; this.cableStart.value = null; this.updateMarkers(); }

  applySnap(): void {
    const on = this.snap.value;
    this.vp.gizmo.setTranslationSnap(on ? 0.5 : null);
    this.vp.gizmo.setRotationSnap(on ? 15 * DEG : null);
    this.vp.gizmo.setScaleSnap(on ? 0.05 : null);
  }

  /* ============================== interação no viewport ============================== */

  private nodeIdFromObject(o: THREE.Object3D | null): Id | null {
    while (o) { if (o.userData.nodeId) return o.userData.nodeId as Id; o = o.parent; }
    return null;
  }

  private handlePick(hit: PickHit | null, e: PointerEvent): void {
    const t = this.tool.value;
    const additive = e.shiftKey || e.ctrlKey || e.metaKey;
    if (t === 'measure') { if (hit) { const d = this.vp.measureClick(hit.point); if (d != null) this.toast(`Distância: ${d.toFixed(3)} mm`); } return; }
    if (t === 'cable') { this.pickCableEndpoint(hit); return; }
    if (t === 'socket') { this.placeCustomSocket(hit); return; }
    // ponto de passagem
    if (hit && hit.object.userData.waypoint != null) { this.waypointIndex = hit.object.userData.waypoint as number; this.waypointProxy.position.copy(hit.object.position); this.refreshSelectionVisuals(); return; }
    if (!hit) { if (!additive) { this.waypointIndex = -1; this.select([]); this.selectCable(null); } return; }
    if (hit.object.userData.cableId) { this.waypointIndex = -1; this.selectCable(hit.object.userData.cableId); this.rightTab.value = 'props'; return; }
    let id = this.nodeIdFromObject(hit.object);
    let n = this.node(id);
    while (n && n.locked && n.parent) n = this.node(n.parent);
    if (!n) return;
    if (!additive && this.selection.value.length === 1 && this.selection.value[0] === n.id && n.parent) n = this.node(n.parent)!;
    this.waypointIndex = -1;
    this.select([n.id], additive);
  }

  private handleHover(hit: PickHit | null): void {
    const t = this.tool.value;
    if (t === 'measure') { if (hit) this.vp.measureHover(hit.point); return; }
    if (t === 'cable') {
      const m = hit ? this.markers.markerOf(hit.object) : null;
      this.markers.hover(m);
      this.hoverInfo.value = m ? this.markerLabel(m) : '';
      return;
    }
    if (hit) { const n = this.node(this.nodeIdFromObject(hit.object)); const c = this.cable(hit.object.userData.cableId); this.hoverInfo.value = c ? c.name : n ? n.name : ''; }
    else this.hoverInfo.value = '';
  }

  private markerLabel(m: MarkerEntry): string {
    const n = this.node(m.endpoint.node);
    if (m.endpoint.pin != null) return `${n?.name} · ${m.def.label} · pino ${m.def.pinNames?.[m.endpoint.pin] ?? m.endpoint.pin + 1}`;
    return `${n?.name} · ${m.def.label} (${m.def.pins} vias, ${m.def.pitch} mm)`;
  }

  private handleTransform(o: THREE.Object3D): void {
    if (o === this.waypointProxy) {
      const c = this.cable(this.cableSel.value);
      if (c && this.waypointIndex >= 0) { c.waypoints[this.waypointIndex] = o.position.toArray().map(v => +v.toFixed(3)) as Vec3; this.sync.buildCable(c); this.updateWaypointHandles(false); }
      return;
    }
    const id = o.userData.nodeId as Id; const n = this.node(id); if (!n) return;
    // encaixe magnético
    if (this.magnetic.value && this.vp.gizmo.getMode() === 'translate') {
      o.updateMatrixWorld(true);
      const s = findSnap(this.doc, this.sync, id, Math.max(2.5, this.vp.sceneSize * 0.02));
      if (s) {
        const parentInv = new THREE.Matrix4().copy(o.parent!.matrixWorld).invert();
        const world = new THREE.Vector3().setFromMatrixPosition(o.matrixWorld).add(s.delta);
        o.position.copy(world.applyMatrix4(parentInv));
        o.updateMatrixWorld(true);
        this.snapHint.value = `Encaixado em ${s.label}`;
        this.showSnapLine(s.to);
      } else { this.snapHint.value = ''; this.showSnapLine(null); }
    }
    n.pos = o.position.toArray().map(v => +v.toFixed(4)) as Vec3;
    n.rot = [o.rotation.x, o.rotation.y, o.rotation.z].map(v => +(v / DEG).toFixed(3)) as Vec3;
    n.scl = o.scale.toArray().map(v => +v.toFixed(4)) as Vec3;
    this.sync.updateCables([id]);
    this.bump();
  }

  private handleTransformEnd(o: THREE.Object3D): void {
    this.showSnapLine(null);
    if (o === this.waypointProxy) { this.commit('Mover ponto do cabo'); return; }
    const snapped = this.snapHint.value;
    this.snapHint.value = '';
    this.commit(snapped ? snapped : 'Transformar');
    this.vp.updateSceneBounds();
  }

  private showSnapLine(p: THREE.Vector3 | null): void {
    if (this.snapLine) { this.vp.helpers.remove(this.snapLine); this.snapLine = null; }
    if (!p) return;
    const m = new THREE.Mesh(new THREE.SphereGeometry(Math.max(0.6, this.vp.sceneSize * 0.006), 16, 12), new THREE.MeshBasicMaterial({ color: '#3cff9a', depthTest: false }));
    m.position.copy(p); m.renderOrder = 30;
    this.vp.helpers.add(m as unknown as THREE.Line); this.snapLine = m as unknown as THREE.Line;
  }

  /* ============================== conexões ============================== */

  updateMarkers(): void {
    if (!this.vp) return;
    if (this.tool.value !== 'cable') { this.markers.clear(); return; }
    const entries: MarkerEntry[] = [];
    const wire = this.cableMode.value === 'wire';
    for (const n of this.doc.nodes) {
      if (!isEffectivelyVisible(this.doc, n)) continue;
      for (const def of this.sync.socketDefs(n)) {
        if (wire) {
          if (!WIREABLE.includes(def.kind)) continue;
          for (let p = 0; p < Math.max(1, def.pins); p++) { const e = { node: n.id, socket: def.id, pin: p }; const f = this.sync.socketFrame(e, def); if (f) entries.push({ endpoint: e, def, frame: f, label: '' }); }
        } else {
          if (!cableRule(def.kind, def.kind) && def.kind !== 'custom') continue;
          const e = { node: n.id, socket: def.id }; const f = this.sync.socketFrame(e, def);
          if (f) entries.push({ endpoint: e, def, frame: f, label: '' });
        }
      }
    }
    const scale = Math.min(3, Math.max(0.5, this.vp.sceneSize / 200)) * (wire ? 0.9 : 1);
    this.markers.set(entries, scale);
    this.vp.pickTargets = [this.markers.group];
  }

  private pickCableEndpoint(hit: PickHit | null): void {
    const m = hit ? this.markers.markerOf(hit.object) : null;
    if (!m) { this.cableStart.value = null; this.markers.select(null); return; }
    const start = this.cableStart.value;
    if (!start) { this.cableStart.value = m; this.markers.select(m); this.toast(`Origem: ${this.markerLabel(m)} — agora clique no destino`); return; }
    if (start.endpoint.node === m.endpoint.node && start.endpoint.socket === m.endpoint.socket && start.endpoint.pin === m.endpoint.pin) { this.cableStart.value = null; this.markers.select(null); return; }
    const r = connect(this.doc, start.endpoint, m.endpoint);
    if (r.error) { this.toast(`Conexão recusada: ${r.error}`, 'err'); return; }
    this.cableStart.value = null; this.markers.select(null);
    this.sync.updateCables();
    this.commit(`Conectar ${r.cable!.name}`);
    if (r.warning) this.toast(`Atenção: ${r.warning}`, 'warn'); else this.toast(`${r.cable!.name} conectado (${this.sync.cableLength(r.cable!).toFixed(1)} mm)`, 'ok');
    this.updateMarkers();
  }

  /** Inicia uma conexão a partir de um encaixe listado no painel. */
  startCableFrom(nodeId: Id, socketId: string): void {
    const n = this.node(nodeId); if (!n) return;
    const def = this.sync.socketDefs(n).find(s => s.id === socketId); if (!def) return;
    this.setCableMode('bus'); this.setTool('cable');
    const e = { node: nodeId, socket: socketId }; const f = this.sync.socketFrame(e, def);
    if (f) { const entry = this.markers['group'].children.map(c => c.userData.marker as MarkerEntry).find(x => x.endpoint.node === nodeId && x.endpoint.socket === socketId) ?? { endpoint: e, def, frame: f, label: '' }; this.cableStart.value = entry; this.markers.select(entry); }
    this.toast('Clique no encaixe de destino');
  }

  updateCable(id: Id, patch: Partial<Cable>, label = 'Editar cabo'): void {
    const c = this.cable(id); if (!c) return;
    Object.assign(c, patch);
    this.sync.buildCable(c);
    this.commit(label);
  }

  addWaypoint(id: Id): void {
    const c = this.cable(id); const r = this.sync.routes.get(id); if (!c || !r) return;
    const p = r.curve.getPointAt(0.5);
    const lift = r.normals[Math.floor(r.points.length / 2)].clone().multiplyScalar(2);
    c.waypoints.push(p.add(lift).toArray().map(v => +v.toFixed(2)) as Vec3);
    this.sync.buildCable(c); this.commit('Adicionar ponto ao cabo');
  }

  clearWaypoints(id: Id): void { this.updateCable(id, { waypoints: [] }, 'Limpar pontos do cabo'); this.waypointIndex = -1; }

  deleteCable(id: Id): void {
    this.doc.cables = this.doc.cables.filter(c => c.id !== id);
    if (this.cableSel.value === id) this.cableSel.value = null;
    this.waypointIndex = -1;
    this.sync.updateCables();
    this.commit('Excluir cabo');
  }

  private updateWaypointHandles(rebuildProxy = true): void {
    this.waypointHandles.clear();
    const c = this.cable(this.cableSel.value);
    if (!c) { this.waypointIndex = -1; return; }
    const r = Math.max(0.5, this.vp.sceneSize * 0.005);
    c.waypoints.forEach((w, i) => {
      const m = new THREE.Mesh(new THREE.SphereGeometry(r, 16, 12), new THREE.MeshBasicMaterial({ color: i === this.waypointIndex ? '#ffffff' : '#ffb547', depthTest: false }));
      m.position.set(...w); m.renderOrder = 25; m.userData.waypoint = i; this.waypointHandles.add(m);
    });
    if (rebuildProxy && this.waypointIndex >= 0 && c.waypoints[this.waypointIndex]) this.waypointProxy.position.set(...c.waypoints[this.waypointIndex]);
    this.vp.pickTargets = this.tool.value === 'cable' ? [this.markers.group] : [this.waypointHandles, this.vp.model, this.vp.cables];
  }

  /* ---- editor de encaixes ---- */

  private placeCustomSocket(hit: PickHit | null): void {
    const target = this.node(this.selection.value[0]);
    if (!target) { this.toast('Selecione a peça que vai receber o encaixe', 'warn'); return; }
    if (!hit) return;
    const hid = this.nodeIdFromObject(hit.object);
    const owner = hid === target.id || (hid && descendants(this.doc, target.id).some(d => d.id === hid));
    if (!owner) { this.toast('Clique na superfície da peça selecionada', 'warn'); return; }
    const h = this.sync.holders.get(target.id)!;
    h.updateWorldMatrix(true, false);
    const inv = new THREE.Matrix4().copy(h.matrixWorld).invert();
    const local = hit.point.clone().applyMatrix4(inv);
    const nWorld = hit.face ? hit.face.normal.clone().transformDirection(hit.object.matrixWorld) : new THREE.Vector3(0, 1, 0);
    const nLocal = nWorld.clone().transformDirection(inv).normalize();
    const axis = Math.abs(nLocal.y) > 0.9 ? new THREE.Vector3(1, 0, 0) : new THREE.Vector3(0, 1, 0).cross(nLocal).normalize();
    const s: SocketDef = { id: 'u' + uid().slice(-6), label: `Encaixe ${target.customSockets.length + 1}`, kind: 'custom', pins: 1, pitch: 1, pos: local.toArray().map(v => +v.toFixed(3)) as Vec3, normal: nLocal.toArray().map(v => +v.toFixed(4)) as Vec3, axis: axis.toArray().map(v => +v.toFixed(4)) as Vec3, termination: 'solder' };
    target.customSockets.push(s);
    this.commit('Adicionar encaixe');
    this.toast(`${s.label} criado — ajuste tipo e pinos em Propriedades`, 'ok');
  }

  updateCustomSocket(nodeId: Id, socketId: string, patch: Partial<SocketDef>): void {
    const n = this.node(nodeId); const s = n?.customSockets.find(x => x.id === socketId); if (!s) return;
    Object.assign(s, patch); this.sync.updateCables([nodeId]); this.commit('Editar encaixe');
  }
  removeCustomSocket(nodeId: Id, socketId: string): void {
    const n = this.node(nodeId); if (!n) return;
    n.customSockets = n.customSockets.filter(s => s.id !== socketId);
    this.doc.cables = this.doc.cables.filter(c => !((c.a.node === nodeId && c.a.socket === socketId) || (c.b.node === nodeId && c.b.socket === socketId)));
    this.sync.updateCables(); this.commit('Remover encaixe');
  }

  /* ============================== comandos de edição ============================== */

  private placeBeside(id: Id, before: THREE.Box3): void {
    if (before.isEmpty()) return;
    const n = this.node(id)!, h = this.sync.holders.get(id)!;
    h.updateMatrixWorld(true);
    const b = new THREE.Box3().setFromObject(h); if (b.isEmpty()) return;
    n.pos[0] += Math.ceil(before.max.x + 15 - b.min.x);
    n.pos[2] += (before.min.z + before.max.z) / 2 - (b.min.z + b.max.z) / 2;
    if (b.min.y < 0) n.pos[1] -= b.min.y;
    this.sync.applyTransform(n);
  }

  addPart(type: string): void {
    const before = this.vp.bounds([this.vp.model]);
    const n = createPart(type);
    this.doc.nodes.push(n);
    this.sync.rebuildAll();
    this.placeBeside(n.id, before);
    this.commit(`Adicionar ${n.name}`, { cables: true });
    this.select([n.id]);
    this.vp.updateSceneBounds();
    this.vp.fit([this.sync.holders.get(n.id)!]);
  }

  addTemplate(t: Template): void {
    const before = this.vp.bounds([this.vp.model]);
    const root = t.build(this.doc);
    this.sync.rebuildAll();
    this.placeBeside(root, before);
    this.sync.updateCables();
    this.commit(`Montagem: ${t.name}`);
    this.select([root]);
    this.vp.updateSceneBounds();
    this.vp.fit([this.sync.holders.get(root)!], new THREE.Vector3(1, 0.9, 1.15));
  }

  deleteSelection(): void {
    if (this.cableSel.value) { this.deleteCable(this.cableSel.value); return; }
    const ids = this.selection.value; if (!ids.length) return;
    removeNodes(this.doc, ids); this.selection.value = [];
    this.commit(`Excluir ${ids.length} item(ns)`, { rebuild: true });
  }

  duplicate(): void {
    const ids = this.selection.value; if (!ids.length) return;
    const out = cloneNodes(this.doc, ids, [12, 0, 12]);
    out.forEach(id => { const n = this.node(id)!; n.name += ' (cópia)'; });
    this.commit('Duplicar', { rebuild: true }); this.select(out);
  }

  mirror(axis: 0 | 1 | 2 = 0): void {
    const ids = this.selection.value; if (!ids.length) return;
    const out = cloneNodes(this.doc, ids);
    out.forEach(id => { const n = this.node(id)!; n.pos[axis] = -n.pos[axis]; n.scl[axis] = -n.scl[axis]; n.rot = n.rot.map((r, i) => (i === axis ? r : -r)) as Vec3; n.name += ' (espelho)'; });
    this.commit(`Espelhar em ${'XYZ'[axis]}`, { rebuild: true }); this.select(out);
  }

  array(count: number, axis: 0 | 1 | 2, step: number): void {
    const ids = topLevel(this.doc, this.selection.value); if (!ids.length) return;
    const out = [...ids];
    for (let i = 1; i < Math.max(2, count); i++) { const off: Vec3 = [0, 0, 0]; off[axis] = step * i; out.push(...cloneNodes(this.doc, ids, off)); }
    this.commit(`Padrão linear ×${count}`, { rebuild: true }); this.select(out);
  }

  private worldMatrix(id: Id | null): THREE.Matrix4 { const o = id ? this.sync.holders.get(id)! : this.vp.model; o.updateWorldMatrix(true, false); return o.matrixWorld.clone(); }

  reparent(id: Id, parent: Id | null, doCommit = true): void {
    const n = this.node(id); if (!n || n.id === parent) return;
    if (parent && descendants(this.doc, id).some(d => d.id === parent)) { this.toast('Não dá para colocar uma montagem dentro dela mesma', 'err'); return; }
    const local = this.worldMatrix(parent).invert().multiply(this.worldMatrix(id));
    const p = new THREE.Vector3(), q = new THREE.Quaternion(), s = new THREE.Vector3(); local.decompose(p, q, s);
    const e = new THREE.Euler().setFromQuaternion(q);
    n.pos = p.toArray().map(v => +v.toFixed(4)) as Vec3; n.rot = [e.x, e.y, e.z].map(v => +(v / DEG).toFixed(3)) as Vec3; n.scl = s.toArray().map(v => +v.toFixed(4)) as Vec3;
    n.parent = parent;
    if (doCommit) this.commit('Mover na árvore', { rebuild: true });
  }

  group(): void {
    const ids = topLevel(this.doc, this.selection.value); if (!ids.length) return;
    const parent = this.node(ids[0])!.parent;
    const g = createNode('assembly', { name: 'Montagem', parent, kind: 'assembly' }); g.expanded = true;
    this.doc.nodes.push(g); this.sync.rebuildAll();
    ids.forEach(id => this.reparent(id, g.id, false));
    this.commit('Agrupar', { rebuild: true }); this.select([g.id]);
  }

  ungroup(): void {
    const n = this.node(this.selection.value[0]); if (!n || n.kind !== 'assembly') { this.toast('Selecione uma montagem', 'warn'); return; }
    const kids = childrenOf(this.doc, n.id).map(c => c.id);
    kids.forEach(id => this.reparent(id, n.parent, false));
    this.doc.nodes = this.doc.nodes.filter(x => x.id !== n.id);
    this.commit('Desagrupar', { rebuild: true }); this.select(kids);
  }

  async booleanOp(op: 'union' | 'subtract' | 'intersect'): Promise<void> {
    const ids = this.selection.value;
    if (ids.length !== 2) { this.toast('Selecione exatamente 2 peças (Shift+clique). A 1ª é a base.', 'warn'); return; }
    try {
      const { boolean } = await import('@/geometry/csg');
      const t0 = performance.now();
      const g = boolean(this.sync.holders.get(ids[0])!, this.sync.holders.get(ids[1])!, op);
      const a = uid();
      this.doc.assets[a] = { id: a, name: 'csg', type: 'mesh', unitScale: 1, data: encodeMesh(g.attributes.position.array as Float32Array, (g.attributes.normal?.array as Float32Array) ?? null, g.index ? new Uint32Array(g.index.array) : null) };
      const base = this.node(ids[0])!;
      const n = createNode('mesh', { name: `${base.name} ${{ union: '∪', subtract: '−', intersect: '∩' }[op]} ${this.node(ids[1])!.name}`, kind: 'mesh', asset: a, mat: base.mat.preset || 'aluminio', cost: base.cost });
      removeNodes(this.doc, ids); this.doc.nodes.push(n);
      this.commit('Operação booleana', { rebuild: true }); this.select([n.id]);
      this.toast(`Booleana concluída em ${Math.round(performance.now() - t0)} ms`, 'ok');
    } catch (e) { this.toast(`Falha na booleana: ${(e as Error).message}`, 'err'); }
  }

  setParam(id: Id, key: string, value: unknown, doCommit: boolean): void {
    const n = this.node(id); if (!n) return;
    n.params[key] = value;
    this.sync.rebuildNode(id);
    this.refreshSelectionVisuals();
    if (doCommit) { const d = byType[n.type]; if (d) n.cost = typeof d.cost === 'function' ? +d.cost({ ...n.params }).toFixed(2) : n.cost; this.commit(`Parâmetro: ${key}`); this.updateMarkers(); }
    else this.bump();
  }

  setTransform(id: Id, key: 'pos' | 'rot' | 'scl', i: number, v: number, doCommit: boolean): void {
    const n = this.node(id); if (!n) return;
    n[key][i] = v; this.sync.applyTransform(n); this.vp.model.updateMatrixWorld(true); this.sync.updateCables([id]);
    if (doCommit) this.commit('Transformar'); else this.bump();
  }

  updateNode(id: Id, patch: Partial<DocNode>, label: string, rebuildMaterials = false): void {
    const n = this.node(id); if (!n) return;
    Object.assign(n, patch);
    if (rebuildMaterials) this.sync.applyMaterials(n);
    if ('visible' in patch) { this.sync.applyTransform(n); this.sync.updateCables(); }
    this.commit(label);
  }

  dropToFloor(id: Id): void {
    const n = this.node(id), h = this.sync.holders.get(id); if (!n || !h) return;
    const b = new THREE.Box3().setFromObject(h); n.pos[1] -= b.min.y; this.sync.applyTransform(n); this.sync.updateCables([id]); this.commit('Apoiar no chão');
  }

  focus(): void { const objs = this.selection.value.map(id => this.sync.holders.get(id)!).filter(Boolean); this.vp.fit(objs.length ? objs : null); }

  /* ============================== exibição ============================== */

  setDisplay(key: 'xray' | 'wire', v: boolean): void { this[key].value = v; this.sync.display[key] = v; this.sync.refreshMaterials(); this.sync.updateCables(); }
  setGrid(v: boolean): void { this.grid.value = v; this.vp.grid.visible = v; }
  setOrtho(v: boolean): void { this.ortho.value = v; this.vp.setOrtho(v); }
  setExplode(f: number, mode?: ExplodeMode): void { this.explode.value = { f, mode: mode ?? this.explode.value.mode }; this.sync.setExplode(f, mode); this.refreshSelectionVisuals(); this.updateMarkers(); }
  setClip(patch: Partial<{ axis: '' | 'x' | 'y' | 'z'; t: number; flip: boolean }>): void { const c = { ...this.clip.value, ...patch }; this.clip.value = c; this.vp.setClip(c.axis || null, c.t, c.flip); this.sync.refreshMaterials(); }
  view(v: ViewName): void { this.vp.view(v); }

  async setQualityLevel(level: QualityLevel): Promise<void> {
    this.qualityLevel.value = level; setQuality(level);
    invalidateMaterials(); await this.vp.applyQuality(PROFILES[level]);
    this.sync.rebuildAll(); this.refreshSelectionVisuals(); this.toast(`Qualidade: ${PROFILES[level].label}`);
  }

  setEnv(patch: Partial<{ preset: EnvPreset; intensity: number; rotation: number; exposure: number; bg: BackgroundMode }>): void {
    this.env.value = { ...this.env.value, ...patch }; lsSet('zeyforge.env', this.env.value); this.applyEnv();
  }
  private applyEnv(): void { const e = this.env.value; this.vp.setEnvironment(e.preset, e.intensity); this.vp.setEnvironmentRotation(e.rotation); this.vp.setExposure(e.exposure); this.vp.setBackground(e.bg); }

  /* ============================== render fotorrealista ============================== */

  async startPhoto(samples: number): Promise<void> {
    this.vp.attachGizmo(null); this.vp.showSelection([]); this.markers.clear();
    this.photo.value = { running: true, samples: 0, target: samples };
    try { await this.vp.startPhoto(samples); } catch (e) { this.photo.value = { running: false, samples: 0, target: 0 }; this.toast(`Render indisponível neste dispositivo: ${(e as Error).message}`, 'err'); }
  }
  stopPhoto(): void { this.vp.stopPhoto(); this.photo.value = { running: false, samples: 0, target: 0 }; this.refreshSelectionVisuals(); this.updateMarkers(); }
  async savePhoto(): Promise<void> {
    const url = this.vp.screenshot();
    const bytes = Uint8Array.from(atob(url.split(',')[1]), c => c.charCodeAt(0));
    await platform().saveFile(bytes, this.baseName() + '_render.png', 'image/png');
  }

  /* ============================== arquivos ============================== */

  baseName(): string { return (this.file.value.name || 'projeto').replace(/\.zeyforge$/i, '').replace(/[^\w\-. ]+/g, '_'); }

  private loadBytes(bytes: Uint8Array, name: string, path: string | null, resetFile = true): void {
    this.doc = decodeProject(bytes);
    this.history.reset(this.doc);
    batch(() => { this.selection.value = []; this.cableSel.value = null; });
    this.sync.rebuildAll();
    this.vp.fit(null, new THREE.Vector3(1, 0.9, 1.15), false);
    if (resetFile) this.file.value = { name: /\.zeyforge$/i.test(name) ? name : name.replace(/\.json$/i, '') + '.zeyforge', path, dirty: false };
    else this.file.value = { name, path: null, dirty: false };
    this.bump(); this.revalidate();
  }

  async newProject(): Promise<void> {
    if (this.file.value.dirty && !confirm('Começar um projeto novo? Alterações não salvas serão perdidas (o salvamento automático guarda a última versão).')) return;
    this.doc = newDocument('Novo projeto'); this.history.reset(this.doc);
    batch(() => { this.selection.value = []; this.cableSel.value = null; });
    this.sync.rebuildAll(); this.vp.view('iso');
    this.file.value = { name: 'Novo projeto.zeyforge', path: null, dirty: false };
    this.bump(); this.revalidate();
  }

  async open(): Promise<void> {
    const f = await platform().openProject(); if (!f) return;
    try { this.loadBytes(f.data, f.name, f.path ?? null); this.toast(`Aberto: ${f.name}`, 'ok'); }
    catch (e) { this.toast(`Não consegui abrir: ${(e as Error).message}`, 'err'); }
  }

  async save(saveAs = false): Promise<void> {
    const thumb = await this.thumbnail();
    const bytes = encodeProject(this.doc, thumb);
    const r = await platform().saveProject(bytes, this.file.value.name, this.file.value.path, saveAs);
    if (!r) return;
    this.file.value = { name: r.name, path: r.path, dirty: false };
    this.doc.name = r.name.replace(/\.zeyforge$/i, '');
    this.toast(`Salvo: ${r.name}`, 'ok');
  }

  private async thumbnail(): Promise<Uint8Array | undefined> {
    try {
      const src = this.vp.renderer.domElement;
      const c = document.createElement('canvas'); c.width = 512; c.height = Math.round(512 * src.height / src.width);
      c.getContext('2d')!.drawImage(src, 0, 0, c.width, c.height);
      const blob = await new Promise<Blob | null>(r => c.toBlob(r, 'image/png'));
      return blob ? new Uint8Array(await blob.arrayBuffer()) : undefined;
    } catch { return undefined; }
  }

  async importModels(): Promise<void> {
    const files = await platform().pickFiles(['glb', 'gltf', 'stl', 'obj'], false);
    const f = files[0]; if (!f) return;
    try {
      const analysis = await analyzeModel(f.name, f.data);
      this.importDialog.value = { analysis, unit: analysis.suggestedUnit, data: f.data };
    } catch (e) { this.toast(`Erro ao ler ${f.name}: ${(e as Error).message}`, 'err'); }
  }

  async confirmImport(unit: string, material: string | null, massOverride: number | null): Promise<void> {
    const d = this.importDialog.value; if (!d) return;
    this.importDialog.value = null;
    const toMM = IMPORT_UNITS.find(u => u.id === unit)?.toMM ?? 1;
    const glb = d.analysis.kind === 'glb' ? d.data : await toGLB(d.analysis.scene);
    const a = uid();
    this.doc.assets[a] = { id: a, name: d.analysis.name, type: 'glb', unitScale: toMM, data: glb };
    const box = d.analysis.rawBox;
    const c = box.getCenter(new THREE.Vector3());
    const offset = [-c.x * toMM, -box.min.y * toMM, -c.z * toMM];
    const n = createNode(d.analysis.name, { name: d.analysis.name.replace(/\.\w+$/, ''), kind: 'import', asset: a, params: { offset }, mat: material, massOverride });
    const before = this.vp.bounds([this.vp.model]);
    this.doc.nodes.push(n);
    this.sync.rebuildAll();
    this.commit(`Importar ${d.analysis.name}`);
    setTimeout(() => { this.placeBeside(n.id, before); this.commit('Posicionar importação'); this.select([n.id]); this.vp.updateSceneBounds(); this.vp.fit([this.sync.holders.get(n.id)!]); }, 300);
    const s = d.analysis.rawSize.clone().multiplyScalar(toMM);
    this.toast(`Importado: ${s.x.toFixed(1)} × ${s.y.toFixed(1)} × ${s.z.toFixed(1)} mm — use a ferramenta Encaixe para criar pontos de conexão`, 'ok');
  }

  exportTargets(): THREE.Object3D[] {
    const ids = this.selection.value.length ? topLevel(this.doc, this.selection.value) : roots(this.doc).map(n => n.id);
    const objs = ids.map(id => this.sync.holders.get(id)).filter(o => o && o.visible) as THREE.Object3D[];
    if (!this.selection.value.length) objs.push(this.vp.cables);
    return objs;
  }

  async exportAs(kind: 'stl' | 'obj' | 'gltf' | 'glb' | 'png' | 'bom' | 'netlist'): Promise<void> {
    const io = await import('@/io/export');
    const name = this.baseName() + (this.selection.value.length ? '_selecao' : '');
    try {
      let saved: string | null = null;
      if (kind === 'stl') saved = await platform().saveFile(await io.exportSTL(this.exportTargets()), name + '.stl', 'model/stl');
      if (kind === 'obj') saved = await platform().saveFile(await io.exportOBJ(this.exportTargets()), name + '.obj', 'text/plain');
      if (kind === 'gltf') saved = await platform().saveFile(await io.exportGLTF(this.exportTargets(), false), name + '.gltf', 'model/gltf+json');
      if (kind === 'glb') saved = await platform().saveFile(await io.exportGLTF(this.exportTargets(), true), name + '.glb', 'model/gltf-binary');
      if (kind === 'png') { this.vp.showSelection([]); this.vp.attachGizmo(null); const url = this.vp.screenshot(2); this.refreshSelectionVisuals(); saved = await platform().saveFile(Uint8Array.from(atob(url.split(',')[1]), c => c.charCodeAt(0)), name + '.png', 'image/png'); }
      if (kind === 'bom') saved = await platform().saveFile(bomToCSV(this.bom.value), name + '_BOM.csv', 'text/csv');
      if (kind === 'netlist') saved = await platform().saveFile(this.netlistCSV(), name + '_netlist.csv', 'text/csv');
      if (saved) this.toast(`Exportado: ${kind.toUpperCase()}`, 'ok');
    } catch (e) { this.toast(`Erro ao exportar: ${(e as Error).message}`, 'err'); }
  }

  private netlistCSV(): string {
    const esc = (v: unknown) => '"' + String(v).replace(/"/g, '""') + '"';
    const lines = [['Cabo', 'Tipo', 'Origem', 'Encaixe', 'Pino', 'Destino', 'Encaixe', 'Pino', 'Comprimento (mm)'].map(esc).join(';')];
    for (const c of this.doc.cables) {
      const sa = this.sync.socketDef(c.a), sb = this.sync.socketDef(c.b);
      lines.push([c.name, c.kind, this.node(c.a.node)?.name, sa?.label, c.a.pin != null ? sa?.pinNames?.[c.a.pin] ?? c.a.pin + 1 : 'todos', this.node(c.b.node)?.name, sb?.label, c.b.pin != null ? sb?.pinNames?.[c.b.pin] ?? c.b.pin + 1 : 'todos', this.sync.cableLength(c).toFixed(2).replace('.', ',')].map(esc).join(';'));
    }
    return '﻿' + lines.join('\n');
  }

  /* ============================== avisos ============================== */

  toast(msg: string, kind: Toast['kind'] = ''): void {
    const t = { id: ++this.toastSeq, msg, kind };
    this.toasts.value = [...this.toasts.value.slice(-3), t];
    setTimeout(() => { this.toasts.value = this.toasts.value.filter(x => x.id !== t.id); }, kind === 'err' ? 5500 : 3200);
  }
}

export const app = new Controller();
(window as unknown as { ZeyForge: Controller }).ZeyForge = app;
export type { Controller };
export type { Endpoint };

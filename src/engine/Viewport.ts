// Viewport 3D: renderer PBR, HDRI de estúdio, sombras (direcional + contato), pós-processamento opcional,
// câmeras perspectiva/ortográfica, controles, gizmo, seleção, corte, medição e render fotorrealista.
import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { TransformControls } from 'three/addons/controls/TransformControls.js';
import { CSS2DRenderer, CSS2DObject } from 'three/addons/renderers/CSS2DRenderer.js';
import { clipPlanes } from './materials';
import { ContactShadows } from './contact-shadows';
import { studioHDRI, keyLightDirection, backgroundTexture, type EnvPreset } from './environment';
import { quality, type QualityProfile } from './quality';
import type { PostFX } from './postfx';
import type { PhotoRenderer } from './pathtracer';

export type ViewName = 'front' | 'back' | 'top' | 'bottom' | 'left' | 'right' | 'iso';
export type BackgroundMode = 'dark' | 'light' | 'studio' | 'transparent';

export interface PickHit { object: THREE.Object3D; point: THREE.Vector3; face?: THREE.Face | null; distance: number }

export class Viewport {
  readonly renderer: THREE.WebGLRenderer;
  readonly scene = new THREE.Scene();
  readonly model = new THREE.Group();
  readonly cables = new THREE.Group();
  readonly overlay = new THREE.Group();
  readonly helpers = new THREE.Group();
  readonly persp: THREE.PerspectiveCamera;
  readonly ortho: THREE.OrthographicCamera;
  camera: THREE.PerspectiveCamera | THREE.OrthographicCamera;
  readonly orbit: OrbitControls;
  readonly gizmo: TransformControls;
  readonly labels = new CSS2DRenderer();
  readonly grid = new THREE.Group();
  readonly contact: ContactShadows;
  private sun = new THREE.DirectionalLight('#ffffff', 2.2);
  private selBoxes: THREE.BoxHelper[] = [];
  private raycaster = new THREE.Raycaster();
  private postfx: PostFX | null = null;
  private photo: PhotoRenderer | null = null;
  private photoActive = false;
  private envPreset: EnvPreset = 'studio';
  private bgMode: BackgroundMode = 'dark';
  dragging = false;
  sceneSize = 100;
  onPick: (hit: PickHit | null, e: PointerEvent) => void = () => {};
  onHover: (hit: PickHit | null, e: PointerEvent) => void = () => {};
  onTransform: (o: THREE.Object3D) => void = () => {};
  onTransformEnd: (o: THREE.Object3D) => void = () => {};
  onFrame: () => void = () => {};
  onPhotoProgress: (s: number, t: number) => void = () => {};
  /** grupos considerados para seleção por clique (ordem de prioridade) */
  pickTargets: THREE.Object3D[] = [];

  constructor(readonly el: HTMLElement) {
    const q = quality();
    const r = this.renderer = new THREE.WebGLRenderer({ antialias: true, preserveDrawingBuffer: true, alpha: true, powerPreference: 'high-performance' });
    r.setPixelRatio(Math.min(window.devicePixelRatio, q.pixelRatio));
    r.toneMapping = THREE.NeutralToneMapping;
    r.toneMappingExposure = 1.0;
    r.shadowMap.enabled = true;
    r.shadowMap.type = THREE.PCFShadowMap;
    r.localClippingEnabled = true;
    el.appendChild(r.domElement);
    this.labels.domElement.className = 'vp-labels';
    el.appendChild(this.labels.domElement);

    this.scene.add(this.model, this.cables, this.overlay, this.helpers);
    this.model.name = 'model'; this.cables.name = 'cables';

    this.sun.castShadow = true;
    this.sun.shadow.mapSize.set(q.shadowMap, q.shadowMap);
    this.sun.shadow.bias = -0.0002; this.sun.shadow.normalBias = 0.02; this.sun.shadow.radius = 4;
    this.scene.add(this.sun, this.sun.target);

    this.contact = new ContactShadows(q.contactShadows);
    this.scene.add(this.contact.group);

    const g1 = new THREE.GridHelper(2000, 200, '#2c333e', '#20252d');
    const g2 = new THREE.GridHelper(2000, 20, '#3d4656', '#3d4656');
    [g1, g2].forEach(g => { (g.material as THREE.Material).depthWrite = false; (g.material as THREE.Material).transparent = true; (g.material as THREE.LineBasicMaterial).opacity = g === g1 ? 0.55 : 0.8; });
    this.grid.add(g1, g2);
    this.grid.renderOrder = -2;
    this.scene.add(this.grid);

    const aspect = el.clientWidth / Math.max(1, el.clientHeight);
    this.persp = new THREE.PerspectiveCamera(32, aspect, 0.5, 20000);
    this.persp.position.set(180, 150, 230);
    this.ortho = new THREE.OrthographicCamera(-100, 100, 100, -100, -20000, 20000);
    this.camera = this.persp;

    this.orbit = new OrbitControls(this.camera, r.domElement);
    this.orbit.enableDamping = true; this.orbit.dampingFactor = 0.12;
    this.orbit.screenSpacePanning = true; this.orbit.zoomToCursor = true;
    this.orbit.mouseButtons = { LEFT: THREE.MOUSE.ROTATE, MIDDLE: THREE.MOUSE.PAN, RIGHT: THREE.MOUSE.PAN };
    this.orbit.addEventListener('change', () => { if (this.photoActive) this.photo?.updateCamera(); });

    this.gizmo = new TransformControls(this.camera, r.domElement);
    this.gizmo.setSize(0.8);
    this.gizmo.addEventListener('dragging-changed', e => {
      this.orbit.enabled = !e.value; this.dragging = !!e.value;
      if (!e.value && this.gizmo.object) this.onTransformEnd(this.gizmo.object);
    });
    this.gizmo.addEventListener('objectChange', () => { if (this.gizmo.object) { this.onTransform(this.gizmo.object); this.contact.dirty = true; } });
    this.scene.add(this.gizmo.getHelper());

    this.setEnvironment('studio');
    this.setBackground('dark');
    this.bindPointer();
    new ResizeObserver(() => this.resize()).observe(el);
    this.resize();
    const loop = () => { requestAnimationFrame(loop); this.frame(); };
    loop();
  }

  /* ---------------- qualidade e ambiente ---------------- */

  async applyQuality(q: QualityProfile): Promise<void> {
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, q.pixelRatio));
    this.sun.shadow.mapSize.set(q.shadowMap, q.shadowMap);
    this.sun.shadow.map?.dispose(); (this.sun.shadow as unknown as { map: null }).map = null;
    this.setEnvironment(this.envPreset);
    if (q.ao && !this.postfx) {
      const { PostFX } = await import('./postfx');
      const s = this.size();
      this.postfx = new PostFX(this.renderer, this.scene, this.camera, s.w * this.renderer.getPixelRatio(), s.h * this.renderer.getPixelRatio(), q.msaa, q.smaa);
      this.postfx.setSceneScale(this.sceneSize);
    } else if (!q.ao && this.postfx) { this.postfx.dispose(); this.postfx = null; }
    this.resize();
  }

  setEnvironment(preset: EnvPreset, intensity = 1): void {
    this.envPreset = preset;
    const tex = studioHDRI(preset, quality().hdriWidth);
    this.scene.environment = tex;
    this.scene.environmentIntensity = intensity;
    const d = keyLightDirection(preset);
    this.sunDir.copy(d);
    this.sun.intensity = preset === 'day' ? 3.0 : preset === 'dark' ? 1.2 : 2.0;
    this.updateShadowFrustum();
    if (this.bgMode === 'studio') this.scene.background = tex;
  }
  private sunDir = new THREE.Vector3(0.5, 1, 0.6);

  setEnvironmentRotation(deg: number): void { this.scene.environmentRotation.set(0, deg * Math.PI / 180, 0); this.scene.backgroundRotation.set(0, deg * Math.PI / 180, 0); }
  setExposure(v: number): void { this.renderer.toneMappingExposure = v; }

  setBackground(mode: BackgroundMode): void {
    this.bgMode = mode;
    if (mode === 'dark') this.scene.background = backgroundTexture('#20242b', '#0e1013');
    else if (mode === 'light') this.scene.background = backgroundTexture('#f4f5f7', '#c9cdd3');
    else if (mode === 'studio') { this.scene.background = this.scene.environment; this.scene.backgroundBlurriness = 0.35; this.scene.backgroundIntensity = 0.6; }
    else this.scene.background = null;
  }

  /* ---------------- tamanho e câmeras ---------------- */

  size() { return { w: Math.max(1, this.el.clientWidth), h: Math.max(1, this.el.clientHeight) }; }

  resize(): void {
    const { w, h } = this.size();
    this.renderer.setSize(w, h);
    this.labels.setSize(w, h);
    this.persp.aspect = w / h; this.persp.updateProjectionMatrix();
    this.updateOrtho();
    this.postfx?.setSize(w * this.renderer.getPixelRatio(), h * this.renderer.getPixelRatio());
  }

  private updateOrtho(): void {
    const { w, h } = this.size();
    const dist = this.persp.position.distanceTo(this.orbit.target);
    const H = Math.tan((this.persp.fov * Math.PI) / 360) * dist;
    this.ortho.left = (-H * w) / h; this.ortho.right = (H * w) / h; this.ortho.top = H; this.ortho.bottom = -H;
    this.ortho.updateProjectionMatrix();
  }

  setOrtho(on: boolean): void {
    const target = on ? this.ortho : this.persp;
    if (this.camera === target) return;
    if (on) { this.updateOrtho(); this.ortho.position.copy(this.persp.position); this.ortho.quaternion.copy(this.persp.quaternion); this.ortho.zoom = 1; this.ortho.updateProjectionMatrix(); }
    else this.persp.position.copy(this.ortho.position);
    this.camera = target;
    this.orbit.object = target;
    this.gizmo.camera = target;
    this.postfx?.setCamera(target);
  }

  get isOrtho(): boolean { return this.camera === this.ortho; }

  bounds(objs?: THREE.Object3D[] | null): THREE.Box3 {
    const box = new THREE.Box3();
    (objs && objs.length ? objs : [this.model, this.cables]).forEach(o => box.expandByObject(o));
    return box;
  }

  fit(objs?: THREE.Object3D[] | null, dir?: THREE.Vector3, animate = true): void {
    let box = this.bounds(objs);
    if (box.isEmpty()) box = new THREE.Box3().setFromCenterAndSize(new THREE.Vector3(), new THREE.Vector3(100, 60, 100));
    const c = box.getCenter(new THREE.Vector3());
    const size = box.getSize(new THREE.Vector3()).length() || 100;
    const d = dir ? dir.clone().normalize() : this.camera.position.clone().sub(this.orbit.target).normalize();
    const { w, h } = this.size();
    const dist = (size / (2 * Math.tan((this.persp.fov * Math.PI) / 360))) * 1.1 / Math.min(1, w / h);
    const toPos = c.clone().addScaledVector(d, dist);
    if (!animate) { this.orbit.target.copy(c); this.camera.position.copy(toPos); }
    else this.animateTo(c, toPos);
    if (this.camera === this.ortho) { this.ortho.zoom = 1; this.ortho.updateProjectionMatrix(); }
  }

  private anim: { t0: number; from: [THREE.Vector3, THREE.Vector3]; to: [THREE.Vector3, THREE.Vector3] } | null = null;
  private animateTo(target: THREE.Vector3, pos: THREE.Vector3): void {
    this.anim = { t0: performance.now(), from: [this.orbit.target.clone(), this.camera.position.clone()], to: [target, pos] };
  }

  view(name: ViewName): void {
    const dirs: Record<ViewName, [number, number, number]> = { front: [0, 0, 1], back: [0, 0, -1], top: [0, 1, 0.0001], bottom: [0, -1, 0.0001], right: [1, 0, 0], left: [-1, 0, 0], iso: [1, 0.85, 1.15] };
    this.fit(null, new THREE.Vector3(...dirs[name]));
  }

  /** Recalcula limites da cena (sombras, plano de contato, AO). */
  updateSceneBounds(): void {
    const box = this.bounds([this.model]);
    if (box.isEmpty()) return;
    this.sceneSize = Math.max(20, box.getSize(new THREE.Vector3()).length());
    this.contact.fit(box);
    this.postfx?.setSceneScale(this.sceneSize);
    this.updateShadowFrustum(box);
  }

  private updateShadowFrustum(box = this.bounds([this.model])): void {
    if (box.isEmpty()) return;
    const c = box.getCenter(new THREE.Vector3());
    const s = Math.max(30, box.getSize(new THREE.Vector3()).length() * 0.65);
    const cam = this.sun.shadow.camera;
    cam.left = cam.bottom = -s; cam.right = cam.top = s; cam.near = 0.5; cam.far = s * 8;
    cam.updateProjectionMatrix();
    this.sun.target.position.copy(c);
    this.sun.position.copy(c).addScaledVector(this.sunDir, s * 3);
    this.grid.position.y = Math.min(0, box.min.y) - 0.02;
  }

  /* ---------------- loop ---------------- */

  private frame(): void {
    if (this.anim) {
      const t = Math.min(1, (performance.now() - this.anim.t0) / 380);
      const e = 1 - Math.pow(1 - t, 3);
      this.orbit.target.lerpVectors(this.anim.from[0], this.anim.to[0], e);
      this.camera.position.lerpVectors(this.anim.from[1], this.anim.to[1], e);
      if (t >= 1) this.anim = null;
    }
    this.orbit.update();
    if (this.camera === this.persp) {
      this.updateOrtho();
      const dist = this.persp.position.distanceTo(this.orbit.target);
      const near = Math.max(0.05, dist / 400), far = Math.max(2000, dist * 60);
      if (Math.abs(this.persp.near - near) / near > 0.05 || this.persp.far !== far) { this.persp.near = near; this.persp.far = far; this.persp.updateProjectionMatrix(); }
    } else this.persp.position.copy(this.ortho.position);
    this.selBoxes.forEach(b => b.update());
    this.onFrame();
    if (this.photoActive && this.photo) {
      this.photo.step();
      this.labels.render(this.scene, this.camera);
      return;
    }
    this.contact.render(this.renderer, this.scene, [this.grid, this.helpers, this.overlay, this.gizmo.getHelper()]);
    if (this.postfx) this.postfx.render(); else this.renderer.render(this.scene, this.camera);
    this.labels.render(this.scene, this.camera);
  }

  /* ---------------- seleção ---------------- */

  showSelection(objs: THREE.Object3D[], color = 0x4da3ff): void {
    this.selBoxes.forEach(b => { this.helpers.remove(b); b.dispose(); });
    this.selBoxes = objs.map((o, i) => {
      const b = new THREE.BoxHelper(o, i === 0 ? color : 0x9fd0ff);
      const m = b.material as THREE.LineBasicMaterial; m.depthTest = false; m.transparent = true; m.opacity = 0.9;
      b.renderOrder = 10; this.helpers.add(b); return b;
    });
  }

  attachGizmo(o: THREE.Object3D | null): void { if (o) this.gizmo.attach(o); else this.gizmo.detach(); }

  /* ---------------- picking ---------------- */

  private bindPointer(): void {
    const dom = this.renderer.domElement;
    let down: { x: number; y: number } | null = null;
    dom.addEventListener('pointerdown', e => { down = { x: e.clientX, y: e.clientY }; });
    dom.addEventListener('pointerup', e => {
      if (!down || this.dragging) { down = null; return; }
      const moved = Math.hypot(e.clientX - down.x, e.clientY - down.y); down = null;
      if (moved > 5 || e.button !== 0) return;
      this.onPick(this.pickAt(e.clientX, e.clientY), e);
    });
    dom.addEventListener('pointermove', e => { if (!this.dragging && !(e.buttons & 1)) this.onHover(this.pickAt(e.clientX, e.clientY), e); });
    dom.addEventListener('dblclick', e => { const h = this.pickAt(e.clientX, e.clientY); if (h) this.fit([h.object]); });
  }

  pickAt(cx: number, cy: number, targets?: THREE.Object3D[]): PickHit | null {
    const rect = this.renderer.domElement.getBoundingClientRect();
    const p = new THREE.Vector2(((cx - rect.left) / rect.width) * 2 - 1, -((cy - rect.top) / rect.height) * 2 + 1);
    this.raycaster.setFromCamera(p, this.camera);
    this.raycaster.params.Line = { threshold: 0.5 };
    const list = targets ?? this.pickTargets;
    for (const root of list) {
      if (!root.visible) continue;
      const hits = this.raycaster.intersectObject(root, true).filter(h => {
        let o: THREE.Object3D | null = h.object;
        while (o) { if (!o.visible) return false; o = o.parent; }
        if ((h.object as THREE.Mesh).isMesh && ((h.object as THREE.Mesh).material as THREE.Material)?.userData?.decal) return false;
        if (clipPlanes.length && clipPlanes[0].distanceToPoint(h.point) < 0 && root !== this.overlay) return false;
        return true;
      });
      if (hits.length) return { object: hits[0].object, point: hits[0].point.clone(), face: hits[0].face, distance: hits[0].distance };
    }
    return null;
  }

  /* ---------------- corte ---------------- */

  private clipPlane = new THREE.Plane(new THREE.Vector3(-1, 0, 0), 0);
  private clipHelper: THREE.PlaneHelper | null = null;
  setClip(axis: 'x' | 'y' | 'z' | null, t: number, flip: boolean): void {
    clipPlanes.length = 0;
    if (this.clipHelper) { this.helpers.remove(this.clipHelper); this.clipHelper = null; }
    if (axis) {
      const box = this.bounds([this.model]);
      const n = new THREE.Vector3(axis === 'x' ? 1 : 0, axis === 'y' ? 1 : 0, axis === 'z' ? 1 : 0);
      const pos = box.min[axis] + (box.max[axis] - box.min[axis]) * t;
      this.clipPlane.normal.copy(n).multiplyScalar(flip ? 1 : -1);
      this.clipPlane.constant = flip ? -pos : pos;
      clipPlanes.push(this.clipPlane);
      this.clipHelper = new THREE.PlaneHelper(this.clipPlane, Math.max(40, this.sceneSize * 0.8), 0xff6a3d);
      this.helpers.add(this.clipHelper);
    }
    const side = axis ? THREE.DoubleSide : THREE.FrontSide;
    this.scene.traverse(o => {
      const m = (o as THREE.Mesh).material;
      if (!m || !(o as THREE.Mesh).isMesh || o === this.contact.group) return;
      (Array.isArray(m) ? m : [m]).forEach(mm => { if (mm.clippingPlanes === clipPlanes) { if (!mm.userData.keepSide) mm.side = side; mm.needsUpdate = true; } });
    });
    this.contact.dirty = true;
  }

  /* ---------------- medição ---------------- */

  private measures: THREE.Group[] = [];
  private pending: { a: THREE.Vector3; g: THREE.Group; line: THREE.Line; label: CSS2DObject } | null = null;

  measureClick(p: THREE.Vector3): number | null {
    if (!this.pending) {
      const g = new THREE.Group(); g.add(this.marker(p));
      const line = new THREE.Line(new THREE.BufferGeometry().setFromPoints([p, p.clone()]), new THREE.LineDashedMaterial({ color: 0xffc94d, dashSize: 1.5, gapSize: 0.8, depthTest: false }));
      line.renderOrder = 12; g.add(line);
      const div = document.createElement('div'); div.className = 'measure-label'; div.textContent = '—';
      const label = new CSS2DObject(div); g.add(label);
      this.helpers.add(g);
      this.pending = { a: p.clone(), g, line, label };
      return null;
    }
    const m = this.pending; this.pending = null;
    m.g.add(this.marker(p)); this.setMeasureLine(m, p); this.measures.push(m.g);
    return m.a.distanceTo(p);
  }

  measureHover(p: THREE.Vector3): void { if (this.pending) this.setMeasureLine(this.pending, p); }

  private setMeasureLine(m: { a: THREE.Vector3; line: THREE.Line; label: CSS2DObject }, p: THREE.Vector3): void {
    m.line.geometry.setFromPoints([m.a, p]); m.line.computeLineDistances();
    const d = m.a.distanceTo(p), dx = Math.abs(p.x - m.a.x), dy = Math.abs(p.y - m.a.y), dz = Math.abs(p.z - m.a.z);
    m.label.element.innerHTML = `<b>${d.toFixed(2)} mm</b><span>ΔX ${dx.toFixed(2)} · ΔY ${dy.toFixed(2)} · ΔZ ${dz.toFixed(2)}</span>`;
    m.label.position.copy(m.a).add(p).multiplyScalar(0.5);
  }

  private marker(p: THREE.Vector3): THREE.Mesh {
    const r = Math.max(0.15, this.camera.position.distanceTo(p) * 0.0035);
    const m = new THREE.Mesh(new THREE.SphereGeometry(r, 16, 10), new THREE.MeshBasicMaterial({ color: 0xffc94d, depthTest: false }));
    m.renderOrder = 12; m.position.copy(p); return m;
  }

  cancelMeasure(): void { if (this.pending) { this.disposeGroup(this.pending.g); this.pending = null; } }
  clearMeasures(): void { this.cancelMeasure(); this.measures.forEach(g => this.disposeGroup(g)); this.measures = []; }
  private disposeGroup(g: THREE.Group): void { g.traverse(o => { if (o instanceof CSS2DObject) o.element.remove(); }); this.helpers.remove(g); }

  /* ---------------- render fotorrealista ---------------- */

  async startPhoto(samples: number): Promise<void> {
    if (!this.photo) { const { PhotoRenderer } = await import('./pathtracer'); this.photo = new PhotoRenderer(this.renderer); }
    this.photo.onProgress = (s, t) => this.onPhotoProgress(s, t);
    const hidden = [this.grid, this.helpers, this.overlay, this.gizmo.getHelper(), this.contact.group];
    const vis = hidden.map(o => o.visible); hidden.forEach(o => (o.visible = false));
    this.photoRestore = () => hidden.forEach((o, i) => (o.visible = vis[i]));
    await this.photo.start(this.scene, this.camera, samples);
    this.photoActive = true;
  }
  private photoRestore: (() => void) | null = null;
  stopPhoto(): void { this.photoActive = false; this.photo?.stop(); this.photoRestore?.(); this.photoRestore = null; }
  get photoRunning(): boolean { return this.photoActive; }

  /** Captura PNG (opcionalmente em resolução maior). */
  screenshot(scale = 1): string {
    const prev = this.renderer.getPixelRatio();
    if (scale !== 1 && !this.photoActive) { this.renderer.setPixelRatio(prev * scale); this.resize(); }
    if (!this.photoActive) { if (this.postfx) this.postfx.render(); else this.renderer.render(this.scene, this.camera); }
    const url = this.renderer.domElement.toDataURL('image/png');
    if (scale !== 1 && !this.photoActive) { this.renderer.setPixelRatio(prev); this.resize(); }
    return url;
  }
}

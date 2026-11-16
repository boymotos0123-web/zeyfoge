// Cubo de orientação (ViewCube): mostra a orientação da câmera; clique numa face para a vista correspondente.
import * as THREE from 'three';
import type { ViewName } from './Viewport';

const FACES: { name: ViewName; label: string; normal: THREE.Vector3 }[] = [
  { name: 'right', label: 'DIREITA', normal: new THREE.Vector3(1, 0, 0) },
  { name: 'left', label: 'ESQUERDA', normal: new THREE.Vector3(-1, 0, 0) },
  { name: 'top', label: 'TOPO', normal: new THREE.Vector3(0, 1, 0) },
  { name: 'bottom', label: 'BASE', normal: new THREE.Vector3(0, -1, 0) },
  { name: 'front', label: 'FRENTE', normal: new THREE.Vector3(0, 0, 1) },
  { name: 'back', label: 'TRÁS', normal: new THREE.Vector3(0, 0, -1) },
];

function faceTexture(label: string): THREE.CanvasTexture {
  const c = document.createElement('canvas'); c.width = c.height = 128;
  const g = c.getContext('2d')!;
  const gr = g.createLinearGradient(0, 0, 0, 128); gr.addColorStop(0, '#323a47'); gr.addColorStop(1, '#232933');
  g.fillStyle = gr; g.fillRect(0, 0, 128, 128);
  g.strokeStyle = '#4d5a6e'; g.lineWidth = 4; g.strokeRect(2, 2, 124, 124);
  g.fillStyle = '#d7dee9'; g.font = `700 ${label.length > 6 ? 17 : 20}px Inter, Arial`; g.textAlign = 'center'; g.textBaseline = 'middle';
  g.fillText(label, 64, 66);
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; return t;
}

export class ViewCube {
  private renderer: THREE.WebGLRenderer;
  private scene = new THREE.Scene();
  private cam = new THREE.OrthographicCamera(-1.6, 1.6, 1.6, -1.6, 0.1, 10);
  private cube: THREE.Mesh;
  private ray = new THREE.Raycaster();
  onView: (v: ViewName) => void = () => {};

  constructor(readonly el: HTMLElement, private source: () => THREE.Camera) {
    this.renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
    this.renderer.setPixelRatio(Math.min(2, window.devicePixelRatio));
    this.renderer.setSize(el.clientWidth || 96, el.clientHeight || 96);
    el.appendChild(this.renderer.domElement);
    const mats = FACES.map(f => new THREE.MeshBasicMaterial({ map: faceTexture(f.label) }));
    this.cube = new THREE.Mesh(new THREE.BoxGeometry(2, 2, 2), mats);
    this.scene.add(this.cube);
    const edges = new THREE.LineSegments(new THREE.EdgesGeometry(this.cube.geometry), new THREE.LineBasicMaterial({ color: '#6b7a92' }));
    this.scene.add(edges);
    const axes = new THREE.AxesHelper(1.5); axes.position.set(-1.01, -1.01, -1.01); this.scene.add(axes);
    this.renderer.domElement.addEventListener('click', e => {
      const r = this.renderer.domElement.getBoundingClientRect();
      this.ray.setFromCamera(new THREE.Vector2(((e.clientX - r.left) / r.width) * 2 - 1, -((e.clientY - r.top) / r.height) * 2 + 1), this.cam);
      const hit = this.ray.intersectObject(this.cube)[0];
      if (hit && hit.face) { const idx = Math.floor(hit.faceIndex! / 2); this.onView(FACES[idx].name); }
    });
    const loop = () => { requestAnimationFrame(loop); this.render(); };
    loop();
  }

  private render(): void {
    const src = this.source();
    const dir = new THREE.Vector3(0, 0, 1).applyQuaternion(src.quaternion);
    this.cam.position.copy(dir.multiplyScalar(5));
    this.cam.quaternion.copy(src.quaternion);
    this.renderer.render(this.scene, this.cam);
  }
}

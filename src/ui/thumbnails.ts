// Miniaturas da biblioteca renderizadas a partir do próprio modelo paramétrico (com cache e fila).
import * as THREE from 'three';
import { signal } from '@preact/signals';
import { buildComponent } from '@/library/registry';
import { studioHDRI } from '@/engine/environment';

export const thumbs = signal<Record<string, string>>({});
const queue: string[] = [];
let renderer: THREE.WebGLRenderer | null = null;
let busy = false;

export function requestThumb(type: string): void {
  if (thumbs.value[type] || queue.includes(type)) return;
  queue.push(type);
  if (!busy) setTimeout(drain, 120);
}

function drain(): void {
  busy = true;
  if (!renderer) {
    renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true, preserveDrawingBuffer: true });
    renderer.setSize(128, 128); renderer.setPixelRatio(1);
    renderer.toneMapping = THREE.NeutralToneMapping;
  }
  const scene = new THREE.Scene();
  scene.environment = studioHDRI('studio', 256);
  const cam = new THREE.PerspectiveCamera(28, 1, 0.1, 10000);
  const t0 = performance.now();
  const batch: Record<string, string> = {};
  while (queue.length && performance.now() - t0 < 60) {
    const type = queue.shift()!;
    try {
      const o = buildComponent(type, {});
      scene.add(o);
      const box = new THREE.Box3().setFromObject(o), c = box.getCenter(new THREE.Vector3()), s = box.getSize(new THREE.Vector3()).length();
      cam.position.copy(c).add(new THREE.Vector3(1, 0.9, 1.25).normalize().multiplyScalar(s * 1.6));
      cam.lookAt(c); cam.near = s / 100; cam.far = s * 10; cam.updateProjectionMatrix();
      renderer.render(scene, cam);
      batch[type] = renderer.domElement.toDataURL('image/png');
      scene.remove(o);
    } catch (e) { console.warn('thumb', type, e); }
  }
  if (Object.keys(batch).length) thumbs.value = { ...thumbs.value, ...batch };
  if (queue.length) setTimeout(drain, 16); else busy = false;
}

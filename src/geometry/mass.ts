// Volume, área e centro de massa por integração de tetraedros (malhas fechadas) — resultados em mm³ / mm² / g.
import * as THREE from 'three';
import { materialOf } from '@/core/materials-db';

export interface MassProps { volume: number; area: number; mass: number; centroid: THREE.Vector3 }

const a = new THREE.Vector3(), b = new THREE.Vector3(), c = new THREE.Vector3(), tmp = new THREE.Vector3();

function integrate(geo: THREE.BufferGeometry, m: THREE.Matrix4, acc: { v: number; area: number; cx: number; cy: number; cz: number }): void {
  const pos = geo.attributes.position; if (!pos) return;
  const idx = geo.index;
  const n = idx ? idx.count : pos.count;
  for (let i = 0; i + 2 < n; i += 3) {
    const i0 = idx ? idx.getX(i) : i, i1 = idx ? idx.getX(i + 1) : i + 1, i2 = idx ? idx.getX(i + 2) : i + 2;
    a.fromBufferAttribute(pos, i0).applyMatrix4(m);
    b.fromBufferAttribute(pos, i1).applyMatrix4(m);
    c.fromBufferAttribute(pos, i2).applyMatrix4(m);
    const v = a.dot(tmp.crossVectors(b, c)) / 6;
    acc.v += v;
    acc.cx += v * (a.x + b.x + c.x) / 4; acc.cy += v * (a.y + b.y + c.y) / 4; acc.cz += v * (a.z + b.z + c.z) / 4;
    acc.area += tmp.crossVectors(b.clone().sub(a), c.clone().sub(a)).length() / 2;
  }
}

/** Propriedades de massa de um objeto (em espaço local do "root"). densityOverride em g/cm³. */
export function massProperties(root: THREE.Object3D, densityOverride?: number | null): MassProps {
  root.updateWorldMatrix(true, true);
  const inv = new THREE.Matrix4().copy(root.matrixWorld).invert();
  let mass = 0, volume = 0, area = 0;
  const cm = new THREE.Vector3();
  const local = new THREE.Matrix4(), im = new THREE.Matrix4();
  root.traverse(o => {
    const mesh = o as THREE.Mesh;
    if (!mesh.isMesh || !mesh.geometry || o.userData.noMass) return;
    const m0 = Array.isArray(mesh.material) ? mesh.material[0] : mesh.material;
    const key = (m0?.userData?.matKey as string) || null;
    if (m0?.userData?.decal) return;
    const density = densityOverride ?? (key ? materialOf(key).density : 1.2);
    const mats: THREE.Matrix4[] = [];
    local.copy(inv).multiply(mesh.matrixWorld);
    if ((mesh as THREE.InstancedMesh).isInstancedMesh) {
      const imesh = mesh as THREE.InstancedMesh;
      for (let i = 0; i < imesh.count; i++) { imesh.getMatrixAt(i, im); mats.push(local.clone().multiply(im)); }
    } else mats.push(local.clone());
    for (const mt of mats) {
      const acc = { v: 0, area: 0, cx: 0, cy: 0, cz: 0 };
      integrate(mesh.geometry, mt, acc);
      const vol = Math.abs(acc.v);
      if (vol < 1e-9) continue;
      const g = (vol / 1000) * density; // mm³ → cm³
      volume += vol; area += acc.area; mass += g;
      cm.x += (acc.cx / acc.v) * g; cm.y += (acc.cy / acc.v) * g; cm.z += (acc.cz / acc.v) * g;
    }
  });
  if (mass > 0) cm.divideScalar(mass);
  return { volume, area, mass, centroid: cm };
}

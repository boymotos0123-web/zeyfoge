// Otimização de desempenho: funde malhas estáticas que compartilham o mesmo material (menos draw calls).
import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';

export function mergeByMaterial(root: THREE.Object3D): THREE.Object3D {
  root.updateMatrixWorld(true);
  const inv = new THREE.Matrix4().copy(root.matrixWorld).invert();
  const groups = new Map<THREE.Material, THREE.Mesh[]>();
  root.traverse(o => {
    const m = o as THREE.Mesh;
    if (!m.isMesh || (m as THREE.InstancedMesh).isInstancedMesh || Array.isArray(m.material)) return;
    if (m.material.userData?.decal || m.userData.noMerge || m.geometry.userData.shared) return;
    if (!groups.has(m.material)) groups.set(m.material, []);
    groups.get(m.material)!.push(m);
  });
  for (const [material, meshes] of groups) {
    if (meshes.length < 2) continue;
    const parts: THREE.BufferGeometry[] = [];
    let noMass = true;
    for (const m of meshes) {
      const g = m.geometry.clone().applyMatrix4(new THREE.Matrix4().multiplyMatrices(inv, m.matrixWorld));
      const n = g.index ? g.toNonIndexed() : g;
      for (const k of Object.keys(n.attributes)) if (k !== 'position' && k !== 'normal' && k !== 'uv') n.deleteAttribute(k);
      if (!n.attributes.normal) n.computeVertexNormals();
      if (!n.attributes.uv) n.setAttribute('uv', new THREE.BufferAttribute(new Float32Array(n.attributes.position.count * 2), 2));
      n.clearGroups();
      parts.push(n);
      if (!m.userData.noMass) noMass = false;
    }
    const merged = mergeGeometries(parts, false);
    if (!merged) continue;
    merged.userData.uvMM = true;
    const out = new THREE.Mesh(merged, material);
    out.castShadow = out.receiveShadow = true;
    if (noMass) out.userData.noMass = true;
    meshes.forEach(m => { m.parent?.remove(m); m.geometry.dispose(); });
    parts.forEach(p => p.dispose());
    root.add(out);
  }
  return root;
}

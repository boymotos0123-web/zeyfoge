// Operações booleanas (CSG) — carregado sob demanda.
import * as THREE from 'three';
import { mergeGeometries, mergeVertices } from 'three/addons/utils/BufferGeometryUtils.js';
import { Brush, Evaluator, ADDITION, SUBTRACTION, INTERSECTION } from 'three-bvh-csg';

export type BoolOp = 'union' | 'subtract' | 'intersect';

function clean(g: THREE.BufferGeometry): THREE.BufferGeometry {
  const n = g.index ? g.toNonIndexed() : g.clone();
  for (const k of Object.keys(n.attributes)) if (k !== 'position' && k !== 'normal') n.deleteAttribute(k);
  if (!n.attributes.normal) n.computeVertexNormals();
  n.clearGroups();
  return n;
}

/** Geometria única de um objeto em espaço do mundo (inclui instâncias). */
export function worldGeometry(obj: THREE.Object3D): THREE.BufferGeometry | null {
  obj.updateWorldMatrix(true, true);
  const parts: THREE.BufferGeometry[] = [];
  const im = new THREE.Matrix4();
  obj.traverse(o => {
    const m = o as THREE.Mesh;
    if (!m.isMesh || !m.visible || o.userData.decal) return;
    if ((m as THREE.InstancedMesh).isInstancedMesh) {
      const inst = m as THREE.InstancedMesh;
      for (let i = 0; i < inst.count; i++) { inst.getMatrixAt(i, im); parts.push(clean(m.geometry.clone().applyMatrix4(im).applyMatrix4(m.matrixWorld))); }
    } else parts.push(clean(m.geometry.clone().applyMatrix4(m.matrixWorld)));
  });
  return parts.length ? mergeGeometries(parts, false) : null;
}

const evaluator = new Evaluator();
evaluator.attributes = ['position', 'normal'];
evaluator.useGroups = false;

export function boolean(a: THREE.Object3D, b: THREE.Object3D, op: BoolOp): THREE.BufferGeometry {
  const ga = worldGeometry(a), gb = worldGeometry(b);
  if (!ga || !gb) throw new Error('Seleção sem geometria');
  const A = new Brush(mergeVertices(ga, 1e-4)), B = new Brush(mergeVertices(gb, 1e-4));
  A.updateMatrixWorld(); B.updateMatrixWorld();
  const res = evaluator.evaluate(A, B, op === 'union' ? ADDITION : op === 'subtract' ? SUBTRACTION : INTERSECTION);
  const g = res.geometry as THREE.BufferGeometry;
  if (!g.attributes.position || g.attributes.position.count === 0) throw new Error('Resultado vazio — os objetos se sobrepõem?');
  return g;
}

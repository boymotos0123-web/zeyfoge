// Importação de modelos 3D externos (GLB/GLTF/STL/OBJ) com escolha de unidade e normalização para GLB.
import * as THREE from 'three';

export type ImportKind = 'glb' | 'gltf' | 'stl' | 'obj';

export interface ImportAnalysis {
  name: string;
  kind: ImportKind;
  scene: THREE.Group;
  meshes: number;
  triangles: number;
  materials: number;
  /** tamanho no sistema de unidades do arquivo */
  rawSize: THREE.Vector3;
  rawBox: THREE.Box3;
  suggestedUnit: string;
}

export async function analyzeModel(name: string, data: Uint8Array): Promise<ImportAnalysis> {
  const ext = (name.split('.').pop() || '').toLowerCase() as ImportKind;
  const buf = data.buffer.slice(data.byteOffset, data.byteOffset + data.byteLength) as ArrayBuffer;
  let scene: THREE.Group;
  if (ext === 'glb' || ext === 'gltf') {
    const { GLTFLoader } = await import('three/addons/loaders/GLTFLoader.js');
    const gltf = await new GLTFLoader().parseAsync(ext === 'glb' ? buf : new TextDecoder().decode(buf), '');
    scene = gltf.scene as unknown as THREE.Group;
  } else if (ext === 'stl') {
    const { STLLoader } = await import('three/addons/loaders/STLLoader.js');
    const g = new STLLoader().parse(buf);
    g.rotateX(-Math.PI / 2); // STL é Z-up
    if (!g.attributes.normal) g.computeVertexNormals();
    scene = new THREE.Group();
    scene.add(new THREE.Mesh(g, new THREE.MeshStandardMaterial({ color: '#9aa0a6', metalness: 0.1, roughness: 0.6 })));
  } else if (ext === 'obj') {
    const { OBJLoader } = await import('three/addons/loaders/OBJLoader.js');
    scene = new OBJLoader().parse(new TextDecoder().decode(buf)) as unknown as THREE.Group;
  } else throw new Error(`Formato .${ext} não suportado (use GLB, GLTF, STL ou OBJ)`);
  scene.updateMatrixWorld(true);
  let meshes = 0, triangles = 0; const mats = new Set<string>();
  scene.traverse(o => {
    const m = o as THREE.Mesh; if (!m.isMesh) return;
    meshes++;
    const g = m.geometry; triangles += (g.index ? g.index.count : g.attributes.position.count) / 3;
    (Array.isArray(m.material) ? m.material : [m.material]).forEach(x => mats.add(x.uuid));
  });
  const rawBox = new THREE.Box3().setFromObject(scene);
  const rawSize = rawBox.getSize(new THREE.Vector3());
  const maxDim = Math.max(rawSize.x, rawSize.y, rawSize.z);
  const suggestedUnit = ext === 'glb' || ext === 'gltf' ? (maxDim > 20 ? 'mm' : 'm') : (maxDim < 1 ? 'm' : 'mm');
  return { name, kind: ext, scene, meshes, triangles: Math.round(triangles), materials: mats.size, rawSize, rawBox, suggestedUnit };
}

/** Converte qualquer formato importado em GLB binário (guardado dentro do projeto). */
export async function toGLB(scene: THREE.Group): Promise<Uint8Array> {
  const { GLTFExporter } = await import('three/addons/exporters/GLTFExporter.js');
  const out = await new GLTFExporter().parseAsync(scene, { binary: true, maxTextureSize: 4096 });
  return new Uint8Array(out as ArrayBuffer);
}

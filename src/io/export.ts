// Exportação profissional: STL binário (Z-up, mm), OBJ, glTF/GLB (metros, PBR preservado).
import * as THREE from 'three';
import { materialOf } from '@/core/materials-db';

const MAP_KEYS = ['map', 'normalMap', 'roughnessMap', 'metalnessMap', 'emissiveMap', 'aoMap', 'bumpMap', 'alphaMap', 'clearcoatNormalMap', 'anisotropyMap'] as const;
const converted = new Map<string, THREE.Texture>();

/** Texturas procedurais em DataTexture viram CanvasTexture (o exportador glTF precisa de imagens desenháveis). */
function drawableTexture(t: THREE.Texture): THREE.Texture {
  const img = t.image as { data?: ArrayLike<number>; width: number; height: number } | undefined;
  if (!(t as THREE.DataTexture).isDataTexture || !img?.data || !(img.data instanceof Uint8Array || img.data instanceof Uint8ClampedArray)) return t;
  const hit = converted.get(t.uuid); if (hit) return hit;
  const c = document.createElement('canvas'); c.width = img.width; c.height = img.height;
  c.getContext('2d')!.putImageData(new ImageData(new Uint8ClampedArray(img.data as Uint8Array), img.width, img.height), 0, 0);
  const ct = new THREE.CanvasTexture(c);
  ct.wrapS = t.wrapS; ct.wrapT = t.wrapT; ct.repeat.copy(t.repeat); ct.offset.copy(t.offset); ct.colorSpace = t.colorSpace; ct.flipY = t.flipY;
  converted.set(t.uuid, ct);
  return ct;
}

function prepareMaterials(root: THREE.Object3D): void {
  root.traverse(o => {
    const m = o as THREE.Mesh;
    if (!m.isMesh) return;
    const fix = (mat: THREE.Material) => {
      const c = mat.clone() as THREE.MeshPhysicalMaterial & Record<string, unknown>;
      c.clippingPlanes = null;
      const key = mat.userData?.matKey as string | undefined;
      c.userData = {};
      if (key) c.name = key;
      for (const k of MAP_KEYS) {
        const t = c[k] as THREE.Texture | null | undefined;
        if (!t) continue;
        // micro-acabamentos procedurais (ruído) não fazem sentido em arquivos de troca: viram rugosidade uniforme
        if ((t as THREE.DataTexture).isDataTexture && (k === 'normalMap' || k === 'roughnessMap')) {
          c[k] = null;
          if (k === 'roughnessMap') c.roughness = materialOf(key).roughness;
          continue;
        }
        c[k] = drawableTexture(t);
      }
      return c;
    };
    m.material = Array.isArray(m.material) ? m.material.map(fix) : fix(m.material);
  });
}

/** Clona os objetos com a transformação de mundo aplicada (sem helpers). */
function worldClone(objs: THREE.Object3D[]): THREE.Group {
  const root = new THREE.Group();
  objs.forEach(o => {
    o.updateWorldMatrix(true, true);
    const c = o.clone(true);
    if (o.parent) c.applyMatrix4(o.parent.matrixWorld);
    c.traverse(x => {
      if (x.userData.noExport) x.visible = false;
      // userData guarda referências internas (conteúdo, material base) que não devem ir para o arquivo
      const keep = x.userData.nodeId ? { zeyforgeId: x.userData.nodeId } : {};
      x.userData = keep;
    });
    root.add(c);
  });
  return root;
}

export async function exportSTL(objs: THREE.Object3D[], zUp = true): Promise<Uint8Array> {
  const { STLExporter } = await import('three/addons/exporters/STLExporter.js');
  const root = worldClone(objs);
  if (zUp) root.rotation.x = Math.PI / 2;
  root.updateMatrixWorld(true);
  const dv = new STLExporter().parse(root, { binary: true }) as unknown as DataView;
  return new Uint8Array(dv.buffer, dv.byteOffset, dv.byteLength);
}

export async function exportOBJ(objs: THREE.Object3D[]): Promise<string> {
  const { OBJExporter } = await import('three/addons/exporters/OBJExporter.js');
  const root = worldClone(objs); root.updateMatrixWorld(true);
  return new OBJExporter().parse(root);
}

export async function exportGLTF(objs: THREE.Object3D[], binary: boolean): Promise<Uint8Array | string> {
  const { GLTFExporter } = await import('three/addons/exporters/GLTFExporter.js');
  const root = worldClone(objs);
  prepareMaterials(root);
  root.scale.setScalar(0.001); // glTF usa metros
  root.updateMatrixWorld(true);
  const out = await new GLTFExporter().parseAsync(root, { binary, onlyVisible: true, maxTextureSize: 4096 });
  return binary ? new Uint8Array(out as ArrayBuffer) : JSON.stringify(out, null, 1);
}

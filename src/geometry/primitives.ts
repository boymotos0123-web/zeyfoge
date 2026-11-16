// Primitivas geométricas em mm. Convenção: Y para cima; peças com origem no centro da base.
import * as THREE from 'three';
import { RoundedBoxGeometry } from 'three/addons/geometries/RoundedBoxGeometry.js';
import { mat } from '@/engine/materials';
import { quality } from '@/engine/quality';

export const DEG = Math.PI / 180;
export type MatLike = string | THREE.Material | THREE.Material[];

const resolve = (m: MatLike): THREE.Material | THREE.Material[] => (typeof m === 'string' ? mat(m) : m);

/** Projeção cúbica de UV em milímetros (texturas de acabamento ficam na escala real). */
export function mmUV(g: THREE.BufferGeometry): THREE.BufferGeometry {
  if (g.userData.uvMM) return g;
  const pos = g.attributes.position, nor = g.attributes.normal;
  if (!pos || !nor) return g;
  const uv = new Float32Array(pos.count * 2);
  for (let i = 0; i < pos.count; i++) {
    const nx = Math.abs(nor.getX(i)), ny = Math.abs(nor.getY(i)), nz = Math.abs(nor.getZ(i));
    const x = pos.getX(i), y = pos.getY(i), z = pos.getZ(i);
    if (ny >= nx && ny >= nz) { uv[i * 2] = x; uv[i * 2 + 1] = z; }
    else if (nx >= nz) { uv[i * 2] = z; uv[i * 2 + 1] = y; }
    else { uv[i * 2] = x; uv[i * 2 + 1] = y; }
  }
  g.setAttribute('uv', new THREE.BufferAttribute(uv, 2));
  g.userData.uvMM = true;
  return g;
}

export function mesh(g: THREE.BufferGeometry, m: MatLike, uvMM = true): THREE.Mesh {
  // materiais múltiplos (faces com etiqueta/marcação) mantêm o UV 0..1 por face
  if (uvMM && !Array.isArray(m) && !(g instanceof THREE.ExtrudeGeometry) && !(g instanceof THREE.ShapeGeometry)) mmUV(g);
  const o = new THREE.Mesh(g, resolve(m));
  o.castShadow = true; o.receiveShadow = true;
  return o;
}

export function box(w: number, h: number, d: number, m: MatLike, x = 0, y = 0, z = 0): THREE.Mesh {
  const o = mesh(new THREE.BoxGeometry(w, h, d), m); o.position.set(x, y + h / 2, z); return o;
}

export function rbox(w: number, h: number, d: number, r: number, m: MatLike, x = 0, y = 0, z = 0, seg = 3): THREE.Mesh {
  const rr = Math.max(0.0005, Math.min(r, w / 2 - 1e-4, h / 2 - 1e-4, d / 2 - 1e-4));
  const o = mesh(new RoundedBoxGeometry(w, h, d, seg, rr), m); o.position.set(x, y + h / 2, z); return o;
}

export function cyl(r: number, h: number, m: MatLike, x = 0, y = 0, z = 0, seg = 32, rTop?: number, open = false): THREE.Mesh {
  const o = mesh(new THREE.CylinderGeometry(rTop ?? r, r, h, seg, 1, open), m); o.position.set(x, y + h / 2, z); return o;
}

/** Cilindro deitado ao longo de X (centro em x,y,z). */
export function cylX(r: number, len: number, m: MatLike, x = 0, y = 0, z = 0, seg = 24): THREE.Mesh {
  const o = mesh(new THREE.CylinderGeometry(r, r, len, seg), m); o.rotation.z = Math.PI / 2; o.position.set(x, y, z); return o;
}
/** Cilindro deitado ao longo de Z (centro em x,y,z). */
export function cylZ(r: number, len: number, m: MatLike, x = 0, y = 0, z = 0, seg = 24): THREE.Mesh {
  const o = mesh(new THREE.CylinderGeometry(r, r, len, seg), m); o.rotation.x = Math.PI / 2; o.position.set(x, y, z); return o;
}

export function sphere(r: number, m: MatLike, x = 0, y = 0, z = 0, seg = 32): THREE.Mesh {
  const o = mesh(new THREE.SphereGeometry(r, seg, Math.round(seg * 0.6)), m); o.position.set(x, y, z); return o;
}

export function roundedRectShape(w: number, d: number, r: number, cx = 0, cy = 0): THREE.Shape {
  const s = new THREE.Shape();
  r = Math.max(0, Math.min(r, w / 2 - 1e-4, d / 2 - 1e-4));
  const x = cx - w / 2, y = cy - d / 2;
  s.moveTo(x + r, y);
  s.lineTo(x + w - r, y); if (r) s.absarc(x + w - r, y + r, r, -Math.PI / 2, 0, false);
  s.lineTo(x + w, y + d - r); if (r) s.absarc(x + w - r, y + d - r, r, 0, Math.PI / 2, false);
  s.lineTo(x + r, y + d); if (r) s.absarc(x + r, y + d - r, r, Math.PI / 2, Math.PI, false);
  s.lineTo(x, y + r); if (r) s.absarc(x + r, y + r, r, Math.PI, Math.PI * 1.5, false);
  return s;
}

/** Superelipse por canto (curvatura contínua G2, estilo Apple). */
export function squircleShape(w: number, d: number, r: number, n = 4.6, cx = 0, cy = 0): THREE.Shape {
  r = Math.max(0.01, Math.min(r, w / 2, d / 2));
  const pts: THREE.Vector2[] = [];
  const seg = 18;
  const corner = (ox: number, oy: number, a0: number) => {
    for (let i = 0; i <= seg; i++) {
      const t = a0 + (i / seg) * (Math.PI / 2), c = Math.cos(t), s = Math.sin(t);
      pts.push(new THREE.Vector2(cx + ox + r * Math.sign(c) * Math.abs(c) ** (2 / n), cy + oy + r * Math.sign(s) * Math.abs(s) ** (2 / n)));
    }
  };
  corner(w / 2 - r, d / 2 - r, 0); corner(-w / 2 + r, d / 2 - r, Math.PI / 2);
  corner(-w / 2 + r, -d / 2 + r, Math.PI); corner(w / 2 - r, -d / 2 + r, Math.PI * 1.5);
  const s = new THREE.Shape(pts); s.closePath(); return s;
}

export function circlePath(r: number, x = 0, y = 0): THREE.Path {
  const p = new THREE.Path(); p.absarc(x, y, r, 0, Math.PI * 2, true); return p;
}

export function holeFromShape(s: THREE.Shape, divisions = 48): THREE.Path {
  return new THREE.Path(s.getPoints(divisions).reverse());
}

/** Extruda um Shape do plano XY para cima (Y). Shape Y → −Z do mundo. Base em y=0. */
export function extrudeUp(shape: THREE.Shape | THREE.Shape[], height: number, m: MatLike, bevel = 0, curveSegments?: number): THREE.Mesh {
  const b = Math.max(0, Math.min(bevel, height / 2 - 1e-4));
  const g = new THREE.ExtrudeGeometry(shape, {
    depth: Math.max(1e-4, height - 2 * b), bevelEnabled: b > 0, bevelThickness: b, bevelSize: b,
    bevelSegments: b > 0 ? 4 : 0, curveSegments: curveSegments ?? quality().curveSegments,
  });
  g.translate(0, 0, b);
  g.rotateX(-Math.PI / 2);
  g.computeVertexNormals();
  return mesh(g, m);
}

/** Face plana (tampa) de um Shape, voltada para +Y, na altura y. */
export function shapeTop(shape: THREE.Shape, y: number, m: MatLike, curveSegments?: number): THREE.Mesh {
  const g = new THREE.ShapeGeometry(shape, curveSegments ?? quality().curveSegments);
  g.rotateX(-Math.PI / 2);
  const o = mesh(g, m, false); o.position.y = y; o.castShadow = false; return o;
}

/** Sólido de revolução em torno de Y a partir de um perfil [raio, altura]. */
export function lathe(profile: [number, number][], m: MatLike, seg = 48): THREE.Mesh {
  return mesh(new THREE.LatheGeometry(profile.map(([r, y]) => new THREE.Vector2(r, y)), seg), m);
}

export function group(...children: (THREE.Object3D | null | undefined | false)[]): THREE.Group {
  const g = new THREE.Group();
  children.forEach(c => c && g.add(c));
  return g;
}

export function at<T extends THREE.Object3D>(o: T, x = 0, y = 0, z = 0, ry = 0): T {
  o.position.set(x, y, z); if (ry) o.rotation.y = ry; return o;
}

/** Instancia uma geometria N vezes (performance para pinos, furos, teclas). */
export function instanced(g: THREE.BufferGeometry, m: MatLike, matrices: THREE.Matrix4[]): THREE.InstancedMesh {
  mmUV(g);
  const im = new THREE.InstancedMesh(g, resolve(m) as THREE.Material, Math.max(1, matrices.length));
  matrices.forEach((mt, i) => im.setMatrixAt(i, mt));
  im.count = matrices.length;
  im.castShadow = true; im.receiveShadow = true;
  im.instanceMatrix.needsUpdate = true;
  return im;
}

export const T = (x: number, y: number, z: number, ry = 0): THREE.Matrix4 => {
  const m = new THREE.Matrix4().makeRotationY(ry); m.setPosition(x, y, z); return m;
};

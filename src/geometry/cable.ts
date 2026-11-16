// Geometria 3D de cabos: flat flex (FPC) com trilhas e enrijecedores, fita IDC com nervuras, fios com
// isolação e conectores Dupont, cabo USB redondo. Tudo segue a rota calculada em connect/route.ts.
import * as THREE from 'three';
import type { Cable, SocketDef } from '@/core/types';
import type { Route } from '@/connect/route';
import { mat } from '@/engine/materials';
import { clipPlanes } from '@/engine/materials';
import { canvasTexture, makeCanvas } from '@/engine/textures/canvas';

const texCache = new Map<string, THREE.Texture>();

function stripeTexture(kind: 'fpc' | 'ribbon', conductors: number): THREE.Texture {
  const key = kind + conductors;
  const hit = texCache.get(key); if (hit) return hit;
  const per = kind === 'fpc' ? 12 : 16;
  const H = Math.min(4096, Math.max(16, conductors * per)), W = 8;
  const c = makeCanvas(W, H), g = c.getContext('2d')!;
  if (kind === 'fpc') {
    g.fillStyle = '#b4610c'; g.fillRect(0, 0, W, H);
    for (let i = 0; i < conductors; i++) { const y = (i + 0.5) * H / conductors; g.fillStyle = '#d99a42'; g.fillRect(0, y - H / conductors * 0.22, W, H / conductors * 0.44); }
    g.fillStyle = '#8f4a06'; g.fillRect(0, 0, W, H * 0.03); g.fillRect(0, H * 0.97, W, H * 0.03);
  } else {
    for (let i = 0; i < conductors; i++) {
      const y0 = i * H / conductors, h = H / conductors;
      const grd = g.createLinearGradient(0, y0, 0, y0 + h);
      const base = i === 0 ? ['#8e1d1d', '#d23a3a', '#8e1d1d'] : ['#7d8185', '#b7bbbf', '#7d8185'];
      grd.addColorStop(0, base[0]); grd.addColorStop(0.5, base[1]); grd.addColorStop(1, base[2]);
      g.fillStyle = grd; g.fillRect(0, y0, W, h);
    }
  }
  const t = canvasTexture(c, true, 8);
  t.wrapS = THREE.RepeatWrapping; t.wrapT = THREE.ClampToEdgeWrapping;
  texCache.set(key, t);
  return t;
}

const matCache = new Map<string, THREE.Material>();
function cableMaterial(c: Cable): THREE.Material {
  const key = `${c.kind}|${c.conductors}|${c.color}`;
  const hit = matCache.get(key); if (hit) return hit;
  let m: THREE.MeshPhysicalMaterial;
  if (c.kind === 'fpc') {
    m = new THREE.MeshPhysicalMaterial({ map: stripeTexture('fpc', c.conductors), roughness: 0.3, metalness: 0.15, clearcoat: 0.8, clearcoatRoughness: 0.15, side: THREE.DoubleSide });
    if (c.color) m.color.set(c.color);
  } else if (c.kind === 'ribbon') {
    const t = stripeTexture('ribbon', c.conductors);
    m = new THREE.MeshPhysicalMaterial({ map: t, bumpMap: t, bumpScale: 0.6, roughness: 0.55, side: THREE.DoubleSide });
  } else {
    m = new THREE.MeshPhysicalMaterial({ color: c.color || (c.kind === 'usb' ? '#1d1e21' : '#e9ebee'), roughness: 0.45, clearcoat: 0.3, sheen: 0.2 });
  }
  m.clippingPlanes = clipPlanes;
  matCache.set(key, m);
  return m;
}

/** Fita retangular ao longo da rota (largura W, espessura N). UV: u = comprimento/10, v = 0..1 na largura. */
export function ribbonGeometry(r: Route, width: number, thickness: number, from = 0, to = r.points.length): THREE.BufferGeometry {
  const pos: number[] = [], nor: number[] = [], uv: number[] = [], idx: number[] = [];
  const hw = width / 2, ht = thickness / 2;
  const faces: { sw: number; sn: number; nx: 'W' | 'N'; sign: number }[] = [
    { sw: 1, sn: 1, nx: 'N', sign: 1 },   // topo
    { sw: 1, sn: -1, nx: 'N', sign: -1 }, // base
    { sw: 1, sn: 1, nx: 'W', sign: 1 },   // lateral +W
    { sw: -1, sn: 1, nx: 'W', sign: -1 }, // lateral -W
  ];
  const p = new THREE.Vector3(), q = new THREE.Vector3();
  for (const f of faces) {
    const start = pos.length / 3;
    for (let i = from; i < to; i++) {
      const P = r.points[i], W = r.widths[i], N = r.normals[i];
      const u = r.s[i] / 10;
      if (f.nx === 'N') {
        p.copy(P).addScaledVector(W, -hw).addScaledVector(N, f.sn * ht);
        q.copy(P).addScaledVector(W, hw).addScaledVector(N, f.sn * ht);
        pos.push(p.x, p.y, p.z, q.x, q.y, q.z);
        const n = N.clone().multiplyScalar(f.sign); nor.push(n.x, n.y, n.z, n.x, n.y, n.z);
        uv.push(u, f.sign > 0 ? 0 : 1, u, f.sign > 0 ? 1 : 0);
      } else {
        p.copy(P).addScaledVector(W, f.sw * hw).addScaledVector(N, -ht);
        q.copy(P).addScaledVector(W, f.sw * hw).addScaledVector(N, ht);
        pos.push(p.x, p.y, p.z, q.x, q.y, q.z);
        const n = W.clone().multiplyScalar(f.sign); nor.push(n.x, n.y, n.z, n.x, n.y, n.z);
        uv.push(u, 0, u, 0.02);
      }
    }
    const count = to - from;
    for (let i = 0; i < count - 1; i++) {
      const a = start + i * 2, b = a + 1, c2 = a + 2, d = a + 3;
      if (f.sign > 0) idx.push(a, c2, b, b, c2, d); else idx.push(a, b, c2, b, d, c2);
    }
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  g.setAttribute('normal', new THREE.Float32BufferAttribute(nor, 3));
  g.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2));
  g.setIndex(idx);
  return g;
}

/** Bloco orientado pelo referencial da rota no índice i (para enrijecedores, contatos, conectores). */
function frameBox(r: Route, i: number, along: number, width: number, height: number, material: THREE.Material | string, offsetAlong = 0, offsetN = 0): THREE.Mesh {
  const m = new THREE.Mesh(new THREE.BoxGeometry(width, height, along), typeof material === 'string' ? mat(material) : material);
  const T = r.tangents[i], W = r.widths[i], N = r.normals[i];
  const basis = new THREE.Matrix4().makeBasis(W, N, T);
  m.quaternion.setFromRotationMatrix(basis);
  m.position.copy(r.points[i]).addScaledVector(T, offsetAlong).addScaledVector(N, offsetN);
  m.castShadow = true; m.receiveShadow = true;
  return m;
}

export interface EndInfo { socket: SocketDef }

export function buildCableObject(c: Cable, r: Route, a: EndInfo, b: EndInfo): THREE.Group {
  const g = new THREE.Group();
  g.name = c.name;
  const material = cableMaterial(c);
  const last = r.points.length - 1;
  if (c.kind === 'fpc' || c.kind === 'ribbon') {
    const body = new THREE.Mesh(ribbonGeometry(r, c.width, c.thickness), material);
    body.castShadow = true; body.receiveShadow = true;
    (material as THREE.MeshPhysicalMaterial).map?.repeat.set(1, 1);
    g.add(body);
    for (const [end, info] of [[0, a], [last, b]] as const) {
      const dir = end === 0 ? 1 : -1;
      const term = info.socket.termination ?? (c.kind === 'ribbon' ? 'pin' : 'zif');
      if (c.kind === 'ribbon') {
        // conector IDC prensado
        g.add(frameBox(r, end, 6, c.width + 2.6, 5.6, 'pbt_preto', dir * 3, 0));
        g.add(frameBox(r, end, 1.2, c.width * 0.6, 1.2, 'pbt_preto', dir * 3, 3.2));
      } else if (term === 'btb') {
        g.add(frameBox(r, end, 3.4, c.width + 0.6, 0.25, 'aco_inox', dir * 1.2, c.thickness));
        g.add(frameBox(r, end, 2.4, Math.max(c.width * 0.9, 3), 0.7, 'lcp_preto', dir * 1.2, -0.45));
      } else if (term === 'zif') {
        g.add(frameBox(r, end, 3.5, c.width, 0.2, 'poliimida', dir * 1.75, c.thickness * 0.5 + 0.1));
        g.add(frameBox(r, end, 1.6, c.width * 0.92, 0.02, 'ouro', dir * 0.8, -c.thickness * 0.5 - 0.01));
      }
      if (c.stiffener && term !== 'solder' && c.kind === 'fpc') g.add(frameBox(r, end, 5, c.width, 0.15, 'abs_preto', dir * 5.5, c.thickness * 0.5 + 0.08));
    }
  } else {
    // fio redondo / cabo USB
    const radius = c.thickness / 2;
    const tube = new THREE.Mesh(new THREE.TubeGeometry(r.curve, Math.min(600, r.points.length * 2), radius, c.kind === 'usb' ? 16 : 10, false), material);
    tube.castShadow = true; tube.receiveShadow = true;
    g.add(tube);
    for (const [end, info] of [[0, a], [last, b]] as const) {
      const dir = end === 0 ? -1 : 1; // conector fica "antes" do início do cabo
      const term = info.socket.termination ?? 'pin';
      if (c.kind === 'usb') {
        g.add(frameBox(r, end, 14, 12, 6.5, 'abs_preto', dir * 7.5, 0));
        g.add(frameBox(r, end, 6.5, 8.2, 2.4, 'aco_inox', dir * 17, 0));
      } else if (term === 'pin' || term === 'zif') {
        g.add(frameBox(r, end, 14, 2.5, 2.5, 'pbt_preto', dir * 7, 0));
        if (info.socket.kind === 'header-female') g.add(frameBox(r, end, 6, 0.64, 0.64, 'ouro', dir * 17, 0));
      } else if (term === 'solder') {
        g.add(frameBox(r, end, 2, radius * 1.6, radius * 1.6, 'estanho', dir * 1, 0));
      }
    }
  }
  g.traverse(o => { if ((o as THREE.Mesh).isMesh) o.userData.cableId = c.id; });
  g.userData.cableId = c.id;
  return g;
}

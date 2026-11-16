// Roteamento de cabos: curva suave (Catmull-Rom centrípeta) com saídas retas nos conectores,
// referenciais com transporte paralelo para fitas (largura acompanha o eixo do conector) e análise de curvatura.
import * as THREE from 'three';
import type { Cable, Vec3 } from '@/core/types';

export interface SocketFrame { pos: THREE.Vector3; normal: THREE.Vector3; axis: THREE.Vector3 }

export interface Route {
  curve: THREE.CatmullRomCurve3;
  points: THREE.Vector3[];
  tangents: THREE.Vector3[];
  widths: THREE.Vector3[];   // direção da largura (W)
  normals: THREE.Vector3[];  // direção da espessura (N = T × W)
  s: number[];               // comprimento acumulado (mm)
  length: number;
  minRadius: number;         // dobra pela espessura
  inPlaneRadius: number;     // dobra lateral (no plano da fita)
}

const v = (a: Vec3) => new THREE.Vector3(...a);

export function controlPoints(c: Cable, A: SocketFrame, B: SocketFrame, startOffset = 0, endOffset = 0): THREE.Vector3[] {
  const a0 = A.pos.clone().addScaledVector(A.normal, startOffset);
  const b0 = B.pos.clone().addScaledVector(B.normal, endOffset);
  const lead = Math.max(0.5, c.lead);
  const a1 = a0.clone().addScaledVector(A.normal, lead);
  const b1 = b0.clone().addScaledVector(B.normal, lead);
  const pts = [a0, a0.clone().addScaledVector(A.normal, lead * 0.45), a1];
  if (c.waypoints.length) c.waypoints.forEach(w => pts.push(v(w)));
  else {
    const dist = a1.distanceTo(b1);
    const mid = a1.clone().add(b1).multiplyScalar(0.5);
    const bow = A.normal.clone().add(B.normal);
    if (bow.lengthSq() < 1e-4) bow.copy(A.axis).cross(A.normal); // normais opostas: barriga lateral
    if (bow.lengthSq() < 1e-4) bow.set(0, 1, 0);
    bow.normalize();
    if (c.slack > 0 && dist > 1) pts.push(mid.addScaledVector(bow, dist * c.slack));
  }
  pts.push(b1, b0.clone().addScaledVector(B.normal, lead * 0.45), b0);
  // remove pontos coincidentes (evita tangente indefinida)
  return pts.filter((p, i) => i === 0 || p.distanceTo(pts[i - 1]) > 1e-3);
}

export function buildRoute(c: Cable, A: SocketFrame, B: SocketFrame, opts: { startOffset?: number; endOffset?: number; step?: number } = {}): Route {
  const cps = controlPoints(c, A, B, opts.startOffset ?? 0, opts.endOffset ?? 0);
  if (cps.length < 2) cps.push(cps[0].clone().add(new THREE.Vector3(0, 0.01, 0)));
  const curve = new THREE.CatmullRomCurve3(cps, false, 'centripetal', 0.5);
  const length = curve.getLength();
  const n = Math.max(24, Math.min(600, Math.round(length / (opts.step ?? 0.6))));
  const points = curve.getSpacedPoints(n);
  const tangents: THREE.Vector3[] = points.map((_, i) => {
    const a = points[Math.max(0, i - 1)], b = points[Math.min(points.length - 1, i + 1)];
    const t = b.clone().sub(a); return t.lengthSq() > 1e-12 ? t.normalize() : new THREE.Vector3(0, 0, 1);
  });
  tangents[0] = A.normal.clone().normalize();
  tangents[tangents.length - 1] = B.normal.clone().negate().normalize();

  // transporte paralelo da direção de largura
  const widths: THREE.Vector3[] = [];
  let w = A.axis.clone().addScaledVector(tangents[0], -A.axis.dot(tangents[0]));
  if (w.lengthSq() < 1e-8) w = new THREE.Vector3(0, 1, 0).cross(tangents[0]);
  w.normalize();
  widths.push(w.clone());
  for (let i = 1; i < points.length; i++) {
    const t = tangents[i];
    w = w.clone().addScaledVector(t, -w.dot(t));
    if (w.lengthSq() < 1e-10) w = widths[i - 1].clone();
    widths.push(w.normalize());
  }
  // distribui a torção necessária para alinhar com o eixo do conector final (simetria de 180°)
  const tn = tangents[tangents.length - 1];
  const target = B.axis.clone().addScaledVector(tn, -B.axis.dot(tn)).normalize();
  const wn = widths[widths.length - 1];
  let ang = Math.atan2(new THREE.Vector3().crossVectors(wn, target).dot(tn), wn.dot(target));
  if (ang > Math.PI / 2) ang -= Math.PI; else if (ang < -Math.PI / 2) ang += Math.PI;
  const s: number[] = [0];
  for (let i = 1; i < points.length; i++) s.push(s[i - 1] + points[i].distanceTo(points[i - 1]));
  const total = s[s.length - 1] || 1;
  const q = new THREE.Quaternion();
  for (let i = 0; i < widths.length; i++) { q.setFromAxisAngle(tangents[i], ang * (s[i] / total)); widths[i].applyQuaternion(q).normalize(); }
  const normals = tangents.map((t, i) => new THREE.Vector3().crossVectors(t, widths[i]).normalize());

  // curvatura
  let minRadius = Infinity, inPlaneRadius = Infinity;
  for (let i = 2; i < points.length - 2; i++) {
    const ds = s[i + 1] - s[i - 1];
    if (ds < 1e-6) continue;
    const dT = tangents[i + 1].clone().sub(tangents[i - 1]).divideScalar(ds);
    const kN = Math.abs(dT.dot(normals[i])), kW = Math.abs(dT.dot(widths[i]));
    if (kN > 1e-6) minRadius = Math.min(minRadius, 1 / kN);
    if (kW > 1e-6) inPlaneRadius = Math.min(inPlaneRadius, 1 / kW);
  }
  return { curve, points, tangents, widths, normals, s, length: total, minRadius, inPlaneRadius };
}

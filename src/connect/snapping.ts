// Encaixe magnético: ao arrastar uma peça, encontra o par de encaixes compatível mais próximo e alinha as posições.
import * as THREE from 'three';
import type { Id, ZDocument } from '@/core/types';
import { canMate } from '@/core/connectivity';
import { descendants, isEffectivelyVisible } from '@/core/document';
import type { SceneSync } from '@/engine/scene-sync';

export interface SnapResult { delta: THREE.Vector3; from: THREE.Vector3; to: THREE.Vector3; label: string; distance: number }

export function findSnap(doc: ZDocument, sync: SceneSync, movingId: Id, threshold: number): SnapResult | null {
  const moving = new Set([movingId, ...descendants(doc, movingId).map(d => d.id)]);
  const mine: { pos: THREE.Vector3; normal: THREE.Vector3; kind: string; label: string }[] = [];
  const others: typeof mine = [];
  for (const n of doc.nodes) {
    if (!isEffectivelyVisible(doc, n)) continue;
    const list = moving.has(n.id) ? mine : others;
    for (const s of sync.socketDefs(n)) {
      const f = sync.socketFrame({ node: n.id, socket: s.id }, s);
      if (f) list.push({ pos: f.pos, normal: f.normal, kind: s.kind, label: `${n.name} · ${s.label}` });
    }
  }
  let best: SnapResult | null = null;
  for (const a of mine) for (const b of others) {
    if (!canMate(a.kind as never, b.kind as never)) continue;
    if (a.normal.dot(b.normal) > -0.7) continue;
    const d = a.pos.distanceTo(b.pos);
    if (d < threshold && (!best || d < best.distance)) best = { delta: b.pos.clone().sub(a.pos), from: a.pos.clone(), to: b.pos.clone(), label: b.label, distance: d };
  }
  return best;
}

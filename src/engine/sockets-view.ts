// Marcadores visuais de encaixes e pinos (modo de conexão / edição), com destaque ao passar o mouse.
import * as THREE from 'three';
import type { Endpoint, SocketDef } from '@/core/types';
import { SOCKET_KIND_COLOR, pinType, wireColor } from '@/core/connectivity';
import type { SocketFrame } from '@/connect/route';

export interface MarkerEntry { endpoint: Endpoint; def: SocketDef; frame: SocketFrame; label: string }

const coneGeo = new THREE.ConeGeometry(0.75, 2.2, 16); coneGeo.translate(0, 1.1, 0); coneGeo.userData.shared = true;
const ringGeo = new THREE.TorusGeometry(1.1, 0.18, 8, 24); ringGeo.userData.shared = true;
const pinGeo = new THREE.SphereGeometry(0.62, 14, 10); pinGeo.userData.shared = true;

export class SocketMarkers {
  readonly group = new THREE.Group();
  private hovered: THREE.Object3D | null = null;
  private selected: THREE.Object3D | null = null;

  constructor() { this.group.name = 'socket-markers'; this.group.renderOrder = 20; }

  set(entries: MarkerEntry[], scale: number): void {
    this.clear();
    for (const e of entries) {
      const isPin = e.endpoint.pin != null;
      const color = isPin ? wireColor(pinType(e.def, e.endpoint.pin!)) : SOCKET_KIND_COLOR[e.def.kind];
      const material = new THREE.MeshBasicMaterial({ color, depthTest: false, transparent: true, opacity: 0.92 });
      const o = new THREE.Group();
      if (isPin) o.add(new THREE.Mesh(pinGeo, material));
      else {
        const cone = new THREE.Mesh(coneGeo, material);
        cone.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), e.frame.normal);
        const ring = new THREE.Mesh(ringGeo, material);
        ring.quaternion.setFromUnitVectors(new THREE.Vector3(0, 0, 1), e.frame.normal);
        o.add(cone, ring);
      }
      o.position.copy(e.frame.pos);
      o.scale.setScalar(scale);
      o.renderOrder = 20;
      o.traverse(m => { m.renderOrder = 20; m.userData.marker = e; });
      o.userData.marker = e;
      this.group.add(o);
    }
  }

  markerOf(obj: THREE.Object3D | null | undefined): MarkerEntry | null {
    let o: THREE.Object3D | null | undefined = obj;
    while (o) { if (o.userData.marker) return o.userData.marker as MarkerEntry; o = o.parent; }
    return null;
  }

  private rootOf(e: MarkerEntry | null): THREE.Object3D | null {
    if (!e) return null;
    return this.group.children.find(c => c.userData.marker === e) ?? null;
  }

  hover(e: MarkerEntry | null): void {
    if (this.hovered && this.hovered !== this.selected) this.hovered.scale.divideScalar(1.6);
    this.hovered = this.rootOf(e);
    if (this.hovered && this.hovered !== this.selected) this.hovered.scale.multiplyScalar(1.6);
  }

  select(e: MarkerEntry | null): void {
    if (this.selected) this.selected.traverse(m => { const mm = (m as THREE.Mesh).material as THREE.MeshBasicMaterial | undefined; if (mm) mm.color.set(mm.userData.base ?? mm.color); });
    this.selected = this.rootOf(e);
    if (this.selected) this.selected.traverse(m => { const mm = (m as THREE.Mesh).material as THREE.MeshBasicMaterial | undefined; if (mm) { mm.userData.base = '#' + mm.color.getHexString(); mm.color.set('#ffffff'); } });
  }

  clear(): void {
    this.group.children.forEach(c => c.traverse(m => ((m as THREE.Mesh).material as THREE.Material | undefined)?.dispose()));
    this.group.clear(); this.hovered = null; this.selected = null;
  }
}

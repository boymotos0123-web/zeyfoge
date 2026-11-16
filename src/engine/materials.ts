// Fábrica de materiais PBR a partir do banco físico (core/materials-db) + texturas procedurais.
import * as THREE from 'three';
import { MATERIALS, materialOf } from '@/core/materials-db';
import { finishMaps } from './textures/finish';
import { quality } from './quality';
import type { PcbMaps } from './textures/pcb';

/** Planos de corte compartilhados por todos os materiais do modelo. */
export const clipPlanes: THREE.Plane[] = [];

const cache = new Map<string, THREE.MeshPhysicalMaterial>();

export function buildMaterial(key: string, color?: string | null): THREE.MeshPhysicalMaterial {
  const d = materialOf(key);
  const m = new THREE.MeshPhysicalMaterial({
    color: new THREE.Color(color || d.color),
    metalness: d.metalness,
    roughness: d.roughness,
    transmission: d.transmission ?? 0,
    ior: d.ior ?? 1.5,
    thickness: d.thickness ?? 0,
    clearcoat: d.clearcoat ?? 0,
    clearcoatRoughness: d.clearcoatRoughness ?? 0.08,
    specularIntensity: d.specularIntensity ?? 1,
    emissive: new THREE.Color(d.emissive || '#000000'),
    emissiveIntensity: d.emissiveIntensity ?? 0,
    sheen: d.sheen ?? 0,
  });
  if (d.attenuationColor) { m.attenuationColor = new THREE.Color(d.attenuationColor); m.attenuationDistance = d.attenuationDistance ?? Infinity; }
  if (d.dispersion) m.dispersion = d.dispersion;
  if (d.iridescence) { m.iridescence = d.iridescence; m.iridescenceIOR = d.iridescenceIOR ?? 1.3; (m as unknown as { iridescenceThicknessMinimum: number }).iridescenceThicknessMinimum = 180; (m as unknown as { iridescenceThicknessMaximum: number }).iridescenceThicknessMaximum = 520; }
  if (d.anisotropy) { m.anisotropy = d.anisotropy; m.anisotropyRotation = 0; }
  const f = d.finish && d.finish !== 'none' ? finishMaps(d.finish, d.roughness, d.finishStrength ?? 0.6, quality().finishTexture) : null;
  if (f) {
    m.normalMap = f.normal; m.normalScale = new THREE.Vector2(f.normalScale, f.normalScale);
    m.roughnessMap = f.roughness; m.roughness = 1;
    if (f.color) m.map = f.color;
    if (d.anisotropy) m.anisotropyMap = null;
  }
  m.clippingPlanes = clipPlanes;
  m.clipShadows = true;
  m.userData.matKey = key;
  m.name = key;
  return m;
}

/** Material compartilhado (cache). Não modifique a instância retornada. */
export function mat(key: string): THREE.MeshPhysicalMaterial {
  let m = cache.get(key);
  if (!m) { m = buildMaterial(key); cache.set(key, m); }
  return m;
}

export function cloneMaterial<T extends THREE.Material>(m: T): T {
  const c = m.clone() as T;
  c.clippingPlanes = clipPlanes;
  c.userData = { ...m.userData };
  return c;
}

/** Superfície superior de PCB com mapas gerados. */
export function pcbMaterial(maps: PcbMaps, maskKey: string): THREE.MeshPhysicalMaterial {
  const d = materialOf(maskKey);
  const m = new THREE.MeshPhysicalMaterial({
    map: maps.map, roughnessMap: maps.rm, metalnessMap: maps.rm, bumpMap: maps.bump, bumpScale: 0.035,
    roughness: 1, metalness: 1, clearcoat: d.clearcoat ?? 0.5, clearcoatRoughness: 0.12,
  });
  m.clippingPlanes = clipPlanes; m.clipShadows = true;
  m.userData.matKey = maskKey;
  m.name = 'pcb:' + maskKey;
  return m;
}

/** Material com textura de marcação (chips, etiquetas). */
export function labelMaterial(map: THREE.Texture, baseKey: string, rough?: THREE.Texture, transparent = false): THREE.MeshPhysicalMaterial {
  const d = materialOf(baseKey);
  const m = new THREE.MeshPhysicalMaterial({
    map, color: '#ffffff', metalness: transparent ? 0 : d.metalness, roughness: rough ? 1 : d.roughness, roughnessMap: rough ?? null,
    clearcoat: d.clearcoat ?? 0, transparent, depthWrite: !transparent,
  });
  if (transparent) { m.polygonOffset = true; m.polygonOffsetFactor = -2; m.polygonOffsetUnits = -2; }
  m.clippingPlanes = clipPlanes;
  m.userData.matKey = baseKey;
  m.userData.decal = transparent;
  return m;
}

export function invalidateMaterials(): void { cache.forEach(m => m.dispose()); cache.clear(); }

export function materialKeys(): string[] { return Object.keys(MATERIALS); }

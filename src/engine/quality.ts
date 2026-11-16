// Perfis de qualidade. Web = abre rápido em qualquer aparelho. Nativo = qualidade máxima com GPU dedicada.
export type QualityLevel = 'fast' | 'balanced' | 'max';

export interface QualityProfile {
  level: QualityLevel;
  label: string;
  pixelRatio: number;
  hdriWidth: number;
  shadowMap: number;
  contactShadows: number;
  ao: boolean;
  smaa: boolean;
  msaa: number;
  /** pixels por mm nas texturas procedurais de PCB */
  pcbPxPerMM: number;
  maxTexture: number;
  finishTexture: number;
  anisotropy: number;
  curveSegments: number;
}

export const PROFILES: Record<QualityLevel, QualityProfile> = {
  fast:     { level: 'fast', label: 'Rápida (web / celular simples)', pixelRatio: 1.25, hdriWidth: 512, shadowMap: 1024, contactShadows: 512, ao: false, smaa: false, msaa: 0, pcbPxPerMM: 6, maxTexture: 2048, finishTexture: 512, anisotropy: 4, curveSegments: 16 },
  balanced: { level: 'balanced', label: 'Equilibrada', pixelRatio: 1.75, hdriWidth: 1024, shadowMap: 2048, contactShadows: 1024, ao: true, smaa: false, msaa: 4, pcbPxPerMM: 10, maxTexture: 4096, finishTexture: 1024, anisotropy: 8, curveSegments: 24 },
  max:      { level: 'max', label: 'Máxima (desktop com GPU)', pixelRatio: 2, hdriWidth: 2048, shadowMap: 4096, contactShadows: 1024, ao: true, smaa: true, msaa: 4, pcbPxPerMM: 16, maxTexture: 8192, finishTexture: 2048, anisotropy: 16, curveSegments: 36 },
};

export const BUILD_TARGET: 'web' | 'native' = (import.meta.env?.VITE_TARGET as 'web' | 'native') || 'web';

export function isTauri(): boolean { return typeof window !== 'undefined' && '__TAURI_INTERNALS__' in window; }
export function isCapacitorNative(): boolean {
  const c = (typeof window !== 'undefined' ? (window as unknown as { Capacitor?: { isNativePlatform?: () => boolean } }).Capacitor : undefined);
  return !!c?.isNativePlatform?.();
}
export function isMobileDevice(): boolean { return typeof navigator !== 'undefined' && /Android|iPhone|iPad|Mobile/i.test(navigator.userAgent); }

export function defaultQuality(): QualityLevel {
  try { const saved = localStorage.getItem('zeyforge.quality') as QualityLevel | null; if (saved && PROFILES[saved]) return saved; } catch { /* sem storage */ }
  if (isTauri()) return 'max';
  if (isCapacitorNative() || isMobileDevice()) return 'balanced';
  return BUILD_TARGET === 'native' ? 'max' : 'balanced';
}

let current: QualityProfile = PROFILES.balanced;
export const quality = (): QualityProfile => current;
export function setQuality(level: QualityLevel): QualityProfile {
  current = PROFILES[level];
  try { localStorage.setItem('zeyforge.quality', level); } catch { /* ok */ }
  return current;
}

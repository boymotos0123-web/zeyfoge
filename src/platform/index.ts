// Detecta a plataforma em tempo de execução e carrega o adaptador correspondente (sob demanda).
import type { Platform } from './types';
import { webPlatform } from './web';
import { isCapacitorNative, isTauri } from '@/engine/quality';

let current: Platform = webPlatform;
export const platform = (): Platform => current;

export async function initPlatform(): Promise<Platform> {
  try {
    if (isTauri()) current = await (await import('./tauri')).createTauriPlatform();
    else if (isCapacitorNative()) current = await (await import('./capacitor')).createCapacitorPlatform();
  } catch (e) { console.warn('Plataforma nativa indisponível, usando web', e); current = webPlatform; }
  return current;
}

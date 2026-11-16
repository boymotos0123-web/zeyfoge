// Desktop (Windows / Linux / macOS) via Tauri v2: diálogos nativos e sistema de arquivos real.
import type { Platform, PickedFile } from './types';

const baseName = (p: string) => p.split(/[\\/]/).pop() || p;

export async function createTauriPlatform(): Promise<Platform> {
  const dialog = await import('@tauri-apps/plugin-dialog');
  const fs = await import('@tauri-apps/plugin-fs');
  const core = await import('@tauri-apps/api/core');
  const read = async (path: string): Promise<PickedFile> => ({ name: baseName(path), data: await fs.readFile(path), path });
  return {
    id: 'tauri', label: 'Desktop', realFiles: true,
    async openProject() {
      const path = await dialog.open({ multiple: false, filters: [{ name: 'Projeto ZeyForge', extensions: ['zeyforge'] }, { name: 'Projeto v0.1', extensions: ['json'] }] });
      return typeof path === 'string' ? read(path) : null;
    },
    async saveProject(data, name, path, saveAs) {
      let target = path && !saveAs ? path : null;
      if (!target) target = await dialog.save({ defaultPath: name, filters: [{ name: 'Projeto ZeyForge', extensions: ['zeyforge'] }] });
      if (!target) return null;
      if (!/\.zeyforge$/i.test(target)) target += '.zeyforge';
      await fs.writeFile(target, data);
      return { path: target, name: baseName(target) };
    },
    async saveFile(data, name, _mime) {
      const ext = name.split('.').pop() || '*';
      const target = await dialog.save({ defaultPath: name, filters: [{ name: ext.toUpperCase(), extensions: [ext] }] });
      if (!target) return null;
      if (typeof data === 'string') await fs.writeTextFile(target, data); else await fs.writeFile(target, data);
      return target;
    },
    async pickFiles(extensions, multiple) {
      const res = await dialog.open({ multiple, filters: [{ name: 'Modelos 3D', extensions }] });
      const list = Array.isArray(res) ? res : res ? [res] : [];
      return Promise.all(list.map(p => read(p as string)));
    },
    async startupFile() {
      try { const p = await core.invoke<string | null>('startup_file'); return p ? read(p) : null; } catch { return null; }
    },
  };
}

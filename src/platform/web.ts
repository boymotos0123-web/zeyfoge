// Navegador: File System Access API (Chrome/Edge desktop) com fallback para download/upload.
import { download, inputPick, type Platform, type PickedFile } from './types';

type Handle = { name: string; getFile(): Promise<File>; createWritable(): Promise<{ write(d: BlobPart): Promise<void>; close(): Promise<void> }> };
const handles = new Map<string, Handle>();
const w = window as unknown as { showOpenFilePicker?: (o: unknown) => Promise<Handle[]>; showSaveFilePicker?: (o: unknown) => Promise<Handle> };
const types = [{ description: 'Projeto ZeyForge', accept: { 'application/x-zeyforge': ['.zeyforge'] } }];

export const webPlatform: Platform = {
  id: 'web', label: 'Navegador', realFiles: !!w.showSaveFilePicker,
  async openProject() {
    if (w.showOpenFilePicker) {
      try {
        const [h] = await w.showOpenFilePicker({ types: [...types, { description: 'Projeto v0.1', accept: { 'application/json': ['.json'] } }] });
        const f = await h.getFile(); const id = crypto.randomUUID(); handles.set(id, h);
        return { name: f.name, data: new Uint8Array(await f.arrayBuffer()), path: id };
      } catch { return null; }
    }
    const [f] = await inputPick(['zeyforge', 'json'], false);
    return f ?? null;
  },
  async saveProject(data, name, path, saveAs) {
    if (w.showSaveFilePicker) {
      try {
        let h = path && !saveAs ? handles.get(path) : undefined;
        if (!h) { h = await w.showSaveFilePicker({ suggestedName: name, types }); }
        const ws = await h.createWritable(); await ws.write(data as BlobPart); await ws.close();
        const id = path && handles.get(path) === h ? path : crypto.randomUUID(); handles.set(id, h);
        return { path: id, name: h.name };
      } catch { return null; }
    }
    download(data, name, 'application/x-zeyforge');
    return { path: null, name };
  },
  async saveFile(data, name, mime) { download(data, name, mime); return name; },
  pickFiles: (ext, multiple) => inputPick(ext, multiple),
  async startupFile(): Promise<PickedFile | null> { return null; },
};

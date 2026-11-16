// Android via Capacitor: salva em Documentos/ZeyForge e oferece compartilhar (Drive, WhatsApp, e-mail…).
import { inputPick, type Platform } from './types';

const toB64 = (d: Uint8Array | string): string => {
  const bytes = typeof d === 'string' ? new TextEncoder().encode(d) : d;
  let s = ''; const CH = 0x8000;
  for (let i = 0; i < bytes.length; i += CH) s += String.fromCharCode.apply(null, Array.from(bytes.subarray(i, i + CH)));
  return btoa(s);
};

export async function createCapacitorPlatform(): Promise<Platform> {
  const { Filesystem, Directory } = await import('@capacitor/filesystem');
  const { Share } = await import('@capacitor/share');
  const write = async (name: string, data: Uint8Array | string) => {
    const r = await Filesystem.writeFile({ path: `ZeyForge/${name}`, data: toB64(data), directory: Directory.Documents, recursive: true });
    return r.uri;
  };
  return {
    id: 'android', label: 'Android', realFiles: true,
    async openProject() { const [f] = await inputPick(['zeyforge', 'json'], false); return f ?? null; },
    async saveProject(data, name) { const uri = await write(name, data); return { path: uri, name }; },
    async saveFile(data, name) {
      const uri = await write(name, data);
      try { await Share.share({ title: name, files: [uri], dialogTitle: 'Compartilhar arquivo' }); } catch { /* usuário cancelou */ }
      return uri;
    },
    pickFiles: (ext, multiple) => inputPick(ext, multiple),
    async startupFile() { return null; },
  };
}

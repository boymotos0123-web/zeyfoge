// Abstração de plataforma: o mesmo app roda no navegador, no desktop (Tauri) e no Android (Capacitor).
export interface PickedFile { name: string; data: Uint8Array; path?: string | null }

export interface Platform {
  id: 'web' | 'tauri' | 'android';
  label: string;
  /** arquivos reais no sistema (salvar no mesmo caminho com Ctrl+S) */
  realFiles: boolean;
  openProject(): Promise<PickedFile | null>;
  saveProject(data: Uint8Array, name: string, path?: string | null, saveAs?: boolean): Promise<{ path: string | null; name: string } | null>;
  saveFile(data: Uint8Array | string, name: string, mime: string): Promise<string | null>;
  pickFiles(extensions: string[], multiple: boolean): Promise<PickedFile[]>;
  startupFile(): Promise<PickedFile | null>;
}

export function inputPick(extensions: string[], multiple: boolean): Promise<PickedFile[]> {
  return new Promise(resolve => {
    const i = document.createElement('input');
    i.type = 'file'; i.multiple = multiple; i.accept = extensions.map(e => '.' + e).join(',');
    i.onchange = async () => resolve(await Promise.all([...(i.files || [])].map(async f => ({ name: f.name, data: new Uint8Array(await f.arrayBuffer()) }))));
    i.click();
  });
}

export function download(data: Uint8Array | string, name: string, mime: string): void {
  const blob = new Blob([data as BlobPart], { type: mime });
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob); a.download = name;
  document.body.appendChild(a); a.click(); a.remove();
  setTimeout(() => URL.revokeObjectURL(a.href), 5000);
}

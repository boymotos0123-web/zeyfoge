// Histórico transacional (desfazer/refazer) com rótulos legíveis.
// Cada transação guarda o estado serializado do documento (sem assets, que são imutáveis).
import type { ZDocument } from './types';

interface Entry { label: string; state: string; time: number }

const serialize = (doc: ZDocument): string => {
  const { assets, ...rest } = doc;
  return JSON.stringify(rest);
};

export class History {
  private undoStack: Entry[] = [];
  private redoStack: Entry[] = [];
  constructor(private limit = 200) {}

  reset(doc: ZDocument, label = 'Abrir'): void {
    this.undoStack = [{ label, state: serialize(doc), time: Date.now() }];
    this.redoStack = [];
  }

  /** Registra o estado atual como uma nova entrada. Retorna false se nada mudou. */
  commit(doc: ZDocument, label: string): boolean {
    const state = serialize(doc);
    const last = this.undoStack[this.undoStack.length - 1];
    if (last && last.state === state) return false;
    this.undoStack.push({ label, state, time: Date.now() });
    if (this.undoStack.length > this.limit) this.undoStack.splice(1, 1);
    this.redoStack = [];
    return true;
  }

  get canUndo(): boolean { return this.undoStack.length > 1; }
  get canRedo(): boolean { return this.redoStack.length > 0; }
  get undoLabel(): string | null { return this.canUndo ? this.undoStack[this.undoStack.length - 1].label : null; }
  get redoLabel(): string | null { return this.canRedo ? this.redoStack[this.redoStack.length - 1].label : null; }
  get entries(): { label: string; time: number }[] { return this.undoStack.map(e => ({ label: e.label, time: e.time })); }

  undo(doc: ZDocument): string | null {
    if (!this.canUndo) return null;
    const e = this.undoStack.pop()!;
    this.redoStack.push(e);
    this.apply(doc, this.undoStack[this.undoStack.length - 1].state);
    return e.label;
  }

  redo(doc: ZDocument): string | null {
    const e = this.redoStack.pop();
    if (!e) return null;
    this.undoStack.push(e);
    this.apply(doc, e.state);
    return e.label;
  }

  private apply(doc: ZDocument, state: string): void {
    const assets = doc.assets;
    const data = JSON.parse(state);
    Object.keys(doc).forEach(k => { if (k !== 'assets') delete (doc as unknown as Record<string, unknown>)[k]; });
    Object.assign(doc, data, { assets });
  }
}

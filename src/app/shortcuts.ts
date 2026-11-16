// Atalhos de teclado (padrão de ferramentas CAD/3D).
import { app } from './controller';

export function installShortcuts(): void {
  window.addEventListener('keydown', e => {
    const t = e.target as HTMLElement;
    if (t.matches('input, textarea, select') || t.isContentEditable) return;
    const k = e.key.toLowerCase(), c = e.ctrlKey || e.metaKey;
    const run = (fn: () => void) => { e.preventDefault(); fn(); };
    if (c) {
      if (k === 'z' && !e.shiftKey) return run(() => app.undo());
      if (k === 'y' || (k === 'z' && e.shiftKey)) return run(() => app.redo());
      if (k === 's') return run(() => app.save(e.shiftKey));
      if (k === 'o') return run(() => app.open());
      if (k === 'n') return run(() => app.newProject());
      if (k === 'i') return run(() => app.importModels());
      if (k === 'd') return run(() => app.duplicate());
      if (k === 'g') return run(() => (e.shiftKey ? app.ungroup() : app.group()));
      if (k === 'a') return run(() => app.select(app.doc.nodes.filter(n => !n.parent).map(n => n.id)));
      return;
    }
    if (!app.ready.value) return;
    switch (k) {
      case 'delete': case 'backspace': return run(() => app.deleteSelection());
      case 'q': return run(() => app.setTool('select'));
      case 'w': return run(() => app.setTool('translate'));
      case 'e': return run(() => app.setTool('rotate'));
      case 'r': return run(() => app.setTool('scale'));
      case 'm': return run(() => app.setTool('measure'));
      case 'c': return run(() => { app.setCableMode('bus'); app.setTool('cable'); });
      case 'j': return run(() => { app.setCableMode('wire'); app.setTool('cable'); });
      case 'escape': return run(() => { if (app.tool.value !== 'translate' && app.tool.value !== 'select') app.setTool('translate'); else { app.select([]); app.selectCable(null); } });
      case 'f': return run(() => app.focus());
      case 'x': return run(() => app.setDisplay('xray', !app.xray.value));
      case 'h': return run(() => app.selection.value.forEach(id => { const n = app.node(id); if (n) app.updateNode(id, { visible: !n.visible }, 'Ocultar/mostrar'); }));
      case '1': return run(() => app.view('front'));
      case '3': return run(() => app.view('right'));
      case '7': return run(() => app.view('top'));
      case '0': return run(() => app.view('iso'));
      case '5': return run(() => app.setOrtho(!app.ortho.value));
    }
  });
}

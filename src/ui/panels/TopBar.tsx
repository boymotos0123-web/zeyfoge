import { app } from '@/app/controller';
import { Btn, Menu } from '../components/common';
import { Icon } from '../icons';
import { platform } from '@/platform';

export function TopBar() {
  const t = app.tool.value;
  const f = app.file.value;
  app.version.value;
  const sel = app.selection.value.length;
  const mobileToggle = (cls: string) => document.body.classList.toggle(cls);
  return (
    <header id="topbar">
      <button class="tb mobile-only" onClick={() => mobileToggle('show-left')} title="Biblioteca"><Icon name="menu" /></button>
      <div class="brand" title="ZeyForge">
        <svg width="26" height="26" viewBox="0 0 32 32"><defs><linearGradient id="zlg" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#5fb4ff" /><stop offset="1" stop-color="#7a5cff" /></linearGradient></defs><path d="M16 2l12 7v14l-12 7-12-7V9z" fill="url(#zlg)" /><path d="M10 11h12l-12 10h12" stroke="#0d1117" stroke-width="2.6" fill="none" stroke-linecap="round" stroke-linejoin="round" /></svg>
        <span>Zey<b>Forge</b></span>
      </div>
      <Menu label="Arquivo" icon="file" items={[
        { label: 'Novo projeto', icon: 'plus', kbd: 'Ctrl+N', onClick: () => app.newProject() },
        { label: 'Abrir…', icon: 'open', kbd: 'Ctrl+O', onClick: () => app.open() },
        { label: 'Salvar', icon: 'save', kbd: 'Ctrl+S', onClick: () => app.save() },
        { label: 'Salvar como…', icon: 'save', kbd: 'Ctrl+Shift+S', onClick: () => app.save(true) },
        '-',
        { label: 'Importar modelo 3D (GLB, GLTF, STL, OBJ)…', icon: 'import', kbd: 'Ctrl+I', onClick: () => app.importModels() },
        '-',
        { label: 'Exportar STL (impressão 3D)', icon: 'export', onClick: () => app.exportAs('stl') },
        { label: 'Exportar GLB (Blender, web, AR)', icon: 'export', onClick: () => app.exportAs('glb') },
        { label: 'Exportar GLTF (texto)', icon: 'export', onClick: () => app.exportAs('gltf') },
        { label: 'Exportar OBJ', icon: 'export', onClick: () => app.exportAs('obj') },
        { label: 'Imagem PNG (2×)', icon: 'camera', onClick: () => app.exportAs('png') },
        { label: 'Lista de materiais (CSV)', icon: 'bom', onClick: () => app.exportAs('bom') },
        { label: 'Netlist de conexões (CSV)', icon: 'cable', onClick: () => app.exportAs('netlist') },
      ]} />
      <Menu label="Editar" icon="select" items={[
        { label: app.history.undoLabel ? `Desfazer: ${app.history.undoLabel}` : 'Desfazer', icon: 'undo', kbd: 'Ctrl+Z', onClick: () => app.undo(), disabled: !app.history.canUndo },
        { label: app.history.redoLabel ? `Refazer: ${app.history.redoLabel}` : 'Refazer', icon: 'redo', kbd: 'Ctrl+Y', onClick: () => app.redo(), disabled: !app.history.canRedo },
        '-',
        { label: 'Duplicar', icon: 'dup', kbd: 'Ctrl+D', onClick: () => app.duplicate(), disabled: !sel },
        { label: 'Espelhar em X', icon: 'mirror', onClick: () => app.mirror(0), disabled: !sel },
        { label: 'Espelhar em Z', icon: 'mirror', onClick: () => app.mirror(2), disabled: !sel },
        { label: 'Padrão linear (array)…', icon: 'array', onClick: () => (app.dialog.value = 'array'), disabled: !sel },
        { label: 'Agrupar em montagem', icon: 'group', kbd: 'Ctrl+G', onClick: () => app.group(), disabled: !sel },
        { label: 'Desagrupar', icon: 'group', kbd: 'Ctrl+Shift+G', onClick: () => app.ungroup(), disabled: !sel },
        '-',
        { label: 'Booleana: unir', icon: 'union', onClick: () => app.booleanOp('union'), disabled: sel !== 2 },
        { label: 'Booleana: subtrair (1ª − 2ª)', icon: 'subtract', onClick: () => app.booleanOp('subtract'), disabled: sel !== 2 },
        { label: 'Booleana: interseção', icon: 'intersect', onClick: () => app.booleanOp('intersect'), disabled: sel !== 2 },
        '-',
        { label: 'Excluir', icon: 'trash', kbd: 'Del', onClick: () => app.deleteSelection() },
      ]} />
      <div class="sep" />
      <Btn icon="undo" label="Desfazer" showLabel={false} title="Desfazer (Ctrl+Z)" onClick={() => app.undo()} disabled={!app.history.canUndo} />
      <Btn icon="redo" label="Refazer" showLabel={false} title="Refazer (Ctrl+Y)" onClick={() => app.redo()} disabled={!app.history.canRedo} />
      <div class="sep" />
      <div class="seg">
        <Btn icon="select" label="Selecionar" showLabel={false} title="Selecionar (Q)" on={t === 'select'} onClick={() => app.setTool('select')} />
        <Btn icon="move" label="Mover" showLabel={false} title="Mover (W)" on={t === 'translate'} onClick={() => app.setTool('translate')} />
        <Btn icon="rotate" label="Girar" showLabel={false} title="Girar (E)" on={t === 'rotate'} onClick={() => app.setTool('rotate')} />
        <Btn icon="scale" label="Escalar" showLabel={false} title="Escalar (R)" on={t === 'scale'} onClick={() => app.setTool('scale')} />
        <Btn icon="measure" label="Medir" showLabel={false} title="Medir (M)" on={t === 'measure'} onClick={() => app.setTool('measure')} />
      </div>
      <div class="seg accent">
        <Btn icon="cable" label="Conectar" title="Rotear flat / FPC / FFC entre encaixes (C)" on={t === 'cable' && app.cableMode.value === 'bus'} onClick={() => { app.setCableMode('bus'); app.setTool('cable'); }} />
        <Btn icon="wire" label="Fio" title="Fio pino a pino com validação elétrica (J)" on={t === 'cable' && app.cableMode.value === 'wire'} onClick={() => { app.setCableMode('wire'); app.setTool('cable'); }} />
        <Btn icon="socket" label="Encaixe" title="Editor de encaixes: clique na peça selecionada para criar um ponto de conexão" on={t === 'socket'} onClick={() => app.setTool('socket')} />
      </div>
      <Btn icon="magnet" label="Ímã" showLabel={false} title="Encaixe magnético entre conectores, furos e espaçadores" on={app.magnetic.value} onClick={() => (app.magnetic.value = !app.magnetic.value)} />
      <Btn icon="grid" label="Snap" showLabel={false} title="Snap de grade (0,5 mm / 15°)" on={app.snap.value} onClick={() => { app.snap.value = !app.snap.value; app.applySnap(); }} />
      <div class="sep" />
      <Btn icon="union" label="Unir" showLabel={false} onClick={() => app.booleanOp('union')} disabled={sel !== 2} />
      <Btn icon="subtract" label="Subtrair" showLabel={false} onClick={() => app.booleanOp('subtract')} disabled={sel !== 2} />
      <Btn icon="dup" label="Duplicar" showLabel={false} title="Duplicar (Ctrl+D)" onClick={() => app.duplicate()} disabled={!sel} />
      <Btn icon="trash" label="Excluir" showLabel={false} title="Excluir (Del)" onClick={() => app.deleteSelection()} />
      <div class="grow" />
      <Btn icon="render" label="Render" title="Render fotorrealista (path tracing)" onClick={() => (app.dialog.value = 'render')} cls="render-btn" />
      <Btn icon="settings" label="Ajustes" showLabel={false} title="Qualidade, iluminação e fundo" onClick={() => (app.dialog.value = 'settings')} />
      <div class="docname" title={f.path ?? 'Ainda não salvo'}>{f.name.replace(/\.zeyforge$/i, '')}{f.dirty ? ' •' : ''}<small>{platform().label}</small></div>
      <button class="tb mobile-only" onClick={() => mobileToggle('show-right')} title="Propriedades"><Icon name="bom" /></button>
    </header>
  );
}

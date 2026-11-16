import { useState } from 'preact/hooks';
import { app } from '@/app/controller';
import { Tabs } from '../components/common';
import { Icon } from '../icons';
import { LIBRARY, CATEGORIES, costOf } from '@/library/registry';
import { TEMPLATES } from '@/library/templates';
import { childrenOf, roots } from '@/core/document';
import type { DocNode } from '@/core/types';
import { brl } from '@/core/units';
import { thumbs, requestThumb } from '../thumbnails';

export function LeftPanel() {
  const tab = app.leftTab.value;
  app.version.value;
  return (
    <aside id="left" class="panel">
      <Tabs value={tab} onChange={v => (app.leftTab.value = v)} tabs={[
        { id: 'library', label: 'Biblioteca', icon: 'box' },
        { id: 'scene', label: 'Cena', icon: 'group', badge: <span class="count">{app.doc.nodes.length}</span> },
      ]} />
      <div class="panel-body">{tab === 'library' ? <Library /> : <SceneTree />}</div>
    </aside>
  );
}

function Library() {
  const [q, setQ] = useState('');
  const [collapsed, setCollapsed] = useState<Record<string, boolean>>({});
  const query = q.trim().toLowerCase();
  const th = thumbs.value;
  const close = () => document.body.classList.remove('show-left');
  return (
    <div>
      <div class="search"><Icon name="search" size={15} /><input placeholder="Buscar: esp32, flat, bateria, câmera…" value={q} onInput={e => setQ((e.target as HTMLInputElement).value)} /></div>
      <div class="lib-list">
        {!query && <>
          <div class="cat"><Icon name="template" size={14} />Montagens prontas</div>
          {TEMPLATES.map(t => <button class="tpl" onClick={() => { app.addTemplate(t); close(); }}><b>{t.name}</b><small>{t.desc}</small></button>)}
          <button class="import-btn" onClick={() => app.importModels()}><Icon name="import" size={16} />Importar modelo 3D (GLB · GLTF · STL · OBJ)</button>
        </>}
        {CATEGORIES.map(cat => {
          const items = LIBRARY.filter(d => d.category === cat && (!query || `${d.name} ${d.type} ${cat} ${d.tags?.join(' ') ?? ''} ${d.partNumber ?? ''}`.toLowerCase().includes(query)));
          if (!items.length) return null;
          const isCol = collapsed[cat] && !query;
          return (
            <div key={cat}>
              <button class="cat clickable" onClick={() => setCollapsed({ ...collapsed, [cat]: !collapsed[cat] })}>
                <span class={`chev${isCol ? '' : ' open'}`}><Icon name="chevron" size={12} /></span>{cat}<span class="count">{items.length}</span>
              </button>
              {!isCol && <div class="lib-grid">
                {items.map(d => {
                  if (!th[d.type]) requestThumb(d.type);
                  const cost = costOf(d.type, {});
                  return (
                    <button class="item" title={`${d.name}${d.description ? '\n' + d.description : ''}`} onClick={() => { app.addPart(d.type); close(); }} draggable={false}>
                      <span class="thumb">{th[d.type] ? <img src={th[d.type]} alt="" /> : <Icon name="chip" size={26} />}</span>
                      <span class="nm">{d.name}</span>
                      {cost > 0 && <span class="cost">~{brl(cost)}</span>}
                    </button>
                  );
                })}
              </div>}
            </div>
          );
        })}
      </div>
    </div>
  );
}

let dragId: string | null = null;

function SceneTree() {
  const sel = app.selection.value;
  const doc = app.doc;
  if (!doc.nodes.length) return <div class="empty">Cena vazia. Adicione peças pela Biblioteca ou importe um modelo 3D.</div>;
  const Row = ({ n, depth }: { n: DocNode; depth: number }) => {
    const kids = childrenOf(doc, n.id);
    const isAsm = n.kind === 'assembly';
    return (
      <>
        <div
          class={`row${sel.includes(n.id) ? ' sel' : ''}${sel[0] === n.id ? ' primary' : ''}${n.visible ? '' : ' hidden'}`}
          style={{ paddingLeft: `${8 + depth * 14}px` }} draggable
          onDragStart={() => (dragId = n.id)}
          onDragOver={e => { e.preventDefault(); (e.currentTarget as HTMLElement).classList.add('drop'); }}
          onDragLeave={e => (e.currentTarget as HTMLElement).classList.remove('drop')}
          onDrop={e => { e.preventDefault(); e.stopPropagation(); (e.currentTarget as HTMLElement).classList.remove('drop'); if (dragId && dragId !== n.id) app.reparent(dragId, isAsm ? n.id : n.parent); dragId = null; }}
          onClick={e => app.select([n.id], e.shiftKey || e.ctrlKey || e.metaKey)}
          onDblClick={() => { const v = prompt('Renomear:', n.name); if (v) app.updateNode(n.id, { name: v }, 'Renomear'); }}
        >
          {kids.length ? <span class={`chev${n.expanded ? ' open' : ''}`} onClick={e => { e.stopPropagation(); n.expanded = !n.expanded; app.version.value++; }}><Icon name="chevron" size={11} /></span> : <span class="chev-sp" />}
          <span class="ico"><Icon name={isAsm ? 'folder' : n.kind === 'import' ? 'import' : n.kind === 'mesh' ? 'wireframe' : 'chip'} size={14} /></span>
          <span class="nm">{n.name}</span>
          <span class="act" title={n.locked ? 'Destravar' : 'Travar'} onClick={e => { e.stopPropagation(); app.updateNode(n.id, { locked: !n.locked }, n.locked ? 'Destravar' : 'Travar'); }}><Icon name={n.locked ? 'lock' : 'unlock'} size={13} /></span>
          <span class="act" title={n.visible ? 'Ocultar (H)' : 'Mostrar'} onClick={e => { e.stopPropagation(); app.updateNode(n.id, { visible: !n.visible }, n.visible ? 'Ocultar' : 'Mostrar'); }}><Icon name={n.visible ? 'eye' : 'eyeoff'} size={13} /></span>
        </div>
        {n.expanded && kids.map(k => <Row n={k} depth={depth + 1} />)}
      </>
    );
  };
  return (
    <div class="tree" onDragOver={e => e.preventDefault()} onDrop={e => { if (dragId && e.target === e.currentTarget) app.reparent(dragId, null); dragId = null; }}>
      {roots(doc).map(n => <Row n={n} depth={0} />)}
      {doc.cables.length > 0 && <div class="tree-cables">
        <div class="cat"><Icon name="cable" size={14} />Cabos e flex ({doc.cables.length})</div>
        {doc.cables.map(c => (
          <div class={`row${app.cableSel.value === c.id ? ' sel primary' : ''}`} style={{ paddingLeft: '8px' }} onClick={() => app.selectCable(c.id)}>
            <span class="chev-sp" /><span class="ico"><Icon name={c.kind === 'wire' ? 'wire' : 'cable'} size={14} /></span><span class="nm">{c.name}</span>
          </div>
        ))}
      </div>}
      <div class="hint">Arraste para dentro de uma montagem · duplo clique renomeia · Shift seleciona vários</div>
    </div>
  );
}

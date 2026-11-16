import * as THREE from 'three';
import { app } from '@/app/controller';
import { TopBar } from './panels/TopBar';
import { LeftPanel } from './panels/LeftPanel';
import { RightPanel } from './panels/RightPanel';
import { ViewportArea } from './panels/Viewport';
import { Dialogs } from './dialogs/Dialogs';
import { Icon } from './icons';
import { grams, brl, fmt } from '@/core/units';

function StatusBar() {
  app.version.value;
  const ready = app.ready.value;
  const sel = app.selection.value;
  const n = app.node(sel[0]);
  const c = app.cable(app.cableSel.value);
  const issues = app.issues.value;
  const errs = issues.filter(i => i.severity === 'error').length, warns = issues.filter(i => i.severity === 'warning').length;
  let dims = '';
  if (ready && sel.length) { const b = app.vp.bounds(sel.map(id => app.sync.holders.get(id)!).filter(Boolean)); if (!b.isEmpty()) { const s = b.getSize(new THREE.Vector3()); dims = `${fmt(s.x, 2)} × ${fmt(s.y, 2)} × ${fmt(s.z, 2)} mm`; } }
  const bom = ready ? app.bom.value : null;
  return (
    <footer id="status">
      <span>{c ? c.name : n ? (sel.length > 1 ? `${sel.length} selecionados` : n.name) : app.hoverInfo.value || 'Nada selecionado'}</span>
      {dims && <span class="dim">{dims}</span>}
      <span class="grow" />
      <button class={`stat-issues ${errs ? 'err' : warns ? 'warn' : 'ok'}`} onClick={() => (app.rightTab.value = 'connections')} title="Verificação de conexões">
        <Icon name={errs ? 'error' : warns ? 'warn' : 'ok'} size={13} />{errs ? `${errs} erro(s)` : warns ? `${warns} aviso(s)` : 'Conexões OK'}
      </button>
      {bom && <span>{grams(bom.totalMass)}</span>}
      {bom && <span>{brl(bom.totalCost)}</span>}
      <span>{app.doc.nodes.length} peças · {app.doc.cables.length} cabos</span>
      {ready && app.vp.renderer.info.render.triangles > 0 && <span>{(app.vp.renderer.info.render.triangles / 1000).toFixed(0)}k tri</span>}
      <span class="brandmini">ZeyForge {__APP_VERSION__}</span>
    </footer>
  );
}

function Toasts() {
  return <div id="toasts">{app.toasts.value.map(t => <div class={`toast ${t.kind}`} key={t.id}>{t.msg}</div>)}</div>;
}

export function App() {
  return (
    <>
      <TopBar />
      <main id="main">
        <LeftPanel />
        <ViewportArea />
        <RightPanel />
      </main>
      <StatusBar />
      <Dialogs />
      <Toasts />
    </>
  );
}

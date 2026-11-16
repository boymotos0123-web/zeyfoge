import { useEffect, useRef } from 'preact/hooks';
import { app } from '@/app/controller';
import { Icon } from '../icons';
import { Select } from '../components/common';
import type { ViewName } from '@/engine/Viewport';

export function ViewportArea() {
  const viewRef = useRef<HTMLDivElement>(null);
  const cubeRef = useRef<HTMLDivElement>(null);
  useEffect(() => { void app.init(viewRef.current!, cubeRef.current!); }, []);
  const ready = app.ready.value;
  return (
    <section id="viewwrap">
      <div id="view" ref={viewRef} />
      <div id="viewcube" ref={cubeRef} />
      {ready && <ViewBar />}
      {ready && <ViewTools />}
      {ready && <ToolHud />}
      {ready && <PhotoHud />}
      {!ready && <div class="boot"><div class="spinner" />Preparando o motor de renderização…</div>}
    </section>
  );
}

function ViewBar() {
  const views: [ViewName, string][] = [['iso', 'Iso'], ['front', 'Frente'], ['top', 'Topo'], ['right', 'Direita'], ['back', 'Trás'], ['bottom', 'Base']];
  return (
    <div id="viewbar" class="pill">
      {views.map(([v, l]) => <button onClick={() => app.view(v)}>{l}</button>)}
      <button class={app.ortho.value ? 'on' : ''} title="Projeção ortográfica (5)" onClick={() => app.setOrtho(!app.ortho.value)}>Orto</button>
      <button title="Enquadrar (F)" onClick={() => app.focus()}><Icon name="focus" size={16} /></button>
    </div>
  );
}

function ViewTools() {
  const ex = app.explode.value, cl = app.clip.value;
  return (
    <div id="viewtools" class="pill">
      <button class={app.xray.value ? 'on' : ''} onClick={() => app.setDisplay('xray', !app.xray.value)} title="Raio-X (X)"><Icon name="xray" size={16} />Raio-X</button>
      <button class={app.wire.value ? 'on' : ''} onClick={() => app.setDisplay('wire', !app.wire.value)} title="Wireframe"><Icon name="wireframe" size={16} />Malha</button>
      <button class={app.grid.value ? 'on' : ''} onClick={() => app.setGrid(!app.grid.value)}><Icon name="grid" size={16} />Grade</button>
      <div class="vt-block">
        <label><Icon name="explode" size={16} />Explodir</label>
        <input type="range" min={0} max={1} step={0.01} value={ex.f} onInput={e => app.setExplode(+(e.target as HTMLInputElement).value)} />
        <Select value={ex.mode} options={[['radial', 'Radial'], ['y', 'Camadas (Y)'], ['x', 'Eixo X'], ['z', 'Eixo Z']]} onChange={v => app.setExplode(ex.f, v)} />
      </div>
      <div class="vt-block">
        <label><Icon name="cut" size={16} />Corte</label>
        <Select value={cl.axis} options={[['', 'Desligado'], ['x', 'Plano X'], ['y', 'Plano Y'], ['z', 'Plano Z']]} onChange={v => app.setClip({ axis: v })} />
        <input type="range" min={0} max={1} step={0.002} value={cl.t} disabled={!cl.axis} onInput={e => app.setClip({ t: +(e.target as HTMLInputElement).value })} />
        <button title="Inverter lado" disabled={!cl.axis} onClick={() => app.setClip({ flip: !cl.flip })}>⇄</button>
      </div>
      <button onClick={() => app.vp.clearMeasures()} title="Limpar medições"><Icon name="measure" size={16} />Limpar</button>
    </div>
  );
}

function ToolHud() {
  const t = app.tool.value;
  const start = app.cableStart.value;
  const hint = app.snapHint.value;
  if (t === 'cable') return (
    <div class="hud">
      <Icon name={app.cableMode.value === 'wire' ? 'wire' : 'cable'} size={16} />
      <span>{start ? <>Origem: <b>{app.node(start.endpoint.node)?.name} · {start.def.label}{start.endpoint.pin != null ? ` · ${start.def.pinNames?.[start.endpoint.pin] ?? start.endpoint.pin + 1}` : ''}</b> — clique no destino</>
        : app.cableMode.value === 'wire' ? 'Modo FIO: clique num pino de origem (cores = tipo elétrico)' : 'Modo CONECTAR: clique num encaixe de origem (cones coloridos)'}</span>
      {app.hoverInfo.value && <em>{app.hoverInfo.value}</em>}
      <button onClick={() => app.setTool('translate')}>Concluir (Esc)</button>
    </div>
  );
  if (t === 'socket') return <div class="hud"><Icon name="socket" size={16} /><span>Editor de encaixes: clique na superfície da peça selecionada para criar um ponto de conexão.</span><button onClick={() => app.setTool('translate')}>Concluir</button></div>;
  if (t === 'measure') return <div class="hud"><Icon name="measure" size={16} /><span>Clique em dois pontos para medir (mm, com ΔX ΔY ΔZ).</span><button onClick={() => app.setTool('translate')}>Concluir</button></div>;
  if (hint) return <div class="hud ok"><Icon name="magnet" size={16} /><span>{hint}</span></div>;
  return null;
}

function PhotoHud() {
  const p = app.photo.value;
  if (!p.running) return null;
  const pct = p.target ? Math.min(100, (p.samples / p.target) * 100) : 0;
  return (
    <div class="photo-hud">
      <div class="ph-row"><Icon name="render" size={16} /><b>Render fotorrealista</b><span>{p.samples} / {p.target} amostras</span></div>
      <div class="bar"><i style={{ width: `${pct}%` }} /></div>
      <div class="ph-row">
        <button onClick={() => app.savePhoto()}><Icon name="camera" size={14} />Salvar PNG</button>
        <button onClick={() => app.stopPhoto()}><Icon name="stop" size={14} />Voltar à edição</button>
      </div>
      <small>Gire a câmera para recomeçar a partir do novo ângulo.</small>
    </div>
  );
}

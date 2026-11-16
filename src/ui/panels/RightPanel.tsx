import * as THREE from 'three';
import { app } from '@/app/controller';
import { Tabs, Field, NumInput, Select, Toggle, Section } from '../components/common';
import { Icon } from '../icons';
import { byType } from '@/library/registry';
import { materialGroups, MATERIALS } from '@/core/materials-db';
import { SOCKET_KIND_LABEL, minBendRadius, pinName } from '@/core/connectivity';
import { computePrice } from '@/core/bom';
import { descendants } from '@/core/document';
import { brl, fmt, grams } from '@/core/units';
import type { Cable, DocNode, SocketKind } from '@/core/types';

export function RightPanel() {
  const tab = app.rightTab.value;
  app.version.value;
  const errors = app.issues.value.filter(i => i.severity === 'error').length;
  const warns = app.issues.value.filter(i => i.severity === 'warning').length;
  return (
    <aside id="right" class="panel">
      <Tabs value={tab} onChange={v => (app.rightTab.value = v)} tabs={[
        { id: 'props', label: 'Propriedades' },
        { id: 'connections', label: 'Conexões', badge: errors ? <span class="badge err">{errors}</span> : warns ? <span class="badge warn">{warns}</span> : null },
        { id: 'bom', label: 'BOM' },
      ]} />
      <div class="panel-body">{tab === 'props' ? <Properties /> : tab === 'connections' ? <Connections /> : <Bom />}</div>
    </aside>
  );
}

/* ============================== PROPRIEDADES ============================== */

function Properties() {
  const cab = app.cable(app.cableSel.value);
  if (cab) return <CableProps c={cab} />;
  const sel = app.selection.value;
  if (!sel.length) return <Empty />;
  if (sel.length > 1) return <Multi ids={sel} />;
  const n = app.node(sel[0]);
  return n ? <NodeProps n={n} /> : <Empty />;
}

function Empty() {
  const keys: [string, string][] = [['Clique', 'Selecionar peça'], ['Clique de novo', 'Montagem-pai'], ['Shift+clique', 'Seleção múltipla'], ['W · E · R', 'Mover · girar · escalar'], ['C / J', 'Conectar flat / fio'], ['M', 'Medir'], ['F', 'Enquadrar'], ['X', 'Raio-X'], ['H', 'Ocultar'], ['Ctrl+D', 'Duplicar'], ['Ctrl+G', 'Agrupar'], ['Ctrl+Z', 'Desfazer'], ['1 3 7 0', 'Vistas'], ['Botão direito', 'Pan']];
  return (
    <div class="empty big">
      <Icon name="select" size={36} />
      <p>Selecione uma peça ou um cabo. Para ligar componentes use <b>Conectar</b> (flat/FPC/FFC) ou <b>Fio</b> (pino a pino).</p>
      <div class="shortcuts">{keys.map(([k, v]) => <div><kbd>{k}</kbd><span>{v}</span></div>)}</div>
    </div>
  );
}

function Multi({ ids }: { ids: string[] }) {
  const com = app.sync.centerOfMass(ids.flatMap(id => [id, ...descendants(app.doc, id).map(d => d.id)]));
  return (
    <>
      <Section title={`${ids.length} itens selecionados`}>
        <p class="muted">Booleanas usam a 1ª peça como base. Agrupe para criar uma montagem.</p>
        <div class="btnrow">
          <button onClick={() => app.booleanOp('union')}>Unir</button><button onClick={() => app.booleanOp('subtract')}>Subtrair</button>
          <button onClick={() => app.booleanOp('intersect')}>Interseção</button><button onClick={() => app.group()}>Agrupar</button>
        </div>
      </Section>
      <Dims objs={ids.map(id => app.sync.holders.get(id)!).filter(Boolean)} mass={com.mass} />
    </>
  );
}

function Dims({ objs, mass, volume, area }: { objs: THREE.Object3D[]; mass?: number; volume?: number; area?: number }) {
  const b = app.vp.bounds(objs);
  if (b.isEmpty()) return null;
  const s = b.getSize(new THREE.Vector3());
  let tris = 0;
  objs.forEach(o => o.traverse(m => { const mm = m as THREE.Mesh; if (mm.isMesh && mm.geometry) { const c = mm.geometry.index ? mm.geometry.index.count : mm.geometry.attributes.position.count; tris += (c / 3) * ((mm as THREE.InstancedMesh).isInstancedMesh ? (mm as THREE.InstancedMesh).count : 1); } }));
  return (
    <Section title="Engenharia">
      <div class="dimgrid"><div><i>X</i>{fmt(s.x)} mm</div><div><i>Y</i>{fmt(s.y)} mm</div><div><i>Z</i>{fmt(s.z)} mm</div></div>
      <div class="kv">
        {mass != null && <div><span><Icon name="weight" size={14} />Massa</span><b>{grams(mass)}</b></div>}
        {volume != null && volume > 0 && <div><span>Volume</span><b>{fmt(volume / 1000, 3)} cm³</b></div>}
        {area != null && area > 0 && <div><span>Área de superfície</span><b>{fmt(area / 100, 2)} cm²</b></div>}
        <div><span>Triângulos</span><b>{Math.round(tris).toLocaleString('pt-BR')}</b></div>
      </div>
    </Section>
  );
}

function NodeProps({ n }: { n: DocNode }) {
  const d = byType[n.type];
  const h = app.sync.holders.get(n.id);
  const isAsm = n.kind === 'assembly';
  const props = isAsm ? null : app.sync.massProps(n);
  const mass = isAsm ? app.sync.centerOfMass([n.id, ...descendants(app.doc, n.id).map(x => x.id)]).mass : app.sync.massOf(n);
  const sockets = isAsm ? [] : app.sync.socketDefs(n);
  const connected = new Set(app.doc.cables.flatMap(c => [c.a, c.b]).filter(e => e.node === n.id).map(e => e.socket));
  const xyz = (key: 'pos' | 'rot' | 'scl', label: string, step: number, unit: string) => (
    <div class="xyz"><span class="fl">{label}</span>
      {[0, 1, 2].map(i => <div class={`ax ax${'xyz'[i]}`}><i>{'XYZ'[i]}</i><NumInput value={n[key][i]} step={step} onLive={v => app.setTransform(n.id, key, i, v, false)} onCommit={v => app.setTransform(n.id, key, i, v, true)} /></div>)}
      <span class="unit">{unit}</span></div>
  );
  return (
    <>
      <div class="section head">
        <input class="name" value={n.name} onChange={e => app.updateNode(n.id, { name: (e.target as HTMLInputElement).value }, 'Renomear')} />
        <div class="muted">{isAsm ? `Montagem · ${descendants(app.doc, n.id).length} itens` : n.kind === 'import' ? 'Modelo importado (GLB)' : n.kind === 'mesh' ? 'Malha (booleana)' : `${d?.category} · ${n.partNumber || d?.name}`}</div>
        {d?.description && <p class="desc">{d.description}</p>}
      </div>
      <Section title="Transformação">
        {xyz('pos', 'Posição', app.snap.value ? 0.5 : 0.1, 'mm')}
        {xyz('rot', 'Rotação', app.snap.value ? 15 : 1, '°')}
        {xyz('scl', 'Escala', 0.05, '×')}
        <div class="btnrow">
          <button onClick={() => { app.updateNode(n.id, { pos: [0, 0, 0], rot: [0, 0, 0], scl: [1, 1, 1] }, 'Zerar transformação'); app.sync.applyTransform(n); app.sync.updateCables([n.id]); }}>Zerar</button>
          <button onClick={() => app.dropToFloor(n.id)}>Apoiar no chão</button>
          <button onClick={() => app.focus()}>Enquadrar</button>
        </div>
      </Section>
      {d && Object.keys(d.params).length > 0 && (
        <Section title="Parâmetros">
          {Object.entries(d.params).map(([k, pd]) => (
            <Field label={pd.label} unit={pd.t === 'num' ? pd.unit : ''}>
              {pd.t === 'num' ? <NumInput value={Number(n.params[k] ?? pd.value)} step={pd.step} min={pd.min} max={pd.max} onCommit={v => app.setParam(n.id, k, v, true)} />
                : pd.t === 'sel' ? <Select value={String(n.params[k] ?? pd.value)} options={pd.options} onChange={v => app.setParam(n.id, k, v, true)} />
                  : <Toggle value={Boolean(n.params[k] ?? pd.value)} onChange={v => app.setParam(n.id, k, v, true)} />}
            </Field>
          ))}
        </Section>
      )}
      {!isAsm && (
        <Section title="Material e acabamento">
          <Field label="Material">
            <Select value={n.mat.preset ?? ''} options={[{ group: 'Padrão', items: [['', 'Original do componente']] }, ...materialGroups().map(g => ({ group: g.group, items: g.items.map(i => [i.key, i.label] as [string, string]) }))]} onChange={v => app.updateNode(n.id, { mat: { ...n.mat, preset: v || null } }, 'Material', true)} />
          </Field>
          <Field label="Cor">
            <div class="inline">
              <input type="color" value={n.mat.color ?? (n.mat.preset ? MATERIALS[n.mat.preset].color : '#888888')} onChange={e => app.updateNode(n.id, { mat: { ...n.mat, color: (e.target as HTMLInputElement).value } }, 'Cor', true)} />
              <button class="mini" onClick={() => app.updateNode(n.id, { mat: { ...n.mat, color: null } }, 'Cor padrão', true)}>Padrão</button>
            </div>
          </Field>
          <Field label="Opacidade"><input type="range" min={0.05} max={1} step={0.01} value={n.mat.opacity} onChange={e => app.updateNode(n.id, { mat: { ...n.mat, opacity: +(e.target as HTMLInputElement).value } }, 'Opacidade', true)} /></Field>
          <div class="chips">
            {(['titanio', 'aluminio', 'aluminio_preto', 'aco_inox', 'vidro', 'policarbonato', 'safira', 'fibra_carbono', 'pla_cinza', 'abs_preto'] as const).map(k => (
              <button class="chip" title={MATERIALS[k].label} style={{ ['--c' as string]: MATERIALS[k].color }} onClick={() => app.updateNode(n.id, { mat: { ...n.mat, preset: k, color: null } }, 'Material', true)}><i />{MATERIALS[k].label.split(' ')[0]}</button>
            ))}
          </div>
        </Section>
      )}
      {!isAsm && (
        <Section title={`Encaixes (${sockets.length})`} right={<button class="mini" title="Clique na superfície da peça para criar" onClick={() => app.setTool('socket')}><Icon name="plus" size={13} />Novo</button>}>
          {!sockets.length && <p class="muted">Sem encaixes. Use <b>Encaixe</b> e clique na superfície para criar pontos de conexão (ex.: em modelos importados).</p>}
          <div class="socket-list">
            {sockets.map(s => {
              const custom = n.customSockets.some(c => c.id === s.id);
              return (
                <div class={`sock${connected.has(s.id) ? ' used' : ''}`}>
                  <div class="sock-main">
                    <span class="dot" style={{ background: `var(--k-${s.kind})` }} />
                    <div class="sock-txt"><b>{s.label}</b><small>{SOCKET_KIND_LABEL[s.kind]}{s.pins > 1 ? ` · ${s.pins} vias · ${s.pitch} mm` : ''}{connected.has(s.id) ? ' · conectado' : ''}</small></div>
                    {!s.kind.startsWith('mount') && s.kind !== 'screw' && !s.kind.startsWith('standoff') && <button class="mini" onClick={() => app.startCableFrom(n.id, s.id)} title="Conectar a partir deste encaixe"><Icon name="cable" size={13} /></button>}
                    {custom && <button class="mini" onClick={() => app.removeCustomSocket(n.id, s.id)} title="Remover"><Icon name="trash" size={13} /></button>}
                  </div>
                  {custom && (
                    <div class="sock-edit">
                      <Field label="Nome"><input value={s.label} onChange={e => app.updateCustomSocket(n.id, s.id, { label: (e.target as HTMLInputElement).value })} /></Field>
                      <Field label="Tipo"><Select value={s.kind} options={(Object.keys(SOCKET_KIND_LABEL) as SocketKind[]).map(k => [k, SOCKET_KIND_LABEL[k]] as [SocketKind, string])} onChange={v => app.updateCustomSocket(n.id, s.id, { kind: v })} /></Field>
                      <Field label="Vias"><NumInput value={s.pins} step={1} min={1} max={200} digits={0} onCommit={v => app.updateCustomSocket(n.id, s.id, { pins: Math.round(v) })} /></Field>
                      <Field label="Passo" unit="mm"><NumInput value={s.pitch} step={0.05} min={0} max={10} onCommit={v => app.updateCustomSocket(n.id, s.id, { pitch: v })} /></Field>
                      <Field label="Terminação"><Select value={s.termination ?? 'solder'} options={[['btb', 'Conector BTB'], ['zif', 'ZIF'], ['solder', 'Solda / saída do módulo'], ['pin', 'Pino']]} onChange={v => app.updateCustomSocket(n.id, s.id, { termination: v })} /></Field>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </Section>
      )}
      <Section title="Produção">
        {!isAsm && <>
          <Field label="Custo unitário" unit="R$"><NumInput value={n.cost} step={0.5} min={0} digits={2} onCommit={v => app.updateNode(n.id, { cost: v }, 'Custo')} /></Field>
          <Field label="Quantidade" unit="un"><NumInput value={n.qty} step={1} min={1} digits={0} onCommit={v => app.updateNode(n.id, { qty: Math.max(1, Math.round(v)) }, 'Quantidade')} /></Field>
          <Field label="Massa manual" unit="g" hint="Vazio = automático (biblioteca ou volume × densidade)"><NumInput value={n.massOverride ?? 0} step={0.1} min={0} digits={2} onCommit={v => app.updateNode(n.id, { massOverride: v > 0 ? v : null }, 'Massa')} /></Field>
          <Field label="Part number"><input value={n.partNumber} onChange={e => app.updateNode(n.id, { partNumber: (e.target as HTMLInputElement).value }, 'Part number')} /></Field>
          <Field label="Fornecedor"><input value={n.supplier} placeholder="AliExpress, Mouser, LCSC…" onChange={e => app.updateNode(n.id, { supplier: (e.target as HTMLInputElement).value }, 'Fornecedor')} /></Field>
        </>}
        <Field label="Notas" wide><textarea rows={2} value={n.notes} placeholder="Observações de engenharia" onChange={e => app.updateNode(n.id, { notes: (e.target as HTMLTextAreaElement).value }, 'Notas')} /></Field>
      </Section>
      {h && <Dims objs={[h]} mass={mass} volume={props?.volume} area={props?.area} />}
    </>
  );
}

function CableProps({ c }: { c: Cable }) {
  const r = app.sync.routes.get(c.id);
  const sa = app.sync.socketDef(c.a), sb = app.sync.socketDef(c.b);
  const na = app.node(c.a.node), nb = app.node(c.b.node);
  const issues = app.issues.value.filter(i => i.cable === c.id);
  const minR = minBendRadius(c.thickness, c.layers);
  const set = (patch: Partial<Cable>, label = 'Editar cabo') => app.updateCable(c.id, patch, label);
  const ep = (n: typeof na, s: typeof sa, pin?: number) => `${n?.name ?? '?'} · ${s?.label ?? '?'}${pin != null && s ? ` · ${pinName(s, pin)}` : ''}`;
  return (
    <>
      <div class="section head">
        <input class="name" value={c.name} onChange={e => set({ name: (e.target as HTMLInputElement).value }, 'Renomear cabo')} />
        <div class="muted">{{ fpc: 'Flat flex (FPC/FFC)', ribbon: 'Fita IDC', wire: 'Fio', usb: 'Cabo USB' }[c.kind]}</div>
        <div class="endpoints"><div><small>Origem</small>{ep(na, sa, c.a.pin)}</div><div><small>Destino</small>{ep(nb, sb, c.b.pin)}</div></div>
      </div>
      {issues.length > 0 && <Section title="Validação">{issues.map(i => <div class={`issue ${i.severity}`}><Icon name={i.severity === 'error' ? 'error' : 'warn'} size={15} /><span>{i.message.replace(/^[^:]+: /, '')}</span></div>)}</Section>}
      <Section title="Geometria">
        {c.kind !== 'wire' && c.kind !== 'usb' && <Field label="Largura" unit="mm"><NumInput value={c.width} step={0.1} min={0.5} onCommit={v => set({ width: v })} /></Field>}
        <Field label={c.kind === 'wire' || c.kind === 'usb' ? 'Diâmetro' : 'Espessura'} unit="mm"><NumInput value={c.thickness} step={c.kind === 'fpc' ? 0.01 : 0.1} min={0.02} onCommit={v => set({ thickness: v })} /></Field>
        {c.kind === 'fpc' && <>
          <Field label="Condutores"><NumInput value={c.conductors} step={1} min={1} digits={0} onCommit={v => set({ conductors: Math.round(v) })} /></Field>
          <Field label="Camadas de cobre"><Select value={String(c.layers)} options={[['1', '1 (face simples)'], ['2', '2 (dupla face)'], ['4', '4 (multicamada)']]} onChange={v => set({ layers: +v })} /></Field>
          <Field label="Enrijecedores"><Toggle value={c.stiffener} onChange={v => set({ stiffener: v })} /></Field>
        </>}
        <Field label="Saída reta" unit="mm"><NumInput value={c.lead} step={0.5} min={0} onCommit={v => set({ lead: v })} /></Field>
        <Field label="Folga (barriga)"><input type="range" min={0} max={0.8} step={0.01} value={c.slack} onChange={e => set({ slack: +(e.target as HTMLInputElement).value })} /></Field>
        <Field label="Cor"><div class="inline"><input type="color" value={c.color ?? (c.kind === 'fpc' ? '#ffffff' : '#e9ebee')} onChange={e => set({ color: (e.target as HTMLInputElement).value })} /><button class="mini" onClick={() => set({ color: null })}>Padrão</button></div></Field>
        <div class="btnrow">
          <button onClick={() => app.addWaypoint(c.id)}><Icon name="plus" size={13} />Ponto de passagem</button>
          {c.waypoints.length > 0 && <button onClick={() => app.clearWaypoints(c.id)}>Limpar pontos ({c.waypoints.length})</button>}
          <button class="danger" onClick={() => app.deleteCable(c.id)}><Icon name="trash" size={13} />Excluir</button>
        </div>
        <p class="muted">Clique numa esfera laranja no cabo para movê-la com o gizmo.</p>
      </Section>
      {r && <Section title="Análise">
        <div class="kv">
          <div><span><Icon name="ruler" size={14} />Comprimento</span><b>{fmt(r.length, 2)} mm</b></div>
          {(c.kind === 'fpc' || c.kind === 'ribbon') && <div class={r.minRadius < minR ? 'bad' : 'good'}><span>Menor raio de dobra</span><b>{Number.isFinite(r.minRadius) ? fmt(r.minRadius, 2) + ' mm' : 'reto'} <small>(mín. {fmt(minR, 2)})</small></b></div>}
          {c.pitch > 0 && <div><span>Passo</span><b>{c.pitch} mm</b></div>}
        </div>
      </Section>}
    </>
  );
}

/* ============================== CONEXÕES ============================== */

function Connections() {
  const issues = app.issues.value;
  const errs = issues.filter(i => i.severity === 'error'), warns = issues.filter(i => i.severity === 'warning');
  return (
    <>
      <Section title="Verificação elétrica e mecânica" right={<button class="mini" onClick={() => app.exportAs('netlist')}><Icon name="export" size={13} />Netlist</button>}>
        {!issues.length ? <div class="issue ok"><Icon name="ok" size={15} /><span>Nenhum problema encontrado em {app.doc.cables.length} conexão(ões).</span></div>
          : [...errs, ...warns].map(i => <div class={`issue ${i.severity} clickable`} onClick={() => i.cable && app.selectCable(i.cable)}><Icon name={i.severity === 'error' ? 'error' : 'warn'} size={15} /><span>{i.message}</span></div>)}
        <p class="muted">Regras: compatibilidade de conectores, nº de vias e passo, encaixe ocupado, curto (5 V/3,3 V/VBAT ↔ GND, inclusive por vários fios), fontes diferentes, 5 V em GPIO de 3,3 V e raio de dobra (IPC-2223).</p>
      </Section>
      <Section title={`Cabos (${app.doc.cables.length})`}>
        {!app.doc.cables.length && <p class="muted">Use <b>Conectar</b> para rotear flats entre encaixes, ou <b>Fio</b> para ligar pino a pino.</p>}
        <div class="cable-list">
          {app.doc.cables.map(c => {
            const bad = issues.some(i => i.cable === c.id && i.severity === 'error'), warn = issues.some(i => i.cable === c.id && i.severity === 'warning');
            return (
              <button class={`cable-row${app.cableSel.value === c.id ? ' sel' : ''}`} onClick={() => { app.selectCable(c.id); app.rightTab.value = 'props'; }}>
                <Icon name={c.kind === 'wire' ? 'wire' : 'cable'} size={15} />
                <span class="nm">{c.name}</span>
                <span class="len">{fmt(app.sync.cableLength(c), 1)} mm</span>
                <span class={`st ${bad ? 'err' : warn ? 'warn' : 'ok'}`} />
              </button>
            );
          })}
        </div>
      </Section>
    </>
  );
}

/* ============================== BOM ============================== */

function Bom() {
  const b = app.bom.value;
  const pr = app.doc.pricing;
  const price = computePrice(b.totalCost, pr);
  const setP = (k: keyof typeof pr, v: number) => { pr[k] = v; app.commit('Precificação'); };
  const com = app.sync.centerOfMass(app.doc.nodes.map(n => n.id));
  const box = app.vp.bounds([app.vp.model]);
  const s = box.isEmpty() ? new THREE.Vector3() : box.getSize(new THREE.Vector3());
  return (
    <>
      <Section title="Resumo do produto">
        <div class="stat-grid">
          <div><small>Custo dos componentes</small><b>{brl(b.totalCost)}</b></div>
          <div><small>Massa total</small><b>{grams(b.totalMass)}</b></div>
          <div><small>Peças</small><b>{b.partCount}</b></div>
          <div><small>Cabos · comprimento</small><b>{b.cableCount} · {fmt(b.cableLength / 10, 1)} cm</b></div>
          <div class="span2"><small>Dimensões totais</small><b>{fmt(s.x, 1)} × {fmt(s.y, 1)} × {fmt(s.z, 1)} mm</b></div>
          <div class="span2"><small>Centro de massa</small><b>X {fmt(com.center.x, 1)} · Y {fmt(com.center.y, 1)} · Z {fmt(com.center.z, 1)} mm</b></div>
        </div>
      </Section>
      <Section title="Lista de materiais" right={<button class="mini" onClick={() => app.exportAs('bom')}><Icon name="export" size={13} />CSV</button>}>
        <p class="muted">Massa: biblioteca (peças compradas) ou volume × densidade do material (peças fabricadas). Custos são estimativas — edite com o preço do seu fornecedor.</p>
        {b.rows.length ? (
          <table class="bomt"><thead><tr><th>Item</th><th>Qtd</th><th>Massa</th><th>Subtotal</th></tr></thead>
            <tbody>{b.rows.map(r => (
              <tr onClick={() => { const id = r.ids[0]; if (app.node(id)) app.select(r.ids.filter(x => app.node(x))); else app.selectCable(id); }}>
                <td><div>{r.name}</div><small>{r.category}{r.partNumber ? ' · ' + r.partNumber : ''} · {brl(r.unitCost)}</small></td>
                <td>{r.qty}</td><td>{grams(r.unitMass * r.qty)}</td><td>{brl(r.unitCost * r.qty)}</td>
              </tr>))}
            </tbody>
          </table>) : <div class="empty">Sem componentes.</div>}
      </Section>
      <Section title="Precificação por unidade">
        <Field label="Montagem / mão de obra" unit="R$"><NumInput value={pr.assembly} step={1} min={0} digits={2} onCommit={v => setP('assembly', v)} /></Field>
        <Field label="Embalagem" unit="R$"><NumInput value={pr.packaging} step={1} min={0} digits={2} onCommit={v => setP('packaging', v)} /></Field>
        <Field label="Frete embutido" unit="R$"><NumInput value={pr.shipping} step={1} min={0} digits={2} onCommit={v => setP('shipping', v)} /></Field>
        <Field label="Impostos e taxas" unit="%"><NumInput value={pr.tax} step={0.5} min={0} max={90} digits={2} onCommit={v => setP('tax', v)} /></Field>
        <Field label="Margem desejada" unit="%"><NumInput value={pr.margin} step={1} min={0} max={90} digits={2} onCommit={v => setP('margin', v)} /></Field>
        <div class="pricebox">
          <div><span>Custo total</span><b>{brl(price.base)}</b></div>
          <div><span>Impostos</span><b>{brl(price.taxes)}</b></div>
          <div class="hl"><span>Preço sugerido</span><b>{Number.isFinite(price.price) ? brl(price.price) : '—'}</b></div>
          <div><span>Lucro por unidade</span><b>{Number.isFinite(price.profit) ? brl(price.profit) : '—'}</b></div>
        </div>
      </Section>
    </>
  );
}

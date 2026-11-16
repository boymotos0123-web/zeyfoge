import { useState } from 'preact/hooks';
import { app } from '@/app/controller';
import { Modal, Field, Select, NumInput } from '../components/common';
import { Icon } from '../icons';
import { IMPORT_UNITS, fmt } from '@/core/units';
import { materialGroups } from '@/core/materials-db';
import { PROFILES, BUILD_TARGET, type QualityLevel } from '@/engine/quality';
import { ENV_PRESETS, type EnvPreset } from '@/engine/environment';
import { platform } from '@/platform';

export function Dialogs() {
  const d = app.dialog.value;
  const imp = app.importDialog.value;
  return (
    <>
      {imp && <ImportDialog />}
      {d === 'settings' && <SettingsDialog />}
      {d === 'render' && <RenderDialog />}
      {d === 'array' && <ArrayDialog />}
      {d === 'about' && <AboutDialog />}
    </>
  );
}

function ImportDialog() {
  const imp = app.importDialog.value!;
  const [unit, setUnit] = useState(imp.unit);
  const [mat, setMat] = useState('');
  const [mass, setMass] = useState(0);
  const toMM = IMPORT_UNITS.find(u => u.id === unit)?.toMM ?? 1;
  const s = imp.analysis.rawSize.clone().multiplyScalar(toMM);
  const close = () => (app.importDialog.value = null);
  return (
    <Modal title={`Importar ${imp.analysis.name}`} onClose={close} width={480} footer={<><button onClick={close}>Cancelar</button><button class="primary" onClick={() => app.confirmImport(unit, mat || null, mass > 0 ? mass : null)}>Importar</button></>}>
      <div class="stat-grid">
        <div><small>Formato</small><b>{imp.analysis.kind.toUpperCase()}</b></div>
        <div><small>Malhas</small><b>{imp.analysis.meshes}</b></div>
        <div><small>Triângulos</small><b>{imp.analysis.triangles.toLocaleString('pt-BR')}</b></div>
        <div><small>Materiais</small><b>{imp.analysis.materials}</b></div>
      </div>
      <Field label="Unidade do arquivo"><Select value={unit} options={IMPORT_UNITS.map(u => [u.id, u.label] as [string, string])} onChange={setUnit} /></Field>
      <div class={`size-preview${Math.max(s.x, s.y, s.z) > 2000 || Math.max(s.x, s.y, s.z) < 0.5 ? ' suspicious' : ''}`}>
        <Icon name="ruler" size={16} /> Tamanho resultante: <b>{fmt(s.x, 2)} × {fmt(s.y, 2)} × {fmt(s.z, 2)} mm</b>
        {(Math.max(s.x, s.y, s.z) > 2000 || Math.max(s.x, s.y, s.z) < 0.5) && <small>Parece fora de escala — confira a unidade.</small>}
      </div>
      <Field label="Material (para massa)"><Select value={mat} options={[{ group: 'Padrão', items: [['', 'Manter materiais do arquivo']] }, ...materialGroups().map(g => ({ group: g.group, items: g.items.map(i => [i.key, i.label] as [string, string]) }))]} onChange={setMat} /></Field>
      <Field label="Massa conhecida" unit="g" hint="Opcional: se souber o peso real da peça"><NumInput value={mass} step={0.5} min={0} digits={2} onCommit={setMass} /></Field>
      <p class="muted">O modelo é centralizado e apoiado no chão. Depois use a ferramenta <b>Encaixe</b> para marcar conectores e furos na superfície.</p>
    </Modal>
  );
}

function SettingsDialog() {
  const e = app.env.value;
  const close = () => (app.dialog.value = '');
  return (
    <Modal title="Ajustes de renderização" onClose={close} width={500} footer={<button class="primary" onClick={close}>Fechar</button>}>
      <Field label="Qualidade"><Select value={app.qualityLevel.value} options={(Object.keys(PROFILES) as QualityLevel[]).map(k => [k, PROFILES[k].label] as [QualityLevel, string])} onChange={v => app.setQualityLevel(v)} /></Field>
      <p class="muted">Build: <b>{BUILD_TARGET === 'native' ? 'nativo (completo)' : 'web (leve)'}</b> · Plataforma: <b>{platform().label}</b>. "Máxima" ativa oclusão de ambiente (GTAO), SMAA, sombras 4K e texturas de PCB de alta resolução.</p>
      <Field label="Iluminação (HDRI)"><Select value={e.preset} options={(Object.keys(ENV_PRESETS) as EnvPreset[]).map(k => [k, ENV_PRESETS[k]] as [EnvPreset, string])} onChange={v => app.setEnv({ preset: v })} /></Field>
      <Field label="Intensidade"><input type="range" min={0.2} max={2.5} step={0.05} value={e.intensity} onInput={ev => app.setEnv({ intensity: +(ev.target as HTMLInputElement).value })} /></Field>
      <Field label="Rotação da luz" unit="°"><input type="range" min={0} max={360} step={1} value={e.rotation} onInput={ev => app.setEnv({ rotation: +(ev.target as HTMLInputElement).value })} /></Field>
      <Field label="Exposição"><input type="range" min={0.3} max={2.5} step={0.05} value={e.exposure} onInput={ev => app.setEnv({ exposure: +(ev.target as HTMLInputElement).value })} /></Field>
      <Field label="Fundo"><Select value={e.bg} options={[['dark', 'Escuro (gradiente)'], ['light', 'Claro (gradiente)'], ['studio', 'Estúdio (HDRI)'], ['transparent', 'Transparente (PNG)']]} onChange={v => app.setEnv({ bg: v })} /></Field>
    </Modal>
  );
}

function RenderDialog() {
  const [samples, setSamples] = useState(256);
  const close = () => (app.dialog.value = '');
  return (
    <Modal title="Render fotorrealista" onClose={close} width={460} footer={<><button onClick={close}>Cancelar</button><button class="primary" onClick={() => { close(); app.startPhoto(samples); }}><Icon name="play" size={14} />Renderizar</button></>}>
      <p>Path tracing na GPU: iluminação global, refração real em vidro/safira, reflexos múltiplos e sombras físicas. Ideal para fotos de produto e apresentação para clientes.</p>
      <Field label="Amostras"><Select value={String(samples)} options={[['64', '64 — prévia rápida'], ['256', '256 — boa'], ['1024', '1024 — alta'], ['4096', '4096 — final (lento)']]} onChange={v => setSamples(+v)} /></Field>
      <p class="muted">Dica: em Ajustes, escolha a iluminação "Estúdio de produto" e o fundo "Claro" ou "Estúdio". Em celulares o render pode ser lento.</p>
    </Modal>
  );
}

function ArrayDialog() {
  const [count, setCount] = useState(4);
  const [axis, setAxis] = useState<'0' | '1' | '2'>('0');
  const [step, setStep] = useState(10);
  const close = () => (app.dialog.value = '');
  return (
    <Modal title="Padrão linear (array)" onClose={close} width={380} footer={<><button onClick={close}>Cancelar</button><button class="primary" onClick={() => { close(); app.array(count, +axis as 0 | 1 | 2, step); }}>Aplicar</button></>}>
      <Field label="Quantidade total"><NumInput value={count} step={1} min={2} max={500} digits={0} onCommit={setCount} /></Field>
      <Field label="Eixo"><Select value={axis} options={[['0', 'X'], ['1', 'Y'], ['2', 'Z']]} onChange={setAxis} /></Field>
      <Field label="Espaçamento" unit="mm"><NumInput value={step} step={0.5} onCommit={setStep} /></Field>
    </Modal>
  );
}

function AboutDialog() {
  return (
    <Modal title="Sobre o ZeyForge" onClose={() => (app.dialog.value = '')}>
      <p><b>ZeyForge v{__APP_VERSION__}</b> — CAD 3D de hardware para web, Windows, Linux, macOS e Android.</p>
      <p class="muted">Motor: three.js (PBR), three-gpu-pathtracer, three-bvh-csg. Desktop: Tauri v2. Android: Capacitor.</p>
    </Modal>
  );
}

declare global { const __APP_VERSION__: string }

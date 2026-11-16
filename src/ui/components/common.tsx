// Componentes básicos de interface.
import type { ComponentChildren } from 'preact';
import { useEffect, useRef, useState } from 'preact/hooks';
import { Icon } from '../icons';
import { fmt } from '@/core/units';

export function Btn(p: { icon?: string; label?: string; title?: string; on?: boolean; onClick?: (e: MouseEvent) => void; cls?: string; showLabel?: boolean; disabled?: boolean; kbd?: string }) {
  return (
    <button class={`tb${p.on ? ' on' : ''}${p.cls ? ' ' + p.cls : ''}`} title={p.title ?? p.label} onClick={p.onClick} disabled={p.disabled} aria-pressed={p.on}>
      {p.icon && <Icon name={p.icon} />}
      {p.showLabel !== false && p.label && <span class="lbl">{p.label}</span>}
    </button>
  );
}

export function Field(p: { label: string; unit?: string; children: ComponentChildren; hint?: string; wide?: boolean }) {
  return (
    <label class={`field${p.wide ? ' wide' : ''}`} title={p.hint}>
      <span class="fl">{p.label}</span>
      {p.children}
      {p.unit !== undefined ? <span class="unit">{p.unit}</span> : <span />}
    </label>
  );
}

/** Campo numérico: digitação livre, aplica ao vivo (onLive) e confirma (onCommit) no Enter/blur; roda do mouse ajusta. */
export function NumInput(p: { value: number; step?: number; min?: number; max?: number; digits?: number; onLive?: (v: number) => void; onCommit: (v: number) => void; id?: string; cls?: string }) {
  const [text, setText] = useState(fmt(p.value, p.digits ?? 3));
  const focused = useRef(false);
  useEffect(() => { if (!focused.current) setText(fmt(p.value, p.digits ?? 3)); }, [p.value]);
  const clamp = (v: number) => Math.min(p.max ?? Infinity, Math.max(p.min ?? -Infinity, v));
  const parse = (s: string) => { const v = Number(s.replace(',', '.')); return Number.isFinite(v) ? clamp(v) : null; };
  return (
    <input
      id={p.id} class={p.cls} type="text" inputMode="decimal" value={text}
      onFocus={() => (focused.current = true)}
      onBlur={() => { focused.current = false; const v = parse(text); if (v != null) p.onCommit(v); else setText(fmt(p.value, p.digits ?? 3)); }}
      onInput={e => { const s = (e.target as HTMLInputElement).value; setText(s); const v = parse(s); if (v != null) p.onLive?.(v); }}
      onKeyDown={e => {
        if (e.key === 'Enter') (e.target as HTMLInputElement).blur();
        if (e.key === 'ArrowUp' || e.key === 'ArrowDown') { e.preventDefault(); const v = clamp((parse(text) ?? p.value) + (e.key === 'ArrowUp' ? 1 : -1) * (p.step ?? 1) * (e.shiftKey ? 10 : 1)); setText(fmt(v, p.digits ?? 3)); p.onCommit(v); }
      }}
      onWheel={e => { if (!focused.current) return; e.preventDefault(); const v = clamp((parse(text) ?? p.value) + (e.deltaY < 0 ? 1 : -1) * (p.step ?? 1)); setText(fmt(v, p.digits ?? 3)); p.onCommit(v); }}
    />
  );
}

export function Select<T extends string>(p: { value: T; options: [T, string][] | { group: string; items: [T, string][] }[]; onChange: (v: T) => void }) {
  const grouped = p.options.length > 0 && !Array.isArray(p.options[0]);
  return (
    <select value={p.value} onChange={e => p.onChange((e.target as HTMLSelectElement).value as T)}>
      {grouped
        ? (p.options as { group: string; items: [T, string][] }[]).map(g => <optgroup label={g.group}>{g.items.map(([v, l]) => <option value={v}>{l}</option>)}</optgroup>)
        : (p.options as [T, string][]).map(([v, l]) => <option value={v}>{l}</option>)}
    </select>
  );
}

export function Toggle(p: { value: boolean; onChange: (v: boolean) => void }) {
  return <input type="checkbox" class="toggle" checked={p.value} onChange={e => p.onChange((e.target as HTMLInputElement).checked)} />;
}

export function Tabs<T extends string>(p: { value: T; tabs: { id: T; label: string; icon?: string; badge?: ComponentChildren }[]; onChange: (v: T) => void }) {
  return (
    <div class="tabs" role="tablist">
      {p.tabs.map(t => (
        <button role="tab" class={p.value === t.id ? 'on' : ''} onClick={() => p.onChange(t.id)}>
          {t.icon && <Icon name={t.icon} size={15} />}{t.label}{t.badge}
        </button>
      ))}
    </div>
  );
}

export interface MenuItem { label: string; icon?: string; kbd?: string; onClick: () => void; disabled?: boolean }
export function Menu(p: { label: string; icon: string; items: (MenuItem | '-')[] }) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!open) return;
    const close = (e: MouseEvent) => { if (!ref.current?.contains(e.target as Node)) setOpen(false); };
    window.addEventListener('pointerdown', close);
    return () => window.removeEventListener('pointerdown', close);
  }, [open]);
  return (
    <div class="menu" ref={ref}>
      <button class={`tb${open ? ' on' : ''}`} onClick={() => setOpen(!open)}><Icon name={p.icon} /><span class="lbl">{p.label}</span></button>
      {open && (
        <div class="menu-pop">
          {p.items.map(it => it === '-' ? <hr /> : (
            <button disabled={it.disabled} onClick={() => { setOpen(false); it.onClick(); }}>
              {it.icon ? <Icon name={it.icon} size={16} /> : <span style="width:16px" />}<span class="ml">{it.label}</span>{it.kbd && <kbd>{it.kbd}</kbd>}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

export function Modal(p: { title: string; onClose: () => void; children: ComponentChildren; footer?: ComponentChildren; width?: number }) {
  useEffect(() => { const k = (e: KeyboardEvent) => e.key === 'Escape' && p.onClose(); window.addEventListener('keydown', k); return () => window.removeEventListener('keydown', k); }, []);
  return (
    <div class="modal" onPointerDown={e => { if (e.target === e.currentTarget) p.onClose(); }}>
      <div class="modal-box" style={{ width: `min(${p.width ?? 440}px, 94vw)` }}>
        <div class="modal-head"><h3>{p.title}</h3><button class="x" onClick={p.onClose}><Icon name="close" size={16} /></button></div>
        <div class="modal-body">{p.children}</div>
        {p.footer && <div class="modal-foot">{p.footer}</div>}
      </div>
    </div>
  );
}

export function Section(p: { title: string; children: ComponentChildren; right?: ComponentChildren }) {
  return <div class="section"><div class="sec-head"><h4>{p.title}</h4>{p.right}</div>{p.children}</div>;
}

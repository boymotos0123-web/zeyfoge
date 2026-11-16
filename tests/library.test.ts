import { describe, it, expect } from 'vitest';
import { LIBRARY, socketsOf, defaults, costOf } from '../src/library/registry';
import { TEMPLATES } from '../src/library/templates';
import { newDocument } from '../src/core/document';
import { validate } from '../src/core/connectivity';
import { socketOf } from '../src/library/factory';

describe('biblioteca', () => {
  it('todos os componentes têm parâmetros e encaixes coerentes', () => {
    const types = new Set<string>();
    for (const d of LIBRARY) {
      expect(types.has(d.type), `tipo duplicado ${d.type}`).toBe(false);
      types.add(d.type);
      const p = defaults(d.type);
      expect(Number.isFinite(costOf(d.type, p))).toBe(true);
      const ss = socketsOf(d.type, p);
      const ids = new Set(ss.map(s => s.id));
      expect(ids.size, `ids de encaixe repetidos em ${d.type}`).toBe(ss.length);
      for (const s of ss) {
        expect(Math.hypot(...s.normal)).toBeCloseTo(1, 3);
        if (s.pinNames) expect(s.pinNames.length, `${d.type}.${s.id} pinNames`).toBe(s.pins);
        if (s.pinOffsets) expect(s.pinOffsets.length, `${d.type}.${s.id} pinOffsets`).toBe(s.pins);
      }
    }
    expect(LIBRARY.length).toBeGreaterThan(45);
  });

  it('pinagens reais: ESP32 30 pinos, RPi 40 pinos, Uno com 5 V', () => {
    const esp = socketsOf('esp32_devkit', defaults('esp32_devkit'));
    expect(esp.filter(s => s.kind === 'header-male').reduce((n, s) => n + s.pins, 0)).toBe(30);
    const pi = socketsOf('rpi4', defaults('rpi4')).find(s => s.id === 'GPIO')!;
    expect(pi.pins).toBe(40); expect(pi.pinNames![0]).toBe('3V3'); expect(pi.pinNames![1]).toBe('5V'); expect(pi.logicVoltage).toBe(3.3);
    const uno = socketsOf('arduino_uno', defaults('arduino_uno')).find(s => s.id === 'PWR')!;
    expect(uno.pinTypes).toContain('5v');
  });

  it('montagens prontas criam todas as conexões sem erros', () => {
    for (const t of TEMPLATES) {
      const doc = newDocument(t.name);
      t.build(doc);
      const issues = validate(doc, e => socketOf(doc, e), new Map());
      expect(issues.filter(i => i.severity === 'error'), t.name).toEqual([]);
    }
    const phone = newDocument(); TEMPLATES.find(t => t.id === 'phone')!.build(phone);
    expect(phone.cables.length).toBe(6);
    const pi = newDocument(); TEMPLATES.find(t => t.id === 'rpi-cam-oled')!.build(pi);
    expect(pi.cables.filter(c => c.kind === 'wire').length).toBe(4);
    expect(pi.cables.filter(c => c.kind === 'fpc').length).toBe(1);
  });
});

import { describe, it, expect } from 'vitest';
import { newDocument, createNode, createCable, cloneNodes, removeNodes, topLevel } from '../src/core/document';
import { History } from '../src/core/history';
import { checkBusConnection, checkWireConnection, validate, buildNets, minBendRadius } from '../src/core/connectivity';
import { buildBom, computePrice } from '../src/core/bom';
import { encodeProject, decodeProject, encodeMesh, decodeMesh } from '../src/core/fileformat';
import type { SocketDef, Endpoint } from '../src/core/types';

const sock = (o: Partial<SocketDef>): SocketDef => ({ id: 's', label: 'S', kind: 'fpc', pins: 24, pitch: 0.5, pos: [0, 0, 0], normal: [0, 0, 1], axis: [1, 0, 0], ...o });

describe('documento', () => {
  it('clona com descendentes e cabos internos', () => {
    const d = newDocument();
    const g = createNode('assembly', { name: 'G' }); d.nodes.push(g);
    const a = createNode('box', { parent: g.id }); const b = createNode('box', { parent: g.id }); d.nodes.push(a, b);
    d.cables.push(createCable('fpc', { node: a.id, socket: 'x' }, { node: b.id, socket: 'y' }));
    const [copy] = cloneNodes(d, [g.id, a.id], [10, 0, 0]);
    expect(d.nodes.length).toBe(6);
    expect(d.cables.length).toBe(2);
    expect(d.nodes.find(n => n.id === copy)!.pos[0]).toBe(10);
    expect(topLevel(d, [g.id, a.id])).toEqual([g.id]);
    removeNodes(d, [copy]);
    expect(d.nodes.length).toBe(3);
    expect(d.cables.length).toBe(1);
  });
  it('desfaz e refaz', () => {
    const d = newDocument(); const h = new History(); h.reset(d);
    d.nodes.push(createNode('box')); h.commit(d, 'Adicionar');
    d.nodes.push(createNode('box')); h.commit(d, 'Adicionar 2');
    expect(h.undo(d)).toBe('Adicionar 2'); expect(d.nodes.length).toBe(1);
    expect(h.redo(d)).toBe('Adicionar 2'); expect(d.nodes.length).toBe(2);
    expect(h.commit(d, 'nada')).toBe(false);
  });
});

describe('conexões', () => {
  it('valida flat por pinos e passo', () => {
    expect(checkBusConnection(sock({}), sock({})).ok).toBe(true);
    expect(checkBusConnection(sock({}), sock({ pins: 30 })).ok).toBe(false);
    expect(checkBusConnection(sock({}), sock({ pitch: 1 })).ok).toBe(false);
    expect(checkBusConnection(sock({ kind: 'mipi-csi' }), sock({ kind: 'mipi-dsi' })).ok).toBe(false);
  });
  it('detecta curto e 5 V em GPIO de 3,3 V', () => {
    const esp = sock({ kind: 'header-male', pins: 3, pitch: 2.54, pinTypes: ['gpio', 'gnd', '3v3'], logicVoltage: 3.3 });
    const uno = sock({ kind: 'header-female', pins: 2, pitch: 2.54, pinTypes: ['5v', 'gnd'], logicVoltage: 5 });
    expect(checkWireConnection(uno, 0, esp, 1).ok).toBe(false);          // 5V -> GND
    const w = checkWireConnection(uno, 0, esp, 0);                         // 5V -> GPIO 3.3V
    expect(w.ok).toBe(true); expect(w.warning).toMatch(/5 V/);
    expect(checkWireConnection(uno, 1, esp, 1).ok).toBe(true);            // GND comum
  });
  it('acha curto através de vários fios (netlist)', () => {
    const d = newDocument();
    const a = createNode('a'), b = createNode('b'), c = createNode('c'); d.nodes.push(a, b, c);
    const S: Record<string, SocketDef> = {
      [a.id]: sock({ kind: 'header-male', pins: 2, pinTypes: ['5v', 'gnd'] }),
      [b.id]: sock({ kind: 'header-male', pins: 1, pinTypes: ['signal'] }),
      [c.id]: sock({ kind: 'header-male', pins: 2, pinTypes: ['gnd', 'gpio'] }),
    };
    const resolve = (e: Endpoint) => S[e.node];
    d.cables.push(createCable('wire', { node: a.id, socket: 's', pin: 0 }, { node: b.id, socket: 's', pin: 0 }));
    d.cables.push(createCable('wire', { node: b.id, socket: 's', pin: 0 }, { node: c.id, socket: 's', pin: 0 }));
    expect(buildNets(d, resolve).length).toBe(1);
    const issues = validate(d, resolve, new Map());
    expect(issues.some(i => i.severity === 'error' && /curto/i.test(i.message))).toBe(true);
  });
  it('raio de dobra IPC', () => { expect(minBendRadius(0.1, 1)).toBeCloseTo(0.6); expect(minBendRadius(0.2, 2)).toBeCloseTo(2); });
});

describe('BOM e preço', () => {
  it('soma custo e massa', () => {
    const d = newDocument();
    const n = createNode('x', { cost: 10 }); n.qty = 3; d.nodes.push(n);
    const b = buildBom(d, { describe: () => ({ category: 'X' }), massOf: () => 5, cableLength: () => 0 });
    expect(b.totalCost).toBe(30); expect(b.totalMass).toBe(15);
    const p = computePrice(100, { assembly: 0, packaging: 0, shipping: 0, tax: 10, margin: 40 });
    expect(p.price).toBeCloseTo(200); expect(p.profit).toBeCloseTo(80);
  });
});

describe('arquivo .zeyforge', () => {
  it('ida e volta com assets binários', () => {
    const d = newDocument('Teste');
    const mesh = encodeMesh(new Float32Array([0, 0, 0, 1, 0, 0, 0, 1, 0]), null, new Uint32Array([0, 1, 2]));
    d.assets['m'] = { id: 'm', name: 'tri', type: 'mesh', unitScale: 1, data: mesh };
    d.nodes.push(createNode('box'));
    const back = decodeProject(encodeProject(d));
    expect(back.name).toBe('Teste');
    expect(back.nodes.length).toBe(1);
    const m = decodeMesh(back.assets['m'].data);
    expect(Array.from(m.idx!)).toEqual([0, 1, 2]);
  });
});

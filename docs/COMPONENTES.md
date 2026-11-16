# Como criar um componente

Os componentes ficam em `src/library/`. Cada um é um `ComponentDef`:

```ts
import type { ComponentDef } from '../types';
import { num, bool, socket, inferPinType } from '../types';
import { Board } from '@/geometry/board';
import { qfn, header, smdPassive } from '@/geometry/parts';

export const meuSensor: ComponentDef = {
  type: 'meu_sensor',                 // id único (vai para o arquivo)
  name: 'Sensor BME280 (módulo)',
  category: 'Telas e câmeras',         // ou outra categoria de CATEGORY_ORDER
  partNumber: 'GY-BME280',
  cost: 18,                           // R$ (ou função dos parâmetros)
  mass: 1.2,                          // g (omita para calcular por volume × densidade)
  params: { pins: bool('Pinos soldados', true) },
  sockets: p => [socket({
    id: 'I2C', label: 'VIN · GND · SCL · SDA', kind: 'header-male', pins: 4, pitch: 2.54,
    pos: [0, 8.6, -5], normal: [0, 1, 0], axis: [1, 0, 0],
    pinNames: ['VIN', 'GND', 'SCL', 'SDA'], pinTypes: ['VIN', 'GND', 'SCL', 'SDA'].map(inferPinType),
    logicVoltage: 3.3, termination: 'pin',
  })],
  build: p => {
    const b = new Board({ w: 15, d: 12, t: 1.6, mask: 'fr4_roxo', seed: 280 });
    b.add(qfn(2.5, 2.5, 0.9, 2, [{ text: 'BME', size: 0.5 }]), 0, 1, 0, { ref: 'U1' });
    b.add(smdPassive('0402', 'cap'), 3, 1);
    if (p.pins) b.add(header(4, 1, false), 0, -5, 0, { outline: false });
    return b.build();
  },
};
```

Depois registre o componente em `src/library/registry.ts` (array `LIBRARY`). A miniatura, a busca, a BOM, a massa e a validação passam a funcionar sozinhas.

## Convenções
- **mm**, **Y para cima** e origem no **centro da base** da peça.
- Use `Board` para placas. Cada peça posicionada com `b.add()` registra seus **pads** na textura da PCB (via `userData.fp`).
- Materiais: chaves de `src/core/materials-db.ts` (a densidade define a massa).
- Encaixes: a `normal` aponta **para onde o cabo sai** e o `axis` segue a fileira de pinos. Para conectores BTB, a `pos` fica 1,5 mm à frente do centro do receptáculo, no sentido da `normal`.
- Pinagem: `pinNames` na ordem física. Use `pinOffsets` quando houver duas fileiras.

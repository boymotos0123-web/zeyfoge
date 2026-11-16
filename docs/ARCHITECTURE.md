# Arquitetura do ZeyForge

## Visão geral

```
┌────────────────────────── UI (Preact + signals) ──────────────────────────┐
│ TopBar · Biblioteca/Cena · Viewport (overlays, ViewCube) · Propriedades /   │
│ Conexões / BOM · Diálogos (importar, ajustes, render, array)                │
└───────────────▲───────────────────────────────────────────┬────────────────┘
                │ signals (versão, seleção, ferramenta…)     │ comandos
┌───────────────┴──────────── app/controller.ts ────────────▼────────────────┐
│ Estado reativo · comandos de edição · ferramentas (mover, medir, conectar,  │
│ fio, encaixe) · histórico · autosave (IndexedDB) · arquivos · validação     │
└──────┬───────────────────┬───────────────────┬──────────────────┬──────────┘
       │                   │                   │                  │
┌──────▼──────┐   ┌────────▼────────┐  ┌───────▼───────┐  ┌───────▼────────┐
│ core/       │   │ engine/          │  │ library/      │  │ platform/      │
│ (TS puro)   │   │ (three.js)       │  │ (componentes) │  │ web·tauri·     │
│ tipos, doc, │   │ Viewport, HDRI,  │  │ boards, módulos│  │ android        │
│ histórico,  │   │ texturas, PBR,   │  │ conectores,    │  └────────────────┘
│ conexões,   │   │ sombras, GTAO,   │  │ mecânica,      │  ┌────────────────┐
│ BOM, formato│   │ path tracer,     │  │ chassi,        │  │ io/            │
└─────────────┘   │ scene-sync       │  │ templates      │  │ import/export  │
                  └────────┬─────────┘  └───────┬────────┘  └────────────────┘
                           │                    │
                  ┌────────▼────────────────────▼─────────┐
                  │ geometry/ — primitivas mm, peças SMD/CIs│
                  │ /conectores, Board (PCB), cabos, CSG,   │
                  │ massa (volume/centroide), otimização    │
                  │ connect/ — roteamento, snapping         │
                  └─────────────────────────────────────────┘
```

## Princípios

1. **O documento é a verdade.** `ZDocument` (core/types.ts) contém nós, cabos, precificação e assets. A cena three.js é derivada dele por `engine/scene-sync.ts`. Desfazer/refazer, salvar e validar trabalham só sobre o documento.
2. **Núcleo sem dependências gráficas.** `core/` não importa three.js nem DOM. Por isso é testado em Node (`tests/core.test.ts`): regras de conexão, netlist, BOM, histórico e formato de arquivo.
3. **Componentes paramétricos.** Cada `ComponentDef` (library/types.ts) declara parâmetros, custo, massa, **encaixes** e a função `build(params)` que gera a geometria em mm. Tudo derivado (miniaturas, BOM, validação) vem dessa definição.
4. **Unidades.** 1 unidade = 1 mm, Y para cima, ângulos em graus no documento, massa em gramas, custo em R$.
5. **Plataforma isolada.** `platform/` abstrai abrir/salvar/exportar. O mesmo código roda no navegador (File System Access API), no Tauri (diálogos nativos + fs) e no Android (Filesystem + Share). Os adaptadores nativos são carregados sob demanda.
6. **Web leve × nativo completo.** O build `--mode web` usa o perfil *Equilibrada/Rápida* e carrega pós-processamento, path tracer, CSG e exportadores só quando necessário (code splitting). O build `--mode native` começa no perfil *Máxima* (GTAO + SMAA, sombras 4K, texturas de PCB a 16 px/mm, HDRI 2048).

## Pipeline de renderização

1. `environment.ts` gera um **HDRI equirretangular HDR** (half-float) com softboxes e gradiente. O three converte para PMREM no raster, e o path tracer usa o mesmo mapa.
2. `materials.ts` cria `MeshPhysicalMaterial` a partir de `core/materials-db.ts`: densidade, IOR, transmissão, anisotropia, iridescência (AR coating), clearcoat e acabamentos procedurais (`textures/finish.ts`). Os UVs são projetados em **mm** (`mmUV`), então a escova tem escala física.
3. `textures/pcb.ts` desenha mapas de cor, rugosidade/metal e relevo para cada placa a partir dos **footprints** das peças posicionadas pelo `Board`.
4. Por quadro: sombras de contato (`contact-shadows.ts`, quando há mudança) → render (com `PostFX`: RenderPass → GTAO → Output → SMAA) → rótulos CSS2D.
5. *Render fotorrealista:* `pathtracer.ts` usa `three-gpu-pathtracer` sobre a mesma cena e acumula amostras.

## Conexões

- `SocketDef` define posição, normal (direção de saída), eixo (fileira de pinos), vias, passo, nomes e tipos elétricos dos pinos, tensão lógica e terminação (BTB, ZIF, solda ou pino).
- `connect/route.ts` monta a rota com saídas retas, Catmull-Rom centrípeta, **transporte paralelo** da largura e torção distribuída até o eixo do conector final. Também calcula o **raio de dobra** (pela espessura) e a **curva lateral** (no plano da fita).
- `geometry/cable.ts` gera a fita (4 faces com normais corretas e UV para trilhas), os enrijecedores, os contatos, os plugs BTB, os IDC, os fios com Dupont e o cabo USB.
- `core/connectivity.ts` guarda as regras de compatibilidade, de encaixe direto (snapping), as regras elétricas por pino, a **netlist** (union-find) e a validação completa.

## Desempenho

- `geometry/optimize.ts` funde malhas estáticas que compartilham material: no celular, as draw calls caem de cerca de 1200 para cerca de 560.
- Pinos, furos e teclas usam `InstancedMesh`.
- Caches: materiais, acabamentos, texturas de PCB (LRU de 64), etiquetas, HDRI e GLBs importados.
- Massa: integração de tetraedros com cache por nó (invalidada quando a geometria ou o material mudam).

## Estrutura de pastas

```
src/
  app/        controller (estado + comandos), atalhos, armazenamento
  core/       tipos, documento, histórico, conexões, BOM, materiais físicos, formato .zeyforge, unidades
  engine/     Viewport, scene-sync, HDRI, sombras de contato, pós-processamento, path tracer, ViewCube, marcadores, texturas/
  geometry/   primitivas, peças eletrônicas, Board (PCB), cabos, CSG, massa, otimização
  connect/    roteamento de cabos, encaixe magnético
  library/    registry, factory, templates, pinouts, boards/, modules/, catálogos de peças e chassi
  io/         importação (GLB/GLTF/STL/OBJ) e exportação (STL/OBJ/GLTF/GLB)
  platform/   web, tauri, capacitor
  ui/         App, painéis, diálogos, componentes, ícones, estilos, miniaturas
src-tauri/    app desktop (Rust, Tauri v2)
android/      app Android (Capacitor)
tests/        testes unitários (Vitest)
.github/      CI, release multiplataforma, GitHub Pages
```

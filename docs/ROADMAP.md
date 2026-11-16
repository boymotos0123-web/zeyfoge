# Roadmap

## ✅ Etapa 1 — v0.2 (esta versão)
Arquitetura modular em TypeScript, web leve e nativo completo (Tauri v2 + Capacitor), render PBR fotorrealista com HDRI, GTAO e path tracing, PCBs com textura gerada, conexões com flat/FFC/fio e validação elétrica e mecânica, encaixe magnético, importação GLB/GLTF/STL/OBJ com editor de encaixes, BOM com massa, CI/CD multiplataforma.

## Etapa 2 — Kernel B-Rep e STEP
- Integrar **OpenCascade.js** (WASM, carregado sob demanda) para sólidos B-Rep exatos.
- **Importar STEP** (modelos oficiais de fabricantes e bibliotecas do KiCad) e **exportar STEP AP214/AP242**, o formato que fábricas e usinagem CNC pedem.
- Filetes e chamfros reais em arestas, cascas (shell) e furos roscados.

## Etapa 3 — Esboço com restrições
- Sketch 2D com cotas e relações (paralelo, tangente, simétrico) e um solver geométrico.
- Extrusão, revolução e varredura paramétricas, com árvore de recursos (*feature tree*).

## Etapa 4 — ECAD
- **Importar `.kicad_pcb`:** contorno, camadas, trilhas reais e modelos 3D dos footprints.
- Netlist real a partir do esquemático e checagem cruzada com os cabos do ZeyForge.

## Etapa 5 — Verificações de engenharia
- **Interferência** entre peças e folgas mínimas.
- Térmica simplificada (dissipação por componente) e análise de queda do centro de massa.
- Tolerâncias (GD&T) e desenho técnico 2D com cotas, exportado em PDF.

## Etapa 6 — Produto
- Biblioteca colaborativa de componentes, colaboração em tempo real e versões do projeto.
- Visualização em **AR** (GLB + model-viewer) e páginas de apresentação para clientes.

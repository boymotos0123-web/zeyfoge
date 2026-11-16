# Changelog

## 0.2.0 — 2026-11-16
- Nova arquitetura em TypeScript com módulos `core`, `engine`, `geometry`, `connect`, `library`, `io`, `platform` e `ui` (Preact).
- Duas edições a partir do mesmo código: web leve (PWA) e nativa completa (Tauri v2 para Windows/Linux/macOS e Capacitor para Android).
- Render PBR fotorrealista: HDRI de estúdio procedural, sombras de contato, GTAO, SMAA, metal escovado anisotrópico, vidro com dispersão e lentes com AR coating.
- Texturas de PCB geradas a partir dos footprints (cobre, trilhas, vias, pads ENIG/HASL, silkscreen) e marcação a laser em chips.
- Render por path tracing.
- Sistema de encaixes com pinagem real, roteamento de flat flex/FFC/IDC/fio/USB com validação elétrica e de raio de dobra, netlist e encaixe magnético.
- Biblioteca hiper-detalhada: ESP32 DevKit (WROOM-32), Raspberry Pi 4, Pico, Uno, Nano, placa e sub-placa de celular, tela OLED, câmeras, bateria com BMS e mais.
- Importação GLB/GLTF/STL/OBJ com escala exata e editor de encaixes. Exportação STL/OBJ/GLTF/GLB/PNG/CSV.
- BOM com massa (volume × densidade), centro de massa e precificação.
- Formato `.zeyforge` (ZIP) com assets e miniatura; migração da v0.1.
- CI/CD: testes, release multiplataforma (instaladores + APK + zip web) e GitHub Pages.

## 0.1.0
- Protótipo web em JavaScript puro (three.js).

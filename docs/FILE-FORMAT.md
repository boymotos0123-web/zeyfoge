# Formato `.zeyforge`

Um arquivo `.zeyforge` é um **ZIP** com esta estrutura:

```
project.json        documento (JSON, formato 2)
assets/<id>.glb     modelos 3D importados (GLB original ou convertido)
assets/<id>.zfm     malhas binárias (resultado de booleanas)
thumbnail.png       miniatura do viewport no momento do salvamento
```

## project.json

| Campo | Tipo | Descrição |
|---|---|---|
| `app` | `"ZeyForge"` | identificador |
| `format` | `2` | versão do formato |
| `name`, `created`, `modified` | string | metadados |
| `units` | `"mm"` | unidade de comprimento |
| `nodes[]` | `DocNode` | peças e montagens (árvore via `parent`) |
| `cables[]` | `Cable` | flex, fitas, fios e cabos USB |
| `pricing` | `Pricing` | montagem, embalagem, frete, impostos e margem |
| `assets` | mapa | metadados dos assets (`name`, `type`, `unitScale`, `file`) |

`DocNode`: `id`, `name`, `kind` (`part` \| `assembly` \| `import` \| `mesh`), `type` (componente da biblioteca), `params`, `pos`/`rot`/`scl` (mm / graus / fator), `mat` (`preset`, `color`, `opacity`), `visible`, `locked`, `cost`, `qty`, `massOverride`, `partNumber`, `supplier`, `notes`, `asset`, `customSockets[]`.

`Cable`: `id`, `name`, `kind` (`fpc` \| `ribbon` \| `wire` \| `usb`), `a`/`b` (`node`, `socket`, `pin?`), `width`, `thickness`, `conductors`, `pitch`, `layers`, `color`, `waypoints[]` (mm, mundo), `lead`, `slack`, `stiffener`, `visible`, `cost`.

## Malha `.zfm`

Binário little-endian: cabeçalho `Uint32[4]` = `[0x314D465A ('ZFM1'), nVértices, nÍndices, temNormais]`, seguido de `Float32[n*3]` posições, `Float32[n*3]` normais (opcional) e `Uint32[nÍndices]`.

## Compatibilidade

Os arquivos `.zeyforge.json` da v0.1 são migrados automaticamente ao abrir (malhas em base64 viram `.zfm`).

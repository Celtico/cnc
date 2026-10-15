# Convencions del codi

Com s'organitza el codi perquè cada cosa nova tingui un lloc clar i no s'embruti la resta. Les regles marcades amb ✅ les
comprova `pnpm check` (si en trenques una, falla); la resta són criteri.

## Abans de donar res per acabat
```bash
pnpm check   # typecheck + lint (0 avisos) + codi mort (knip) + cicles (madge) + tests (incl. arquitectura i proves d'or)
pnpm build
```

## Capes
```
src/
  core/        lògica pura (sense React, Chakra, three ni Dexie) ✅
    model/       tipus, esquemes zod, migracions, catàlegs. makers/: noms dels fabricants (Blum, Hettich)
    build/       composició → peces. module/: el constructor del mòdul, per capes (base → carcass → lights →
                 fittings → fronts → drawers → zones). mount/: muntatge dels ferratges
    export/      STEP (step/), Maestro .xcs (maestro/), Vista CAM (cam/), CSV, DXF
    assets/      Poly Haven i fitxers de models 3D (textures i models que l'usuari puja)
    import/      importació de ferratges del fabricant: ADORMIDA (sense UI). Cap altre mòdul de core/ la fa servir ✅
    …            cutlist, nesting, machine, process, file, photo, assistant
  lib/         utilitats i hooks d'ús general, sense saber res de l'app ✅ (no importa de features/components/core)
  app/         l'esquelet de l'app: navegació, menú lateral, pestanyes del moble
  components/  mòduls compartits i el visor 3D. No importen de features/ ✅ (excepte l'estat global:
               features/settings/SettingsContext i features/useProject)
  features/    una carpeta per pantalla; dins, una subcarpeta per a les peces d'un component gran
  db/          Dexie
  theme/       tema de Chakra
```
- Les dependències van cap avall: `features → components → core`, i `lib` el pot fer servir tothom.
- Cap import circular en temps d'execució ✅ (`pnpm cycles`; els `import type` no compten).
- Res sense ús: ni fitxers, ni exports, ni dependències ✅ (`pnpm deadcode`). Si una cosa es treu de la UI i se'n vol
  guardar el codi, es diu a la documentació («adormit») i s'aïlla com `core/import`.

## Mida ✅
- Un fitxer: màxim **700 línies**. Una funció o component: màxim **350**. Objectiu real: components de menys de ~250 i
  fitxers de menys de ~400. Fora del límit només les dades (catàlegs, plantilles) i el traçador de camins (`render/`).
- Quan un component creix: l'**estat amb els seus efectes** va a un hook (`useXxx.ts`) al costat; els **blocs grans de JSX**
  van a components propis. Patrons ja fets: `features/editor/` (useEditorSelection, useEditorCamera, useEditorKeys,
  EditorInspector…), `features/ambients/editor/`, `components/viewer/cabinet/`.
- El que necessita un hook o un component se li passa explícitament (arguments i props). Res de contextos nous si no cal.

## UI: Chakra primer
- **Si Chakra ja ho té fet, es fa servir el de Chakra: no es reinventa la roda** (per decisió de l'usuari, 2026-10-15).
  Abans de fer un component, mira la llista de components de Chakra v3 (https://chakra-ui.com/docs/components; els
  instal·lats, a `node_modules/@chakra-ui/react/dist/types/components/`): `Splitter`, `Tabs`, `Slider`, `TreeView`,
  `FileUpload`, `ColorPicker`, `SegmentGroup`, `Accordion`, `Editable`, `EmptyState`…
- Un component de `components/` que fa una cosa que Chakra ja té és només un **embolcall petit que el configura** (valors per
  defecte, l'aspecte de l'app, la persistència): `PanelSplit` sobre `Splitter`, `FoldGroup` sobre `Accordion`. Res de lògica
  pròpia d'arrossegar, de teclat o d'ARIA si el component de Chakra ja la porta.
- El que es manté fet a mà ha de tenir un motiu concret (què no pot fer el de Chakra) a
  [`millores-v1/chakra-auditoria.md`](millores-v1/chakra-auditoria.md).

## React: una manera de fer cada cosa
| Per a | Fes servir |
|---|---|
| Llegir el valor d'ara des d'un callback, un temporitzador o un efecte | `useLatest(valor)` (`lib/useLatest.ts`) |
| Còpia editable d'un valor de fora (un nom, un lliscador) | `useDraft(valor)` (`lib/useDraft.ts`) |
| El mateix objecte mentre una clau no canviï | `useKeyed(valor, clau)` (`lib/useKeyed.ts`) |
| Desar amb retard | `useDebouncedSave` (`lib/`) |
| Preferència de vista al navegador | `usePersistentFlag` / `usePersistentNumber` (`lib/`) |
| Panells amb vora arrossegable (amplada recordada) | `PanelSplit` + `SplitHandle` (`components/`, sobre el `Splitter` de Chakra) |
| Tancar l'editor si l'element triat ja no hi és | `useCloseWhenGone` (`features/settings/`) |
- Els efectes porten **totes** les dependències. Si un efecte s'ha de disparar només amb algunes (enquadrar la càmera en
  obrir, un avís un cop), la línia de dependències porta
  `// eslint-disable-next-line react-hooks/exhaustive-deps -- <per què>`. Sense motiu no es desactiva.
- Les regles del React Compiler (`refs`, `immutability`, `set-state-in-effect`) estan desactivades: no el fem servir i
  react-three-fiber modifica objectes de three a propòsit.
- Un `.tsx` només exporta components (Fast Refresh); constants i hooks en un `.ts` a part.

## Fabricació
- Tot el que surt cap al taller (peces, forats, STEP, CSV, DXF, .xcs) ha de sortir igual si no es vol canviar: proves d'or
  (`src/core/build/__golden__`). Un canvi volgut: `UPDATE_GOLDEN=1 pnpm test` i es revisa el diff.
- En moure codi de `core/build` o `core/export`: no reordenar operacions, sumes ni la sortida (ho veuen les proves d'or).

## Estil
- Comentaris i textos de la UI en català; identificadors, fitxers i commits en anglès.
- Sense punts i coma, cometes dobles, 2 espais. Mai prettier. Només icones Lucide (`react-icons/lu`).
- Commits: l'autor és el Cel, sense línies de co-autor.

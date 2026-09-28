# CLAUDE.md — Mobles CNC (configurador paramètric)

## Què és
PWA personal per dissenyar mobles de cos (armaris, calaixeres, prestatgeries, mòduls)
de forma **paramètrica**, veure'ls **sobre una foto** del racó real i treure'n
**llista de peces, nesting i DXF** per tallar-los a la CNC (TopSolid / SCM Maestro
del taller del meu germà) o a una fusteria que talla a mida.

Projecte per passar-ho bé: sense clients, sense monetització. Prioritat: que funcioni
amb mobles reals de casa meva, no que ho faci tot.

## Idioma
- Respon-me sempre en **català**.
- Textos de la UI en català.
- Codi, identificadors, noms de fitxers i commits en **anglès**.

## Documentació (`docs/`)
- [`docs/prompt/PROMPT.md`](docs/prompt/PROMPT.md): abast i tasques de la **Fase 1** (mòdul de
  caixa de punta a punta, nesting simple, `toUnified`). Llegeix-lo abans de treballar
  en una fase.
- [`docs/prompt/PROMPT-editor-compartiments.md`](docs/prompt/PROMPT-editor-compartiments.md):
  **editor de compartiments**: composició de mòduls, divisions, portes, calaixos,
  reixeta, objectes de referència i plantilles. Prova d'acceptació: el moble de TV + el
  cobreradiador de casa.
- [`docs/prompt/PROMPT-visualitzacio.md`](docs/prompt/PROMPT-visualitzacio.md): vistes
  estàndard, portes i calaixos oberts, materials amb textura i veta, imatge PNG.
  **Sense decoració.**
- [`docs/prompt/PROMPT-foto.md`](docs/prompt/PROMPT-foto.md): foto del lloc: calibratge
  amb referència, mesures **relatives / estimades / reals**, recalibratge i moble superposat.
- [`docs/prompt/PROMPT-preferencies.md`](docs/prompt/PROMPT-preferencies.md): pantalla de
  **Preferències** (referències de foto, materials, taulers, ferratges, jocs, etiquetes).
- [`docs/prompt/PROMPT-fitxer-moble.md`](docs/prompt/PROMPT-fitxer-moble.md): **desar i
  obrir mobles com a fitxer `.moble`** (JSON versionat, amb foto opcional). Després de
  l'editor de compartiments.
- [`docs/prompt/PROMPT-moble-tv-radiador.md`](docs/prompt/PROMPT-moble-tv-radiador.md):
  **substituït** per l'editor de compartiments (referència del disseny del cobreradiador).
- [`docs/prompt/PROMPT-export-taller.md`](docs/prompt/PROMPT-export-taller.md): **export
  per al taller en format TopSolid (STEP 3D + CSV de nesting)**. És el camí principal.
- [`docs/prompt/PROMPT-taller-import.md`](docs/prompt/PROMPT-taller-import.md): **OBSOLET**
  (substituït per l'export STEP + CSV). Prompt per a
  `taller-cnc-nest` (endpoint `POST /api/nesting/import`). **No s'executa en aquest
  repo.**
- [`docs/export-taller.md`](docs/export-taller.md): decisions de l'export STEP + CSV
  (eixos, numeració de cantells del taller, geometria dels forats i ranures, etiqueta).
- [`docs/foto-mesures.md`](docs/foto-mesures.md): model de mesures de la foto
  (relativa / estimada / real, recalibratge, qualitat, línia del terra i fondària).
- Els prompts van a `docs/prompt/`. La resta de documentació nova (decisions, notes de fusteria) va a `docs/` en
  Markdown. El `CLAUDE.md` es queda a l'arrel i només hi enllaça.

## Principi de disseny
L'usuari dissenya els mobles **des de la UI**, sense tocar codi. El codi defineix
**capacitats genèriques** (carcassa, divisions, continguts, regles de fusteria); els
mobles concrets són dades (composicions i plantilles). Abans d'afegir un "tipus de
moble" nou, pregunta't si es pot fer amb zones i continguts. Normalment sí.
El mateix per als valors: mides de referència, materials, taulers, ferratges i jocs
per defecte són **preferències de l'usuari** (Dexie), no constants al codi. El codi
només porta els valors inicials.

## Stack (no el canviïs sense preguntar)
- **Vite + React 19 + TypeScript** (strict). Sense backend: tot al client.
- **Chakra UI v3** per a tota la UI → segueix la skill `chakra-ui-builder`
  (`.claude/skills/chakra-ui-builder/SKILL.md`).
- **react-icons** per a totes les icones, **només la família Lucide (`react-icons/lu`)**
  per coherència visual (és la que fa servir la documentació de Chakra v3).
- **three.js** via `@react-three/fiber` + `@react-three/drei` per al 3D.
- **vite-plugin-pwa** (instal·lable a iPhone, funciona offline).
- **Dexie** (IndexedDB) per guardar projectes i fotos en local.
- **zod** per validar el model de moble.
- **Vitest** per als tests del nucli.
- Gestor de paquets: **pnpm**.

## Arquitectura
```
src/
  core/          # lògica pura, SENSE React ni three.js. Testejada.
    model/       # tipus i esquemes zod: Furniture, Panel, Joint, Hardware
    build/       # regles: paràmetres -> peces (gruixos, encaixos, forats)
    cutlist/     # llista de peces, cantells, veta
    nesting/     # col·locació de peces rectangulars sobre taulers
    export/      # DXF (capes), CSV, GLB, UnifiedData (taller-cnc-nest)
    photo/       # homografia, calibració amb referència, EXIF
  features/      # pantalles: projects, editor, photo, cutlist, export
  components/
    ui/          # snippets generats per la CLI de Chakra (no editar a mà)
    viewer/      # escena 3D (r3f)
  theme/         # createSystem, tokens, recipes
  db/            # Dexie
```
Regla clau: **`core/` no importa mai de React, Chakra ni three**. Tota la geometria
de fabricació surt de `core/`; el visor 3D només la pinta.

## Unitats i convencions de fusteria
- Unitat interna: **mil·límetres, sempre `number` en mm**. Mai cm a la lògica; la UI
  pot mostrar cm però emmagatzema mm. (Al GLB per a AR: metres, dividir per 1000.)
- Coordenades dins la peça: **u sobre el costat llarg, v sobre el curt**, des de la
  cantonada de la peça (mateixa convenció que `taller-cnc-nest`).
- Cantells numerats **1 = dalt · 2 = dreta · 3 = baix · 4 = esquerra** (igual que el
  laminat i els forats de cantell del taller).
- Gruixos habituals del taller: **10 · 12 · 16 · 19 · 30**. Per defecte: tauler 19,
  fons 10 (confirmar amb mi si cal un altre).
- Sistema de forats: **System 32** (fileres a 37 mm del cantell, pas de 32 mm).
- Cazoleta de frontissa: Ø35 mm, profunditat 13 mm, a 22,5 mm del cantell (configurable).
- Taulers estàndard per al nesting: 2800×2070 i 2440×1220.
- Cada peça té: ref, nom, llarg, ample, gruix, material, veta, cantells (4),
  mecanitzats de cara (u, v, r, fondària, cara a/b), forats de cantell i buidats.

## Export DXF (important)
- Una peça per bloc/entitat, contorn en capa `CONTOUR`.
- Forats en capes per diàmetre i profunditat, p. ex. `DRILL_D5_P12`, `DRILL_D35_P13`,
  `DRILL_D8_P30`. Així TopSolid/Maestro els pot mapejar a eines.
- Coordenades en mm, sense escalar. Validar que l'arxiu s'obre en un visor DXF.

## Integració amb `taller-cnc-nest` (~/Desktop/taller-cnc-nest)
**Decisió: el configurador exporta els mateixos fitxers que TopSolid V6**, i el taller
els carrega per la seva pàgina de pujada de sempre (`POST /api/nesting/process`), sense
cap canvi al taller:

```
Configurador ──► <moble>.step       (STEP AP214 · sòlids del moble)
             └─► <moble>_res.csv    (CSV de nesting · peces, mides, posicions, refs)
                      │
                      ▼
        taller-cnc-nest: visor 3D, mecanitzats, etiquetes, laminat, escaneigs
             + DXF per a la CNC
```

- **Font de veritat: els parsers del taller** (`src/nesting/parsers/*`, `assemble.ts`).
  Si el taller no llegeix bé un fitxer nostre, s'arregla el nostre exportador, no el
  parser. **No es modifica res de `taller-cnc-nest` des d'aquí.**
- CSV: UTF-16 LE amb BOM, `;`, CRLF, mateixes columnes que la mostra `ARM02_res.csv`;
  fila de tauler `<material>:<L>x<A>x<gruix>` abans de les seves peces.
- STEP: mm, **X = amplada, Y = fondària, Z = amunt** (el nostre 3D és Y-amunt: es
  converteix en exportar); un `MANIFOLD_SOLID_BREP` per peça dins
  `ADVANCED_BREP_SHAPE_REPRESENTATION('<nom>')`; forats cecs com a cilindres.
- El taller lliga peça ↔ sòlid **per mida**. Peces idèntiques surten com a
  `representative`, i és normal.
- Noms de peça del vocabulari del taller (`lat d`, `lat e`, `base`, `sostre`,
  `prestatge`, `trassera`, `porta`, `frontal`) i refs `A.<mòdul>.<tipus>.<n>` a `ÍNDICE_3D`.
- Test d'anada i tornada: els fitxers generats es passen pels parsers del taller
  (importats del seu codi font, només lectura) i s'hi comproven peces, rols, forats i
  buidats. Detall a `docs/prompt/PROMPT-export-taller.md`.
- L'export JSON `UnifiedData` es pot mantenir per depurar, però ja no és el camí de
  producció.
- Diferències: allà Chakra **v2** + React 18, aquí Chakra **v3** + React 19. No es
  comparteix codi d'UI.

## Foto i visualització
- La foto serveix per **veure proporcions**, no per fabricar. Les mides reals
  sempre les entra l'usuari i **recalculen** el model i recalibren la foto.
- Calibració: l'usuari marca 4 punts d'un rectangle de mides conegudes (rajola,
  porta, A4) → homografia → escala i pla del terra/paret.
- Llegir EXIF (focal) si existeix; si no, continuar sense.
- AR: export USDZ + `<model-viewer>` amb AR Quick Look a l'iPhone. Res de WebXR.

## UI (Chakra v3 + react-icons)
- Mobile-first: la faig servir sobretot a l'iPhone. Mínim breakpoints `base` i `md`.
- **Panell esquerre = acordió** (`components/PanelSection.tsx` + `PanelGroup`): totes les
  seccions iguals (icona + títol + fletxa, sense fons), **només una oberta alhora**, i es
  recorda quina. Seccions noves (p. ex. l'alçat de compartiments) fan servir el mateix.
- **Editor = panell esquerre (paràmetres) + visor amb pestanyes `3D` · `Foto`**, les
  dues amb la mateixa disposició. Els controls de la pestanya activa van al panell
  esquerre, no en botons o finestres a part. La foto no té entrada pròpia al menú.
- **És una app, no una web**: el contingut ocupa **tota l'amplada** (sense `Container`
  amb `maxW` centrat). El 3D, la foto, l'alçat i el nesting s'estiren tant com la
  pantalla. Només es limita l'amplada dels panells de formulari (p. ex. 360–400 px) i
  dels textos llargs.
- **Inputs a 16px sempre** (globalCss a `createSystem`) per evitar el zoom d'iOS.
- Tokens semàntics (`bg.subtle`, `fg.muted`...) i `colorPalette`, no colors crus.
- Mode fosc suportat.
- Icones dins dels components de Chakra v3 com a **children**, no amb la prop `icon`:
  ```tsx
  import { LuRuler } from "react-icons/lu"
  <IconButton aria-label="Mesurar"><LuRuler /></IconButton>
  <Button><LuDownload /> Exportar DXF</Button>
  ```
- Tot `IconButton` porta `aria-label` en català.
- **Etiquetes curtes, que no saltin de línia** als panells (360–400 px, dues columnes):
  agrupa amb un títol i abrevia el camp ("Posició del moble" → `X` · `Y (alçada)`;
  "Mida coneguda" → `Amplada` · `Alçada`). L'explicació llarga va al `HelperText`.
- Camps numèrics de mides amb `NumberInput` i sufix "mm".

## Com treballar
- Abans de codi nou al `core/`, escriu o actualitza els tests (Vitest).
- Canvis petits i verificables. Després de cada fase: `pnpm typecheck`, `pnpm test`,
  `pnpm build` han de passar.
- No afegeixis dependències fora del stack sense preguntar.
- Si una decisió de fusteria no és clara (tolerància, tipus d'unió), pregunta'm
  en lloc d'inventar-te-la.

### Icones (catàleg fix, `react-icons/lu`)
Una icona = un significat a tota l'app. No en triïs d'altres per a aquestes accions; si en
cal una de nova, afegeix-la aquí. Botons només d'icona: `aria-label` + `Tooltip` en català.
Accions principals: icona + text.

| Àmbit | Acció | Icona |
|---|---|---|
| Navegació | Mobles · Editor · Peces · Nesting · Exportar | `LuFolder` · `LuBox` · `LuList` · `LuLayoutGrid` · `LuDownload` |
| Navegació | Tornar · Plegar/desplegar menú · Preferències | `LuArrowLeft` · `LuPanelLeftClose` / `LuPanelLeftOpen` · `LuSettings` |
| Zones | Dividir en vertical (divisor vertical, zones esquerra/dreta) | `LuSquareSplitHorizontal` |
| Zones | Dividir en horitzontal (travesser, zones dalt/baix) | `LuSquareSplitVertical` |
| Zones | Eliminar divisió · Mida | `LuUngroup` · `LuRuler` |
| Contingut | Obert · Prestatges · Porta · Calaixos | `LuSquareDashed` · `LuRows3` · `LuDoorClosed` · `LuArchive` |
| Contingut | Abatible · Reixeta · Front fix | `LuPanelBottom` · `LuGrid3X3` · `LuSquare` |
| Composició | Afegir · Duplicar · Eliminar · Reordenar | `LuPlus` · `LuCopy` · `LuTrash2` · `LuGripVertical` |
| Composició | Objecte de referència · Radiador · TV | `LuScan` · `LuHeater` · `LuTv` |
| Composició | Plantilles · Desar com a plantilla | `LuLayoutTemplate` · `LuBookmark` |
| Panell | Mides exteriors · Taulers · Interior i front · Fusteria · Adaptar a la imatge | `LuMoveDiagonal` · `LuSquareStack` · `LuLayoutPanelLeft` · `LuHammer` · `LuCamera` |
| Panell | Composició (mòduls i objectes de referència) · Compartiments (alçat) | `LuLayoutDashboard` · `LuLayoutPanelLeft` |
| Fitxer | Desar com a fitxer · Obrir fitxer | `LuSave` · `LuFolderOpen` |
| Estat | Avisos de fusteria · Desfer · Refer | `LuTriangleAlert` · `LuUndo2` · `LuRedo2` |
| Foto | Foto · Referència · Distància · Rectangle | `LuCamera` · `LuCrosshair` · `LuMoveHorizontal` · `LuRectangleHorizontal` |
| Foto | Origen (0,0) · Treure/tancar | `LuLocateFixed` · `LuX` |
| Foto | Mida estimada · Mida real (cinta) · Línia del terra · Fondària | `LuEye` · `LuCircleCheck` · `LuArrowDownToLine` · `LuArrowUpFromLine` |
| Visor | Forats · Explosionat / muntat · Ampliar / reduir 3D | `LuCircleDot` · `LuExpand` / `LuShrink` · `LuMaximize2` / `LuMinimize2` |
| Visor | Vista 3D · Obertura portes · Materials · Per tipus de peça · Imatge | `LuRotate3D` · `LuDoorOpen` · `LuPalette` · `LuLayers` · `LuImageDown` |
| Exportar | DXF (CNC) · STEP 3D · CSV de nesting · CSV de peces · GLB | `LuScissors` · `LuCuboid` · `LuLayoutGrid` · `LuFileDown` · `LuBoxes` |

Les vistes Davant, Darrere, Esquerra, Dreta i Dalt van amb **text**, sense icona. Compte:
a Lucide, `square-split-horizontal` té la línia **vertical**. Per això és la de "dividir en vertical".

## Ordres
```bash
pnpm dev         # servidor de desenvolupament
pnpm build       # build de producció + service worker
pnpm test        # vitest
pnpm typecheck   # tsc --noEmit
pnpm lint
```

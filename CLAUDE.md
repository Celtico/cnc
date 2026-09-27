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
- [`docs/prompt/PROMPT-taller-import.md`](docs/prompt/PROMPT-taller-import.md): prompt per a
  `taller-cnc-nest` (endpoint `POST /api/nesting/import`). **No s'executa en aquest
  repo.**
- Els prompts van a `docs/prompt/`. La resta de documentació nova (decisions, notes de fusteria) va a `docs/` en
  Markdown. El `CLAUDE.md` es queda a l'arrel i només hi enllaça.

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

## Integració amb `taller-cnc-nest` (~/Desktop/taller-cnc-nest) — CAMÍ DIRECTE
El taller té un sistema (NestJS + React/Chakra v2) amb visor 3D, etiquetes PDF i
traçabilitat de peces. El seu contracte és **`UnifiedData`** (`src/nesting/types.ts`
d'aquell repo). **Decisió: anem directes, sense TopSolid.** El configurador genera un
`UnifiedData` complet i el taller l'importa tal qual.

```
Configurador → UnifiedData (JSON) → POST /api/nesting/import (taller) → visor, etiquetes, escaneigs
            → DXF (per tallar a la CNC)
```

Què ha de complir el `UnifiedData` que generem (`core/export/unified.ts`):
- `mueble`, `material`, `ctr` (centre del moble, per al 3D).
- `boards` + per peça `tab`, `x`, `y`, `angle` (posició al tauler) → **cal nesting**.
  El taller etiqueta tauler a tauler, sense nesting no funciona.
- `pieces`: `ref` única, `name`, `thick`, `L`, `W`, `dim = [L, W]`, `r3d`, `side3d`,
  `solid` (índex), `match = 'exact'` sempre (coneixem la geometria real), `lam`
  (4 cantells, ordre 1 dalt · 2 dreta · 3 baix · 4 esquerra).
- `solids`: `min`, `size` (mm, coordenades del moble), `role`, `side`, `label`, i els
  mecanitzats `mach` (cara), `edges` (cantell), `pockets` (buidats). Les frontisses i
  ferratges com a sòlids `role: 'hw'` amb `label`.
- `joins`: quin ferratge uneix cada parell de sòlids i quants.

Regles:
- Els tipus es copien a `src/core/export/unified.types.ts` indicant-ne l'origen.
  **No els canviïs aquí.** Si falta un camp, s'amplia primer al taller, i només de
  manera additiva (regla d'or d'aquell repo).
- Esquema zod equivalent i test que el JSON generat el validi.
- Encara que el taller rebi el rol explícit, fes servir el seu vocabulari de noms
  (`lat d`, `lat e`, `base`, `sostre`, `prestatge`, `trassera`, `porta`, `frontal`),
  perquè altres parts del taller es basen en el nom.
- Refs: `A.<mòdul>.<tipus>.<n>` (p. ex. `A.1.H.3`).
- **No toquis `taller-cnc-nest` des d'aquest projecte.** L'endpoint d'importació es
  fa allà amb `docs/prompt/PROMPT-taller-import.md`.
- Diferències: allà Chakra **v2** + React 18, aquí Chakra **v3** + React 19. Es
  comparteix només el contracte de dades, no la UI.

(Via TopSolid queda com a opció secundària: el DXF segueix servint per tallar.)

## Foto i visualització
- La foto serveix per **veure proporcions**, no per fabricar. Les mides reals
  sempre les entra l'usuari i **recalculen** el model i recalibren la foto.
- Calibració: l'usuari marca 4 punts d'un rectangle de mides conegudes (rajola,
  porta, A4) → homografia → escala i pla del terra/paret.
- Llegir EXIF (focal) si existeix; si no, continuar sense.
- AR: export USDZ + `<model-viewer>` amb AR Quick Look a l'iPhone. Res de WebXR.

## UI (Chakra v3 + react-icons)
- Mobile-first: la faig servir sobretot a l'iPhone. Mínim breakpoints `base` i `md`.
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
- Camps numèrics de mides amb `NumberInput` i sufix "mm".

## Com treballar
- Abans de codi nou al `core/`, escriu o actualitza els tests (Vitest).
- Canvis petits i verificables. Després de cada fase: `pnpm typecheck`, `pnpm test`,
  `pnpm build` han de passar.
- No afegeixis dependències fora del stack sense preguntar.
- Si una decisió de fusteria no és clara (tolerància, tipus d'unió), pregunta'm
  en lloc d'inventar-te-la.

## Ordres
```bash
pnpm dev         # servidor de desenvolupament
pnpm build       # build de producció + service worker
pnpm test        # vitest
pnpm typecheck   # tsc --noEmit
pnpm lint
```

# CLAUDE.md — Mobles CNC (configurador paramètric)

## Què és
PWA personal per dissenyar mobles de cos (armaris, calaixeres, prestatgeries, mòduls) de forma **paramètrica**, veure'ls
**sobre una foto** del racó real i treure'n **llista de peces, nesting, programes de CNC i DXF** per tallar-los a la CNC del
taller del meu germà (SCM amb Xilog Maestro; abans TopSolid) o a una fusteria que talla a mida.

Projecte per passar-ho bé: sense clients, sense monetització. Prioritat: que funcioni amb mobles reals de casa meva, no que
ho faci tot.

**Objectiu (per decisió de l'usuari): substituir TopSolid** per fer mobles paramètrics per a la CNC. Això és el que importa:
el disseny paramètric, les peces, els mecanitzats i els fitxers per al taller han de funcionar bé. Ambients, objectes,
plantes, models 3D i renders són **decoratius**: no s'hi dedica temps mentre el nucli tingui coses per resoldre.

## Idioma
- Respon-me sempre en **català**. Textos de la UI i documentació en català.
- Codi, identificadors, noms de fitxers i commits en **anglès**.

## Documentació — llegeix la part que toques abans de canviar-la
Aquest fitxer és curt a propòsit: el detall de cada part és a `docs/funcional/`. **Abans de tocar una part, llegeix-ne el
document**; si canvies com funciona, actualitza'l en el mateix commit.

- [`docs/convencions.md`](docs/convencions.md): **com s'organitza el codi** (capes, mides, hooks comuns, efectes, `pnpm
  check`). Obligatori abans d'escriure codi.
- `docs/funcional/`: [model](docs/funcional/model.md) (el moble: composició, mòduls, zones, fronts, peces lliures) ·
  [fabricacio](docs/funcional/fabricacio.md) (regles de construcció) · [exports](docs/funcional/exports.md) (STEP, CSV,
  DXF, Maestro, Vista CAM, 3D/AR) · [maquines](docs/funcional/maquines.md) · [editor](docs/funcional/editor.md) (pàgines del
  moble i Editor) · [visor](docs/funcional/visor.md) (3D i render) · [materials](docs/funcional/materials.md) ·
  [foto](docs/funcional/foto.md) · [ambients](docs/funcional/ambients.md) ·
  [objectes-galeries](docs/funcional/objectes-galeries.md) · [preferencies](docs/funcional/preferencies.md) ·
  [ui-moduls](docs/funcional/ui-moduls.md) (mòduls compartits, navegació, mides tàctils) ·
  [fitxers-pwa](docs/funcional/fitxers-pwa.md) · [icones](docs/funcional/icones.md).
- Temes concrets: [`maestro-xcs.md`](docs/maestro-xcs.md) (programes de Maestro, orígens, eines; fonts a `docs/maestro/`,
  el manual MSL no es puja) · [`export-taller.md`](docs/export-taller.md) (format TopSolid) ·
  [`ferratges-jocs.md`](docs/ferratges-jocs.md) (jocs paramètrics del catàleg: **el camí dels ferratges**) ·
  [`ferratges-import.md`](docs/ferratges-import.md) (**adormit des del 2026-10-08**: importar del fabricant, sense UI; el
  codi és aïllat a `core/import`) · [`foto-mesures.md`](docs/foto-mesures.md) · [`xat-ia.md`](docs/xat-ia.md) (assistent
  IA) · [`colleccions-mobles.md`](docs/colleccions-mobles.md) · [`cad-mobles-cataleg.md`](docs/cad-mobles-cataleg.md) ·
  [`millores-v1/`](docs/millores-v1/) (auditories i decisions, p. ex. `coherencia-editor.md`, `chakra-auditoria.md`) · [`notes-cel.md`](docs/notes-cel.md).
- Prompts de cada fase a `docs/prompt/` (històric; el que mana és el codi i aquests documents).

## Principi de disseny
L'usuari dissenya els mobles **des de la UI**, sense tocar codi. El codi defineix **capacitats genèriques** (carcassa,
divisions, continguts, regles de fusteria); els mobles concrets són dades (composicions i plantilles). Abans d'afegir un
"tipus de moble" nou, pregunta't si es pot fer amb zones i continguts. Normalment sí. El mateix per als valors: mides de
referència, materials, taulers, ferratges, jocs i màquines són **preferències de l'usuari** (Dexie), no constants al codi;
el codi només porta els valors inicials.

## Stack (no el canviïs sense preguntar)
- **Vite + React 19 + TypeScript** (strict). Sense backend: tot al client. Gestor de paquets: **pnpm**.
- **Chakra UI v3** per a tota la UI → segueix la skill `chakra-ui-builder` (`.claude/skills/chakra-ui-builder/SKILL.md`).
- **react-icons**, **només la família Lucide (`react-icons/lu`)** (la de la documentació de Chakra v3).
- **three.js** via `@react-three/fiber` + `@react-three/drei` per al 3D; **three-bvh-csg** (+ `three-mesh-bvh`) per als
  booleans 3D de les peces que tallen de costat.
- **polygon-clipping** (booleans de polígons) per als encaixos i osques de les peces lliures.
- **vite-plugin-pwa** (instal·lable a l'iPhone, funciona sense connexió). **Dexie** (IndexedDB) per a projectes, fotos,
  ambients, models i preferències. **zod** per validar els models. **Vitest** per als tests del nucli.
- **occt-import-js** (OpenCascade en WASM): només **devDependency**, per als tests d'anada i tornada de la importació
  adormida (`core/import`). L'app ja no el carrega (el worker es va treure amb la importació).
- **`@anthropic-ai/sdk`** (aprovat per l'usuari el 2026-10-09 per a l'assistent IA, `docs/xat-ia.md`): el navegador crida
  l'API de Claude amb la clau de l'usuari (Preferències › Assistent IA, `dangerouslyAllowBrowser`). **A demanda**
  (`import()` a `features/assistant/claudeClient.ts`, en obrir el xat o provar la clau): no és al bloc d'entrada.
- **`@xyflow/react`** (React Flow, aprovat per l'usuari el 2026-10-15): només el dibuix de Preferències › Opcions en
  cascada, carregat a demanda (`lazy`).
- Lint: `oxlint`. **Mai prettier.**

## Arquitectura
Resum (el detall, a [`docs/convencions.md`](docs/convencions.md)):
```
src/
  core/         lògica pura i testejada: model/, build/, cutlist/, nesting/, export/, machine/, process/, file/,
                assets/, photo/, assistant/ · import/ (ADORMIT: ningú més de core/ el fa servir)
  lib/          hooks i utilitats generals (useLatest, useDraft, useKeyed, useDebouncedSave…)
  app/          navegació i esquelet de l'app
  components/   mòduls compartits (Workspace, FormRow, Fold…) i el visor 3D (viewer/, viewer/cabinet/, viewer/render/)
  features/     una carpeta per pantalla (projects, editor, composition, cutlist, nesting, export, photo, ambients,
                objects, settings, file, assistant, history)
  db/ · theme/
```
Regla clau: **`core/` no importa mai de React, Chakra ni three**. Tota la geometria de fabricació surt de `core/`; el visor
3D només la pinta. Les regles de capes, de mida i de cicles es comproven soles (`src/architecture.test.ts`, `pnpm check`).

## Convencions de fusteria
- Unitat interna: **mil·límetres, sempre `number` en mm**. Mai cm a la lògica; la UI pot mostrar cm però desa mm. (GLB/AR:
  metres.)
- Coordenades dins la peça: **u sobre el costat llarg, v sobre el curt**, des de la cantonada de la peça (com `taller-cnc-nest`).
- Cantells numerats **1 = dalt · 2 = dreta · 3 = baix · 4 = esquerra** (com el laminat i els forats de cantell del taller).
- Gruixos habituals del taller: **10 · 12 · 16 · 19 · 30**. Per defecte: tauler 19, fons 10 (confirmar amb mi si cal un altre).
- Sistema de forats: **System 32** (fileres a 37 mm del cantell, pas de 32 mm). Cassoleta de frontissa: Ø35, fondària 13,
  a 22,5 mm del cantell (configurable).
- Taulers estàndard: 2800×2070 i 2440×1220. Un tauler entrat dret (1220×2440) és el mateix: `nest` el fa servir apaïsat
  (`landscape`), la veta sempre va pel costat llarg (X) i els taulers del resultat tenen `w ≥ h`. Les posicions (x, y, cx,
  cy) no s'arrodoneixen: amb separació 0 i mides amb decimals, arrodonir només x/y feia solapar peces.
- Cada peça (`Panel`) té: ref, nom, llarg, ample, gruix, material, veta, cantells (4), mecanitzats de cara (u, v, r,
  fondària, cara A/B), forats de cantell, buidats, inglets, contorn opcional.
- Si una decisió de fusteria no és clara (tolerància, tipus d'unió), pregunta'm en lloc d'inventar-la.

## Proves d'or (golden)
- `src/core/build/golden.test.ts` construeix un corpus fix (totes les plantilles —app, botiga, col·leccions, revista— i 200
  variacions aleatòries amb llavor, `build/testCorpus.ts`, ids estables) i en compara un resum determinista amb
  `src/core/build/__golden__/*.json`: per moble, peces i avisos (codis); per peça, rol, nom, L×A×G, material, veta, cantells,
  inglets, forats, ranures, talls, contorn i col·locació (hash). `exports.json`: CSV de TopSolid, .xcs per tauler (context
  real de la màquina) i entitats del DXF per capa d'uns quants.
- **Qualsevol canvi volgut a la fabricació** s'actualitza a propòsit: `UPDATE_GOLDEN=1 pnpm test` i es **revisa el diff** dels
  JSON (què ha canviat i a quins mobles). Un diff que no s'esperava és un error.

## UI (Chakra v3 + react-icons)
### Regles
- **Si Chakra ja ho té fet, es fa servir el de Chakra: no es reinventa la roda** (per decisió de l'usuari, 2026-10-15). Abans
  de fer un component o un comportament (vores arrossegables, pestanyes, lliscadors, arbres, pujar fitxers…), mira la llista
  de components de Chakra v3 (https://chakra-ui.com/docs/components, i els instal·lats a
  `node_modules/@chakra-ui/react/dist/types/components/`). Al `components/` només hi van **embolcalls petits que configuren
  Chakra** (p. ex. `PanelSplit` sobre `Splitter`). El que es manté fet a mà té el motiu escrit a
  [`docs/millores-v1/chakra-auditoria.md`](docs/millores-v1/chakra-auditoria.md).
- **Mobile-first**: la faig servir sobretot a l'iPhone. Mínim breakpoints `base` i `md`.
- **És una app, no una web**: contingut a **tota l'amplada** (sense `Container` amb `maxW`); 3D, foto, alçat i nesting
  s'estiren. Només es limita l'amplada dels formularis i dels textos llargs.
- Tokens semàntics (`bg.subtle`, `fg.muted`…) i `colorPalette`, no colors crus. **Color principal = paleta `wood`** sempre
  (`colorPalette="wood"`, `wood.fg`, `wood.solid`…); res de `blue`, `orange`… per al color principal. Mode fosc suportat
  (dia/nit és a Preferències, no al menú). Controls segmentats en mode fosc: l'indicador triat és gris clar
  (`theme/system.ts`).
- **Cursor, una sola regla al tema** (`theme/system.ts`, `globalCss` i tokens `cursor`): fletxa per defecte (és una app),
  la I només als camps on s'escriu, mà (`pointer`) a tot el que fa alguna cosa en clicar (botons, `role` de botó, pestanya,
  ítem d'arbre i de menú, opcions, triggers d'acordió, segments) i `not-allowed` als desactivats. No es posa
  `cursor="pointer"` a mà en un `button` o `role`: només en un element clicable que no ho sigui (una fila de taula). Arrossegar
  (`grab`/`grabbing`), dibuixar (`crosshair`) i les vores (`col-resize`) es posen on es fan. **3D**: `useViewerCursor`
  (`components/viewer/cursor.ts`: `hover`/`drag`, arrossegar mana, al canvas i es neteja en desmuntar): `pointer` sobre el
  que es pot triar, `grab` a les fletxes del gizmo i a la nansa, `grabbing` mentre s'arrosseguen.
- Icones dins dels components de Chakra v3 com a **children**, no amb la prop `icon`:
  ```tsx
  <IconButton aria-label="Mesurar"><LuRuler /></IconButton>
  <Button><LuDownload /> Exportar DXF</Button>
  ```
  Tot `IconButton` porta `aria-label` en català (i `Tooltip`).
- **Res de desplegables** (per decisió de l'usuari, tot unificat): cada tria és un `ChoiceChips` (`components/FormRow`:
  botons segmentats que salten de línia; els noms llargs es tallen amb «…» i el sencer al `title`; tornar a tocar la triada
  no fa res, si no és amb `retap`): vistes, formes, tipus, mòduls, gruixos, grups, resolucions… Les explicacions de les
  opcions van a l'ajuda (`help`). Els materials, amb el `MaterialSelect`. Cap `NativeSelect` fora de `components/ui`.
- **Etiquetes curtes, que no saltin de línia**: agrupa amb un títol i abrevia (`X` · `Y (alçada)`); l'explicació llarga a
  l'ajuda. Xarxa de seguretat: tota `Field.Label` és d'una línia amb «…» (`theme/system.ts`) i mostra el text sencer en passar
  per sobre (`theme/truncatedTitles.ts`; per a altres textos, `data-truncate`).
- Camps numèrics de mides amb `NumberInput` i sufix "mm"; en columnes estretes (< 130 px) s'amaga el sufix (container query
  a `NumberField`). Mentre s'escriu, el text es queda encara que no sigui un número, però `onChange` només rep números; en
  sortir es torna l'últim valor vàlid; amb `allowEmpty` rep `NaN`.
- **Compte amb `Field.Root`**: no hi posis dos interruptors a dins (els dona el mateix id i els dos rètols activen el mateix;
  passava amb Laterals Esquerre/Dret).
- **Fast Refresh**: un `.tsx` només exporta components; constants, hooks i utilitats a un `.ts` a part
  (`composition/partOrient.ts`, `composition/zoneIcons.ts`), si no Vite fa «hmr invalidate» i recarrega la pàgina. **El nom
  del `.ts` no pot coincidir amb el del `.tsx` si només canvien majúscules** (`MaterialLibrary.tsx` i `materialLibrary.ts`):
  al Mac `./MaterialLibrary` obre el `.ts` i l'app surt en blanc; per això les dades són a `libraryItems.ts`.
- `components/ui/`: snippets de la CLI de Chakra; el `toaster.tsx` està retocat (✕ sempre per tancar, per sobre de la barra
  de baix al mòbil, spinner `wood`).
- **Res de Ionic** (per decisió: refer la UI no compensa i no encaixa amb les eines d'escriptori).

## Glossari (una paraula, una cosa)
Les etiquetes i les ajudes de la UI fan servir sempre aquestes paraules (auditoria de coherència D,
`docs/millores-v1/coherencia-editor.md`):

| Terme | Només per a |
|---|---|
| **Cos** | la caixa del mòdul (laterals, base, tapa, fons) i el seu material («Com el cos») |
| **Fons** | la peça del darrere del mòdul (el `trassera` del taller); **Fons del calaix**, la del calaix (fila del joc, avís `drawer-bottom`, material propi a Materials; el nom de peça `fons calaix` i l'etiqueta `Fons calaix n` no canvien: són els dels fitxers del taller) |
| **Tipus** | el del mòdul: Baix · Penjat · Columna · Electrodomèstic (Mòdul › Tipus); el del moble (Moble · Cuina · Armari · Taula) es tria en crear-lo |
| **Suport** / **Base** | Suport: on seu el mòdul, **el mateix per a tots els mòduls de terra** (Moble › Sòcol i potes: directe a terra, sòcol sobre potes, potes vistes); el penjat, des de Tipus. Base: la peça de baix de la caixa (Sencera · Sense base) |
| **Tram** | els mòduls de terra que es toquen; el sòcol és una peça per tram, mai una per mòdul |
| **Fondària** | l'eix Z i la mida en Z (mai «Fons Z») |
| **Portes** | la secció del mòdul amb les portes de dalt a baix de tot el mòdul (Interior dividit; Cap · Una · Dues, `LuDoorClosed`); al Front d'una porta, la fila Una · Dues |
| **Front** | porta, front de calaix, abatible, reixeta, front fix; d'un compartiment sense dividir (les zones dividides no en tenen: les portes de tot el mòdul són a Mòdul › **Portes**) (l'estil i les folgances de tots els fronts del mòdul són a Mòdul › **Caixa**; el material, a Mòdul › **Materials**) |
| **Folgança** | separacions: front–cos, entre fronts, lateral i darrere de la guia, prestatge, fons, encaixos, peces de dins; **Folgances per defecte** a Preferències |
| **Joc** | només el joc paramètric del fabricant (`HardwareKit`, «joc de calaix», «Ferratges dels jocs») |
| **Ferratge** | qualsevol `HardwareItem`; **Ferratges**, la secció de l'inspector de la peça lliure (no la del mòdul), la biblioteca de Preferències i l'opció del visor (`LuWrench`) |
| **Acabats de l'escena** | terra i paret de la presentació (moble); als ambients, «Acabats» = terra, parets i sostre. **No hi ha secció «Acabats» al mòdul** (des del 2026-10-08: el que hi havia és a Caixa, Materials i Unió) |
| **Unió** | la secció del mòdul amb l'espiga de les unions de la caixa (`LuBolt`) |
| **Com el mòdul** / **Com el cos** / **Com a Preferències** | heretat; **Còpia pròpia**, la còpia d'un ferratge que ja no és a la biblioteca tal qual |
| **Electrodomèstic** | l'aparell del catàleg del fabricant (ferratge de la categoria «Electrodomèstics», motor `appliance`) que es tria a Mòdul › Electrodomèstic (mòdul sense dividir: si l'ocupa, el mòdul és l'aparell i no hi ha «Interior») o al compartiment d'un mòdul dividit; el seu front és el **Front de moble** (muntat com diu el fabricant), no el Front del compartiment |
| **Accessoris** | barra de penjar, tira LED (ferratges del compartiment, a la secció «Prestatges i accessoris»); el marc de vitrina va amb la porta de vidre |
| **Cap (push)** | el tirador que no hi és: obertura per pressió |

## Com treballar
- **Regla d'or: coherència i cohesió.** Abans de fer res nou (component, opció, pantalla, interacció), **busca com està
  resolt el mateix a l'app** i fes-ho igual.
  - **Reutilitza o generalitza; no copiïs.** Si ja hi ha un component que fa la feina, s'hi afegeix el que falta (prop,
    variant) a `components/`. Si n'hi ha dos que fan el mateix, s'unifiquen abans d'afegir-ne un tercer.
  - **Si Chakra ja ho té fet, es fa servir el de Chakra: no es reinventa la roda** (abans de fer un component, mira la llista
    de components de Chakra v3; vegeu UI › Regles).
  - **Un concepte, un component**: cercador + «+» = `SearchBar`, tria = `ChoiceChips`/`IconChoice`, interruptor = `Switch`,
    lliscador = `Slider`, material = `MaterialSelect`, ferratge = `HardwareSelect`, finestra = `FloatingWindow`, calaix de
    tria amb cercador = `PickerDrawer`, cota = `layoutDims` + `DimLine`, camp = `FormRow`, vora arrossegable = `PanelSplit` (`Splitter`). Res d'elements nadius (`<input type="checkbox|range">`)
    fora de `components/ui`.
  - **Finestres** (per decisió de l'usuari, 2026-10-15): **tot el que s'obre per editar o veure és una `FloatingWindow`; les tries amb cercador (materials, ferratges, mobles i objectes d'un ambient, la fitxa d'una peça de les col·leccions) són un calaix lateral (`PickerDrawer`, `Drawer` de Chakra)**
    (`components/FloatingWindow.tsx`, sobre el `FloatingPanel` de Chakra, com el Render: no modal, es mou, s'estira, es
    minimitza i es maximitza; al mòbil, a tota la pantalla); **les confirmacions curtes** («Esborrar?», «Començar una
    conversa nova?») **i les preguntes d'un sol camp** (posar un nom, «Mida real», moure a un grup) **són un `Dialog` de
    Chakra** (modal). Res de `Drawer` per triar ni de `Dialog` per editar. Detall a [ui-moduls](docs/funcional/ui-moduls.md).
  - **El mateix gest fa el mateix a tot arreu**: seleccionar, cercar, afegir, esborrar, plegar i moure es fan igual a Mobles,
    Objectes, Ambients i Preferències (mateixa posició, icona del catàleg, text i cursor).
  - **De punta a punta**: una opció nova es comprova a tots els llocs on té efecte (visor, miniatura, previsualització,
    render, GLB/USDZ, exports, `.moble`) abans de donar-la per feta. Si una previsualització no la pot mostrar, ho diu.
  - **Una dada, una font**: l'`accept` d'un selector de fitxers surt de la mateixa taula que el lector que els classifica
    (`IMPORT_FORMATS` → `IMPORT_ACCEPT`), no d'una llista escrita a mà al component.
  - **Opcions en cascada** (per decisió de l'usuari: «les opcions de més avall s'adapten a les de més amunt»): a cada
    inspector, cada opció depèn només de les de més amunt; canviar-ne una de dalt fa aparèixer o desaparèixer les de
    sota, mai al revés (Laterals abans de Parets i Cantonades; l'imant de la reixeta després de Muntatge i Trapa;
    a Mòdul › Caixa, el fons i després la seva ranura o retirada, i els fronts al final; Mòdul › Portes després de la
    Caixa i abans dels Materials; Mòdul › Electrodomèstic abans de la Caixa: l'aparell decideix les parts de fusta, que surten
    fixes com a text; a la Caixa, el Suport abans de la Base, i amb potes la base hi és sempre). El que una opció de dalt fa irrellevant no
    surt (un compartiment tapat no ensenya el seu Front; sense fronts, ni estil ni folgances ni material dels fronts;
    sense laterals ni divisors, ni prestatges ni accessoris ni fronts; sense on unir el divisor, ni Dividir: `zoneSupport.ts`).
  - **Un sol lloc per decisió**: una tria surt un cop a cada pantalla (l'electrodomèstic d'un mòdul sense dividir, a
    Mòdul › Electrodomèstic i no al seu Interior; el d'un mòdul dividit, al compartiment). Els **per defecte** del mòdul (tirador i ferratges)
    no surten: es trien a cada compartiment («Com el mòdul» = l'heretat). Res del que la construcció no llegeix no surt, i
    al revés (`usedHardwareSlots`, `moduleRows`; res amagat compta).
  - **Opcions globals** (per decisió de l'usuari, 2026-10-16): una opció que és de tot el moble (p. ex. el suport dels
    mòduls de terra) **no es repeteix** a l'inspector del mòdul ni s'hi posa un missatge: hi surt el que hi ha (text) i un
    botó **«Modificar opció global»** que obre la secció del Moble on es tria.
  - **Opció nova a un inspector → al registre** de les opcions en cascada (`core/model/options/`, `optionId` a la fila; ho
    comprova `src/optionCascade.test.ts`): així surt a l'esborrany de Preferències › Opcions en cascada (un dibuix per
    pensar la cascada; **no s'aplica a l'Editor**, [convencions](docs/convencions.md)).
  - Quan aparegui un cas nou, s'afegeix aquí.
- Abans de codi nou al `core/`, escriu o actualitza els tests (Vitest). Canvis de fabricació: proves d'or (vegeu més amunt).
- Canvis petits i verificables. Després de cada canvi ha de passar `pnpm check` (typecheck, lint amb 0 avisos, codi mort,
  cicles i tests) i `pnpm build`.
- No afegeixis dependències fora del stack sense preguntar.

## Ordres
```bash
pnpm dev         # servidor de desenvolupament
pnpm build       # build de producció + service worker
pnpm test        # vitest (UPDATE_GOLDEN=1 per refer les proves d'or)
pnpm typecheck   # tsc --noEmit
pnpm lint        # oxlint, 0 avisos
pnpm deadcode    # knip: fitxers, exports i dependències sense ús
pnpm cycles      # madge: imports circulars
pnpm check       # tot l'anterior + tests (fes-lo abans de donar res per acabat)
```

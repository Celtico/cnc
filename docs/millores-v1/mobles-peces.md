# Millores v1 — Model del moble, inspectors, peces lliures i objectes

Estudi (fase 1–2) de l'àrea **Mobles / peces** de [`PROMPT-millore-v1.md`](../prompt/PROMPT-millore-v1.md) §3:
inspectors de peces lliures i objectes, «Tipus» de moble, Flat-pack, objectes de referència i models 3D, i el «Front» del
mòdul pare. No s'ha tocat cap fitxer de codi. Línies citades sobre l'estat actual del repositori.

Resum de mides: **1** S · **2** M · **3** L (M si es fa per fases) · **4** S · **5** M.

---

## 0. Context comú (cal tenir-lo present a tots els punts)

- `Composition.kind` (`core/model/composition.ts:440`, `CompositionKindSchema = ["moble","cuina","armari","taula","lliure","objecte"]`)
  és opcional; `compositionKind()` (`composition.ts:670`) dedueix els antics (cuina si té `runs`, si no moble).
  `partsOnlyKind(k)` (`composition.ts:679`) = `lliure | objecte`: **els mòduls es guarden però no es fan**.
- **Una composició sempre té almenys un mòdul**: `readComposition` (`db/compositionStore.ts:54`) n'hi posa un si no en té,
  l'Editor fa `comp.modules[0]!` (`EditorScreen.tsx:197`, `:318`, `:984`, `:988`), `ProjectCard.tsx:43`, `RunsForm.tsx:99`.
  Per això el Flat-pack i l'Objecte porten un «Mòdul 1» fantasma (`flatPack.ts:35`, `storeCatalog.ts:139-145`,
  `ambient.ts:231`, `blank.ts:11`).
- **Migracions = en llegir, no a Dexie**. Dexie (`db/db.ts:147-171`, v1–v5) no indexa res de la composició (només
  `++id, name, updatedAt`): canviar el model **no demana `version(6)`**. El patró del projecte és migrar en carregar:
  `normalizeComposition` (`composition.ts:582`), `migrateCableHoles` (a `readComposition` i a `buildComposition:54`),
  `repairComposition` element a element, i `parseMobleFile` per als `.moble` (`core/file/mobleFile.ts`, `MOBLE_VERSION`).
  Totes les propostes d'aquí segueixen aquest patró; així els projectes desats, els `.moble` antics, les plantilles de
  codi i els mobles dins dels ambients (que llegeixen amb `compositionOf`) passen pel mateix camí.
- Treure un valor de l'enum `kind` **trencaria la lectura** (zod) i `repairComposition` el trauria en silenci: cal
  mantenir-lo a l'esquema (o `z.preprocess`) i convertir-lo a la migració.
- **Dependència amb l'àrea «Coherència / UI»**: el propietari vol que tots els acordions siguin l'`Accordion` de Chakra.
  Avui els inspectors fan servir `PanelSection` (`components/PanelSection.tsx`, independents, estat a
  `sessionStorage mobles:section:<id>`). Els punts 1 i 5 creen i treuen seccions: convé fer-los **damunt del component
  d'acordió definitiu** (o, si va abans, mantenir els `id` de secció perquè la migració sigui mecànica).

---

## 1. Inspectors de peça lliure i d'objecte de referència sense «General» — **S**

### Com funciona avui

**`PartInspector`** (`features/composition/PartInspector.tsx:67-281`), seccions (`PanelSection`):

| Secció (id) | Línies | Contingut | Icona |
|---|---|---|---|
| General (`part-general`) | 95-204 | Orientació (`IconChoice ORIENTS`), Efecte (Peça/Talla), Material (si no talla), Enganxada a (si no és `partsOnly` i hi ha mòduls), Grup, CNC (switch `nest`), Veta (`GRAIN`), Cantell (`edged`), Encaixos (switch `joints`, només Flat-pack) + llista d'encaixos de la peça | `LuPuzzle`, insígnia = orientació |
| Mides (`part-size`) | 205-242 | Ample · Alt · Fondària (el gruix triat entre els del material si és de CNC) | `LuMoveDiagonal` |
| Forma (`part-shape`) | 243-254 | Rectangle / Forma a mida… (`ProfileEditor`) | `LuSpline` (**no és al catàleg**) |
| Posició (`part-position`) | 266-273 | X · Y · Z (`AxisLabel`) | `LuMove` |
| Encaixos (tot el moble) (`part-joinery`) | 274-278 | `PartJoineryForm` (joc, fresa, pestanya, dogbones), només Flat-pack | `LuPuzzle` |

**`RefInspector`** (`features/composition/RefInspector.tsx:17-151`):

| Secció (id) | Línies | Contingut | Icona |
|---|---|---|---|
| General (`ref-general`) | 26-72 | Efecte (Obstacle/Talla), Forma (Caixa/Cilindre/Perfil + «Editar la forma…»), Material (no als que tallen) | `LuScan` |
| Mides (`ref-size`) | 73-106 | Direcció (cilindre/perfil, o «Direcció del tall» de la caixa que talla), Ø, Llarg, Secció o Ample·Alt·Fondària | `LuMoveDiagonal` |
| Posició (`ref-position`) | 119-148 | «Enganxat» Al terra / A la paret (`onFloor`, `onWall`) + X · Y · Z | `LuMove` |

`GroupInspector` (`PartInspector.tsx:353-391`) i `ModelInspector` ja no tenen «General».

### Què cal canviar

Cada apartat, un acordió de primer nivell. No toca el model ni el desat: **cap migració**. Només canvien els `id` de
secció (l'estat obert/tancat de la sessió es perd una vegada, sense importància).

**Peça lliure** — ordre proposat (de més a menys freqüent; el que no aplica s'amaga, regla «opcions que no toquen
s'amaguen»):

| Secció | Camps | Icona (catàleg CLAUDE.md §Icones) | Es veu si |
|---|---|---|---|
| Efecte | Peça / Talla | dinàmica: `LuPuzzle` (peça) · `LuScissors` (talla) — fila «Composició» | sempre |
| Orientació | De cara / De costat / Estirada | dinàmica `ORIENT_ICON[p.orient]` (`partOrient.ts`: `LuRectangleVertical` · `LuPanelLeft` · `LuRectangleHorizontal`) | sempre |
| Mides | igual | `LuMoveDiagonal` | sempre |
| Material | Material + **Veta** | `LuPalette` (Inspector › Materials) | `!cutter` |
| Forma | Rectangle / a mida | `LuRectangleHorizontal` (rectangle) · `LuSpline` (a mida) | sempre |
| CNC | «Es talla a la CNC» + **Cantell** | `LuFactory` (Màquina CNC) | `!cutter` |
| Encaixos (flat-pack) | switch + llista d'encaixos (vegeu punt 3) | `LuPuzzle` | peça de CNC en un moble fabricable |
| Grup | Sense grup / grups / + Grup nou | **nova**: `LuGroup` (ja es fa servir al menú de l'arbre, `StructureTree.tsx:344`, però no és al catàleg) | sempre |
| Enganxada | Res / mòduls | **nova**: `LuLink` (proposta) | `!partsOnly && modules.length > 0` |
| Posició | igual | `LuMove` | sempre |

**Objecte de referència** — mateixos noms i icones on el concepte és el mateix (coherència, §7 del prompt):

| Secció | Camps | Icona |
|---|---|---|
| Efecte | Obstacle / Talla | dinàmica `LuShield` · `LuScissors` |
| Forma | Caixa / Cilindre / Perfil | dinàmica: `LuBox` · `LuCylinder` · `LuSpline` (les de `SHAPE_OPTIONS`, `RefInspector.tsx:163-167`) |
| Orientació | la «Direcció» que avui és dins Mides (`AXIS_OPTIONS`, `:156-160`) | dinàmica `LuMoveDiagonal2` · `LuMoveVertical` · `LuMoveHorizontal` |
| Mides | sense la Direcció | `LuMoveDiagonal` |
| Material | Material o «Cap (fantasma)» | `LuPalette` (`effect !== "cut"`) |
| Enganxada | Al terra / A la paret (avui dins Posició, `:121-130`) | la mateixa que la peça (`LuLink`) |
| Posició | X · Y · Z (desactivats segons Enganxada) | `LuMove` |

Els objectes no tenen Grup ni CNC: no surten (no s'inventen camps).

### Decisions a confirmar
- **Veta i Cantell** no són a la llista del propietari: proposta Veta → Material (és del material/tauler) i Cantell → CNC
  (és de fabricació). Alternativa: secció pròpia «Cantell».
- **Icones noves al catàleg** (CLAUDE.md §Icones, regla «si en cal una de nova, afegeix-la aquí»): `LuGroup` (grup de
  peces; `LuFolder` ja vol dir grup de la galeria) i `LuLink` (enganxada). Alternativa per a Enganxada: `LuMagnet`, però
  ja vol dir «Imants» (muntatge de reixeta, imant del gizmo).
- `LuSpline` (forma a mida / perfil) i `LuCylinder` es fan servir però no són al catàleg: afegir-los a la fila «Forma».
- Les icones dinàmiques (la de l'opció triada) segueixen el criteri que ja fan els compartiments (`zoneIcons.ts`, la
  icona del contingut a l'arbre, la capçalera i «Front»).

### Pla
1. `PartInspector.tsx`: partir `part-general` en `part-effect`, `part-orient`, `part-material`, `part-cnc`,
   `part-joints`, `part-group`, `part-attach`; moure Veta i Cantell; insígnia de cada secció = el valor triat (com ara la
   d'orientació). Treure `LuPuzzle` com a icona de «General».
2. `RefInspector.tsx`: `ref-effect`, `ref-shape`, `ref-orient`, `ref-material`, `ref-attach`; treure la Direcció de
   Mides; `ProfileEditor` es queda fora de les seccions (com ara).
3. CLAUDE.md: línia 499-501 («Objecte (`RefInspector`): General · Mides · Posició») i taula d'icones.
4. Prova manual: peça que talla (només Efecte, Orientació, Mides, Forma, Grup, Posició), peça de ferro (CNC apagat),
   objecte d'ambients (`objecte`: sense Enganxada ni Encaixos), objecte de referència cilindre/perfil/caixa que talla.

Risc baix. Si el canvi d'acordió (Chakra `Accordion multiple`) es fa abans, aquest punt és trivial; si es fa després,
la migració ha de conservar aquests `id`.

---

## 2. Treure l'opció «Tipus» dels mobles — **M**

### Com funciona avui
- UI: `EditorScreen.tsx:921-950`, secció `moble-kind` de l'inspector del moble: `IconChoice` amb `MOBLE_KINDS`
  (`features/composition/kinds.ts:6-16`: Moble · Cuina · Armari · Taula · Flat-pack; Objecte fora). Canviar fa
  `setComp({ ...c, kind })` i res més (les dades es conserven, «res amagat compta»).
- Què decideix el `kind` (tot el codi, `grep compositionKind|partsOnlyKind|"lliure"`):

| Tipus | Efecte real | On |
|---|---|---|
| `cuina` | Secció «Taulell i sòcol» (`RunsForm`) i **només aquí es construeixen els `runs`** | `EditorScreen.tsx:951-955`; `buildComposition.ts:133` |
| `taula` | «Afegir mòdul» crea un `tableModule` en lloc d'una caixa | `EditorScreen.tsx:1189` |
| `armari` | **Cap** (només el text d'ajuda i l'etiqueta de la targeta) | `EditorScreen.tsx:937` |
| `lliure` | Només peces: mòduls no es fan, encaixos actius, arbre sense Mòduls, etc. (vegeu punt 3) | 15+ llocs |
| `objecte` | No es fabrica, no surt a l'historial de Mobles, galeria pròpia | `isObject.ts`, `buildComposition.ts:56` |
| tots | Etiqueta a la targeta i a la cerca de les galeries | `NewMobleGallery.tsx:15,33,76,83`; `searchText.ts:25` |

- On es tria avui de debò: a les **plantilles** (catàleg `storeCatalog.ts` per categoria, col·leccions, `magFurniture.ts`,
  `BUILTIN_TEMPLATES`), via `pick = onCreate({ ...t.make(), kind: t.kind })` (`NewMobleGallery.tsx:92`). «Nou moble» en
  blanc és sempre `moble` (`projects/blank.ts:4`).

### Interpretació de la petició
«Les primeres opcions Moble, Cuina, Armari, Taula ja poden fer aquesta funció»: el tipus queda **fixat en crear el
moble** (plantilla o «Nou moble») i no cal un selector per canviar-lo després. **A confirmar amb el propietari** on veu
aquestes «primeres opcions» (avui només són dins del mateix selector Tipus). Proposta coherent: el botó «Nou moble»
(`PageHeader`) obre un menú Moble · Cuina · Armari · Taula (icones del catàleg `LuBox` · `LuCookingPot` · `LuContainer`
· `LuTable`) que crea el blanc del tipus (`blankMoble(settings, kind)`; per a Taula, amb `tableModule`).

### Què es trencaria en treure el selector
- Un moble ja no podria passar a Cuina → **no podria tenir taulell i sòcol correguts** si no s'ha creat com a cuina.
- Mobles que algú va passar de cuina a un altre tipus guarden `runs` que no es fan; sense selector, mai tornarien.
- Els projectes que són `lliure` no podrien sortir-ne (avui tampoc tenen mòduls fets) → és el punt 3.

### Opcions per al taulell i el sòcol (la cuina)
- **A (recomanada): els `runs` deixen de dependre del tipus.** «Taulell i sòcol» surt a qualsevol moble amb mòduls a
  terra (com a acció «Afegir taulell / sòcol», plegat si no n'hi ha) i `buildComposition` construeix `comp.runs` sempre
  (`buildComposition.ts:133`: `const runs = comp.runs ?? []`). La cuina només és una etiqueta de plantilla.
  Migració (`migrateRuns`, a `normalizeComposition`): si `kind !== "cuina"` i té `runs`, **treure'ls** (avui no es fan:
  la sortida no canvia; es perd només la possibilitat de recuperar-los, que sense selector ja no existiria). Proves d'or:
  no canvien (cap plantilla té `runs` sense ser cuina — comprovar amb un test que recorri `STORE_TEMPLATES`,
  `BUILTIN_TEMPLATES`, col·leccions i `magFurniture`).
- **B: fer-los amb peces lliures** (el que suggereix el propietari). Possible avui: un taulell és una peça `flat` (amb
  `module` enganxada o lliure), els forats de pica i placa són peces «Talla» (`effect: "cut"`) o objectes que tallen;
  el sòcol, una peça `front`. **Es perd**: el llarg automàtic de → fins a sobre els mòduls de la fila (`build/runs.ts`),
  el voladís i el retranqueig paramètrics, no arribar a les illes (`freeX`), els avisos de forat que travessa el contorn,
  els presets de placa/pica (`CUTOUT_PRESETS`, `composition.ts:430`), la numeració com a mòdul n+1 i el grup «Taulell i
  sòcol» del STEP (`stepGroups.ts`). Migrar automàticament `runs` → peces canviaria refs i peces del taller (proves d'or
  de les cuines del catàleg) i trauria el paramètric: **no recomanat com a migració**; sí com a possibilitat d'ús (ja
  funciona).
- **C**: deixar el selector però sense Flat-pack. No respon a la petició.

### Taula i armari
- Taula: sense selector, «Afegir mòdul» pot seguir llegint `kind` (fixat en crear) **o** millor, copiar el tipus del mòdul
  seleccionat/últim (si té `carcass.tableTop` i `base.kind === "open"` → `tableModule`). La segona fa coherent un moble
  mixt (consola + calaixera) i no depèn del tipus.
- Armari: res a fer; només etiqueta.

### Pla
1. `EditorScreen.tsx:921-950`: treure la secció `moble-kind` (el text de l'objecte, `:922-925`, es queda).
2. `:951-955`: «Taulell i sòcol» per a tot moble no `partsOnly`; `buildComposition.ts:133` sense condició de tipus.
3. `migrateRuns` a `normalizeComposition` + test (projecte `moble` amb runs → sense runs; cuina igual).
4. `blank.ts`: `blankMoble(settings, kind)`; `ProjectsScreen` «Nou moble» amb menú de 4 tipus (si el propietari ho
   confirma).
5. `EditorScreen.tsx:1189`: «Afegir mòdul» segons el mòdul de referència.
6. Mantenir `kind` al model (etiqueta de targeta, cerca, galeries). `kinds.ts`: `MOBLE_KINDS` sense Flat-pack (punt 3).
7. CLAUDE.md §Model del moble (línies 107-112) i §Editor (línia 494).

Riscos: els `runs` de projectes «no cuina» desapareixen (comunicar-ho al changelog); `hiddenState.test.ts` i les proves
d'or han de quedar igual (comprovar-ho és la validació del canvi).

---

## 3. Flat-pack: d'un tipus de moble a una opció de les peces lliures — **L** (en dues fases: M + M)

### Com funciona avui
- **Tipus `lliure`** («Flat-pack», `kinds.ts:11`). Plantilles: `flatPack.ts` (`flatPack()`, `:34-36`; escriptori,
  prestatgeria, tamboret a `templates.ts:63-88`) i el catàleg de botiga `loose()` (`storeCatalog.ts:139-145`: **llits,
  capçals, taules de pedra**, `:200`, `:244`, `:631`, `:633`…), que no són flat-pack d'encaix sinó «mobles només de peces».
- Què fa `lliure` (via `partsOnlyKind`):
  - **Build**: no es fan els mòduls (`buildComposition.ts:64-65`), cap avís `overlap`, peces numerades com a mòdul 1
    (`:151`). **Els encaixos només es calculen si `kind === "lliure"`** (`build/freeParts.ts:167-169`).
  - Coordenades: `resolveParts`/`partOffset` ignoren `module` (`composition.ts:798`, `:808`).
  - Visor i mides: `viewerSize.ts:10`, `compositionDims` (`storeCatalog.ts:428`), STEP (`stepGroups.ts:20`).
  - Editor: arbre sense «Mòduls» (`StructureTree.tsx:182`, `:266-267`); selecció inicial al moble
    (`EditorScreen.tsx:199`, `:352`); no s'hi enganxen mòduls (`:474-478`); sense «Materials de tot el moble» (`:982`);
    secció «Encaixos» del moble (`:956-960`); centre de peces noves a terra (`:1190`); peça nova amb el material de
    l'última (`addElements.ts:31-33`).
  - Inspector de peça: switch «Encaixos» i llista (`PartInspector.tsx:79`, `:171-203`) i «Encaixos (tot el moble)»
    (`:274-278`).
- **Encaixos de les peces lliures**: per peça, `FreePart.joints` (`freePart.ts:56-57`: «false: no fa encaixos; per
  defecte, sí»); per moble, `Composition.joinery` (`JoinerySchema`, `freePart.ts:66-81`; `DEFAULT_JOINERY`). Regles
  (CLAUDE.md:194-197): pestanyes + mortalles, mitja fusta, dits, espigues; `nest === false` → mai. Una parella fa encaix
  només si **cap** de les dues té `joints === false` (`freeParts.ts:190-193`). Espigues: `comp.modules[0]?.hardware?.dowel
  ?? DOWEL` (`freeParts.ts:165`) — avui surt del mòdul fantasma.
- Objectes (`objecte`) forcen `nest:false, joints:false` (`buildComposition.ts:56`, `ambient.ts:197`).

### Proposta
Flat-pack = **opció de cada peça lliure** («Encaixos», secció pròpia del punt 1, icona `LuPuzzle`), disponible a
qualsevol moble fabricable (no a `objecte`). «Moble només de peces» deixa de ser un tipus: és un moble sense mòduls.

**Problema de semàntica (clau per a la migració).** Avui `joints` absent = encaixos SÍ. Si els encaixos s'activen a tots
els tipus amb aquest valor per defecte, **tots els mobles amb peces lliures que es toquen farien encaixos de cop**
(aparadors sobre potes de peces lliures, capçals amb prestatge, taulells enganxats…) → canvien peces, forats i fitxers del
taller. Opcions:
- **A (recomanada): camp nou opt-in** `FreePart.joinery?: true` («Flat-pack: encaixos amb les altres peces»). Absent =
  sense encaixos. Migració `migrateFlatPack` (a `normalizeComposition`, i per tant a `readComposition`, `parseMobleFile`
  i `buildComposition` com `migrateCableHoles`): si `kind === "lliure"`, cada peça amb `joints !== false` → `joinery:
  true`; el camp `joints` queda llegit però obsolet (es treu en migrar). Resultat idèntic per als flat-pack existents; cap
  canvi per a la resta. Regla del build: encaix si totes dues peces tenen `joinery` (i són de CNC).
- B: mantenir `joints` i escriure `joints:false` a totes les peces dels mobles no `lliure` en migrar. Funciona però les
  plantilles de codi (`storeCatalog.ts:108 part()`, col·leccions…) també l'haurien de portar; fràgil.

**Moble sense mòduls.** Per treure `lliure` del tot cal que una composició pugui tenir `modules: []`:
- `readComposition` (`compositionStore.ts:54`) ja no hi ha de posar el mòdul de caixa si hi ha peces.
- Editor: `module` passa a opcional (`EditorScreen.tsx:197`, `:318`; inspector de mòdul i alçat només si n'hi ha);
  «Materials de tot el moble» (`:984-988`) amb mòduls o amaga; `ProjectCard.tsx:43` (color de la targeta: de la primera
  peça); `RunsForm.tsx:99`; eliminar l'últim mòdul permès si hi ha peces (`StructureTree.tsx:93`, `:300`;
  `EditorScreen.tsx:544`).
- `freeParts.ts:165`: espiga de les preferències (`settings` → `hardware.dowel`) en lloc del mòdul fantasma.
- Migració: `lliure` → `moble` amb `modules: []` (es descarta el «Mòdul 1» fantasma, que mai s'ha construït: la sortida
  no canvia) i `joinery` a les peces. `partsOnlyKind` queda només per a `objecte`.
- Coordenades: `resolveParts` ja funciona sense mòduls; les peces `module` d'un flat-pack (enganxades a un mòdul que no es
  feia) → treure `module` en migrar (avui s'ignorava).

### Fases recomanades
- **Fase 1 (M)**: camp `joinery` + `migrateFlatPack` (només peces) + encaixos a tots els tipus fabricables; secció
  «Encaixos» del moble (`EditorScreen.tsx:956`) quan alguna peça en fa (`parts.some(p => p.joinery)`), i també a la secció
  Encaixos de la peça (`PartJoineryForm`, tot el moble, com avui). Flat-pack fora de `MOBLE_KINDS`; `lliure` es manté
  intern per als existents (continuen sense mòduls). Ja respon a la petició.
- **Fase 2 (M)**: mobles amb 0 mòduls i conversió `lliure` → `moble`. Etiqueta de les targetes del catàleg de botiga
  (llits, capçals) passa de «Flat-pack» a «Moble».

### Dependències i riscos
- Proves: `freeParts.test.ts`, `flatPackTemplates.test.ts`, `stepCad.test.ts`, `topsolidCsv.test.ts`,
  `taller.roundtrip.test.ts`, `mobleFile.test.ts`, `compositionRepair.test.ts`, `editOps.test.ts` fan servir `lliure`.
  **Les proves d'or no han de canviar** (és la verificació que la migració és neutra).
- Encaixos entre peces lliures i **mòduls** no existeixen (només peça–peça): un flat-pack dins d'un moble amb mòduls no
  s'uneix a la caixa. Deixar-ho clar a l'ajuda; ampliar-ho és una altra feina (i tocaria Ferratges, §9 del prompt).
- Miniatures del catàleg: `templatePrint` canvia → es refan una vegada (normal).
- Porta-retalls (`mobles:clipboard`, `parseClip`): una peça copiada d'abans porta `joints`; `parseClip` ha de passar per
  la mateixa migració de peça.
- `.moble` antics: `parseMobleFile` → `normalizeComposition` → OK sense pujar `MOBLE_VERSION` (el camp nou és opcional).

---

## 4. Treure «Objectes de referència» als Objectes i «Models 3D» als Mobles — **S**

### On surten avui
Totes dues coses són **grups de l'arbre de l'Editor** (el mateix `StructureTree` per a mobles i objectes):
- «Objectes de referència»: `StructureTree.tsx:450-516` (SectionTitle amb menú: presets de Preferències › Objectes de
  referència + «En blanc…», files amb ⋯ Duplicar/Eliminar, arrossegar `reorderRef`).
- «Models 3D»: `StructureTree.tsx:518-574` (menú «Quin fitxer?» + «Triar un fitxer .glb…», `ModelUpload`, files).
- També: badges del Resum del moble (`EditorScreen.tsx:914-915`), nom per defecte i diàleg (`StructureTree.tsx:227`),
  enganxar del porta-retalls (`EditorScreen.tsx` `paste`, ref i model), inspectors (`RefInspector`, `ModelInspector`).
- No surten a les galeries ni als menús «+» de les pàgines: **no hi ha res a treure a `ObjectsGallery` /
  `ProjectsScreen`**. Els Ambients no fan servir `references` (cap a `features/ambients`).

### Què es fa servir de debò (no es pot perdre)
- **Mobles amb objectes de referència**: sí, i molts — passacables migrats (`migrateCableHoles`), objectes que tallen a
  plantilles (`templates.ts:193`, `:352`, `:390`, `:430`; `collections.ts:1675`, `:1699`; matalàs de `storeCatalog.ts:244`),
  fantasmes de tele/radiador. **Es queden als Mobles.**
- **Objectes amb models 3D**: sí (plantes del catàleg d'objectes, `ambient.ts:316`, `:327`). **Es queden als Objectes.**
- **Objectes amb objectes de referència**: cap plantilla (`objectComposition`, `ambient.ts:231`: `references: []`).
- **Mobles amb models 3D**: cap plantilla; només els que l'usuari hagi pujat (`Composition.models`, `.moble` els porta,
  `mobleIo.ts`).

### Què cal canviar (treure ≠ esborrar dades)
- Objectes (`kind === "objecte"`): amagar el grup «Objectes de referència» **si no en té cap**; si en té (fets abans),
  mostrar el grup sense «+» perquè es puguin seleccionar i eliminar. La «Talla» dels objectes ja es fa amb peces lliures
  (`effect: "cut"`), que és el que el propietari usa (làmpada).
- Mobles (no `objecte`): el mateix amb «Models 3D». Els models d'un moble existents continuen visibles al 3D/render/AR.
- Enganxar: no enganxar un objecte de referència dins d'un objecte ni un model dins d'un moble (toast com el dels mòduls,
  `EditorScreen.tsx:474-478`).
- Resum (`EditorScreen.tsx:914-915`): cada badge només al tipus on té sentit (o si n'hi ha).
- **Preferències › Objectes de referència** es manté (alimenta el «+» dels mobles).

### Pla i riscos
1. `StructureTree.tsx`: `const isObjectKind = compositionKind(comp) === "objecte"`; condicionar `:450-516` a
   `!isObjectKind || comp.references.length` (i `menu` només si `!isObjectKind`), i `:518-574` a
   `isObjectKind || models.length`.
2. `EditorScreen.tsx`: `paste` i Resum.
3. CLAUDE.md §Editor (línies 480-488: «Un + a cada grup»… passa a dependre del tipus) i §Model del moble (211-216).
Risc baix; cap migració.

---

## 5. «Front» al nivell pare (mòdul) — **M**

### Com funciona avui
- **Mòdul seleccionat**: si l'arrel està dividida, l'inspector del mòdul mostra «Front de tot el mòdul»
  (`EditorScreen.tsx:1099-1100`: `ZoneFrontSection` amb `zone={module.root}`, `kinds=["none","door","panel"]`,
  `id="module-front"`).
- **Compartiment dividit seleccionat** (`ZonePanel.tsx:130-148`): «Divisió …» + «Front de tota la zona»
  (`ZoneFrontSection`, mateixos 3 tipus, `id` `zone-parent-front`). **Fulla** (`:149-245`): «Front» amb els 6 tipus
  (`ZoneFrontSection`, `:396-413`; Obert · Porta · Calaixos · Abatible · Reixeta · Front fix), Prestatges, Mida, Dividir.
- **L'arrel dividida no és seleccionable a l'arbre**: `ZoneRows` amb `root && zone.split` només pinta els fills
  (`StructureTree.tsx:594-603`). Sense dividir, l'arrel sí que surt com un compartiment (el mòdul sencer) i el seu Front és
  el normal. Tampoc s'hi arriba des del 3D: `selectFrom3D` puja del fill al mòdul saltant l'arrel
  (`EditorScreen.tsx:639-640`), igual que Supr (`:567-569`). Sí que s'hi arriba amb ⋯ «Seleccionar el pare» d'un fill de
  l'arrel (`ZonePanel.tsx:71-75`): l'inspector mostra «Front de tota la zona» però l'arbre no marca res (incoherent).
- **Build**: `buildModule.ts:743-749` fa `buildParentFront` (`:894…`) per a tota zona dividida amb `front` (també
  l'arrel); les fulles de sota queden `covered`.

### És un cas real? Sí, i important
Tots els armaris del catàleg fan el front a l'**arrel dividida**: `storeCatalog.ts:487-498` `wardrobe()` →
`zone("hang")` = `{ front: doubleDoors, split: { dir: "h", children: [rail(), open()] } }` passat com a `root` de
`box()` (`:86`). Ho fan servir les plantilles de dormitori, juvenil, emmagatzematge i exterior (`:651-653`, `:697-699`,
`:800-802`, `:894`) i les col·leccions (`collections.ts:557`, `:877`). **No es pot treure la capacitat**, només moure on
s'edita.

### Proposta (coherent amb «les opcions apareixen en seleccionar l'element»)
- **Treure** la secció «Front de tot el mòdul» de l'inspector del mòdul (`EditorScreen.tsx:1099-1100`). El mòdul queda
  amb Mides · Posició · Caixa · Materials · Fusteria (la caixa, no el contingut).
- **Fer visible l'arrel dividida a l'arbre com a «Interior»**: a `ZoneRows`, en lloc de saltar-la, una fila de profunditat
  2 amb la icona del seu contingut (`zoneIcon`: divisió o, si té front, la del front) i l'etiqueta «Interior · 2 portes» /
  «Interior · Divisió horitzontal (2)»; els fills a profunditat 3. Seleccionar-la = `ZonePanel` de la zona dividida, que
  ja té «Front de tota la zona» (Obert · Porta · Front fix). Així l'estructura és la mateixa a tots els nivells: el front
  es tria seleccionant l'interior o la divisió.
- Navegació: `selectFrom3D` (`:639-640`) i Supr (`:569`) han de pujar del fill a l'**arrel** abans del mòdul (treure
  `parent.id !== mod.root.id`); `siblings` (`:661`) pot continuar excloent l'arrel.
- **Supr a l'Interior**: `deleteZone` de l'arrel (`editOps.ts:76-78`) **buida tot el mòdul** (`{ id: root.id }`). Cal
  bloquejar-ho (no s'elimina l'interior, com «Eliminar» no surt a `ZoneActions` sense pare) o demanar confirmació.
- Alternativa més petita (S): deixar l'arbre com està i, en lloc de la secció al mòdul, un enllaç «Interior» a la
  capçalera del mòdul que seleccioni l'arrel. Menys coherent (l'arbre no mostraria la selecció).

### Dades i migració
Cap: el front continua a `module.root.front`. Proves d'or i `hiddenState.test.ts` intactes (només canvia la UI).

### Pla
1. `StructureTree.tsx:594-603`: fila «Interior» per a l'arrel dividida (profunditat i sagnat dels fills +1).
2. `EditorScreen.tsx:1099-1100`: treure la secció; `:569`, `:640`: pujar a l'arrel.
3. `zoneLabel.ts`: prefix «Interior» per a l'arrel (`zoneLabel(z, { root: true })`).
4. Supr/⌘X a l'arrel: bloquejar (toast «L'interior no es pot eliminar; treu la divisió») o confirmar.
5. `ElevationEditor` (`onSelectZone`, `:134`): comprovar que es pot seleccionar l'arrel clicant fora de les fulles.
6. CLAUDE.md §Model del moble línia 159 («Front de tota la zona» i, al mòdul, «Front de tot el mòdul») i §Editor
   línia 499.

Riscos: sagnat de l'arbre en mòduls amb moltes divisions (amplada 280 px); usuaris que ja coneixen la secció del mòdul.

---

## Ordre d'implementació i dependències

1. **Punt 4** (S, independent).
2. **Punt 1** (S) — idealment amb/després de l'acordió únic de Chakra (àrea UI).
3. **Punt 5** (M, independent del model).
4. **Punt 3, fase 1** (M): camp `joinery` + migració; deixa Flat-pack fora del selector.
5. **Punt 2** (M): treure Tipus (depèn de 3.1 perquè Flat-pack ja no hi sigui) i `runs` sense tipus.
6. **Punt 3, fase 2** (M): mobles sense mòduls, `lliure` → `moble`.

Regla de validació comuna: **proves d'or i `hiddenState.test.ts` sense canvis** a 1, 2, 3 (el model canvia, la
fabricació no) i tests nous per a cada migració (`migrateRuns`, `migrateFlatPack`) amb projectes desats i `.moble` antics.
Actualitzar CLAUDE.md en el mateix canvi (§Model del moble, §Editor, §Objectes, §Icones).

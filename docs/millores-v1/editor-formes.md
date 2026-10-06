# Editor de formes i eina de ploma — estat actual i proposta (millores v1)

Resposta als apartats 5 («Eina de ploma», Ambients) i 6 («Editor de formes», Peces lliures › Forma › Ploma) de
[`docs/prompt/PROMPT-millore-v1.md`](../prompt/PROMPT-millore-v1.md) (línies 164–172 i 220–234), amb la regla d'or de
l'apartat 7 (coherència i reutilització, línies 238–252). Document d'anàlisi: no hi ha cap canvi de codi.

**Resum en una frase:** avui hi ha **dues plomes que no comparteixen res** (model, vista, teclat ni desfer); la de les
formes ja fa corbes que arriben bé a la CNC, la dels ambients fa només parets rectes. Proposo **un nucli vectorial
compartit** (model de traç, pan/zoom, ploma, desfer, importadors) amb **dues superfícies** (diàleg de forma i plànol),
no un sol component monolític. Prioritat: primer la forma de les peces (és fabricació), després els ambients (decoratius,
`CLAUDE.md` § «Què és»).

---

## 1. Com funciona avui

### 1.1 Editor de formes (`src/features/composition/ProfileEditor.tsx`, 607 línies)

**On es fa servir** (tres consumidors, el mateix diàleg):
- Peça lliure › Forma (`PartInspector.tsx:241-265`): `initial` = `p.shape` o el rectangle; `onApply` desa `shape` i
  `w`/`h` arrodonits.
- Tauler de taula a mida (`CarcassForm.tsx:350`, `Carcass.tableTop.shape`, `composition.ts:138`).
- Objecte de referència amb perfil 2D (`RefInspector.tsx:108`, `RefObject.profile`, `composition.ts:315`).

**Model de dades** (`src/core/model/polygon.ts:177-198`, esquema `ProfileNodeSchema` a `core/model/panel.ts:106-113`):
- Un sol **contorn tancat** de nodes `PNode { x, y, in?, out?, b?, t? }`. Cada costat i→i+1 és (`edgeOf`, `polygon.ts:203`):
  **cúbica** si algun extrem té manegador, **arc** si el node d'inici té `b` (bulge, com al DXF), si no **recta**.
- `t` = tipus de reflex només per a l'editor (cantonada · alineat · simètric).
- Els perfils antics `[x, y, bulge]` (`BPt`) es llegeixen amb `toNodes` (`polygon.ts:196`).
- **No hi ha**: traços oberts, diversos subcamins, forats interiors, ni nodes compartits entre formes.

**Eines i interacció** (`ProfileEditor.tsx`):
- Estat local: `nodes`, `sel` (un sol node), `tool` = `edit | pen | bend | erase`, `drag` (línies 36-40, 80-86).
- **Moure**: arrossegar nodes/manegadors; Alt en un manegador el trenca (línia 237); doble clic commuta corba/cantonada
  (línia 450); fletxes 1 mm (Maj 10) i Supr (167-196).
- **Ploma** (`startPen`, 149-154): **esborra la forma** i en comença una de nova; clic = cantonada, clic+arrossegar =
  manegadors simètrics (241-245); clicar el primer node o Retorn tanca, Esc descarta (173-179).
- **Corbar** (`bendEdge`) i **Esborrar**; el cercle del mig d'un costat hi afegeix un node (`splitEdge`, de Casteljau,
  250-253).
- **Imant** a la quadrícula `minor` (5/10/50 mm segons la vista); **Maj = imant d'1 mm** (`snap`, línia 125; 217, 233).
- **Vista fixa**: `viewBox` quadrat calculat per `viewOf` (600-607), que es congela mentre s'arrossega (102-106).
  **No hi ha zoom ni desplaçament.**
- **Sense desfer/refer**: l'únic «desfer» és Cancel·lar el diàleg (o `cancelPen`, que torna a `before.current`).
- Validació: `selfIntersects` sobre el contorn mostrejat; «Aplicar» desactivat si es talla (109, 559).
- Formes de partida a `features/composition/profilePresets.ts` (rectangle, arrodonit, el·lipse, arc, L, U, bisell).
  Nota de coherència: l'el·lipse hi duplica `ellipseNodes` de `core/model/polygon.ts:419` (mateixa constant `KAPPA`), i
  `core/model/objectShapes.ts` té una tercera biblioteca de formes (`roundRect`, `leaf`, `wave`…).

**Com arriba la forma al 3D i a la fabricació**:
1. `normalizeNodes` (`polygon.ts:389`) la posa a (0, 0) i en dona `w × h`.
2. `shapeOutline` (`core/build/buildModule.ts:188-205`) l'escala a llarg × ample **per l'extensió real de la corba
   mostrejada** i crida `profileToOutline` (`polygon.ts:295`).
3. `profileToOutline` passa **cada cúbica a arcs i rectes** amb `cubicToArcs` (`polygon.ts:255-293`, error < 0,02 mm);
   els arcs `b` es conserven tal qual. Resultat: `Panel.outline: BPt[]` (rectes + bulges, `panel.ts:184`).
4. Peces lliures amb encaixos (`core/build/freeParts.ts:346-369`, `partContour`): si hi ha osques, el contorn es
   **aplana** (`flatten`, passos de 7,5°, `polygon.ts:111`) i passa per `polygon-clipping`; el resultat torna com a
   polígon de rectes (els arcs es perden: G1 segmentat). És un límit existent, no d'aquest treball, però l'import de DXF
   amb molts arcs l'agreujarà.

### 1.2 Què accepta l'export de CNC (això limita les corbes que podem permetre)

| Sortida | Rectes | Arcs | Cúbiques / splines | Referència |
|---|---|---|---|---|
| DXF (R12, `AC1009`) | `POLYLINE`/`VERTEX` | bulge (codi 42) | **no** | `core/export/dxf.ts:107-119`, `:186-190` |
| Maestro `.xcs` | `AddSegmentToPolyline` | `AddArc2PointRadiusToPolyline`, semicercles amb `AddArc2PointCenterToPolyline` | **no** | `core/export/maestroXcs.ts:204-233` |
| STEP | arestes rectes | cares cilíndriques (`outlineSolid`) | **no** | `CLAUDE.md` § Tauler de taula |
| Nesting / Vista CAM | — | aplanat per dibuixar | — | `xcsPreview.ts:486` |

**Conclusió:** la CNC només veu **rectes i arcs**. Com que `cubicToArcs` ja existeix i és fiable, **podem permetre
cúbiques a l'editor** (ja es fa) i qualsevol corba importada que es pugui passar a cúbiques: arcs → `b`, el·lipses i
splines → cúbiques → arcs en fabricar. No cal arc-fitting nou. Sí que cal un test que garanteixi que tot el que entra
per un importador surt amb `|error| < 0,02 mm` i sense autointerseccions.

### 1.3 Ploma dels Ambients (`src/features/ambients/PlanCanvas.tsx`, 665 línies + `planGeom.ts`, 101)

- **No dibuixa formes, dibuixa parets.** `Tool = "select" | "wall" | "room" | "window" | "door" | "calibrate"`
  (`planGeom.ts:11`). La ploma és l'eina «Paret» (P).
- Model: `Wall { id, a, b, thickness, height, material?, openings? }` (`core/model/ambient.ts:45-56`): **segment recte
  amb gruix**. Tota la geometria en depèn: `wallCorners` (358), `wallOpenings` (371), `nearestWall` (392),
  `setWallEnds` (443), `wallSegments` (463, el 3D), `snapToWalls` (493), `roomWalls` (478), `eyePose`
  (`planGeom.ts:93`), el render i les miniatures.
- Interacció: cada clic afegeix un punt a `chain` i crea una paret del punt anterior (`onDown`, `PlanCanvas.tsx:209-225`);
  `penPoint` (181-192) fa imant al primer punt i als extrems de parets (Alt: sense) i **angle a 15°** (`snapAngle`,
  `planGeom.ts:60`) — **Maj = angle lliure**. Retorn, Esc o doble clic acaben (134-152, 425-430). Previsualització amb
  `polyline` i la mida (559-571).
- **Vista bona**: `View {tx, ty, s}`, roda/pessigar/espai per a pan i zoom al punt (`PlanCanvas.tsx:159-177`, `zoomAt`
  612), botons − / + i escala. És el que li falta a l'editor de formes.
- **Desfer/refer**: sí, però a `AmbientEditor.tsx:199-262` (pila pròpia de 100, API `change(next, commit)`), dreceres
  a 415-430.
- **Plànol de fons**: només imatge (`PlanImageSchema`, `ambient.ts:91-103`; `pickPlanImage`, `AmbientEditor.tsx:1227`;
  s'afegeix amb `mmPerPx = 10` i es calibra amb dos punts, 485-504).

### 1.4 Desfer/refer existent (`grep undo`)

Dues implementacions diferents de la mateixa cosa:

| On | API | Límit | Agrupació de passos | Dreceres |
|---|---|---|---|---|
| `features/editor/EditorScreen.tsx:113-117, 149-193` | `setComp(next)` + `History {past, present, future}` | 50 | per temps (< 500 ms = un pas) | ⌘Z, ⇧⌘Z, Ctrl Y; respecta camps numèrics |
| `features/ambients/AmbientEditor.tsx:199-262, 415-430` | `change(next, commit)` amb refs | 100 | explícita (`commit` en deixar anar) | ⌘Z, ⇧⌘Z, Ctrl Y; ignora `[role=dialog]` |

**Risc a verificar abans de posar desfer a l'editor de formes:** la drecera d'`EditorScreen` escolta `window` i **no
ignora els diàlegs** (172-193). Amb l'editor de formes obert (és un `Dialog` sobre l'Editor), ⌘Z probablement desfà el
**moble del darrere**. El desfer de la forma ha d'escoltar en captura i fer `stopPropagation`, o millor: una drecera
comuna que sàpiga quin àmbit és l'actiu (vegeu §3.3).

### 1.5 Lectors existents
- **DXF**: només hi ha un **lector mínim per a tests** a `core/export/dxf.ts:345-398` (`parseDxfPairs`,
  `parseDxfEntities`). Serveix de base però **no és suficient**: agrupa els valors per codi (`values[code][]`), i a una
  `LWPOLYLINE` els bulges (42) només surten als vèrtexs que en tenen, així que es perd a quin vèrtex van; tampoc
  llegeix `HEADER` (`$INSUNITS`), ni aplica `INSERT` (blocs amb escala/gir).
- **SVG / EPS / PDF**: res. `three` porta un `SVGLoader` a `three/examples`, però `core/` no pot importar three
  (`CLAUDE.md` § Arquitectura); un parser propi de `path d` és petit i testejable.
- No hi ha cap dependència de DXF/SVG al `package.json` (i no se n'han d'afegir sense preguntar).

---

## 2. Anàlisi de buits respecte al que demana el propietari

| Desig | Editor de formes | Ploma d'Ambients | Cost |
|---|---|---|---|
| **Corbes** | ✅ cúbiques i arcs | ❌ parets rectes; caldria `Wall.bulge` i refer 3D, obertures, imant, render | Formes: — · Ambients: **L** |
| **Maj = segment recte mentre dibuixes** | ❌ Maj vol dir «imant d'1 mm» (125, 217, 233) | Maj vol dir «angle lliure» (190) — conflicte de significat | **S** + decisió |
| **Desfer / Refer** | ❌ cap | ✅ (però codi propi) | **S** (amb hook compartit **M**) |
| **Importar DXF** com a forma | ❌ | — | **M** |
| **Importar DXF** com a plànol de fons | — | ❌ només imatge | **S** (si es rasteritza) / **M** (vectorial) |
| **Importar EPS** | ❌ | ❌ | **M**, i fràgil (vegeu §4.2) |
| **Seleccionar diversos nodes / marc** | ❌ un sol `sel` | — | **M** |
| **Zoom i desplaçament** | ❌ vista fixa | ✅ | **S** si es reaprofita el de `PlanCanvas` |
| **Imant a nodes, guies, angles** | només quadrícula | extrems de paret, 15° | **M** |
| **Continuar / afegir a una forma amb la ploma** | ❌ la ploma esborra la forma (149-154) | ✅ encadena | **S** |
| **Entrada numèrica** (llarg/angle del tram) | només X/Y del node | mida a la previsualització | **S** |
| **Forats interiors / diversos contorns** | ❌ un contorn | — | **L** (toca model i build) |

Detalls que importen:
- **«Maj per fer el segment recte»** (apartat 6): amb la ploma, mentre s'arrossega per crear manegadors (línies 241-245),
  Maj hauria de **treure els manegadors** del node nou i del tram que hi arriba (`out` del node anterior), i la
  previsualització (279) dibuixar recta. Avui Maj fa una altra cosa i no es pot reutilitzar sense moure aquella funció.
- **Coherència dels modificadors** (regla d'or): avui Maj vol dir «imant fi» a les formes i «angle lliure» al plànol,
  Alt vol dir «trencar manegador» a les formes i «sense imant» al plànol. Proposta de taula única (a confirmar amb
  l'usuari):

  | Tecla | Ploma (formes i plànol) | Moure nodes / extrems |
  |---|---|---|
  | **Maj** | tram **recte** i angle a 15° (com Figma/Illustrator restringeixen) | angle a 15° respecte al veí |
  | **Alt** | sense imant | sense imant; sobre un manegador, el trenca (com Figma) |
  | **Espai** | arrossegar = desplaçar la vista | igual |
  | **Retorn / Esc** | tancar / descartar | — |
  | **⌘Z / ⇧⌘Z** | desfer l'últim node | desfer |

  Això **canvia el plànol** (avui l'angle a 15° hi és per defecte i Maj l'allibera). **Pregunta oberta:** mantenir el
  15° per defecte al plànol (parets) i a les formes no? La proposta neutra és: per defecte imant a quadrícula + extrems;
  Maj = recte + 15°. Cal la decisió de l'usuari abans de tocar res.
- **Corbes a les parets** són cares i decoratives. Alternativa barata i coherent: la ploma comuna dibuixa una corba i,
  **en desar-la com a parets**, es parteix en N parets rectes (p. ex. ≤ 15° d'arc cadascuna) amb un `group` comú. Sense
  canviar `Wall`, el 3D, les obertures ni el render. Una paret corba de debò (`Wall.bulge`) queda per a més endavant.

---

## 3. Un editor vectorial compartit?

### 3.1 Veredicte

**Sí al nucli compartit, no a un sol component.** Les dues superfícies fan coses diferents: `PlanCanvas` és un editor
d'escena (parets amb gruix, elements, obertures, calibratge, grups) i `ProfileEditor` és un diàleg d'un sol contorn per
fabricar. Ficar-les en un component amb `if (mode)` faria un monstre. Però **tot el que és vectorial és el mateix
problema** i avui està fet dues vegades o a mitges:
- pan/zoom (només al plànol), quadrícula (dues implementacions), imant (dues), ploma (dues), desfer (dues, i una tercera
  si en fem una per a les formes), dreceres (tres llocs amb el seu `MOD`/`metaKey || ctrlKey`).

La regla d'or (apartat 7) obliga a **extreure aquestes peces una sola vegada** i fer que les dues superfícies les usin.

### 3.2 Arquitectura proposada

```
core/model/path2d.ts        (pur, testejat)  — model de traç i operacions
core/import/dxf.ts          (pur)            — DXF → Path2D[]
core/import/svgPath.ts      (pur)            — SVG (path, rect, circle, ellipse, polyline) → Path2D[]
core/import/eps.ts          (pur, opcional)  — EPS/AI senzill → Path2D[]
features/vector/            (React)
  useViewport.ts            — View {tx,ty,s}, roda, pessigar, espai, zoomAt, fit (tret de PlanCanvas.tsx:100-177, 612)
  usePenTool.ts             — màquina d'estats de la ploma: clic/arrossegar/tancar, Maj recte, Alt sense imant
  useSnap.ts                — quadrícula + punts (nodes, extrems de parets) + angle; el plànol hi passa els seus punts
  PathOverlay.tsx           — nodes (quadrat/cercle), manegadors en rombe, punt del mig (el que dibuixa ProfileEditor 358-453)
  Grid.tsx                  — quadrícula menor/major amb la mida segons el zoom
features/useUndoable.ts     — desfer/refer genèric (substitueix els dos actuals)
features/useEditorShortcuts.ts — ⌘Z/⇧⌘Z/Ctrl Y/Supr/fletxes amb àmbit (diàleg > pàgina)
```

**Model de traç** (`core/model/path2d.ts`): generalitzar el que ja hi ha, sense trencar dades desades:
```ts
interface Path2D { nodes: PNode[]; closed: boolean }   // PNode = el d'ara (polygon.ts:184), sense canvis
```
- Les formes desades (`PNode[]`) són `{ nodes, closed: true }`; no cal migració.
- Les operacions de `polygon.ts` (`edgeOf`, `splitEdge`, `bendEdge`, `filletNode`, `moveHandle`, `sampleProfile`,
  `profileToOutline`) passen a acceptar `closed` (avui assumeixen tancat amb `% n`). `openPath` (`ProfileEditor.tsx:587`)
  desapareix.
- Operacions noves: `appendNode`, `straighten(i)` (treu `out` de i i `in` de i+1), `removeNodes(set)`,
  `translateNodes(set, d)`, `reverse`, `join(a, b)`, `arcToCubics` (per editar un arc importat com a corba si cal).
- El plànol fa servir el mateix `Path2D` **mentre es dibuixa** i el converteix en parets en acabar
  (`pathToWalls(path, defaults)`: rectes → una paret; corbes → N parets agrupades, §2).

**Desfer compartit** (`features/useUndoable.ts`): unir les dues semàntiques que ja existeixen:
```ts
const h = useUndoable<T>(initial, { limit: 100, coalesceMs?: 500 })
h.set(next, { commit?: boolean })   // commit:false = en viu (arrossegar); commit:true = un pas
h.undo(); h.redo(); h.canUndo; h.canRedo; h.reset(value)
```
- `AmbientEditor` hi passa amb `commit` (com ara); `EditorScreen` amb `coalesceMs` (com ara); `ProfileEditor` amb
  `commit` en deixar anar (i cada node de la ploma = un pas, perquè ⌘Z mentre dibuixes tregui l'últim punt, com Figma).
- El reductor pur (`past/present/future`) es pot posar a `core/` i testejar-lo sense React.

**Dreceres** (`useEditorShortcuts`): una sola funció que decideix si una tecla és per a un camp de text (regla d'avui de
`EditorScreen.tsx:178-184`), per a un diàleg obert o per a la pàgina. Corregeix el risc de §1.4 i treu els tres
`metaKey || ctrlKey` repetits. Ajuda: una llegenda única de dreceres (les de §2) als dos editors.

**Figma-like a l'editor de formes**, amb aquestes peces:
- Vista amb pan/zoom (`useViewport`), «Encabir» i escala; el diàleg ja és a pantalla completa al mòbil.
- Selecció múltiple (`Set<number>`), marc de selecció, Maj+clic afegeix; moure/esborrar/fletxes sobre la selecció.
- Ploma que **continua** el traç obert o comença un subcamí sense esborrar la forma (avui `startPen` buida `nodes`).
- Imant a nodes i a l'angle (guies tipus «alineat amb el node X»), indicador visual de l'imant.
- Camps numèrics del tram seleccionat (llarg i angle) a més d'X/Y del node.

---

## 4. Importar

### 4.1 DXF (viable, **M**)

Base: el tokenitzador de `core/export/dxf.ts:354` (parells codi/valor) es mou a `core/import/dxf.ts` i es reaprofita;
la part d'entitats es reescriu llegint **parells en ordre** (no agrupats per codi).

| Entitat | Com | A què passa |
|---|---|---|
| `LINE` | 10/20 → 11/21 | tram recte |
| `ARC` | centre, radi, angles (graus, antihorari) | tram amb bulge `tan(sweep/4)` |
| `CIRCLE` | centre, radi | camí tancat de 2 arcs (bulge 1) o 4 cúbiques (`ellipseNodes`) |
| `LWPOLYLINE` | 90 (n), 70 (bit 1 = tancada), 10/20 i **42 per vèrtex en ordre** | nodes amb `b` |
| `POLYLINE`/`VERTEX`/`SEQEND` (R12, el que escrivim nosaltres) | 70 bit 1, vèrtexs amb 42 | nodes amb `b` |
| `ELLIPSE` | centre, eix major, ràtio, paràmetres | cúbiques (4 per volta, partides) |
| `SPLINE` | grau, nusos (40), punts de control (10/20), pesos (41) | **grau 3 no racional** → Bézier per inserció de nusos (Boehm); grau ≤ 2 elevat; racional o amb `fit points` només → mostrejar i ajustar (avís) |
| `INSERT` | bloc + 10/20, escala 41/42, gir 50 | aplicar la transformació (les nostres peces són blocs `P001…`, `dxf.ts:87`) |
| `TEXT`, `DIMENSION`, `HATCH`, `SOLID`, 3D | — | s'ignoren i es compten (com `unknown` a `xcsPreview.ts`) |

Després: **unir trams** pels extrems (tolerància 0,01 mm) en camins; els tancats es classifiquen (el d'àrea més gran =
contorn, els de dins = forats). **Unitats**: `$INSUNITS` (4 = mm, 1 = polzades, 5 = cm, 6 = m); sense, mm i es diu.

Destinacions:
- **Forma d'una peça**: el contorn exterior → `PNode[]` → `ProfileEditor` (es veu i es pot retocar abans d'«Aplicar»).
  **Els forats interiors no tenen lloc avui**: `FreePart` només té `shape` (`freePart.ts:37`). Opcions: (a) avisar i
  descartar-los a la v1; (b) afegir `FreePart.holes?: PNode[][]` → `Panel.cutouts` `polygon` (l'esquema ja existeix,
  `panel.ts:124`) — toca build i proves d'or (**L**). Proposo (a) a la fase 1 i (b) com a fase pròpia.
- **Plànol de fons d'un ambient**: el DXF ja porta l'escala real, així que es pot **rasteritzar** a un canvas
  (2400 px, com la imatge actual) i desar-lo com a `PlanImage` amb `mmPerPx` conegut i **sense calibrar**: reaprofita
  tot el que ja hi ha (opacitat, bloqueig, `ambientBox`). Vectorial de debò (zoom sense píxels, imant als traços del DXF)
  vol un camp nou (`Ambient.planVector`) i és **M**; es pot fer després.
- **Round-trip gratis com a test**: `toDxf` (`dxf.ts:318`) d'una peça amb `outline` → importar → mateix contorn.

### 4.2 EPS (feasible només a mitges; ser honestos)

EPS és **PostScript, un llenguatge de programació**: pot tenir bucles, procediments, transformacions, text, imatges i
dades comprimides. Un lector complet és un intèrpret PostScript (Ghostscript) — fora d'abast i fora del stack.
El que **sí** es pot fer:
- Els EPS **d'Illustrator / Inkscape / CorelDraw exportats «simples»** fan servir procediments curts per a `moveto`,
  `lineto`, `curveto`, `closepath` (`m`, `l`, `c`, `v`, `y`, `h` a l'estil AI, o `moveto`/`lineto`/`curveto` literals).
  Un lector que només reconegui aquests operadors amb números literals, `concatmatrix`/`cm` per a la matriu i
  `%%BoundingBox` per a l'escala (punts → mm: × 25,4/72) funciona per a una bona part dels fitxers de dibuix. **M**,
  amb avís clar «aquest EPS no s'ha pogut llegir: exporta'l com a SVG o DXF» quan trobi alguna cosa que no entén
  (procediments definits per l'usuari, `image`, binari, `%%BeginData`, compressió).
- Els EPS que porten una **previsualització TIFF/WMF** o són només imatge no es poden fer vectors.

**Recomanació:** afegir **SVG** (i opcionalment PDF vectorial més endavant) com a format principal d'import, i l'EPS
com a «millor esforç» o directament no fer-lo i dir a la UI «per a EPS, exporta'l com a SVG o DXF». Cal preguntar a
l'usuari quin programa fa servir per dibuixar: si és Illustrator/Inkscape, l'SVG li és igual de còmode.

### 4.3 SVG (més fàcil i més útil, **S–M**)

- `DOMParser` (navegador, a `features/`) per llegir l'XML; el **parser de `d`** (`M L H V C S Q T A Z`, relatius i
  absoluts) i la composició de `transform` van a `core/import/svgPath.ts` (pur, testejable amb cadenes).
- `C`/`S` → cúbiques directes (`PNode.in/out`); `Q`/`T` → elevació a cúbica (exacta); `A` (arc el·líptic) → si és
  circular, bulge exacte; si no, cúbiques. `rect`/`circle`/`ellipse`/`polygon`/`polyline` → camins.
- Unitats: `viewBox` + `width/height` amb `mm`; sense unitats, 96 dpi (px → mm × 25,4/96) i avís perquè l'usuari
  confirmi l'escala (l'editor ja té els camps per corregir la mida: `onApply` torna `w`, `h`).
- Mateix pas final que el DXF: camins → contorn + forats → `PNode[]`.

---

## 5. Pla per fases

Mides: **S** ≤ 1 dia · **M** 2–4 dies · **L** > 1 setmana. Cada fase acaba amb `pnpm typecheck`, `lint`, `test`, `build`.

| Fase | Què | Mida | Depèn de | Tests nous |
|---|---|---|---|---|
| **F0** | Decisions amb l'usuari: taula de modificadors (§2), EPS sí/no, forats interiors sí/no, corbes de paret «partides» vs `Wall.bulge` | S | — | — |
| **F1** | `useUndoable` + reductor a `core/` i `useEditorShortcuts`; migrar `EditorScreen` i `AmbientEditor` sense canviar comportament; corregir ⌘Z dins de diàlegs | M | F0 | reductor: límit, `commit:false` no apila, coalescència per temps, redo es buida en un canvi nou; drecera ignora inputs de text i diàlegs |
| **F2** | Editor de formes: desfer/refer (un pas per node de la ploma i per arrossegada), **Maj = recte** a la ploma, imant fi a Alt, ploma que no esborra | S | F1 | `straighten`, `appendNode` (core); un test de la màquina d'estats de la ploma si s'extreu a una funció pura |
| **F3** | `useViewport` tret de `PlanCanvas` i fet servir a `ProfileEditor` (zoom, pan, Encabir); `Grid` i `PathOverlay` comuns | M | F2 | `zoomAt`/`fitView` ja purs → moure'ls a un `.ts` testejat |
| **F4** | `Path2D` amb `closed` a `core/model/path2d.ts`; operacions de `polygon.ts` per a obert/tancat; selecció múltiple, marc, Supr/fletxes sobre la selecció, camps de llarg i angle | M | F3 | `edgeOf`/`sampleProfile`/`splitEdge` amb obert; `profileToOutline` idèntic per a tancat (golden sense canvis) |
| **F5** | Import **DXF** com a forma (`core/import/dxf.ts`: LINE, ARC, CIRCLE, LWPOLYLINE amb bulge, POLYLINE R12, ELLIPSE, SPLINE grau 3, INSERT, unitats; unió de trams; contorn exterior) i botó «Importar DXF/SVG…» al diàleg | M | F4 | round-trip `toDxf` → import; LWPOLYLINE amb bulge només a alguns vèrtexs; SPLINE → Bézier contra punts mostrejats (< 0,02 mm); polzades → mm; trams desordenats que s'uneixen; entitats ignorades comptades |
| **F6** | Import **SVG** (`core/import/svgPath.ts`) al mateix botó | S–M | F5 | `d` amb tots els comandaments, relatius, `transform` niats, `A` circular → bulge, unitats `mm` vs px |
| **F7** | Plànol de fons des de **DXF/SVG** (rasteritzat a `PlanImage` amb `mmPerPx` del fitxer) | S | F5/F6 | escala: un rectangle de 5000 mm al DXF fa 5000 mm al plànol |
| **F8** | Ploma comuna al plànol (`usePenTool`): corbes que es desen com a parets partides en grup; Maj/Alt com a les formes | M | F3, F0 | `pathToWalls`: recta → 1 paret; arc de 90° → N parets amb error de corda ≤ x; extrems enganxats |
| **F9** *(opcional)* | Forats interiors en peces lliures (`FreePart.holes` → `Panel.cutouts` polígon) | L | F5 | build + **proves d'or** (`UPDATE_GOLDEN=1`, revisar diff), xcs i DXF amb talls interiors |
| **F10** *(opcional)* | EPS «millor esforç» (operadors de traç d'AI/Inkscape) | M | F6 | fitxers d'exemple petits d'Illustrator i Inkscape; fitxer amb procediments → error clar |
| **F11** *(més endavant)* | Paret corba de debò (`Wall.bulge`): 3D, obertures, imant, render | L | F8 | `wallSegments`/`nearestWall` amb arc |

Ordre recomanat: **F0 → F1 → F2** (el que demana l'usuari de forma immediata: Maj, desfer) → **F3 → F5 → F6** (importar,
on «dibuixar fora i portar-ho» deixa de ser necessari) → F4 → F7 → F8. F9–F11 només si l'usuari ho demana.

### Proves transversals
- **Tot el que entra per un importador** ha de passar per `profileToOutline` amb error < 0,02 mm i sense
  `selfIntersects` (propietat comprovada sobre un corpus petit de fitxers a `src/core/import/__fixtures__/`).
- **Cap canvi a la fabricació** fins a F9: les proves d'or no s'han de moure en F1–F8; si es mouen, és un error.
- Teclat: un test de `useEditorShortcuts` (o de la funció pura que decideix l'àmbit) amb un input de text, un numèric i un
  diàleg obert.

---

## 6. Preguntes obertes per a l'usuari
1. **Maj**: ha de ser «tram recte + angle a 15°» a tot arreu (i el plànol deixa de tenir el 15° per defecte), o només
   «tram recte» a la ploma de formes?
2. **EPS**: quin programa fas servir per dibuixar? Si pot exportar SVG o DXF, proposo no fer EPS.
3. **Forats** dins d'una forma importada (p. ex. un logotip, una nansa calada): els vols com a talls a la CNC (F9) o
   n'hi ha prou amb el contorn?
4. **Parets corbes**: n'hi ha prou amb parets rectes curtes que segueixen la corba (barat), o vols paret corba de debò?
5. **DXF de fons**: n'hi ha prou amb una imatge feta a partir del DXF (escala automàtica) o el vols vectorial (imant als
   seus traços)?

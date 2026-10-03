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

## Documentació (`docs/`)
- Els prompts van a `docs/prompt/`; la resta de documentació nova (decisions, notes de fusteria) a `docs/` en Markdown. El
  `CLAUDE.md` es queda a l'arrel i només hi enllaça.
- [`docs/prompt/PROMPT.md`](docs/prompt/PROMPT.md): abast i tasques de la **Fase 1** (mòdul de caixa de punta a punta,
  nesting simple, `toUnifiedData`). Llegeix-lo abans de treballar en una fase.
- [`docs/prompt/PROMPT-editor-compartiments.md`](docs/prompt/PROMPT-editor-compartiments.md): **editor de compartiments**
  (mòduls, divisions, portes, calaixos, reixeta, objectes de referència, plantilles). Prova d'acceptació: el moble de TV +
  el cobreradiador de casa. [`PROMPT-moble-tv-radiador.md`](docs/prompt/PROMPT-moble-tv-radiador.md): **substituït** per
  aquest (referència del disseny del cobreradiador).
- [`docs/prompt/PROMPT-visualitzacio.md`](docs/prompt/PROMPT-visualitzacio.md): vistes estàndard, portes i calaixos oberts,
  materials amb textura i veta, imatge PNG. **Sense decoració.**
- [`docs/prompt/PROMPT-foto.md`](docs/prompt/PROMPT-foto.md) i [`docs/foto-mesures.md`](docs/foto-mesures.md): foto del lloc
  (calibratge amb referència, mesures **relatives / estimades / reals**, recalibratge, qualitat, línia del terra i fondària).
- [`docs/prompt/PROMPT-preferencies.md`](docs/prompt/PROMPT-preferencies.md): pantalla de **Preferències** (prompt inicial;
  els noms dels apartats d'ara són els d'aquest fitxer).
- [`docs/prompt/PROMPT-fitxer-moble.md`](docs/prompt/PROMPT-fitxer-moble.md): **desar i obrir mobles com a fitxer `.moble`**.
- [`docs/prompt/PROMPT-export-taller.md`](docs/prompt/PROMPT-export-taller.md) i [`docs/export-taller.md`](docs/export-taller.md):
  **export en format TopSolid (STEP 3D + CSV de nesting)**: eixos, numeració de cantells del taller, geometria de forats i
  ranures, etiqueta, test d'anada i tornada.
- [`docs/prompt/PROMPT-taller-import.md`](docs/prompt/PROMPT-taller-import.md): **OBSOLET** (substituït per l'export STEP +
  CSV). Era per a `taller-cnc-nest` (`POST /api/nesting/import`). **No s'executa en aquest repo.**
- [`docs/maestro-xcs.md`](docs/maestro-xcs.md): **màquines CNC i programes de Maestro (.xcs)**: context de màquina,
  orientació i origen (orígens verificats), instruccions MSL amb les pàgines del manual, tria d'eines, regles, comparació amb
  un programa real del taller i preguntes obertes. Fonts a `docs/maestro/` (manual MSL R4 —**no es puja al repo**, és de
  SCM—, context `AA10008021.machinecontext`, `eines.txt` del germà, mostres a `docs/maestro/samples/`).
- [`docs/colleccions-mobles.md`](docs/colleccions-mobles.md): **col·leccions de mobles** (biblioteca de referències:
  minimalisme arquitectònic i comercial; prompt a [`PROMPT-colleccions.md`](docs/prompt/PROMPT-colleccions.md)).
- [`docs/cad-mobles-cataleg.md`](docs/cad-mobles-cataleg.md): font del catàleg de plantilles per a botigues de mobles.

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
- Lint: `oxlint`. **Mai prettier.**

## Arquitectura
```
src/
  core/            # lògica pura, SENSE React, Chakra ni three.js. Testejada.
    model/         # tipus i esquemes zod: composició (mòduls, zones, peces lliures, objectes), Panel, ambients,
                   #   màquines, preferències, plantilles i catàlegs, reparació i migracions
    build/         # regles: composició -> peces (gruixos, unions, forats, ranures), avisos; golden tests
    cutlist/       # llista de peces, agrupació, cantells, veta
    nesting/       # col·locació de peces rectangulars sobre taulers (nest, machineNest)
    export/        # STEP, CSV de TopSolid, DXF, .xcs de Maestro, lector d'.xcs (Vista CAM), UnifiedData (JSON)
    machine/       # importar de Maestro (.machinecontext, .pgmx), tria d'eines, regles de mecanitzat
    process/       # post-processos de cada peça (2a cara, inglet, cantell, encolar, push)
    file/          # fitxer .moble, zip
    photo/         # homografia, calibració amb referència, EXIF
  features/        # pantalles: projects (Mobles), editor, composition (arbre i inspectors), cutlist (Peces), nesting,
                   #   export, photo, ambients, objects, settings, file
  components/      # mòduls compartits (Workspace, TopBar, FormRow, MasterDetail, PanelSection…)
    ui/            # snippets de la CLI de Chakra (retocats només on cal: toaster)
    viewer/        # escena 3D (r3f), textures, miniatures, GLB/USDZ (exportGlb.ts, exportUsdz.ts), render/
  theme/           # createSystem, tokens, accent, layout.css
  db/              # Dexie
```
Regla clau: **`core/` no importa mai de React, Chakra ni three**. Tota la geometria de fabricació surt de `core/`; el visor
3D només la pinta.

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

## Model del moble
- **Tipus de moble** (`Composition.kind`, `compositionKind`, `features/composition/kinds.ts`): Moble, Cuina, Armari, Taula,
  Flat-pack (`lliure`) i Objecte (`objecte`, vegeu Objectes). Es canvia a l'inspector del moble (secció Tipus,
  `MOBLE_KINDS`); un moble nou en blanc és sempre del tipus Moble. Els antics: cuina si tenen `runs`, si no moble. Taulell i
  sòcol correguts només surten i es construeixen a la Cuina; en canviar de tipus es guarden (no es fan) i tornen. Taula:
  `tableModule` (tauler + dos laterals de panell, sense base ni fons, cantonades a inglet); «Afegir mòdul» n'afegeix una. Flat-pack: no es fan mòduls (es
  guarden), l'arbre només mostra peces i objectes.
- **Sense mòduls especials** (per decisió de l'usuari: la caixa es configura a l'inspector). Queden al codi sense UI els de
  `core/model/modulePresets.ts` (`modulePresetsFor`: cuina —baixos de calaixos, porta, fregadera, fogons, forn; columnes forn i rebost; alts porta i
  abatible—, armari —prestatges, penjador amb maleter, calaixos i prestatges—, taula —consola, menjador, centre, banc, «Taula
  oval»—; al Moble, les plantilles d'un sol mòdul).
- **Posició: dues files, com a les cuines** — *A terra* (baixos) i *Penjats a la paret* (`base.kind = "wall"` amb l'alçada
  des del terra). Dins de cada fila l'ordre és el de l'arbre i cada mòdul va al costat de l'anterior amb `gapBefore`. Posició
  sempre amb `modulePlacements()` / `compositionWidth/Height`, mai a mà. Els `anchor` antics es converteixen en carregar
  (`normalizeComposition`). Tres muntatges (`mountOf`): **A la paret**, **Penjat** i **Al terra** (lliure: `Module.wallGap`
  = separació de la paret, i **X pròpia** `Module.x`/`freeX`: surt de la fila i no empeny els altres, p. ex. una illa; camp
  «De costat (X)»). Els antics «Al terra» sense `x` continuen a la fila. Taulell i sòcol correguts no tenen en compte `wallGap`.
- **Carcassa** (inspector del mòdul, Estructura):
  - **Base**: a terra · sòcol · potes · sense base. Avís `hanging` si un penjat té el fons prim.
  - **Fons** (`Carcass.back`): en ranura · cargolat darrere · **encastat** · sense. Encastat (`buildInsetBack`): ocupa la
    llum interior (on falta una peça, fins a fora; parets buides: entre les pells de dins), enrasat o retirat
    `backInsetSetback` (Fusteria, «Retirada del fons»); pot ser del tauler del cos (veta vertical, cantell només on no toca
    res). S'uneix com un prestatge fix: 3 espigues per costat (`threeAlong`, `endOffset`) a laterals, base i tapa (no al
    tauler de taula ni on la tapa amb ranura d'aire no arriba); amb menys de 15 mm, sense espigues i avís `back-inset`
    (cargolar-lo). L'interior comença a `backInnerZ` = retirada + gruix; la filera System 32 de darrere es mesura des del
    darrere del fons però mai dins (`max(retirada + 37, backInnerZ + Ø)`); si arribaria a la de davant, no es fa. Més avisos
    `back-inset`: poca fondària davant del fons (< 2 × 37 + Ø) i, amb ranura d'aire, menys de 10 mm entre fons i tapa (el
    cantell de dalt del fons, si és del cos, es canteja). Tapa de reixeta: la franja del fons queda sense ranures. Passar a
    «Encastat» amb un fons de menys de 15 mm el posa «Com el cos». «Afegir mòdul al costat» copia el fons sencer.
  - **Cantonades** Normals / A inglet (`Carcass.joint`): la tapa arriba a fora dels laterals; la base també (`mitreBottom`)
    si és a baix de tot (a terra, potes o penjat; amb sòcol no). No surt si no hi ha res a unir (`jointApplies`). Si el
    mòdul només té calaixos i fronts recobrents, **els fronts dels calaixos van a inglet** (`mitreFronts`): laterals fins a
    la cara dels fronts amb el cantell de davant a 45°, fronts de fora a fora, el primer i l'últim també amb tapa i base;
    amb portes no (toparien en obrir). La caixa del calaix queda sempre dins de la llum. El tall a 45° és un post-procés
    (el nesting talla el rectangle). `mitreGeometry` (qualsevol dels 4 cantells), `Panel.mitres` (sense cantell ni espigues,
    avís informatiu), capa DXF `MITRE_45`, «n∠45°» al llistat i al CSV, trapezi al 3D/GLB, 45° al STEP.
  - **Fronts** Recobrents / Encastats (`fronts.style`): encastats dins de la llum amb el joc a tot el voltant, a nivell amb
    el davant (`frontZ`), caixa del calaix un gruix més curta i avís si els prestatges no es retiren prou.
  - **Parets buides** (`Carcass.hollow.thickness`): laterals, base i tapa de pell de fora + pell de dins (`*-inner`, fa de
    paret per a forats, guies i ranura del fons), llistons (rol `spacer`) i tira del davant (rol `facing`). `derive` dona
    `ws/wb/wt` i la llum; `frontTerritory` usa el gruix real. Sense espigues entre pells (s'encolen); calen ≥ 2·gruix + 6 mm
    (si no, avís i massisses). Cantonades **sempre a inglet** (`hollowCorners`) i tires del davant en marc amb el tall a 45°
    en el seu pla (`outline`, es fa al nesting).
  - **Tauler de taula** (`Carcass.tableTop`): la tapa per sobre dels laterals (més curts), voladís a tot el voltant i forma
    (rectangle, arrodonit, oval o a mida amb l'editor de perfil; `shape` en mm s'escala). `Panel.outline` (rectes i arcs):
    3D/GLB extruït, DXF amb bulge, STEP prisma amb cares cilíndriques (`outlineSolid`). `shapeOutline` escala per
    l'extensió real de la corba mostrejada (no pels nodes: les cúbiques sortien del rectangle del nesting). Els fronts
    recobrents s'aturen a sota del voladís (joc `outerGap`).
- **Zones** (compartiments): divisions verticals/horitzontals amb mides fixes o «auto» (l'últim «auto» agafa el que sobra);
  contingut obert, prestatges, porta, calaixos, abatible, reixeta o front fix.
  - **Prestatges gruixuts** (`zone.shelves.thickness`, «Gruixuts (buits)»): pells, tira i llistons. **A ras del davant**
    (`zone.shelves.flush`); amb fronts encastats, només als compartiments sense front (si no, es retiren i avisa).
  - **Front d'una zona dividida** (`buildParentFront`; portes d'armari de dalt a baix amb penjador i maleter darrere): les
    fulles de sota queden `covered`. «Front de tota la zona» i, al mòdul, «Front de tot el mòdul»: només portes o front fix.
  - **Barra de penjar** (`Zone.rail`, a Prestatges): tub d'inox Ø25 a 50 mm del sostre, de lateral a lateral; va a
    `ModuleBuild.extras` → «Elements sense nesting». Avís `rail` si el compartiment fa menys de 900 mm.
  - **Tiradors mecanitzats**: portes (costat contrari de les frontisses, a mitja alçada), calaixos (centrats) i abatibles
    (al cantell que obre): dos forats passants Ø5 a 128 / 96 / 64 com a talls `circle` `tag: "handle"` (el taller els llegeix
    com els passacables); el 3D no els buida (`visualPanel`) i hi col·loca el tirador.
- **Peces corregudes** (`comp.runs`, `core/build/runs.ts`, secció «Taulell i sòcol» del moble; `RunsForm`: cada peça és un
  plegable `Fold` amb un resum —de → fins a · gruix · forats—, dins del taulell cada forat també; una oberta alhora, la nova
  s'obre sola):
  **taulell** d'una peça sobre els baixos de la fila (voladís, forats d'encastar de placa, pica o a mida → talls passants) i
  **sòcol corregut** (davant de les potes, retranquejat). Es numeren com un mòdul més (n + 1) per a les refs. No arriben a
  les illes (`freeX`) llevat que la peça sigui només de l'illa; un forat que travessa el contorn no es fa i s'avisa.
- **Objectes de referència** (`RefObject`): caixa, cilindre o **perfil 2D**, per veure mides i, amb efecte:
  **Obstacle** (avisa si xoca; el cilindre amb la seva secció, `refTouchesBox`) o **Talla** (`build/refCuts.ts`,
  `applyRefCuts`): forat passant a cada peça perpendicular a la seva direcció (z: fons i portes; y: base, tapa, prestatges;
  x: laterals); si seria un rebaix (arriba a la vora), no es fa i avisa (`ref-cut`). Els **passacables** dels mòduls ja no
  tenen UI: es migren a objectes que tallen (`migrateCableHoles`, a `compositionOf` i `buildComposition`). Els objectes
  només foraden en la seva direcció.
- **Perfil 2D** (`shape: "profile"`): Bézier cúbica composta i tancada, extrudida. Nodes `PNode` (`model/polygon.ts`): punt,
  manegadors `in`/`out` relatius, `t` = reflex (cantonada · angle · angle i llarg) i `b` (bulge, arcs d'«Arrodonir»); els
  antics `[x, y, bulge]` es llegeixen amb `toNodes`. Per tallar, les cúbiques passen a arcs i rectes (`cubicToArcs`, error
  < 0,02 mm): DXF amb bulge i STEP amb cares cilíndriques; xocs i 3D amb el contorn mostrejat. Pendent: rebaixos de contorn.
- **Peces lliures i flat-pack** (`Composition.parts`, `model/freePart.ts`, `build/freeParts.ts`): taulers solts col·locats
  com els objectes però que són peces de debò (rol `part`, un «mòdul» més per a les refs). Orientació `front` (X·Y) · `side`
  (Z·Y) · `flat` (X·Z, v cap al fons); `w × h` al seu pla, gruix, material, veta, forma amb l'editor de perfils.
  - **Encaixos automàtics, només al tipus Flat-pack** (a la resta no es fan ni surten les opcions): entra i hi acaba →
    pestanyes + mortalles (passants o ranures cegues `tag: "mortise"`); s'encreuen → mitja fusta; totes dues hi acaben →
    dits; cantell contra cara → espigues. `Composition.joinery` (`DEFAULT_JOINERY`): joc, Ø de fresa dels **dogbones**,
    ample de pestanya. Contorn amb `polygon-clipping`; `build.joints` els llista.
  - **Grups** (`FreePart.group`, `moveGroupBy`, `duplicateGroup`, `movePartToGroup`, `reorderPart`, `removePartFromGroup`).
  - **Enganxada a un mòdul** (`FreePart.module`, `resolveParts`, `partOffset`): x/y/z relatives al mòdul (el taulell de
    pedra de l'illa). Tot el que dibuixa o construeix fa servir `resolveParts`.
  - **Peça que talla** (`FreePart.effect = "cut"`): no és una peça; `partCutters` la converteix en objecte que talla (perfil
    = la seva forma, direcció = el gruix) i `applyRefCuts` fa el forat a les peces que travessa (també lliures). Amb la
    mateixa normal: forat passant. **De costat** (`sidewaysCut`): si la travessa de cara a cara amb secció recta,
    rectangle al pla de la peça (forat, o osca del contorn a les peces lliures i les que no són de CNC; avisa si la parteix);
    si no, **booleà 3D**: `Panel.solidCuts` (prismes locals) que el visor, l'AR i el render resten amb three-bvh-csg
    (`solidCutGeometry`); a les peces de CNC avisa que no es mecanitza. També talla les peces que no són de CNC.
  - **Materials que no són de CNC** (`MaterialPref.cnc = false`: ferro, inox, pedra, vidre…): la peça porta `nest: false`
    (en triar-lo) i va a `build.extras`: es veu, surt a Peces › «Elements sense nesting» i no va al nesting ni als fitxers
    del taller, ni fa encaixos. Mides sempre Ample · Alt · Fondària (X · Y · Z); de CNC, el gruix es tria entre els del
    tauler; si no, les tres lliures i sense Veta ni encaixos.
- **Models 3D** (`Composition.models`, `ModelObject` a `model/composition.ts`: `src` = id de `MODEL_ASSETS` (`model/models.ts`)
  o `user-…`, cantonada x/y/z i caixa w/h/d en mm, `rot` en graus al voltant del vertical): malles `.glb` que **només es
  veuen** (vegeu Visor 3D). El gir compta a les caixes (`modelFootprint`: enquadrar, plànol dels ambients, contorn i imant).
  A l'editor: grup «Models 3D» a l'arbre (⋯ Duplicar · Eliminar, `insertModelCopy`), clic al 3D per triar-lo (`ModelMesh` a
  `CabinetViewer`), contorn i gizmo (`RefGhost outline`, es mou en viu), fletxes, Supr, Ctrl/⌘ C · V · D, i `ModelInspector`
  (Model · Mides amb «Mida original» · Posició amb el Gir a passos de 15°). Compten per enquadrar la càmera.

## Fabricació
### Regles de construcció (`core/build/`)
- **Regles revisades** (`build/manufacturing.test.ts`): amb fronts encastats, divisors i prestatges fixos d'una zona coberta
  es retiren `t + outerGap` (`insetCut`, espigues i System 32 al cantell nou); les portes d'una zona pare fan la filera
  System 32 als trams lliures entre prestatges fixos (placa de la frontissa); forats de guia dels calaixos des del davant de
  la caixa (`zFront − 37`); trapa de reixeta darrere del front encastat; ranura del fons sempre dins de la peça i allargada
  `g` on la tapa/base passa per sobre del lateral (inglet, tauler de taula); fons sota el tauler de taula i fins a
  `interior.y1` amb ranura d'aire; `hingeCount` (`geometry.ts`: 2/3/4/5 fins a 900/1600/2100) i cassoletes separades
  ≥ Ø + 10 (si no, menys i avís `hinge`); fons del calaix amb material del seu gruix (avís `drawer-bottom`); peces amb
  alguna mida ≤ 0 fora amb avís `invalid-part`. **Pendent de decidir amb el taller**: joc de les ranures i descompte del
  gruix del cantell.
- **Forats que es trobarien per dins** (`build/holeClash.ts`, `resolveHoleClashes`): System 32 a banda i banda d'un divisor
  → tots dos a (T − 1)/2; espiga de cantell contra un forat de cara → l'espiga s'atura 1 mm abans (mínim 10 mm, si no avís
  `hole-clash`). Els forats de guia de la caixa del calaix no arriben a la ranura del fons.
- **Casos degenerats** (trobats amb un fuzzer; `build/robustness.test.ts`): res surt de les peces i **mai mitja unió**
  (`dowelJoint`: si l'espiga no cap sencera al cantell i a la cara, no es fa cap dels dos forats). Espigues de divisors i
  prestatges fixos sobre el **tram de fondària comú** (`HorizontalRef.zRear/zFront`). Mides fixes que no sumen el total
  (±0,5 mm, sense «auto»): l'última s'ajusta i avís `layout` (`fitSizes`). Calaixos: **els fronts iguals fan la mateixa
  caixa** (la més justa del grup, a mig mm); espigues de la caixa amb `dowelsAlong` (dues a 30/20 mm dels extrems, una al
  mig o cap i avís); caixa de menys de `bottomOffset + fons + 30` mm d'alt o de 50 mm entre laterals → només el front i avís
  `drawer-box`. Portes estretes: sense cassoleta si no hi cap (`hinge`) i sense tirador si cauria a la columna de les
  cassoletes o fora (`handle`); abatibles estrets, forats a ¼ i ¾ o cap. Prestatges regulables a una filera lliure; fixos a
  ≥ 10 mm entre ells; els que no hi caben no es fan (`shelves`). **Mòduls que es trepitgen** (> 0,5 mm en les tres
  direccions): avís `overlap` amb els dos noms. Les plantilles del catàleg no poden fer cap d'aquests avisos
  (`storeCatalog.test.ts`).
- **Peces iguals**: dues peces de la mateixa mida i material amb mecanitzats diferents (no mirall) es poden intercanviar al
  taller (que lliga peça ↔ sòlid per mida): avís `same-size` (`build/sameSize.ts`, a `buildComposition`).
- **Res amagat compta** (regla): el que s'amaga a la UI es conserva (tornar a encendre l'opció recupera els valors), però
  `buildModule` construeix des de `visibleModule` (`model/composition.ts`), que posa a un valor fix els camps de les opcions
  apagades: fons (material i gruix sense fons; ranura sense ranura; retirada si no és encastat), inglet si Cantonades no
  surt (també els fronts dels calaixos), tauler de taula sense tapa sencera, prestatges i barra als calaixos i als
  compartiments dividits, gruix i «a ras» sense prestatges, alçades de calaix de més, frontissa de les dues portes, patró de
  reixeta de l'altre tipus. Sense fons, el fons dels calaixos surt del material del cos. Sense cap prestatge, «Regulables» es
  veu i compta (fileres System 32). **Una opció nova que amaga camps s'afegeix a `visibleModule` i a
  `build/hiddenState.test.ts`** (camps amagats a l'atzar i camins de la UI en un altre ordre → les mateixes peces i avisos).
- **Post-processos** (`core/process/processes.ts`, `panelProcesses`): el que toca a cada peça després del nesting, en ordre:
  2a cara → Inglet 45° → Cantell → Forats de cantell → Encolar (`Panel.assembly`) → Push (Tip-On) (`Panel.push`, fronts
  sense tirador; l'avís `push` surt un sol cop i demana frontisses sense molla). **2a cara** (`needsSecondFace`: forats o
  ranures a la cara B) → columna `SEGUNDO_NOMBRE_DE_FICHERO_DE_MECANIZADO` del CSV amb `<ref>Volt` (com TopSolid; el taller
  en fa l'etiqueta «PROGRAMA 2a CARA»). La resta surt a Peces («Després del nesting») i al CSV de peces (Processos). L'app
  **no fa etiquetes** (les fa el taller): només ho anota.

### Proves d'or (golden)
- `src/core/build/golden.test.ts` construeix un corpus fix (totes les plantilles —app, botiga, col·leccions, revista— i 200
  variacions aleatòries amb llavor, `build/testCorpus.ts`, ids estables) i en compara un resum determinista amb
  `src/core/build/__golden__/*.json`: per moble, peces i avisos (codis); per peça, rol, nom, L×A×G, material, veta, cantells,
  inglets, forats, ranures, talls, contorn i col·locació (hash). `exports.json`: CSV de TopSolid, .xcs per tauler (context
  real de la màquina) i entitats del DXF per capa d'uns quants.
- **Qualsevol canvi volgut a la fabricació** s'actualitza a propòsit: `UPDATE_GOLDEN=1 pnpm test` i es **revisa el diff** dels
  JSON (què ha canviat i a quins mobles). Un diff que no s'esperava és un error.

## Exports (pàgina Exportar)
- **Per destinació, en aquest ordre**: **Màquina CNC (Maestro, .xcs)** (la primera i principal, destacada, BETA) · STEP de
  TopSolid · CSV de TopSolid · CNC (DXF) · Llista de tall (CSV) · Model 3D (GLB/USDZ); una acció principal per grup. Les
  eines de depuració (JSON `UnifiedData`, `toUnifiedData`) plegades a «Avançat». Els plànols de peça no van a Exportar.
- Tots els textos cap al taller passen per `workshopName` / `csvField` (`export/text.ts`: ASCII, sense `;` ni `:`; el parser
  del taller no admet cometes).

### TopSolid: STEP + CSV per a `taller-cnc-nest` (~/Desktop/taller-cnc-nest)
**Decisió: el configurador exporta els mateixos fitxers que TopSolid V6** i el taller els carrega per la seva pàgina de
pujada de sempre (`POST /api/nesting/process`), sense cap canvi al taller:
```
Configurador ──► <moble>.step       (STEP AP214 · sòlids del moble)
             └─► <moble>_res.csv    (CSV de nesting · peces, mides, posicions, refs)
                      ▼
        taller-cnc-nest: visor 3D, mecanitzats, etiquetes, laminat, escaneigs + DXF per a la CNC
```
- **Font de veritat: els parsers del taller** (`src/nesting/parsers/*`, `assemble.ts`). Si no llegeix bé un fitxer nostre,
  s'arregla el nostre exportador. **No es modifica res de `taller-cnc-nest` des d'aquí.** Allà Chakra v2 + React 18: no es
  comparteix codi d'UI.
- **CSV**: UTF-16 LE amb BOM, `;`, CRLF, mateixes columnes que la mostra `ARM02_res.csv`; fila de tauler
  `<material>:<L>x<A>x<gruix>` abans de les seves peces. Gruix enter si ho és (`19`), si no amb punt (`18.6`), igual al nom
  del tauler, a la fila i a `Grueso_pieza`; els taulers es numeren pel nom imprès. Noms de peça del vocabulari del taller
  (`lat d`, `lat e`, `base`, `sostre`, `prestatge`, `trassera`, `porta`, `frontal`) i refs `A.<mòdul>.<tipus>.<n>` a
  `ÍNDICE_3D`.
- **STEP**: mm, **X = amplada, Y = fondària, Z = amunt** (el 3D és Y-amunt: es converteix); un `MANIFOLD_SOLID_BREP` per peça
  dins `ADVANCED_BREP_SHAPE_REPRESENTATION('<nom>')`. El taller lliga peça ↔ sòlid **per mida**: peces idèntiques surten com a
  `representative` (normal). **Un sol STEP** (`toStepCad` a `export/step.ts`, conjunts de `stepCadGroups`), per obrir el moble
  a TopSolid **i** per al taller: conjunt arrel › un subconjunt per mòdul («1. Baix»), «Taulell i sòcol» i les peces lliures
  (per grup) › una peça per tauler amb el nom, material i mides a la descripció i el color del material (`STYLED_ITEM`,
  `finishRgb`); inglets de debò, booleans 3D (`solidCuts`), talls i forats de les peces amb forma. Noms dels sòlids =
  `workshopName(p.name)` (= `Nombre_pieza` del CSV), l'etiqueta de l'app al `PRODUCT`. Forats de cara cecs com a molt a
  gruix − 1 (avís; el taller descarta els de ≥ T − 0,5). Peces amb base mirall: bucles girats. Si dos mecanitzats es creuen
  per dins, en deixa un fora i avisa. **Ferro, pedra i vidre** (`build.extras`) només amb l'interruptor «només per a CAD»
  (`stepCadGroups(…, { extras })`, `mobles:step-extras`, apagat): al taller donarien unions falses.
- **El STEP no serveix per mecanitzar**: TopSolid llegeix els forats com a geometria, no com a mecanitzats. Per això els .xcs.
- Validat amb OpenCascade (sòlids vàlids, volum positiu, sense autointerseccions) i amb els parsers del taller:
  `taller.roundtrip.test.ts` passa els fitxers pels parsers (importats del seu codi font, només lectura) i comprova peces,
  rols, forats, cantells, buidats i la 2a cara, i que `toStepCad` es llegeix igual que el STEP pla `toStep` (`toStep` només
  es fa servir als tests). Detall a `docs/prompt/PROMPT-export-taller.md`.

### DXF (CNC)
- Una peça per bloc (`P001…`, l'id en un comentari 999), contorn a la capa `CONTOUR`; R12, textos en ASCII.
- Forats en capes per diàmetre i profunditat, sense punt (`DRILL_D5_P12`, `DRILL_D35_P13`, `DRILL_D8_P17_5`) perquè TopSolid/Maestro
  els mapegin a eines; inglets a `MITRE_45`; contorns amb bulge (G2/G3). Coordenades en mm, sense escalar.

### Maestro .xcs (BETA)
- Exportar › «Màquina CNC (Maestro)» › «Programes .xcs» → `<moble>-maestro.zip` (`zipStore`, sense dependències) amb la
  màquina per defecte i les regles del taller (`machineWithRules`). **Només per tauler** (el Maestro no fa nesting; per
  decisió de l'usuari es va treure «Per peça» de la UI; petició del taller). El per peça (`toMaestroXcs`, un `<ref>.xcs` per
  peça i `<ref>Volt.xcs` per a la cara B, i `panelXcs`, a `core/export/maestroXcs.ts`) **queda al nucli amb tests però no és
  a la UI**; la capçalera `Machine.header.mechanicalOptions` només el fa servir ell. La targeta diu BETA fins que el taller
  els validi i mostra els avisos.
- **Per tauler** (`core/export/maestroNestXcs.ts`: `toMaestroNestXcs`, `cncNestOptions`, `toBoard`, `orderFeats`): un
  `T01_<material>_<gruix>.xcs` per tauler, **una peça de treball = el tauler**, amb el nom del tauler del CSV (`boardName`,
  `Noguera_xapada_19#01`; com el `Proyecto1.pgmx` del taller, no les peces «contemporànies» de §3.11 p129), tot en
  coordenades del tauler. Gir 0/90 (antihorari, sense mirall, = `localToBoard`). Només cara A: forats → ranures (sempre
  fresa) → talls per dins → contorns per fora (gruix + martiri), per eina i veí més proper; les peces petites (`small`) al
  final o al principi (`Machine.nesting.smallParts`, per defecte al final). Forats de cantell, cara B («fer a la perforadora /
  segona passada», sense Volt) i inglets a la ruta «CNC (tauler N) → …». Comentaris amb les peces i les etiquetes (ref +
  centre). Mostra `docs/maestro/samples/nesting_T01.xcs`. Alternativa documentada: el nesting del Maestro (§4 p134, CSV).
- **Instruccions**: només les dels exemples del manual MSL (pàgines als comentaris i a `docs/maestro-xcs.md`):
  `SetMachiningParameters`, `CreateFinishedWorkpieceBox`, `CreateRawWorkpiece`, `SelectWorkplane`, `CreateDrill`,
  `CreateSegment` + `CreateSlot` (disc), `CreatePolyline` + `CreateRoughFinish` (fresa), `CreateContourPocket`,
  `CreateBidirectionalMillingStrategy`, `Set/ResetApproachStrategy`, `Set/ResetRetractStrategy`, polilínia/cercle +
  `CreateContour` (semicercles amb `AddArc2PointCenterToPolyline`). Capçal sempre `"-1"`. Broques verticals amb eina `"-1"`
  per defecte (com el .pgmx; opció «Broques: tria el Maestro / eina concreta», `Machine.verticalDrills`). Noms d'eina sense
  plegar a ASCII, cadenes C# escapades (`cs`); fitxers en **UTF-8 amb BOM** (`xcsBytes`/`xcsZip`, pendent de validar).
- **Eixos**: X = u (`length`), Y = v, origen a baix a l'esquerra de la cara A; forats de cantell a les cares estàndard
  (3 Front · 1 Back · 4 Left · 2 Right, vistes des de fora, a mig gruix, broca horitzontal `"-1"`; a les peces amb forma només
  si el contorn toca la cara); cara B girada sobre X: (x, A − y). **Orígens verificats** (taula a `docs/maestro-xcs.md`).
- **Eines** (`core/machine/tools.ts`, només `auto` i muntades): broques pel Ø exacte i la fondària útil; ranures amb disc si
  van de cantell a cantell (opció «Ranures» de la màquina), si no fresa Ø ≤ ample; talls amb broca si n'hi ha del Ø, si no
  fresa limitada pels arcs i dogbones (`maxToolDiameter`); amb cantonades vives (`sharpCorners`), la fresa més petita i avís
  si el radi passa de 0,5 mm. Punts repetits fora (`dedupePolyline`), `num()` llança si no és finit. Sense eina → no surt i
  avisa. Les **regles de mecanitzat** del taller manen (vegeu Màquines).
- **Separació i marge**: `nest()` amb separació = Ø de la fresa de contorn més grossa dels gruixos del moble (`boardRouter`
  per gruix: la de la regla de perfilar o la de nesting; 19 + 30 → 14 + 2 = 16) + `spacingExtra`, i marge `edgeTrim`
  (`Machine.nesting`, `machineNesting`: 10 mm, Ø + 2, martiri 0,3 mm). La mateixa xifra al LLEGEIX-ME, la capçalera i la
  targeta d'Exportar. **El mateix nesting a tot arreu** (`core/nesting/machineNest.ts`, `nestPlan`, a `useNesting`): amb una
  màquina per defecte, la pàgina Nesting, el CSV de TopSolid, el JSON i els .xcs fan servir aquesta separació i marge; sense
  màquina, el `kerf`/`margin` del projecte (que de nou surten de `Settings.boards`, sense UI a Preferències: es queden a
  l'esquema com a valors inicials). Taulers, taulers per material i veta són sempre els del projecte (`project.nesting`).
- **Avisos ≠ post-processos** (per decisió de l'usuari): `warnings` només amb problemes de debò (eina, forat que no es pot
  fer…); el que toca després (`postProcesses`: inglets a la serra, cantejar, forats de cantell que no fa la CNC, encolar,
  push; al per peça també «Programa cara B: <ref>Volt.xcs») i la ruta («CNC: … → serra (inglets) → cantejadora») van al
  LLEGEIX-ME, al plegable «Després de la CNC» d'Exportar i com a comentaris ASCII a la capçalera (mai missatges a
  l'operari). Cantells amb la numeració de l'app (pendent de confirmar amb el taller).
- **Programa real del taller** (`docs/maestro/samples/taller_U767_Gris_cubanita_19_01.xcs`, TopSolid → Maestro, s'hi va
  mecanitzar; comparació línia a línia a `docs/maestro-xcs.md`). Ja hi som iguals: capçalera (`MachineParameters
  mp=GetMachiningParameters();`, 16777216, `SetPreserveWorkingSequence`, `SetWorkPieceFallPrevention`,
  `SetWorkpieceSetupPosition`, `Pload`), campanes (`SetPneumaticHoodPosition(1); ResetAuxiliaryHood(); ResetDustpan();` després
  de `SelectWorkplane("Top")`), comentari `//BROCA PLANA <eina>` / `//FRESA PLANA <eina>` abans de cada grup d'eina (el parser
  del taller hi atribueix els forats; cap altre comentari nostre diu BROCA/FRESA), `CreateDrill(…, "-1", "-1", 0, -1, -1, "P",
  0, 2)` i el nom de la peça. **Diferència deliberada**: TopSolid envia el **recorregut del centre de l'eina**
  (`CreateToolpath` + `AddSegmentToToolpath`/`AddArc2PointRadiusToToolpath`, rampa a 30°); nosaltres la geometria
  (`CreateContour`/`CreateContourPocket`/`CreateRoughFinish`) i el Maestro calcula el recorregut. El parser del taller només
  veu els `CreateRoughFinish`. Test: `core/export/tallerXcs.roundtrip.test.ts`
  (`TALLER_DIR=/tmp/claude-0/taller pnpm exec vitest run src/core/export/tallerXcs.roundtrip.test.ts`; se salta sense el repo).
- **Pendent de validar amb el taller** (llista a `docs/maestro-xcs.md`): pontets/pell de les peces petites, martiri, zones de
  buit, etiquetes, prova a la màquina (`PROVA_ORIENTACIO.xcs`), UTF-8 amb BOM (el real és ASCII sense BOM), noms de totes les
  eines al Maestro 2.0.5, bits de `MechanicalOptions` i el −20, disc o fresa per a les ranures, fixació, eines que falten al
  `.tlgx`, recorreguts explícits o calculats, sentit dels talls interiors, marge (el real: 12 = Ø), forats gairebé passants.

### Vista CAM
- Exportar › Màquina CNC (Maestro) › «Vista CAM» (`LuMonitorCog`): perquè el taller revisi cada programa a l'app abans
  d'enviar-lo, sense TopSolid. Diàleg a pantalla completa (zona segura com el Render) amb `export/CamPreview.tsx` sobre **el
  mateix text dels .xcs que va al zip** (`xcs.sheetList`).
- El dibuix surt de **llegir l'MSL**, no del model: `core/export/xcsPreview.ts` (`parseXcsPreview`, pur i testejat) llegeix
  peça de treball, peces i etiquetes dels comentaris, forats, polilínies (rectes, `AddArc2PointRadius/Center/3Points…`),
  cercles, segments, recorreguts (`CreateToolpath`) i operacions (`CreateContour` dins/fora, `CreateContourPocket`,
  `CreateRoughFinish`/`CreateSlot` amb la correcció, eina —amb `"-1"`, la del comentari `//BROCA PLANA …`—, fondària, sobrant,
  passada `_Pn` de les peces petites, rampa i passades) en l'ordre del fitxer. Una polilínia que acaba on comença (≤ 1e-3) és
  tancada encara que no porti `ClosePolyline` (`closedLoop`). Les línies que no entén **no llancen**: es compten (`unknown`).
- `camDraw`: el centre de l'eina a mig Ø al costat que toca (`offsetPolyline`) i la franja Ø (Ø de l'eina de la màquina pel
  nom, `findTool`); aproximat, només per dibuixar. SVG (`features/export/camDrawing.ts`): tauler i marge, peces (petites en
  groc discontinu) amb la ref, forats i fresats d'un color per eina amb la llegenda, «Amplada de l'eina», fletxa de rampa,
  números d'«Ordre» («289·302·318» si coincideixen), zoom 1×/2×/4×, `ChoiceChips` per tauler i la llista compacta
  d'operacions (tocar-ne una la marca).
- Tests (`xcsPreview.test.ts`): mobles del catàleg amb el context real (el que es llegeix = el que s'ha escrit),
  `nesting_T01.xcs`, el programa real del taller i els per peça.

### Model 3D i AR
- GLB/USDZ (`components/viewer/exportGlb.ts`, `exportUsdz.ts`) amb textures, models 3D i peces que tallen.
- **AR («Veure a casa»)**: botó del visor (`LuView`), no una exportació: USDZ + `<model-viewer>` amb AR Quick Look a
  l'iPhone. Res de WebXR.

## Màquines i regles de mecanitzat
- **Màquines CNC** (`settings/MachinesPane.tsx`, `MasterDetail`): la SCM del taller (Xilog Maestro 2.00.004, sèrie
  AA10008021) s'**importa de Maestro** amb un **sol importador** (`core/machine/maestroImport.ts`, `importMaestro`; zona
  «Importar de Maestro» amb «Triar carpeta…» (`webkitdirectory`) · «Triar fitxers…» i drag & drop de fitxers i carpetes,
  `webkitGetAsEntry`): la carpeta `<sèrie>.machinecontext`, un projecte `.pgmx` (zip o carpeta desplegada amb l'XML,
  `def.atrx`, `*.cfgx`) o fitxers solts. Tipus pel **contingut** (`detectMaestroFile`), agrupat per carpeta
  (`planMaestroImport`); primer el context (crea o actualitza per sèrie) i després els .pgmx: a la màquina de la seva
  carpeta (sèrie del `.cfgx`; sense `.tlgx`, eines de l'`.atrx` sense mides, `machineFromAtrx`), a la triada, a la per
  defecte o a una nova (`addPgmxTools`). Un sol avís amb el resum. Tests amb els fitxers reals (`maestroImport.test.ts`).
- Lectura (`core/machine/maestro.ts`, lector XML propi `xml.ts`, .cfgx = zip amb `DecompressionStream`, `core/file/zip.ts`):
  eines (`MachineTool`: codi, nom, broca/fresa/disc/agregat/palpador, vertical/horitzontal, Ø, fondària útil, gruix del disc,
  sentit, capçal i mandrins, `mounted`, `auto`), versió, camp de treball, àrees, capçalera. Model a `core/model/machine.ts`.
- Desat a `Settings.machines` (**preferències v10**, additiu); **una per defecte** (`defaultMachine`, ★): la de l'export .xcs
  i la que dona la separació i el marge del nesting. Detall: nom, sèrie, configuració, Maestro, camp, per defecte, «Projecte
  de Maestro (.pgmx)», «Programes .xcs» (àrea de treball, repeticions, taula, cicle continu, passants de més, broques,
  ranures disc/fresa), «Programes per tauler» (separació, marge, martiri, peces petites al final/principi i la capçalera del
  nesting) i **taula d'eines per tipus** (codi · nom · Ø · fondària · posició; tocar-ne una l'edita; «Afegir eina» per a les
  que el `.tlgx` no porta, amb el codi de Maestro; una «Eina nova» `NOVA1` no es tria fins que té codi). Tornar a importar
  la mateixa sèrie (`mergeReimport`) conserva, eina per eina, els camps tocats a mà (`MachineTool.edited`), les eines
  afegides i les opcions. Una eina invàlida a les preferències només treu aquella eina (`repairMachine`; si encara falla, es
  torna a provar sense les regles d'abans de la v11 i/o sense les opcions de nesting, que tornen a les inicials amb un avís).
- **Projecte .pgmx** («Importar .pgmx» al detall = el mateix importador amb la màquina triada; `core/machine/pgmx.ts`): el
  paràmetre `tool` de l'MSL és el **nom** de l'eina i el Maestro del taller (2.0.5) les ha rebatejades (ID 2149647431: `E128`
  al .tlgx, «12mm diamant nesting» al projecte `docs/maestro/samples/Proyecto1.pgmx.xml`). Per ID (`MachineTool.id` =
  `Key/ID` del .tlgx) posa `mslName` (`toolMslName`) i el nom; el codi no canvia. També la capçalera (`MachiningParameters`):
  `SetMachiningParameters(fields, repeticions, taula, mecàniques, cicle continu)`, per defecte la del projecte
  (`DEFAULT_HEADER`: AD, 1, 10, 16973824, false). Els **programes per tauler** fan servir la capçalera del programa de nesting
  real del taller (`Machine.nesting.program`, `nestProgram`, `DEFAULT_NEST_PROGRAM`: MechanicalOptions 16777216,
  `SetWorkpieceSetupPosition(0, -20, 0, 0)`, macro `Pload`, campana 1, `SetWorkPieceFallPrevention`;
  `SetPreserveWorkingSequence` = el `preserveWorkingSequence` de la capçalera, `true` sense valor). A la UI, «Opcions
  mecàniques» només surt a «Programes per tauler» (la de la capçalera general només afecta el per peça).
- **Regles de mecanitzat** (del germà; **del taller, no de cada màquina**: `Settings.machiningRules`, per decisió de l'usuari
  «en un taller les regles són les mateixes per a les dues CNC»). Pàgina pròpia Preferències › **Regles de mecanitzat**
  (`rules`, `LuRoute`, just després de Màquines CNC), sense triar màquina; `settings/MachineRules.tsx`, `RulePicker`;
  `core/machine/rules.ts`; detall a `docs/maestro-xcs.md`. Inicials (`defaultMachineRules`): ranures «8mm diamant» a 6 mm per
  passada (`CreateBidirectionalMillingStrategy`), caixeres «12mm diamant nesting» (`CreateContourPocket`), perfilar per gruix
  (8–22 → «12mm diamant nesting», 23–41 → «14mm diamant nesting»), rampa als perfilats del nesting (`SetApproachStrategy(true,
  false, k)`, des del mig del costat recte més llarg), peces petites (menys de 0,8 m²; `maxSide` 0 = no compta) en 3 passades
  (Z/XY 1/1, 0,5/0 i la final al martiri o als passants, `overMaterial`).
  - Eines **pel nom a la màquina que exporta** (`findRuleTool`, només `usableTool`, les mateixes que ofereix el selector, amb
    les freses de totes les màquines); si falta, no es pot fer servir o no arriba, tria de sempre i un sol avís per regla i
    eina. A la pàgina, una línia per màquina: «✓ té totes les eines» o «falta «X»» (`missingRuleTools`).
  - L'export llegeix les regles a `Machine.rules`, on les posa **`machineWithRules(settings)`** (la màquina per defecte amb les
    del taller, `withWorkshopRules`; el mateix objecte per a les mateixes preferències): `useNesting`, Nesting i Exportar
    l'han de fer servir en lloc de `defaultMachine(settings.machines)`, si no la separació i les eines serien les inicials.
  - **Preferències v11** (additiu): sense `machiningRules`, les de la màquina per defecte (o la primera que en tingui; si cap,
    les inicials, `rulesFromMachines`) i les `rules` de les màquines es treuen (l'esquema les llegeix per compatibilitat; un
    fitxer d'abans importat també les passa); idempotent. Els valors provisionals d'abans (Ø + 1, 300 mm / 0,1 m²) es migren
    un sol cop (`Machine.rulesVersion`, `migrateMachine`) i es desa, així una tria posterior de l'usuari es queda.
    «Restaurar valors inicials» torna a `defaultMachineRules()`.

## Pàgines del moble
Pestanyes del moble obert (`PROJECT_NAV`): **Editor · Peces · Nesting · Exportar**, cadascuna amb un sol propòsit.
- **Peces**: taula (peces iguals agrupades) + **plànol de la peça seleccionada** al costat; sense botó d'exportar.
  Agrupació (`toCutList`, `groupKey`): rol, mides, gruix, material, veta, cantells i inglets normalitzats (`canonicalSides`:
  mirall esquerra/dreta, dalt/baix o girada 180° cauen a la mateixa fila), 2a cara, forats de cantell, encolar, push i, de
  qualsevol rol, contorn i talls (peces lliures: també forats i ranures). CSV de peces: cometes als números si la coma
  decimal és el separador i als textos amb `\r`. Al mòbil, una **targeta per peça** i la triada porta el plànol a dins.
  «Elements sense nesting» per a `build.extras`.
- **Nesting**: mides del tauler i, amb màquina, la línia «Separació X mm i marge Y mm de la màquina … (Preferències ›
  Màquines CNC)»; sense màquina, «Separació (fresa)» i «Marge tauler». Les peces amb `outline` es dibuixen amb el contorn
  real (el rectangle que ocupen, discontinu); el nesting reserva el rectangle. Marca de veta al tauler (`BoardDrawing`):
  horitzontal si `(grain === "x") === (angle === 0)`, vertical si no, cap sense veta. Forats de cara plens a la cara A, buits
  a la B.

## Editor
- **Tres columnes, com Figma / Fusion 360** (`features/editor/EditorScreen.tsx` sobre `Workspace`): Estructura (arbre) ·
  Visor · Propietats. Arbre de 280 px i propietats de 340 px per defecte, amb vora arrossegable (`ResizeHandle`, 48–900 px,
  nansa al mig; amplades recordades per editor); si el panell és més estret que el contingut, desplaçament horitzontal (com
  IntelliJ). Visor amb mínim de 320 px; si fa menys de 640 px, pestanyes només amb icona, botons en columna i la barra de
  vistes s'amaga (les vistes, a «Opcions de vista»). Cada panell lateral es plega amb els botons de les cantonades del visor
  (`LuPanelLeftClose/Open` · `LuPanelRightClose/Open`). L'app ocupa just la finestra; cada panell té la seva barra de
  desplaçament fina amb lloc reservat (`scrollbarGutter: stable`). **Mòbil**: visor a dalt i pestanyes `Estructura` ·
  `Propietats` (triar a l'arbre porta a Propietats); «Ampliar el visor».
- **Una sola selecció** (`Selection`), sincronitzada entre arbre, 3D i alçat. Controls nous: decideix a quin nivell pertanyen
  i posa'ls a l'inspector d'aquell nivell.
- **Estructura** (`composition/StructureTree.tsx`): moble › mòduls (agrupats per fila) › compartiments, peces lliures,
  objectes de referència i models 3D. **Un + a cada grup** (Mòduls · Peces lliures · Objectes de referència · Models 3D; per
  decisió de l'usuari, així es veuen els tipus): demana el nom (`NameDialog`, «Mòdul 3», «Peça 2», «Objecte 1», seleccionat;
  `addElements.ts`) i crea l'element sense més opcions: caixa bàsica, peça de cara, caixa de 600 × 600 × 100. Res de mòduls
  especials, passacables ni plantilles al +. El + de «Models 3D» obre directament el selector de fitxers (vegeu Visor).
  Menú ⋯ per afegir/duplicar/moure/eliminar (manté «Moure amunt/avall», «Moure a l'esquerra/dreta»). **Arrossegar per
  ordenar** (`reorderModule`, `reorderRef`): mòduls dins de la seva fila i objectes; una línia marca on cau. Arrossegar una
  peça lliure sobre la fila d'un grup la hi posa; al costat d'una peça n'agafa el grup; la zona «Treure del grup» surt
  mentre s'arrossega una d'un grup.
- **Propietats** del que hi ha seleccionat i **només d'això**, en seccions plegables independents (`PanelSection`, vegeu UI):
  - Moble: Resum (i avisos de fusteria), Tipus, Materials de tot el moble (aplica a tots els mòduls), Taulell i sòcol,
    Encaixos, Acabats de l'escena (`Composition.scene`: `floor`, `wall` per a Presentació i miniatura; buit = «Com a
    Preferències»; `CabinetViewer sceneFinish`, `renderThumb(…, finish)`).
  - Mòdul: Mides · Estructura · Materials · Fusteria (avançat). Posició. Materials visibles: cos, **fronts**
    (`frontMaterial`, buit = el del cos) i fons.
  - Compartiment (`ZonePanel`): accions com a icones a la capçalera (Pare · Duplicar · Eliminar) i Front · Prestatges ·
    Mida · Dividir. Objecte (`RefInspector`): General · Mides · Posició (accions Desar a preferències · Eliminar). Peça lliure
    (`PartInspector`), model (`ModelInspector`). A la pestanya Foto, el calibratge.
  - **Nom a la capçalera de l'inspector**: el del mòdul i de l'objecte es canvia clicant-lo (`Editable`, com Figma); el del
    moble, a la barra de dalt.
  - **Opcions que no toquen s'amaguen** (sense fons no surten material, gruix ni ranura del fons; Cantonades només si hi ha
    res a unir) i hi val la regla **res amagat compta**.
  - Res de botons «Veure a l'alçat»: les pestanyes 3D · Alçat · Foto ja són a dalt del visor.
- **Centre — Visor** amb pestanyes `3D` · `Alçat` · `Foto`. **Alçat** (`ElevationEditor`): el mòdul en edició i, translúcids,
  els veïns (costats, a sobre i a sota); clicar un veí hi passa (`neighbors`).
- **Barra del visor**: fora només «Opcions de vista» (i amagar propietats). Opcions de vista (`components/ViewOptions`:
  `ViewOptions` + `ViewTile`, popover a l'ordinador, calaix de baix al mòbil; es tanca en obrir el Render): a dalt els tres
  modes i les accions ràpides només amb icona i el nom al tooltip (`tile`/`viewTiles` a `EditorScreen`): Enquadrar, Forats,
  Explosió, Ferratges, Render i Veure a casa (AR); a sota, la vista, l'obertura i la imatge. El visor de tots els documents
  (moble, objecte i ambient) amb el mateix aire: 16 a dalt al mòbil i 16 al voltant a l'ordinador.
- **Mode del visor** (`VIEW_MODES`): **Per peça** (`LuShapes`: colors per tipus de peça, paleta `ROLE_GROUPS` a
  `viewer/roleColorMap.ts` i llegenda a `viewer/roleColors.tsx`), **Textura** (`LuTrees`: materials i veta) i
  **Presentació** (`LuSparkles`: ombres, sense perfils, graella ni «+»; terra i paret amb llum d'estudi,
  `viewer/PresentationRoom.tsx`, escena a `viewer/presentationScene.ts`). Per dins: la qualitat (`viewer/renderQuality.ts`:
  fast / presentation, també a Preferències › Visor 3D) més `mobles:viewer-role-colors-fast` (els objectes en tenen una de
  pròpia, `mobles:viewer-role-colors-object`, i s'obren amb la textura).
- **Selecció al 3D**: **mòdul seleccionat sòlid amb contorn taronja** (com Figma o SketchUp; per decisió de l'usuari:
  translúcid semblava que canviés de color); només es fa **translúcid amb un compartiment triat**. El primer clic tria el
  mòdul i el segon entra al compartiment tocat (`selectFrom3D`); tornar a clicar el seleccionat puja al pare; clicar la
  carcassa torna al mòdul. **Ratolí a sobre** (`BoxFrame`): contorn prim del color de selecció per sobre de tot (objectes i
  mòduls); seleccionat, gruixut.
- **Moure** (per decisió de l'usuari **el cos no s'arrossega**, així sempre se sap cap on es mourà):
  - **Gizmo** (`viewer/MoveGizmo`): tres fletxes (vermella X de costat, verda Y amunt, blava Z endavant), de mida constant i
    per sobre de tot; cada una arrossega només en la seva direcció (pla que conté l'eix i mira a la càmera). S'amaguen les
    fixades (al terra: Y; a la paret: Z) i les que miren a la càmera en vistes ortogràfiques. `frontRaycast`: les fletxes es
    poden agafar encara que l'objecte sigui dins d'un altre, i el seu clic no tria el que hi ha davant. Per a objectes de
    referència (`RefGhost`), peces lliures, grups i models 3D. Imant de 15 mm a les vores dels mòduls, altres objectes, terra
    i paret (Alt: sense); etiqueta amb la posició mentre s'arrossega; es desa en deixar-lo anar (un pas de desfer). Grups de
    peces: caixa del grup amb el gizmo; el primer clic selecciona el grup i el segon la peça.
  - **Mòduls**: nansa ↔ (`MoveHandle`) uns píxels per sobre de l'aresta de dalt (en un mòdul alt que no hi cap, baixa fins a
    sota de la barra del visor); els + a l'aresta de davant de cada costat apartats cap a fora; arrossegar-la el mou a la
    seva fila (`moveModuleBy`: els de la dreta es queden on eren) i, si és penjat, amunt i avall; al terra, de costat i
    endavant/enrere (`dz`); amb Maj, tot el moble (`moveAllBy`). Imant a les vores dels mòduls i dels objectes. Nanses, + i gizmo són malles 3D de mida constant
    (`usePixelScale`), no `Html` de drei (fallaven en muntar-se i desmuntar-se amb React 19), amb `userData.editorOnly` (la
    imatge per al Render no els porta). La nansa surt també a Presentació (els + no).
  - **Posició dels objectes**: camps «↔ De costat X», «↕ Alçada Y», «⤢ Fons Z» (`AxisLabel`, colors com les fletxes;
    `NumberField.label` accepta un ReactNode). «Al terra» (y = 0) i «A la paret» (z = 0) (`RefObject.onFloor`, `onWall`,
    `anchorRef`, aplicat a l'inspector, a l'arrossegament i a les fletxes; el camp fixat queda desactivat).
  - Teclat: fletxes 1 mm (Maj 10), Re Pàg / Av Pàg per a Z.
- **Objectes de referència al 3D**: amb material (`RefObject.material`, a General; no als que tallen) es veuen sòlids
  (`surfaceMaterial`, amb ombres) i surten a la Presentació i al render; sense («Cap (fantasma)»), fantasma translúcid que el
  render no pinta. Els que tallen només es veuen seleccionats (violeta, a través del moble; també les peces que tallen, id
  `part:<id>`). Els forats del mòdul seleccionat es marquen en taronja a través de les portes (`CableMarks`).
- **Teclat**: Ctrl/⌘ C · X · V · D i Supr per al mòdul, l'objecte, el model o el compartiment (`core/model/editOps.ts`). El
  porta-retalls és a localStorage (`mobles:clipboard`, entre mobles), validat amb zod (`parseClip`); una peça enganxada a un
  mòdul d'un altre moble queda solta, una illa es duplica al costat i no s'enganxen mòduls a un flat-pack o objecte. Ctrl/⌘ D
  en un compartiment fa `duplicateZone`. **Eliminar un mòdul** = `removeModule`: peces enganxades soltes al mateix lloc,
  taulell i sòcol al mòdul més proper del tram (o fora) i forats del taulell seus fora.
- **Càmera**: s'enquadra en obrir, canviar de vista, redimensionar o amb «Enquadrar» (`LuVideo`); editar no la mou. El botó
  surt **marcat** mentre la càmera és a l'enquadrament (`onFramedChange`). **Es recorda per moble** (`Composition.camera`,
  `CameraPose` a `core/model/camera.ts`: posició, punt mirat i fov; una de no vàlida es descarta): 1 s després d'orbitar o
  d'«Enquadrar» (només a la vista 3D) es desa amb `saveProjectCamera`, **sense tocar `updatedAt` ni `edited`** i fora del
  desfer; `updateProjectComposition` conserva la desada. En obrir-lo `CabinetViewer initialCamera` hi torna; redimensionar no
  la treu fins que s'orbita, s'enquadra o es canvia de vista. Va al `.moble`.
- **Editor de perfils** (`composition/ProfileEditor.tsx`, com el mode vector de Figma): **Moure** (nodes i manegadors en
  rombe; Alt trenca el reflex; doble clic node ↔ corba), **Ploma** (clic = cantonada, clic i arrossegar = manegadors
  simètrics, clicar el primer node o Retorn tanca, Esc descarta), **Corbar** (arrossegar el punt del mig d'un costat,
  `bendEdge`; clic a un node commuta corba/cantonada) i **Esborrar**; clic al punt del mig afegeix un node sense canviar la
  forma (`splitEdge`, de Casteljau); radi de cantonada; imant a la quadrícula.
- L'Editor espera `useSettings().loading` abans de llegir la composició (vegeu Materials, àlies) i només desa composicions
  que passen `CompositionSchema`.

## Visor 3D i render
- **Llum com model-viewer** (`StudioEnvironment` a `SceneHelpers`): entorn d'estudi procedural (`RoomEnvironment` + PMREM,
  sense connexió) com a `scene.environment` i to `Neutral`; hemisfèrica baixa. **`three-gpu-pathtracer` descartat**: (WebGL)
  necessita més de 16 unitats de textura i als Mac/iPhone (límit 16) sortien malament.
- **Només pinten quan cal** (`frameloop="demand"` a `CabinetViewer`, `Ambient3D` i `PhotoRender`): controls, animacions
  (obrir, explosionar, enquadrar: demanen `invalidate` fins que arriben; el primer pas després d'estar quiets compta 1/60 s,
  `animStep`), canvis de React i fotos que arriben (`TextureRefresh`). L'enquadrament no passa de la distància màxima dels
  controls. Cada peça (`PanelMesh`, `memo`) només es refà si canvia la seva signatura visual (`panelVisualKey`) o la
  col·locació; els callbacks reben la peça. Forats: una malla instanciada per peça. Ombra de contacte pròpia
  (`viewer/ContactShadow.tsx`: la de drei deixava render targets a la GPU; l'escala va a passos de ¼ d'octava). Alliberar un
  material allibera les seves textures (`disposeMaterial`; `userData.shared` no); `disposeTree` a `textures.ts`.
- **Memòria a l'iPhone** (`components/viewer/deviceLimits.ts`, `LOW_MEMORY` = pantalla tàctil; si se supera, iOS tanca i
  recarrega la pàgina): Presentació fa l'ombra a 2048 i fins a 2×, el parquet procedural de 1024 (`floorTextures.ts`, només
  si es fa servir), les memòries de textures (`remember`) en guarden 12 i alliberen les que en surten **sense clons vius**
  (`tileClone`), i el render fa com a molt 1600 px («Alta» i «Màxima» desactivades amb l'explicació) i, per CPU, com a molt
  2 processos (`cpuThreads`, menys fils com més gran és la imatge).
- **Ferratges visuals** (`viewer/Hardware.tsx`, «Ferratges» a Opcions de vista, `mobles:viewer-hardware`): frontisses,
  tirador de barra, potes regulables. Només es dibuixen.
- **Textura desplaçada per peça** (`viewer/textureOffset.ts`, test): cada cara de cada peça (`Panel.id` + cara) té un
  desplaçament determinista (hash FNV-1a) i, a l'atzar, un gir de 180°, a la matriu UV (`faceTexture(…, off)`), que llegeixen
  el visor, el render (`sceneData`, també la base tangent) i el GLB/USDZ. Canviar el hash canvia la veta de tots els mobles.
- **Models 3D** (`viewer/models3d.ts`): `loadModel` un cop, `preloadModels` (→ `true` si hi són tots), `onModelsLoaded`; una
  càrrega fallida no es torna a provar fins passat 60 s. `modelInstance` fa la còpia col·locada (geometria i materials
  compartits, `userData.sharedModel`); `releaseModelGpu` els treu de la GPU en alliberar el renderitzador de miniatures i en
  tancar els visors. Les miniatures amb un model no carregat no es fan. Surten als ambients, miniatures, Presentació,
  render, AR i GLB/USDZ.
  - De l'app: falgueres de Poly Haven (CC0) a `public/models`, textura 1K WebP amb el retall a l'alfa (`alphaTest`, només als
    materials amb alfa). **Arbres** (Xicranda, Avet, de debò 19 m) reduïts amb `scripts/polyhaven-tree-to-glb.py` (Blender com
    a mòdul, `pip install bpy`) i comprimits amb meshopt (`npx gltfpack -c`; `GLTFLoader.setMeshoptDecoder`). Es
    precachegen. El render per CPU també retalla les fulles (`RenderMaterial.alphaCut`, `alphaAt`).
  - **De l'usuari** (sense llista de models al +, per decisió de l'usuari: les plantes de l'app són al catàleg d'Objectes;
    a l'inspector, «Model» diu el nom i «Canviar» puja un altre `.glb`; `composition/ModelUpload.tsx`): taula Dexie **v5**
    `models` (`UserModel`: id `user-…`, nom, `blob`, mida en mm); `db/userModels.ts` (`addUserModel` valida amb `GLTFLoader` +
    meshopt i mesura; només `.glb` amb les textures a dins; avís si fa més de 15 MB). **S'optimitzen en pujar-los**
    (`viewer/optimizeGlb.ts`, a demanda; parts pures i test a `optimizeGlbPlan.ts`): pressupost de **100.000 triangles**; les
    malles opaques es delmen (`MeshoptSimplifier` després de `mergeVertices`, primer amb `LockBorder`, ≥ 25 % del pressupost)
    i les d'alfa no (se'n treuen grups solts i els que queden ≤ 1,5× més grans); textures de més de **1024 px** reduïdes i
    WebP si el navegador en sap codificar (si no, JPEG/PNG). Si ja compleix, no millora o falla, es desa l'original. Avís amb
    `formatReport`. `useModelAssets` = `MODEL_ASSETS` + els de l'usuari; `forgetModel` en pujar-ne o esborrar-ne;
    `removeUserModel` sense UI. El `.moble` porta els que fa servir (base64) i en obrir-lo es tornen a crear amb el mateix id.
- **Render** (`viewer/render/`, `RenderDialog`, «Render» a Opcions de vista, també als ambients; com Cinema 4D): path
  tracing progressiu amb **dos motors que donen la mateixa imatge** (`ChoiceChips` GPU · CPU, per defecte GPU si n'hi ha,
  `mobles:render-engine`): **GPU** (WebGPU, `gpuTracer.ts` + `gpuTracer.wgsl.ts`) i **CPU** (`cpuEngine.ts`: un `pathWorker`
  per nucli). Sense WebGPU, GPU desactivada amb el motiu; si la GPU falla, CPU amb un avís.
  - **Comença aturat**: obrir el diàleg mostra la imatge del visor (`SceneGetter.snapshot`) i «Començar»; després, les
    opcions de qualitat, motor, escena i llum tornen a començar; aturar/continuar, límit de passades, passades per segon.
  - `extractScene` passa l'escena a triangles + materials + textures; tots dos motors fan servir el **mateix BVH** (`bvh.ts`,
    SAH per calaixos, 8 paraules per node), llums (`lights.ts`) i constants (`shading.ts`). Contracte (`engine.ts`): sumes RGBA
    + AOV (albedo i normal) i nombre de mostres; el diàleg divideix, filtra el soroll, fa el to i desa el PNG.
  - **GPU sense textures de GPU**: tot en buffers d'emmagatzematge (`gpuScene.ts`; textures RGBA8 en un buffer de u32 amb
    bilineal fet a mà, reduïdes a la meitat si no hi caben): així no hi ha el límit de 16 unitats de textura. Respecta
    `maxStorageBufferBindingSize`/`maxBufferSize` (si no hi cap, CPU). Tandes de files de ~10–30 ms (més mostres per passada
    si va de pressa) perquè la pàgina no s'encalli; llegeix el resultat a cada passada sencera (cada cop menys sovint si costa).
  - **Materials**: difús + GGX amb Fresnel, metalls, vidre fi (no fa ombra), retall per l'alfa. **Arestes arrodonides** (2 mm,
    `BEVEL_RADIUS`, `userData.bevel`, `bevelNormal`). **Veta amb relleu** (`userData.grain`). **Normals llises**
    (`RenderScene.normals`, `smoothNormal`; GPU: `encodeNormal`); la geomètrica es queda per desplaçar rajos; cantells corbs
    llisos (`creaseNormals` a `cutoutGeometry`, < 30°). **Mapes PBR** (`normalMap`/`roughMap`, `tangentFrame`/`perturbNormal`).
    **Llums que fan llum** (`MaterialPref.glow` → `RenderMaterial.emission`, mostra directa dels emissors, `emitters.ts`;
    «Llums enceses» + intensitat). **Translucidesa** (`MaterialPref.translucent`).
  - **Llum**: sol amb mida (ombres suaus; el reflex s'eixampla amb la mida) i halo ample al cel de dia; cel amb mostra directa
    a cada rebot i MIS: cel llis, **HDRI per importància** (`envSampling.ts`) i, als
    interiors, per les finestres (portals). **Sense ateses**: la indirecta té un màxim relatiu a la llum de l'escena
    (`sceneKey`, la mateixa als dos motors; ×20 indirecta, ×400 directa) i després d'un rebot difús els reflexos són més rugosos
    (`PATH_ROUGHNESS`).
  - **Interiors com les fotos de revista** (ambients): cel de dia (`daySky`, `scene.userData.daylight`) i sol tres vegades més
    fort; les habitacions tancades porten **sostre** (`userData.renderOnly = "ceiling"`, es veu quan la càmera és a dins, al visor i al render;
    **només si hi ha alguna finestra**: sense, l'habitació sortia negra) i els vidres són **portals** (`userData.portal`). Exposició automàtica (mitjana geomètrica de les superfícies al gris del
    18 %, fins a ×40; per defecte als ambients) i temperatura càlida per defecte.
  - **Opcions** en seccions plegables (`PanelSection`: Qualitat, Càmera, Escena, Llum, Imatge, amb el resum a la insígnia):
    motor, resolució, rebots, aturar a N passades; format (visor, 3:2, 4:5, 16:9, 1:1) i desenfocament (lent fina, enfoca el centre); escena (habitació de
    Presentació / només terra / cap, `userData.room`); sol, intensitat, ombres, **Cel** (`render/skies.ts`: «Dia» procedural,
    «Núvols» i «Interior» HDRI de Poly Haven reduïts a 1K a `public/hdr/`, precachejats, o un `.hdr` propi, `hdr.ts`, que es pot
    girar; el de defecte a Preferències › Visor 3D › «Cel del render»: mobles «Interior», ambients «Núvols»); **Imatge, a
    l'instant**: exposició EV, contrast, saturació, «Corba de color» AgX (per defecte) · ACES (`tonemap.ts`), vinyeta (0,2),
    resplendor (**apagada per defecte**, per decisió de l'usuari: l'aura dels leds es veia postissa), fons estudi / blanc /
    transparent. La finestra ocupa **tota la pantalla** a totes les mides (zona segura als quatre costats); al mòbil, la
    imatge a dalt i les opcions a sota.
  - **Reduir el soroll**: Open Image Denoise (`oidn.ts`, `oidn-web`, WebGPU) si hi ha WebGPU i
    `public/oidn/rt_hdr_alb_nrm.tza` és un fitxer de pesos de debò (> 10 KB i no un punter de Git LFS: `isWeightsFile`); si
    no, o si falla, À-Trous (`denoise.ts`, guiat per l'albedo i la normal, en un worker, cada cop menys sovint). Els pesos (1,8 MB) van amb l'app però no es precachegen. Al costat
    de l'opció surt quin filtre es fa servir («Intel OIDN» / «bàsic»).
  - Tests: `render/render.test.ts` (BVH contra força bruta, CDF de l'HDRI, bevel, empaquetat, normals llises).

## Materials
- **Categories** (`MaterialPref.category`, `materialCategory`, `withCategory`, `MATERIAL_CATEGORIES`): **Taulers** · **Fons** ·
  **Simulació** (als antics es dedueix de `forBacks` / `cnc`; l'antiga «Metall, pedra i vidre», `hard`, es llegeix com a
  Simulació: per decisió de l'usuari és el mateix, no es tallen a la CNC). A Preferències es llisten per
  categoria (camp Categoria en lloc dels interruptors «Per a fons» i «Es talla a la CNC») i el `MaterialSelect` agrupa per
  categoria. Els que no són de CNC (ferro, inox, pedra, vidre) van arribar a la v2 de les preferències. Els de **simulació** (`SIM_MATERIALS`: v3 teixits, vellut, cuir, parquet, rajoles, microciment, pintures,
  electrodomèstics; v4 els de les escenes de revista; v5 els llums; `SIM_MATERIALS_SINCE`: la migració només afegeix els d'una
  versió posterior a la desada, així els esborrats no tornen) només es veuen: `cnc: false`, no surten als selectors del cos
  ni del taulell. Els que no són de CNC pinten els cantells amb el mateix material. Acabats `metal`, `glass`, `fabric`
  (trama) i `tiles` (rajola amb junta), procedurals (`patternTexture`).
- **Textures procedurals editables** (`settings/TextureEditor.tsx`, «Editar la textura»): mostra gran a escala real amb zoom;
  s'aplica en acceptar. A l'ordinador, com a molt el 90 % de l'alçada i el cos es desplaça (el títol i els botons a la
  vista); el diàleg es queda muntat tancat (muntar-lo ja obert el tancava sol: el focus comptava com «de fora»). **Fusta** (`Finish.wood.gen`, `WoodGenSchema`, `WOOD_PRESETS` + `WOOD_EXTRA_PRESETS`), **Teixit**,
  **Rajola** (junta, variació, quadrícula o trencajunts), **Pedra** (`stone`: marbre, granit, travertí, formigó; soroll
  periòdic), **Metall** (polit, raspallat, martellejat), **Vidre**, **Color llis i lacat**. Tots menys la foto (`isEditable`).
  Tot a `textures.ts` (canvas; `woodTexture(species, gen)`, `patternTexture(kind, color, grout, opts)`), memòria de 48.
- **Textures reals** (`Finish.kind = "image"`): foto reduïda a 1024 px JPEG i amplada real (mm); `photoTexture` en mirall o,
  amb «Sense costures (seamless)» (`Finish.seamless`), repetició normal. `Finish.aspect` fa que l'alçada real sigui
  `tileMm × aspect` (es mesura en triar-la o, a les antigues, en obrir la targeta; abans s'estirava). `faceTexture` creua
  les repeticions quan la veta va en v (three escala després de girar). Botó visible «Posar una foto de textura» (a més de
  l'Acabat «Foto (textura)»), amb miniatura, «Canviar la foto» i «Treure-la».
- **Mapes PBR de l'usuari** (com els jocs de Poly Haven; `settings/TextureMapRows.tsx`, `settings/textureImport.ts`, pur
  a `core/photo/pbrMaps.ts` amb test): amb l'acabat de foto, sota «Foto» (miniatura de la foto de color) hi ha **Relleu**
  («Mapa de relleu (normal)») i **Brillantor** («Mapa de brillantor (rugositat)»), cadascun amb miniatura, «Posar»/«Canviar»
  i «Treure». Es redueixen a 1024 px com el color; el normal i la rugositat són **dades**: es llegeixen sense gestió de
  color (`createImageBitmap` amb `colorSpaceConversion: "none"`), el normal en JPEG 0,95 (alfa opac) i la rugositat en
  grisos (JPEG 0,9; d'un ARM/ORM, el canal verd). El normal es desa sempre en **OpenGL**: «Invertir el verd (DirectX)»
  (`Finish.normalDx`, només recorda l'interruptor) inverteix el verd en carregar-lo i, si ja n'hi ha un, el torna a
  invertir. La foto de color en dona el color mitjà (`Finish.color`, STEP). **«Joc PBR»** (a tots els acabats):
  «Carregar joc de textures…» (diversos fitxers o un `.zip`, `unzip`), «Carpeta…» (`webkitdirectory`) o deixar-los anar a
  sobre (`pickedFromDrop`). Es reconeixen pel nom (`classifyTextureFile`/`planTextureSet`: mana l'última paraula que és un
  mapa —el nom del material va al davant—; diff/diffuse/albedo/basecolor/color/col → color; nor/normal/nrm, `_gl`/`_dx` →
  relleu i invertir; rough/roughness/rgh i ARM/ORM → brillantor; disp, ao, metal… no es fan servir; el normal OpenGL i la
  rugositat pròpia guanyen). Amb foto de color substitueix foto i mapes (i posa «Sense costures»); sense, només els mapes
  d'una foto que ja hi era. L'amplada real és la de sempre. Visor, miniatures, render (CPU/GPU), GLB/USDZ i
  exportar/importar les preferències els llegeixen com els de l'app (tot passa per `photoTexture`, memòria per `src`); a
  Dexie i al JSON de preferències no hi ha límit de mida (un material amb els tres mapes fa ~0,5–1 MB).
- **Canviar l'Acabat no perd res** (`MaterialPref.previousFinishes`, `switchFinish`/`restoredFinish` a `materialOps.ts`): l'acabat d'abans es guarda per tipus i, en tornar-hi, es recupera (la foto amb els mapes de relleu i brillantor). Un material de foto de l'app que ja l'havia perdut la recupera del material inicial (mateix id o nom). El que torna a ser l'actual surt de `previousFinishes` (si no, una foto quedaria desada dues vegades).
- **Materials de foto amb relleu** (v6): 22 jocs de Poly Haven (CC0, 1K) a `public/textures/<id>/{diff,nor,rough}.jpg`
  (normal OpenGL, rugositat en grisos), manifest a `core/model/textureSets.ts` (`TEXTURE_SETS`: nom, mida real d'una repetició,
  direcció de la veta a la foto, ús). `PHOTO_MATERIALS`: xapes a **Taulers** (16/19/30: «Roure (foto)», «Noguera (foto)»,
  «Noguera fumada (foto)», «Fusta fosca (foto)»), pedres i la resta (parquets, estucs, formigons,
  microciment, terratzo, murs de pedra, jute, llana espiga, vaquer) a **Simulació**; la migració v6 només afegeix els que
  falten. També a la biblioteca («Fotos · …»). L'acabat `image` porta `normalMap`, `roughMap`, `grain`,
  `roughness` (multiplicador) i `color` (STEP); `grain` `y` = veta vertical a la foto (es gira un quart). Visor:
  `MeshStandardMaterial` map + normalMap + roughnessMap amb la mateixa repetició i gir, sRGB només el color. Els `.jpg` no es
  precachegen (~14 MB, vegeu PWA). Les miniatures esperen les fotos (`photoTexturesIdle`).
- **Els materials de sempre amb la foto** (v7, per decisió de l'usuari: «a tot arreu»; `core/model/photoUpgrade.ts`,
  `PHOTO_UPGRADES`, nom de sempre → joc, només on la foto és fidel, mirat a `diff.jpg`): Roure massís / xapat, Melamina roure,
  Revestiment de roure → `oak_veneer_01`; Noguera xapada → `walnut_veneer_02`; Parquet de roure → `wood_floor`; Microciment
  gris → `gravel_concrete_03`; Formigó → `concrete_layers_02`; Pedra calcària → `marble_01`; Pedra de paret →
  `medieval_blocks_03`; Jute → `hessian_230`; Teixit gris → `poly_wool_herringbone`. **Els noms no canvien** (CSV del taller,
  composicions): només l'acabat (gruixos, cantell, veta, categoria i id es queden; una foto pròpia no es toca). Lacats, colors,
  metalls, vidres i el que no té foto fidel (freixe, wengué, estucs clars, teixits de color…) queden procedurals (l'acabat
  `image` no es pot tenyir). `upgradeToPhoto` (migració v7 i valors inicials, idempotent): els «(foto)» el joc dels quals ja
  fa servir un de sempre desapareixen (els seus gruixos passen al de sempre); la resta perden el «(foto)» («Fusta fosca»,
  «Terratzo»…; si el nom ja és d'un altre material, es queda amb «(foto)»). Només passa a foto un material amb l'acabat per
  defecte d'abans (`OLD_FINISHES`, igualtat estructural): un de retocat es queda, i el «(foto)» al costat. **Àlies** (`resolveMaterialAlias`: «Roure (foto)» → «Roure massís / xapat», «Fusta fosca (foto)» → «Fusta fosca»;
  `aliasMaterialRefs`: claus `material`, `material2`, `frame` de les obertures, `…Material`, `scene.floor/wall`; a
  `normalizeComposition`, `parseAmbient`, `readPresentationScene` i preferències): «X (foto)» → «X» només si no hi ha cap «X
  (foto)» i sí «X» (`setKnownMaterialNames`, de `settingsStore`). **Sense noms coneguts (preferències encara no llegides) no es reescriu res** (abans un moble
  obert massa d'hora perdia el seu «Roure (foto)» en desar-lo): per això l'Editor i l'editor d'Ambients esperen `useSettings().loading`. La biblioteca fa el mateix (`LIBRARY_PHOTO_UPGRADES`).
  Cantells (`resolveEdgeFinish`): un cantell lacat, «sense cantell» o buit és el mateix tauler (un MDF lacat antracita no
  fa el cantell blanc); si no, material de la mateixa foto, després el mateix material si el cantell en diu la primera
  paraula, després un altre material que hi surti **sencer** (no per la primera paraula) i paraules clau.
- **v8**: mida real de les xapes de foto (mirada a `diff.jpg`: fibres de roure a 2–3 mm, catedrals de noguera de ~250–300 mm;
  roure 1100 → 600, noguera 1200 → 900, noguera fumada 1200 → 800; `rescalePhotoTiles`, només si encara
  tenen la d'abans, `PREVIOUS_TILE_MM`). **v9**: `restorePhotoThicknesses` (16 · 19 · 30) i `TEMPLATE_MATERIALS` (Melamina 19
  i DM 10 de `DEFAULT_CABINET`, MDF lacats de les plantilles) s'afegeixen si falten. Un test comprova que tots els materials
  de plantilles i ambients del catàleg són a les preferències inicials.
- **v12, duplicats fora** (`mergeDuplicateMaterials`, additiu i sense perdre res): «Melamina 19» → «Melamina blanca» i
  «DM 10» → «DM (fons)» (eren iguals; només si encara són els inicials, `RETIRED_TEMPLATE_MATERIALS`, i el de sempre hi
  és; els gruixos hi passen) i les fulles «Pi» (`sim-pine`) → «Fulles de pi» (es confonia amb la fusta «Pi» de la
  biblioteca; si el nom és lliure i cap altre material es diu «Pi»; «Pi» no és un àlies general: un moble de fusta de pi es
  queda «Pi»). `DEFAULT_CABINET` i les plantilles ja fan servir els de sempre. Els canvis de nom
  (`SettingsParse.renames`) es segueixen a les preferències (per defecte, taulers) i, a `loadSettings`, a tots els mobles
  i ambients desats (`renameMaterialEverywhere`, la mateixa transacció); l'àlies (`MATERIAL_MERGES` a
  `resolveMaterialAlias`) llegeix els `.moble` i dades antigues. Conseqüència al taller: el tauler del CSV ja no porta el
  gruix dues vegades («DM (fons):…x10», `T03_DM_fons_10.xcs`; abans «DM 10:…x10», `T03_DM_10_10.xcs`).
- **v13, gruixos del catàleg** (`addCatalogThicknesses`, només afegeix): Melamina blanca/gris/roure 30, Roure massís /
  xapat 40, Freixe xapat 16 i 30 (les plantilles els feien servir). Un test comprova que cap plantilla del catàleg avisa de
  materials ni gruixos amb les preferències inicials; l'avís de gruix no surt als materials de Simulació.
- **Noms únics** (`materialNameKey`: sense majúscules ni espais repetits): l'esquema (`MaterialListSchema`) rebutja els
  repetits; en llegir unes preferències, un de repetit passa a «X 2» amb un avís (`dedupeMaterialNames`).
- **Canviar el nom** (Preferències › Materials): en acabar (sortir del camp o Retorn; Esc el desfà), no a cada tecla; un
  nom repetit o buit surt en vermell a sota i es queda l'antic. Els mobles, objectes i ambients desats el segueixen
  (`renameMaterialRefs`, les claus de `mapMaterialRefs` = les d'`aliasMaterialRefs`; `db/materialRefs.ts`
  `renameMaterialEverywhere`, una transacció amb les preferències): **sense tocar `updatedAt` ni `edited`** (com
  `saveProjectCamera`) però amb la miniatura per refer (`thumbAt` fora). També el tauler i el fons per defecte, les mides
  de tauler (`renameMaterialInSettings`), les mides de tauler per material desades al nesting de cada moble
  (`renameNestingSheets`) i l'escena de Presentació (`renamePresentationMaterial`). Avís «Nom canviat: N
  mobles i M ambients actualitzats». Importar un fitxer d'abans de la v12 fa el mateix amb els seus `renames`.
- **Eliminar** (`DeleteMaterialDialog`): diu on es fa servir (`materialUsage`: mobles, objectes, ambients; i
  `materialSettingsUsage`: tauler/fons per defecte, mida de tauler) i ofereix un substitut (les referències hi passen com
  en un canvi de nom; `removeMaterialFromSettings`); el tauler o el fons per defecte no s'eliminen sense triar-ne un.
  «Restaurar valors inicials» (i eliminar sense substitut) corregeix el per defecte i les mides de tauler que apuntaven a
  un material que ja no hi és (`fixMaterialRefs`).
- **Selectors** (`core/model/materialOps.ts`): `boardChoices` (només taulers de CNC: cos, fronts, taulell i sòcol, tauler
  per defecte), `backChoices` (taulers i fons: fons del mòdul i per defecte, mides de tauler) i `partChoices` (peces
  lliures: tot menys els fons; ferro, pedra i vidre hi van a propòsit, la simulació per als objectes). Un moble fet amb un
  material que ja no és a la llista el conserva: el `MaterialSelect` el mostra com a valor actual amb ⚠ i «No es talla a
  la CNC» / «Només de simulació» / «No és a Preferències».
  Una peça lliure nova amb un material que no és a Preferències pren el tauler per defecte (`freePartFor`; no el primer
  de la llista: els nous s'hi afegeixen al davant).
- **Avisos de materials** (`core/build/materialIssues.ts`, `materialIssues(build, comp, materials)`: el build no llegeix
  preferències): `unknown-material` («El material «X» no és a Preferències: es veu amb un color per defecte i al taller
  sortirà amb aquest nom») i `thickness-not-listed` («El gruix 18 mm no és dels gruixos de «X»»), a «Avisos de fusteria»
  de l'Editor i a Exportar. A «Per defecte als mòduls nous», un gruix que no és del material és una nota, no una pastilla.
- **Biblioteca** (`settings/libraryItems.ts`, `MATERIAL_LIBRARY`; diàleg `MaterialLibrary`): «Afegir» obre una graella de
  materials fets (fustes, lacats, pedres, metalls, vidres, teixits, terres, parets) i «En blanc». `libraryItems.test.ts`.
  Els que ja tens (mateix nom o mateix acabat, `ownedMaterial`) porten «Ja el tens»: tocar-ne un no fa un «X 2» en
  silenci, sinó que ofereix «Obrir el meu» o «Afegir una còpia».
  (Les dades no són a `materialLibrary.ts`: vegeu Fast Refresh.)

## Foto
- La foto serveix per **veure proporcions**, no per fabricar. Les mides reals sempre les entra l'usuari i **recalculen** el
  model i recalibren la foto.
- Calibració: 4 punts d'un rectangle de mides conegudes (rajola, porta, A4) → homografia → escala i pla del terra/paret.
  EXIF (focal) si n'hi ha (focal 35 mm = 0 vol dir desconeguda).
- Rectangle amb cinta: només el valor principal és real; l'alçada continua estimada (`MeasureValue.state2`/`error2`) i les
  aplicades recorden quin valor (`AppliedMeasure.which`). L'origen (`originMm`) es desa amb l'escala d'aquell moment
  (`originScale`) i `scaledOrigin` el passa a l'actual: recalibrar no el fa lliscar.
- Moble sobre la foto (`cal.render`): **Línies** (SVG de cares projectades) o **Realista** (`photo/PhotoRender.tsx`: three.js
  amb la càmera calibrada, materials reals, llum de Preferències › Visor 3D i ombres sobre plans invisibles). L'SVG de
  controls va sempre a sobre. Panell de 280–560 px.

## Ambients (plànol de la casa amb els mobles)
- Els Mobles es dissenyen i es fabriquen; els Ambients són on es col·loquen. Model a `core/model/ambient.ts` (`Ambient`:
  `walls`, `items`, `plan`, materials del terra, parets i sostre), Dexie v4 (`ambients`, `parseAmbient`). Plànol en mm, x a
  la dreta i y avall; al 3D X = x, Z = y. Els elements van pel **centre** de la petjada i giren al voltant del centre (graus,
  horari vist des de dalt); sense girar, el darrere mira amunt.
- **Mobles enllaçats** (`item.kind = "moble"`, `projectId`): és el mateix moble de la llista. A l'ambient només se'n toquen
  les **mides generals** (`resizeComposition`: escala amplades, separacions, alçades, fondàries, mides fixes, peces lliures,
  objectes i models; els gruixos no; una divisió amb totes les mides fixes deixa l'última «auto») i la posició; «Obrir a
  l'editor» per a l'interior. Els objectes es col·loquen igual. «+ Moble» / «+ Objecte» obren la galeria a **pantalla
  completa** (`Drawer` full: la de Mobles, `NewMobleGallery`, o la d'Objectes) **sense** botó «Nou moble» / «Nou objecte»
  (per decisió de l'usuari: un moble en blanc a l'ambient no servia i despistava); a l'historial, «Afegir»; una plantilla crea el moble i el col·loca. Els que ja són en un ambient
  porten la marca (`useAmbientMembership`, `ProjectCard`), destacada (✓ i vora) a la finestra de l'ambient obert.
- **Blocs** (`kind = "block"`, `blockComposition`): llegat; els antics es veuen i s'editen (inspector «Bloc»), però no se'n
  creen de nous: els `BLOCK_PRESETS` són ara objectes (`object-<id>`). Tot es dibuixa pel mateix camí: build → peces →
  `buildScene`.
- **Editor** (`features/ambients/AmbientEditor.tsx`, sobre `Workspace`): pestanyes **Plànol · 3D** a dalt al mig del visor
  (es recorda, `AMBIENT_TAB_KEY`; els creats del catàleg s'obren al 3D); llista «Elements» a l'esquerra amb «+ Moble» ·
  «+ Objecte»; inspector (element, bloc, paret, grup, ambient) en `PanelSection` (Posició, Mides generals, Bloc, Mides i
  material, Finestres i portes, Parets noves, Acabats, Plànol de fons, Elements).
- **Plànol** (`PlanCanvas`, com Figma): roda o dos dits per desplaçar, Ctrl/⌘ + roda o pessigar per fer zoom al punt, espai
  + arrossegar; − / + i l'escala (1:50…) a baix a la dreta; la barra d'eines flota a dalt. Eines en columna a l'esquerra: **Seleccionar** (V), **Paret** (P,
  ploma: angle a 15°, imant als extrems, clicar el primer punt tanca, Retorn/Esc/doble clic acaben), **Habitació** (H, rectangle → 4 parets),
  **Finestra** (F), **Porta** (D), **Calibrar** (dos punts del plànol de fons i la mida real). Maj: sense angles; Alt: sense
  imant. Arrossegar una paret mou les enganxades; els extrems de la seleccionada s'arrosseguen (només mouen les parets
  enganxades en començar). Elements arrambats a les cares de les parets (`snapToWalls`), R gira 90°, fletxes (Maj ×10), Supr,
  Ctrl/⌘ D, desfer/refer. Es desa sol. «Encabir» deixa l'habitació fora de les eines i barres (`PLAN_INSETS`); noms i mides
  només si hi caben. **Plànol de fons**: imatge (2400 px JPEG) escalada amb la calibració, opacitat i bloqueig. La vista del
  plànol no es recorda.
- **Finestres i portes** (`Wall.openings`: finestra amb ampit de pedra, porta amb fulla, vidriera amb travessers):
  `nearestWall`, `addOpening` amb `OPENING_DEFAULTS`, `clampOpening` (no trepitja les que hi ha: forat lliure més proper o
  avís); es queden al seu lloc en moure extrems o escurçar la paret (`setWallEnds`); s'arrosseguen al llarg de la paret;
  inspector de la paret: tipus, centre, ample, alt, ampit, fulles i material propi (`Wall.material`). 3D: `wallOpenings`,
  `wallSegments`; el vidre porta `userData.glass` i `baseOpacity`.
- **Grups d'elements** (`AmbientItem.group`; `setItemGroup`, `moveItems`, `rotateItems`, `duplicateItems`, `removeItems`):
  la llista és com l'arbre de l'editor (grups plegables, menú ⋯: duplicar, grup nou, posar a un grup, treure, obrir a
  l'editor, treure de l'ambient). El primer clic a un element agrupat (plànol o 3D) tria el grup i el segon l'element; Supr,
  Ctrl/⌘ D, R i fletxes valen per a tot el grup (duplicar un sol element el deixa al grup; el grup sencer en fa un de nou);
  inspector del grup.
- **Opcions de vista** (les mateixes `ViewOptions`/`ViewTile`): al plànol encabir, graella, mides, noms, peces, imant, plànol
  de fons i render; al 3D enquadrar, interior, casa de nines, sostre, ombres i render.
- **3D** (`Ambient3D`): terra i parets amb `surfaceMaterial` (textura a mida real); les parets entre la càmera i l'habitació es
  fan transparents (casa de nines). La mateixa navegació que l'editor; clic per seleccionar (caixa taronja; Supr, Ctrl/⌘ D, R
  i fletxes); **es mou amb les fletxes del gizmo** (`MoveGizmo`, X i Z; quadrícula, imant a les parets només en la direcció
  de la fletxa amb un sol element, Alt sense imant, un pas de desfer). Ratolí a sobre: contorn prim (`BoxFrame`); seleccionat, gruixut. Les peces d'un
  element només es refan si en canvia la geometria o els materials (moure'l només en canvia la posició) i les que ja no es
  dibuixen s'alliberen. La càmera mira el punt de l'obertura (o d'«Enquadrar»), no segueix la caixa de l'ambient. **Interior** (`LuEye`, `eyePose`): càmera anivellada a 1,35 m al costat de la paret de davant
  mirant la del fons, fov 55 («Enquadrar» torna a 40). **La càmera es recorda per ambient** (`Ambient.camera`, `pose` =
  «home»/«eye»; `saveAmbientCamera` 1 s després, sense `updatedAt` ni desfer; `updateAmbient` la conserva); en obrir el 3D s'hi torna i el botó surt marcat només si és la mateixa d'ara. **Sostre**: opció
  de vista (`mobles:ambient-ceiling`) i material a Acabats (`Ambient.ceilingMaterial`), amb una mica de llum pròpia. Fons del
  3D transparent sobre el gris del plànol (`bg.subtle`); el render fa servir el clar (`scene.userData.renderBackground`).
- **Catàleg d'ambients** (`core/model/ambientTemplates.ts`, `AMBIENT_TEMPLATES`, per categories `AMBIENT_CATEGORIES`):
  habitacions «de revista» per a renders; referències `store:<cat>:<nom>`, `app:<id>`, `object:<id>`, `mag:<id>`, `col:<id>`,
  arrambades a una paret (N/S/E/O, `placeTemplateItem`) o lliures. **Escenes amb plantes de debò** (`PLANT_SCENES`, les
  primeres: models 3D, `F(id)` = `object:object-model-<id>`), **escenes de revista** (`MAG_SCENES`: 14 fetes a partir de fotos;
  la plantilla pot dur `height`, `walls`, `low`, `open`, `openings`; `templateWalls`; mobles `MAG_FURNITURE`,
  `magFurniture.ts`, fets amb `storeBuilders`) i les dues **«Col·lecció · …»** (`COLLECTION_SCENES`).
  `createAmbientFromTemplate` (`features/ambients/fromTemplate.ts`) crea cada moble i objecte (un per plantilla, a l'Historial
  o al grup del client) i l'ambient enllaçat. **Una escena del catàleg s'obre directament** i va a l'Historial (per decisió de l'usuari, sense preguntar).
- **Ambients per a clients**: menú ⋯ › «Duplicar (per a un client)…» (`duplicateAmbient`): «escena · client», duplica els
  mobles i objectes enllaçats i ho posa tot al grup del client: dos clients no comparteixen cap moble.

## Objectes
- Un objecte (sofà, làmpada, planta…) és un moble del tipus **`objecte`** (`partsOnlyKind`: només peces lliures, com el
  Flat-pack): s'edita amb el **mateix Editor** (peces amb forma, «Talla», materials per categories) però **no es fabrica**
  (`buildComposition` en treu el nesting i els encaixos; al menú només hi ha l'Editor; la molla de pa diu «Objectes»). No surten
  a l'historial de Mobles (`isObject`).
- `OBJECT_TEMPLATES` (`ambient.ts`): els blocs d'abans i cadira, làmpada, planta, mirall, taula rodona. **Objectes de revista**
  (`magObjects.ts`, `MAG_OBJECTS`, formes de `objectShapes.ts`: `ellipse`, `roundRect`, `leaf`, `wave`, `blob`): sofàs,
  butaques, quadres, miralls, tele, cortines, llums, plantes, catifes, taules… Tot és geometria (perfils extrudits), no física
  ni shaders: el render ho veu igual que el visor. Categories `OBJECT_CATEGORIES` / `objectCategory`
  (`core/model/objectCategories.ts`).
- **Mides al mm**: `tidyMm`/`tidyPart` (`freePart.ts`) arrodoneixen al mm els valors amb més d'un decimal (els de l'usuari,
  com 22,5, es queden) en crear l'objecte i en carregar-lo (`normalizeComposition`).

## Galeries (Mobles · Objectes · Ambients)
- **Les tres pàgines fan igual**: capçalera `PageHeader` (títol gran, **botó principal a sota** —«Nou moble» · «Nou objecte»
  · «Nou ambient», `colorPalette="wood"`, en blanc amb `projects/blank.ts`; Mobles també «Obrir fitxer»— i l'explicació),
  cercador (sense accents; obre les seccions i categories amb resultats) i acordions **tots tancats** en obrir l'app (estat
  de la sessió, p. ex. `mobles:gallery`): **Historial**, **Projectes** i **Catàleg**; a Mobles, a més, **Col·leccions de
  mobles**. No hi ha filtre de tipus (el tipus també es busca). Fila d'eines dins dels acordions («Grup nou»,
  «Seleccionar», «Esborrar l'historial») **a l'esquerra**.
- **Mobles** (`projects/ProjectsScreen.tsx` + `projects/NewMobleGallery.tsx`, també a la finestra «+ Moble» dels ambients).
  Les **plantilles de l'app** (`BUILTIN_TEMPLATES` a `templates.ts`) **ja no surten a la galeria**: les fan servir les escenes
  (`app:<id>`), el corpus golden, els tests i `modulePresetsFor`. Són: les vitrina (`SHOWCASE`: Aparador sobre ferro, Moble TV
  flotant, Moble de bany amb pedra, Cuina amb illa de pedra, Vestidor amb barres, Escriptori flat-pack), les inspirades en
  fotos d'interiors (`INSPIRED_TEMPLATES` a `inspiredTemplates.ts`: Moble TV llarg, Llibreria amb baixos negres, Lliteres
  encastades, Consola de noguera a inglet, Moble penjat de noguera, Tauleta cub, Cuina de roure amb illa de calaixos), les
  flat-pack («Prestatgeria d'encaix», «Tamboret flat-pack», `model/flatPack.ts`), les de `kind` taula (Consola, Taula de
  menjador); `showcase.test.ts` comprova que no fan avisos de xoc ni de talls. Tretes per decisió de l'usuari: Consola ona, Moble TV 3 portes i Moble TV
  menjador (aquest es queda com a `TV_LIVING_ROOM` per als tests i la vista prèvia de l'escena a Preferències). Les «teves
  plantilles» es van convertir en mobles del grup «Les meves plantilles» (`migrateUserTemplates`). Un `.moble` (també les
  plantilles exportades abans, `kind: "plantilla"`) **s'obre sempre com a moble**; no hi ha «Desar com a plantilla».
- **«Catàleg», igual a les tres pàgines** (`projects/CatalogSection`, `LuBookOpen`, per decisió de l'usuari): l'última secció
  (a Mobles, abans de Col·leccions), amb una línia d'explicació i un acordió per categoria (`lazyMount`: les miniatures es
  munten en obrir-lo). Mobles: **plantilles per a botigues de mobles** (`model/storeCatalog.ts`, `STORE_CATALOG` /
  `STORE_TEMPLATES`, de [`cad-mobles-cataleg.md`](docs/cad-mobles-cataleg.md)): 10 categories (Saló, Menjador, **Cuina** —no és
  al catàleg, afegida amb `kitchen()`: lineal, amb illa, kitchenette, illa sola, columnes i racó de cafè—, Dormitori,
  Juvenil, Despatx, Entrada, Emmagatzematge, Bany, Exterior) › tipus › 3 dissenys (nom, estil, mides, materials, ús, colors,
  públic, `Template.price` orientatiu), 198 plantilles en una graella per categoria amb el tipus a la targeta. Fora: sofàs,
  butaques, cadires, miralls, gandules i carros (no són de tauler). Els mobles només de peces lliures (llits, capçals, taules
  de pedra) són Flat-pack. Aparadors sobre potes de peces lliures: caixa «penjada» a l'alçada de les potes.
  `storeCatalog.test.ts`: totes sense avisos de disseny. Objectes: per tipus (`OBJECT_CATEGORIES`). Ambients: per habitació.
- **Col·leccions de mobles** (`projects/CollectionsSection`, `LuLibrary`; `FURNITURE_COLLECTIONS` a
  `core/model/collections.ts`): Minimalisme arquitectònic i Minimalisme comercial, per famílies, 25 + 25 peces paramètriques
  (fronts push on la fitxa diu «sense tirador») amb una **fitxa d'estudi** (`PieceStudy`: referència, llenguatge, geometria,
  proporcions, materials, acabats, gruixos, ferratges, sensació, relació amb l'espai, graus 1–5, qualitat, fotos de la carpeta
  `referencies`); tocar una peça obre la fitxa (calaix) i «Crear el moble»; la cerca també mira la fitxa;
  `collections.test.ts`.
- **Targetes**: totes les graelles fan servir `GALLERY_COLS` (`projects/galleryGrid.ts`) i la **`GalleryCard`**
  (`projects/GalleryCard.tsx`: miniatura · nom de dues línies · què és · descripció · etiquetes (color principal) i preu ·
  peu amb data i ⋯); `TemplateCard`, `ProjectCard`.
- **Historial i Projectes**: primer l'**Historial** (el que és de pas, sense grup) i a sota **Projectes** (el que es desa en
  un grup, p. ex. un per client; `FolderedGrid show="loose"|"folders"`, `projects/Folders.tsx`: grups plegables amb ⋯
  canviar el nom / desagrupar; la cerca obre els grups amb resultats). Grups: `Project.folder`, `AmbientRow.folder`;
  `setProjectsFolder`, `setAmbientsFolder`. Menú ⋯ de cada targeta: desar com a fitxer, duplicar, **moure a un grup…**
  (`MoveToFolderDialog`), esborrar. **«Grup nou»** (nom i després es toquen les targetes) i **«Seleccionar»**
  (`FolderedGrid selection`): diverses targetes → moure-les a un grup o esborrar-les (els mobles i objectes que són en un
  ambient es conserven). **Modificats** (`Project.edited`, de `updateProjectComposition`; `isEdited` per als antics):
  etiqueta «Modificat». **Esborrar l'historial** (`projects/ClearHistory.tsx`, amb confirmació, respecta la cerca): no toca
  els Projectes ni els mobles/objectes que són en algun ambient (a Ambients esborra els ambients, els seus mobles es queden);
  avisa dels modificats i permet «Esborrar només els no modificats».
- **Miniatures 3D** (per decisió de l'usuari, en lloc dels dibuixos de línies): **sense cap 3D viu per targeta** (a l'iPhone
  farien tancar la pàgina). `components/viewer/thumbRenderer.ts`: un sol renderitzador fora de pantalla (s'allibera 3 s
  després de buidar la cua) que pinta les peces amb els materials reals sobre el terra i la paret de Presentació, amb ombres,
  en un JPEG 2:1 de 480 px; cua d'una en una quan el navegador és lliure (`enqueueThumb`; `projects/projectThumbs.ts`;
  `request…Thumb` torna la funció per cancel·lar). Es pinta quan les fotos de textura hi són (`drawWhenReady`; `snapshot` torna
  `null` si se'n baixen); si alguna falla (`photoTextureFailures`), no es desa. Es desa al projecte (`Project.thumb`,
  `thumbAt`, `thumbV` = `THUMB_VERSION`); les de plantilles, en memòria. Ambients (`ambients/ambientThumbs.ts`): terra,
  parets (sense les de davant) i els mobles i objectes, de dalt i de davant, **sense fons** (PNG transparent);
  `AmbientRow.thumb`; les del catàleg, en memòria (amb les plantilles de les seves referències). **Amb la càmera desada** (`Composition.camera`, `Ambient.camera`) es fa des d'allà (`viewerSize`,
  `thumbPose`); sense, enquadrament automàtic. `thumbCam` (`cameraSignature`) i `thumbIsStale` la refan si la càmera ha
  canviat; desar la miniatura no toca `updatedAt` ni `edited`. `SnapshotThumb` (2:1, sense fons); sense foto encara, el
  mateix requadre buit (la graella no salta). Cal `scene.updateMatrixWorld(true)` abans de mesurar la caixa.

## Preferències
- **Com la Configuració de macOS / Figma** (`SettingsPages` + `Pane` a `SettingsScreen`): a l'esquerra els apartats per
  categories (`SETTINGS_GROUPS`; no és un acordió): **Fabricació** — Màquines CNC, Regles de mecanitzat, Ferratges
  (frontisses, guies, espigues i els seus forats), Jocs per defecte, Materials, **Taulers** (camp de treball de la màquina per
  defecte o «importa-la a Màquines CNC»; «Mides de tauler de fàbrica» per material; «Distribució»: girar les peces amb veta;
  sense «Tall»: separació i marge són de la màquina; sense avís si el tauler passa del camp: 2800 × 2070 sobre 5020 × 1905 va
  bé), Etiquetes —, **Foto i visor 3D** — Objectes de referència, Visor 3D — i **App** — Visualització, Tema. A la dreta la
  pàgina triada (icona, títol, explicació i «Restaurar valors inicials»): **una sola columna de 760 px** (`FoldGrid` = pila)
  de **grups sempre oberts** (`components/SettingsGroup`: targeta amb capçalera, res no es plega). Al mòbil, navegació en
  profunditat: apartats › pàgina › element, amb «‹ Tornar»; l'apartat i l'element es recorden durant la sessió
  (`useSessionString`). Les referències creuades als textos diuen «Preferències › <títol de la pàgina>».
- **Llista i detall** (`components/MasterDetail`: llista agrupada amb mostra; cercador, categories i «Afegir» (només icona)
  en una fila; `head` = títol de la pàgina a dalt de la llista —`PaneHeadContext` a les pàgines `wide`—; `footer` = sota el
  detall) a Objectes de referència i Màquines CNC.
- **Materials: graella de targetes i edició a pantalla completa** (per decisió de l'usuari, com la finestra del Render;
  `settings/MaterialsPane.tsx`, `MaterialsList`): a dalt el cercador (sense accents, `fold`) i «Afegir» (biblioteca); a sota,
  les categories en el mateix **acordió** que els apartats de les galeries (`gallery-accordion` tancat amb vora, icona, nom,
  comptador i, sota el nom, per a què serveix: Taulers i Fons, per al nesting; Simulació, decoratius per a objectes i
  ambients; `lazyMount`: les targetes només es munten en obrir la categoria). Per defecte, oberts els Taulers; la cerca obre
  les que tenen resultats; les obertes es recorden durant la sessió (`mobles:md-open:materials`). Dins, una graella
  `GALLERY_COLS` de **`GalleryCard`** (marge `--gallery-px`): la mostra del material de debò (`MaterialSwatch`, 3:2, CSS de
  `previewStyle` a escala fixa: sense canvas per targeta, les procedurals es pinten un cop i es recorden), nom de dues línies,
  «Acabat · gruixos · cantell» (`materialSummary`) i l'etiqueta «★ Tauler per defecte» / «★ Fons per defecte».
  - Tocar una targeta obre l'**editor a pantalla completa** (`MaterialEditorDialog`: `Dialog size="full"`, 100vw × 100dvh,
    zona segura als quatre costats, ✕ a `calc(env(safe-area-inset-top) + 8px)` i el títol a la seva altura: nom del material
    i categoria). Mostres (`MaterialStage`, fora de la `MaterialCard` amb `key`: canviar de material no refà el 3D): la
    **tira a escala real** (`MaterialHero fill`, 600 mm = l'amplada, «A escala real») i la **bola de material**
    (`settings/MaterialBall.tsx`, «Bola de material»: esfera de 300 mm, `ballMaterial` a `viewer/ballMaterial.ts` = el
    mateix camí que les peces, `finishMaterial` d'`exportablePanel.ts`; u = π·D i v = π·D/2, repeticions en u enteres si
    cal estirar ≤ 12 % (`ballSpanU`), si no costura darrere; un sol `Canvas` `frameloop="demand"`, dpr ≤ 2 / 1,5
    `LOW_MEMORY`, `resize offsetSize` —el diàleg s'obre escalat—, `StudioEnvironment` + llum principal forta i retall,
    terra de caselles de 50 mm que s'esvaeix sobre el fons d'estudi CSS clar/fosc, ombra de contacte de textura;
    `OrbitControls` sense zoom ni desplaçar; el material es refà per `ballKey` i s'allibera; només muntada amb l'editor
    obert; en DEV `window.__materialBall` = el renderitzador per mirar `info.memory`). A l'ordinador gran (`lg`) omplen
    la columna de l'esquerra (tira a dalt, bola a sota a tota l'amplada) i el formulari va a la dreta (560 px, amb el seu
    desplaçament); més estret, tira i bola una al costat de l'altra a dalt (meitat i meitat al mòbil, bola de 280 px a
    `md`) i el formulari (760 px com a molt) a sota, tot es desplaça. Les targetes de la graella es queden en CSS. Formulari (`MaterialCard`): nom editable amb Duplicar/Eliminar i
    les seccions **Aspecte** (Acabat, Color/Espècie/Foto, mapes de relleu i brillantor, Rajola, Textura, Joc PBR) i
    **Fabricació** (Gruixos `ThicknessChips`, Cantell, Veta, Categoria; als de simulació només Categoria) i, als taulers i
    fons, **«Per defecte als mòduls nous»** (`DefaultPick`). Esc i ✕ tornen a la graella; **Esc amb el nom a mig escriure
    només el desfà** (no tanca). El focus va al ✕ (al mòbil no surt el teclat), llevat d'un material nou.
  - Un material nou (biblioteca o «En blanc»; nom únic, «Material nou 2», a la categoria oberta si només n'hi ha una) o
    duplicat **obre l'editor** amb el nom seleccionat; «Obrir el meu» de la biblioteca també l'obre. **Eliminar** des de
    l'editor el tanca. Al mòbil l'editor fa de pàgina de detall: el seu ✕ és el «Tornar» (cap «‹ Materials»; la pàgina de
    la graella només té «‹ Preferències»). Controls de 280 px com a molt.
- **Objectes de referència inicials** (`BUILTIN_REFERENCES`): genèrics (A4, rajoles, portes, **una sola tele** de 55″,
  radiador, endoll; per decisió de l'usuari, no una llista de teles). Les teles antigues es treuen (`RETIRED_REFERENCES`,
  `isRetired`, també les còpies «TV Sony KD-55XD8505…»).
- **Visor 3D**: qualitat, escena de Presentació (terra i paret: materials de la biblioteca, `PresentationScene.floorMaterial`
  / `wallMaterial`, o les mostres ràpides; terra per defecte «Parquet de roure»), llum i «Cel del render». **Tema**:
  dia/nit/sistema i color principal (`theme/accent.ts` redirigeix les variables CSS de `wood`).
- **Versions i lectura** (`core/model/settings.ts`, `SETTINGS_VERSION`, ara 12): les migracions depenen només de la versió
  desada, que **mai baixa** (`saveSettings` desa la més alta). **Desades per una versió més nova**: només lectura
  (`saveSettings` torna `false` amb `console.warn`; `loadSettings` avisa). **Lectura camp a camp** (`repairValue`,
  `core/model/repair.ts`): un valor dolent d'una secció només torna aquell valor a l'inicial (un tauler o una llargada de guia
  dolents es treuen); el missatge diu el nom de la pàgina. **Importar** (`importSettingsJson`): només se substitueixen les
  seccions que porta el fitxer (un sense `machines` no esborra les màquines).

## UI (Chakra v3 + react-icons)
### Regles
- **Mobile-first**: la faig servir sobretot a l'iPhone. Mínim breakpoints `base` i `md`.
- **És una app, no una web**: contingut a **tota l'amplada** (sense `Container` amb `maxW`); 3D, foto, alçat i nesting
  s'estiren. Només es limita l'amplada dels formularis i dels textos llargs.
- Tokens semàntics (`bg.subtle`, `fg.muted`…) i `colorPalette`, no colors crus. **Color principal = paleta `wood`** sempre
  (`colorPalette="wood"`, `wood.fg`, `wood.solid`…); res de `blue`, `orange`… per al color principal. Mode fosc suportat
  (dia/nit és a Preferències, no al menú). Controls segmentats en mode fosc: l'indicador triat és gris clar
  (`theme/system.ts`).
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

### Mòduls compartits (com les apps professionals)
Tots els editors fan servir les mateixes peces, no còpies; una funcionalitat nova d'un editor es fa al mòdul compartit:
- **`Workspace`** + `useWorkspace(id)` (`components/`): estructura · visor · propietats, vores arrossegables, plegar amb els
  botons de les cantonades, pestanyes Estructura · Propietats al mòbil, amplades recordades; a l'Editor i als Ambients.
- **`SceneHelpers`** (`StudioEnvironment`, `SceneAccess`) als visors 3D; **`RenderDialog`** a l'editor i als ambients;
  **`MoveGizmo`**, **`BoxFrame`**; **`ViewOptions`** / **`ViewTile`**.
- **`NameDialog`** (`components/`): posar un nom (grup nou, canviar el nom, mòdul nou), amb un nom per defecte seleccionat.
- **`MaterialSelect`** (`settings/MaterialSelect.tsx`) a tot arreu on es tria un material: un **botó** (fons suau, a tota
  l'amplada, sense fletxa ni icona: no ha de semblar un desplegable) amb la mostra i el nom que obre un calaix (a la dreta a
  l'ordinador, de baix al mòbil) amb un acordió per categoria i les mostres (només de la categoria oberta); en tocar-ne una es
  tria i es tanca. `emptyLabel` per a «Com el cos», «Com a Preferències», «Tots els altres», «Cap (fantasma)».
- **`FormRow`** (`components/FormRow`): **tots els camps de l'app són files etiqueta · control** (Preferències, inspectors,
  diàlegs de render, textura, foto i nesting): etiqueta a l'esquerra (min(150 px, 36 %)), control amb `maxW` i l'ajuda a
  sota; **consulta de contenidor**: amb menys de 300 px l'etiqueta va a sobre. `NumRow` (`components/NumRow`, 180 px, amb
  `ariaLabel`), `IconChoice hideLabel` i `MaterialSelect hideLabel` dins un `FormRow`; `FormSection` per a seccions dins una
  targeta (títol petit en majúscules = `components/SectionLabel`, també als grups de les llistes i a Opcions de vista);
  `ChoiceChips` per a opcions que han de saltar de línia.
- **Opcions amb icona** (`components/IconChoice.tsx`): poques opcions → botons d'icona amb el nom al tooltip i l'opció triada
  al costat del títol (o a sota, `hideLabel`). **Estil discret i comú** (`components/segmented.ts`, `segGroup` + `segItem(on)`):
  control segmentat petit (botons xs, fons suau, la triada amb fons clar, ombra i icona del color principal), **sense ocupar
  tota l'amplada** i sense botons plens; el fan servir IconChoice, el tipus de front, la «Fila» del mòdul, `ChoiceChips`,
  `ViewTile`, Forma, «Al terra / A la paret» i les eines de la Foto. Base, Fons, Tapa, Patró de reixeta, Direcció dels
  objectes són només icona; Efecte i Forma dels objectes, portes (una/dues, frontisses), abatible i muntatge de la reixeta,
  segments amb icona i text.
- **Seccions plegables** (`components/PanelSection.tsx`): totes iguals (icona + títol + insígnia + fletxa, sense fons),
  **independents** (se'n poden tenir diverses obertes) als inspectors i al Render; **comencen tancades** en obrir l'app
  (llevat de `defaultOpen`, p. ex. els xocs amb l'obertura actual) i l'estat es recorda durant la sessió
  (`mobles:section:<id>`). Dins d'un `PanelGroup` fan d'acordió (una oberta): només l'«Avançat» d'Exportar. Les Preferències
  no en fan servir (`SettingsGroup`, sempre obert).
- **`PageHeader`** (`components/PageHeader`, Ambients · Objectes · Mobles · Preferències): títol gran, accions a sota i
  l'explicació. **Seccions de les galeries sense marge** (`.gallery-accordion`, `layout.css`): barra d'eines i acordions de
  dins **a sang**; la resta amb `--gallery-px`. Res de marges negatius.

### Navegació i barres
- **Menú global sempre igual** (`App.tsx`, `GLOBAL_NAV`, com Figma o Linear): **Ambients · Objectes · Mobles** i, a baix de
  tot, Preferències (igual a la barra de baix del mòbil); l'apartat del document obert queda marcat (`section`). L'app s'obre
  a Ambients si no hi havia res obert. **Cada apartat recorda l'últim obert** (`mobles:last-object`, `mobles:last-moble`): clicar
  Objectes o Mobles hi torna si encara existeix; tornar a la llista («Mobles ›», la fletxa o clicar l'apartat del document
  obert) el deixa d'obrir. **Les accions d'un apartat van a la seva capçalera**, mai al menú.
- **Barra superior del document** (`components/TopBar.tsx`, `DocBar` per a moble, objecte i ambient —`AmbientTopBar`—, com
  Figma/Onshape/Notion): `Mobles › Nom` a l'esquerra (nom editable) i les accions del document a la dreta, que cada pàgina hi
  posa amb `<TopBarActions>` (desar, desfer, refer). Les pàgines **no porten títol propi** ni capçaleres pròpies. Les pàgines
  d'un moble (`PROJECT_NAV`) són **pestanyes al mig de la barra** (`TopBar tabs`); al mòbil, en una **franja a sang sota la
  barra de dalt** (`mobileProjectTabs`: icona a sobre i nom a sota, la triada amb el color principal i una ratlla): la barra
  de baix és **sempre el menú general** (com les apps de l'iPhone).
- **Mòbil sense títols repetits**: les pàgines d'inici porten el seu títol gran (com iOS) i no hi ha barra de dalt; només n'hi
  ha quan cal tornar enrere. **Un sol «‹ Tornar» a la vista** («‹ nom del moble», «‹ Preferències», «‹ Màquines CNC»;
  `useSessionString` es manté igual entre components amb la mateixa clau; `DETAIL_KEYS`). Diàlegs i calaixos a pantalla
  completa respecten la zona segura (`env(safe-area-inset-top)`), també el botó de tancar; el Render (i l'editor de
  materials, la Vista CAM), els quatre costats i el botó a `calc(env(…) + 8px)`, també a l'ordinador i a l'iPad.

### Mides d'iOS a les pantalles tàctils
- `src/theme/layout.css`, `@media (pointer: coarse)` (CSS sense capa: guanya a les de Chakra): es canvien les variables dels
  tokens. Text `sm`/`md` 17, `xs` 13, `2xs` 11, `lg` 20, `xl` 22; controls (`sizes` 8–11) 40 / 44 / 44 / 48 (mínim tàctil
  d'Apple: 44); interlineat 1,3; camps on s'escriu a 17 (amb menys de 16, Safari fa zoom). `FormRow` centra l'etiqueta amb
  `--form-row-label-pt`. Barra de baix com la d'iOS (icona 24, nom 2xs). Al tàctil també: noms de les targetes (`.card-title`)
  a 15 en dues línies, capçaleres d'acordió de 48, opcions dels controls segmentats (`.seg-item`) de 44 × 44 i camps numèrics
  **sense les fletxetes + −** (es fa servir el teclat numèric, `inputMode`). A l'ordinador, les mides de Chakra (sm = 14).
- **La mateixa estructura a l'ordinador i al mòbil** (per decisió de l'usuari), com la Configuració d'iOS/macOS: files de
  formulari (`.form-row`) enganxades amb una línia fina, marges de les targetes de Preferències i de les seccions
  (`.settings-group-*`, `.form-section`: 20, al tàctil 16) i 32 entre grups (`.settings-stack`). **Només canvien les mides.**

## Desar i fitxers
- **Tot el que es desa sol fa servir `useDebouncedSave`** (`features/useDebouncedSave.ts`): Editor, Foto, Nesting, Ambients i
  Preferències. Desa amb retard, compara amb **l'últim valor desat** (no amb el que torna Dexie: es desava sense parar) i desa
  el pendent en sortir de la pàgina, en amagar l'app i amb `mobles:flush-save`. Obrir una cosa no la desa (no puja a la llista
  ni surt «Modificat»). Si `save` falla o torna `false`, aquell valor no compta com a desat i torna a quedar pendent.
- **Llegir sense perdre res** (`repairComposition`, `core/model/compositionRepair.ts`, test): una composició que no passa
  l'esquema es repara **element a element** (un objecte, una peça lliure, un model, un taulell o un forat dolents es treuen
  sols; d'un mòdul només els camps dolents; a l'arbre de zones, només el camp dolent). `readComposition`
  (`db/compositionStore.ts`; la fa servir `compositionOf`) dona també `problems` i `unreadable`: sense cap mòdul bo, el del
  mòdul de caixa (`params`); si no es pot reparar, caixa per defecte i **no es desa a sobre** (`updateProjectComposition` torna
  `false`; l'Editor no desa i avisa). Peces, Nesting i Exportar mostren l'error (`UnreadableAlert`, `useCompositionRead`) i
  no fan res, i el `.moble` no es desa (`projectToMoble` llança `UNREADABLE_COMPOSITION`). L'Editor avisa del que s'ha tret.
  Les parets dels ambients (`parseAmbient`) també: una obertura o un material dolents no treuen la paret.
- **Fitxer `.moble`** (`core/file/mobleFile.ts`, JSON versionat amb foto opcional; `parseMobleFile` fa la mateixa reparació i
  treu amb un avís el nesting, el calibratge de la foto (camp a camp) i les referències malmesos). Porta la càmera i els models
  de l'usuari que fa servir. El calibratge (`FileCalibrationSchema`) té els mateixos camps que `PhotoCalibration` (un test ho
  comprova en compilar). `updateProjectPhoto` no desa un calibratge d'una foto que ja no hi és.
- **El `.moble` no porta preferències** (per decisió de l'usuari): forats, ferratges, jocs, l'aspecte dels materials i la
  màquina són de **qui l'obre** (el moble s'hi adapta en silenci). Només s'avisa dels **materials** de la composició
  (`materialRefNames`, les claus d'`aliasMaterialRefs`) que no són a les preferències després dels àlies (`missingMaterials`,
  `missingMaterialsWarning` a `openMobleFile`: «Materials que no tens a Preferències: …; es veuran amb un color per defecte i
  al taller sortiran amb aquest nom. Afegeix-los a Preferències › Materials.»). Les referències que falten s'afegeixen.
- **Obrir un `.moble` amb doble clic** (app instal·lada, Chromium): `file_handlers` i `launch_handler` `focus-existing` al
  manifest; `useLaunchFiles` (`features/file/useLaunchFiles.ts`, a `App`) llegeix la `launchQueue` i fa el mateix que «Obrir
  fitxer» (espera les preferències). Safari/iOS no ho suporta.

## PWA
- **Càrrega a demanda** (`App.tsx`, `React.lazy` + `Suspense`): Editor, Peces, Nesting, Exportar, Foto, Preferències i l'editor d'ambients es carreguen quan s'obren (la barra de l'ambient és a part, `ambients/AmbientTopBar.tsx`). `advancedChunks` només posa al bloc de three el nucli (`three/build`, `@react-three`, `three-stdlib`): els carregadors i exportadors de `three/examples` van amb qui els fa servir. Els fallbacks JS de Draco/Basis no es precachegen. Les textures procedurals que es llegeixen (`getImageData`) fan servir `willReadFrequently`.
- **Icones a sang**: quadrat sencer amb el fons `#1a202c`, **sense cantonades rodones ni transparència** (iOS i Android hi
  posen la màscara; si ja és arrodonida, les puntes surten blanques). Font `public/icon.svg` → `pwa-192/512.png`,
  `apple-touch-icon.png` (180); `pwa-maskable-512.png` (`icon-maskable.svg`, la marca al 78 %). El `favicon.svg` sí que és
  arrodonit (amb transparència).
- **Pantalles d'inici d'iOS** (`public/splash/`, `apple-touch-startup-image` a `index.html`): una per mida i orientació
  (marca, «Mobles» i «Configurador de mobles per a CNC» en Inter). No es precachegen (`globIgnores`). Les PNG es generen des
  de l'SVG (no s'editen a mà).
- **Versió** (com a rack): `__APP_VERSION__` = nombre de commits i `__APP_COMMIT__` (git en construir, `vite.config.ts`; sense
  git, `APP_VERSION` o «dev»), petita al costat del nom al menú i al manifest. El Dockerfile instal·la git i el `.git` no
  s'ignora.
- Precache (`vite.config.ts`): models `.glb` i HDRI sí; fotos de textura (`/textures/`) i pesos d'OIDN (`/oidn/`, `oidn.ts`
  els valida i esborra els dolents de la seva memòria cau) no: `runtimeCaching` CacheFirst en fer-los servir; splash no.

## Icones (catàleg fix, `react-icons/lu`)
Una icona = un significat a tota l'app. No en triïs d'altres per a aquestes accions; si en cal una de nova, afegeix-la aquí.
Botons només d'icona: `aria-label` + `Tooltip` en català. Accions principals: icona + text.

| Àmbit | Acció | Icona |
|---|---|---|
| Navegació | Ambients · Objectes · Mobles (el cub: un moble) | `LuHouse` · `LuSofa` · `LuBox` |
| Navegació | Editor · Peces · Nesting / taulers · Exportar | `LuDraftingCompass` · `LuList` · `LuLayoutGrid` · `LuDownload` |
| Navegació | Tornar (‹ a les barres) · Plegar/desplegar menú · Preferències | `LuChevronLeft` · `LuPanelLeftClose` / `LuPanelLeftOpen` · `LuSettings` |
| Tipus de moble | Moble · Cuina · Armari · Taula · Flat-pack · Objecte | `LuBox` · `LuCookingPot` · `LuContainer` · `LuTable` · `LuPuzzle` · `LuSofa` |
| Zones | Dividir en vertical (divisor vertical, zones esquerra/dreta) | `LuSquareSplitHorizontal` |
| Zones | Dividir en horitzontal (travesser, zones dalt/baix) | `LuSquareSplitVertical` |
| Zones | Divisió vertical · horitzontal (un compartiment porta la icona del seu contingut, igual a l'arbre, a la capçalera i a «Front»: `composition/zoneIcons.ts`) | `LuColumns2` · `LuRows2` |
| Zones | Eliminar divisió · Mida | `LuUngroup` · `LuRuler` |
| Contingut | Obert · Prestatges · Porta · Calaixos · Barra de penjar | `LuSquareDashed` · `LuRows3` · `LuDoorClosed` · `LuArchive` · `LuShirt` |
| Contingut | Abatible · Reixeta · Front fix | `LuPanelBottom` · `LuGrid3X3` · `LuSquare` |
| Composició | Afegir · Duplicar · Eliminar | `LuPlus` · `LuCopy` · `LuTrash2` |
| Composició | Objecte de referència · Model 3D (`.glb`) · Menú del document | `LuScan` · `LuSprout` · `LuEllipsis` |
| Composició | Peces lliures, encaixos i flat-pack (peça, Efecte peça) · Peça/objecte que talla | `LuPuzzle` · `LuScissors` |
| Composició | Moure a l'esquerra · a la dreta (menú de l'arbre) | `LuArrowLeft` · `LuArrowRight` |
| Front | Una porta · Dues portes · Abatible avall · amunt · Ranures horitzontals · verticals (reixeta) | `LuDoorClosed` · `LuFlipHorizontal2` · `LuArrowDownToLine` · `LuArrowUpToLine` · `LuAlignJustify` · `LuColumns3` |
| Front | Recobrents (fronts) | `LuSquareStack` |
| Forma | Rectangle · Arrodonit · Oval (tauler de taula) · Efecte obstacle | `LuRectangleHorizontal` · `LuSquircle` · `LuCircle` · `LuShield` |
| Inspector | Mides · Estructura (base, fons, tapa, laterals) · Materials · Fusteria · Front · Pare | `LuMoveDiagonal` · `LuFrame` · `LuPalette` · `LuHammer` · `LuDoorClosed` · `LuArrowUp` |
| Inspector | Fons en ranura · Cargolat darrere · Encastat · Sense fons | `LuLayers2` · `LuDrill` · `LuInspectionPanel` · `LuSquareDashed` |
| Inspector | Resum del moble · Posició | `LuBox` · `LuMove` |
| Inspector | Anterior · Següent · Accions de la selecció (menú) | `LuChevronLeft` · `LuChevronRight` · `LuEllipsis` |
| Preferències | Tema (dia/nit/sistema) · Color principal | `LuSunMoon` (`LuSun` · `LuMoon` · `LuMonitor`) · `LuCheck` a la mostra triada |
| Preferències | Visualització · Ferratges (i Fusteria a l'inspector) · Calaixos · System 32 · Cassoleta · Imants | `LuScanEye` · `LuHammer` · `LuArchive` · `LuCircleDot` · `LuCircleDashed` · `LuMagnet` |
| Preferències | Visor 3D (els materials per defecte als mòduls nous porten la de Materials, `LuPalette`) | `LuLampFloor` |
| Fitxer | Desar com a fitxer · Obrir fitxer · Pujar un fitxer (preferències, model `.glb`) | `LuSave` · `LuFolderOpen` · `LuUpload` |
| Editor | Estructura · Propietats · Opcions de vista | `LuListTree` · `LuSlidersHorizontal` · `LuSlidersVertical` |
| Editor | Pestanyes 3D · Alçat · Foto | `LuBox` · `LuLayoutPanelLeft` · `LuCamera` |
| Estat | Avisos de fusteria · Desfer · Refer | `LuTriangleAlert` · `LuUndo2` · `LuRedo2` |
| Foto | Foto · Referència · Distància · Rectangle | `LuCamera` · `LuCrosshair` · `LuMoveHorizontal` · `LuRectangleHorizontal` |
| Foto | Origen (0,0) · Treure/tancar · Eines | `LuLocateFixed` · `LuX` · `LuPencilLine` |
| Foto | Mida estimada · Mida real (cinta) · Línia del terra · Fondària | `LuEye` · `LuCircleCheck` · `LuArrowDownToLine` · `LuArrowUpFromLine` |
| Visor | Modes Per peça · Textura · Presentació | `LuShapes` · `LuTrees` · `LuSparkles` |
| Visor | Enquadrar · Forats · Explosionat / muntat · Ferratges · Render · Veure a casa (AR) | `LuVideo` · `LuCircleDot` · `LuExpand` / `LuShrink` · `LuWrench` · `LuAperture` · `LuView` |
| Visor | Ampliar / reduir 3D · Obertura portes · Imatge | `LuMaximize2` / `LuMinimize2` · `LuDoorOpen` · `LuImageDown` |
| Ambients | Seleccionar · Paret (ploma) · Habitació · Calibrar · Plànol de fons | `LuMousePointer2` · `LuPenTool` · `LuBrickWall` · `LuPencilRuler` · `LuImageUp` |
| Ambients | Finestra · Porta · Moure a un grup · Grup (carpeta) · Projectes | `LuAppWindow` · `LuDoorOpen` · `LuFolderInput` · `LuFolder` · `LuFolders` |
| Ambients | Moble · Objecte / bloc · Pestanyes Plànol · 3D · Girar · Peces (plànol) · Interior | `LuBox` · `LuSofa` · `LuMap` · `LuRotate3D` · `LuRotateCw` / `LuRotateCcw` · `LuLayers` · `LuEye` |
| Galeries | Historial · Catàleg · Col·leccions de mobles | `LuHistory` · `LuBookOpen` · `LuLibrary` |
| Exportar | DXF (CNC) · STEP 3D · CSV de nesting · CSV de peces · GLB · Avançat | `LuScissors` · `LuCuboid` · `LuLayoutGrid` · `LuFileDown` · `LuBoxes` · `LuSettings2` |
| Materials | Categories de la llista: Taulers · Fons · Simulació | `LuLayers3` · `LuLayers2` · `LuSprayCan` |
| Màquines | Màquina CNC (pàgina, grups del detall i export Maestro) · Per defecte · Triar carpeta… · Triar fitxers… | `LuFactory` · `LuStar` · `LuFolderOpen` · `LuFileUp` |
| Màquines | Regles de mecanitzat · Distribució dels taulers (girar peces) · Vista CAM | `LuRoute` · `LuRotateCw` · `LuMonitorCog` |
| Materials | Posar una foto / mapa (relleu, brillantor) · Carregar joc de textures… · Carpeta… | `LuImagePlus` · `LuFileUp` · `LuFolderOpen` |

Les vistes Davant, Darrere, Esquerra, Dreta i Dalt van amb **text**, sense icona. Compte: a Lucide, `square-split-horizontal`
té la línia **vertical**. Per això és la de "dividir en vertical".

## Com treballar
- Abans de codi nou al `core/`, escriu o actualitza els tests (Vitest). Canvis de fabricació: proves d'or (vegeu Fabricació).
- Canvis petits i verificables. Després de cada fase han de passar `pnpm typecheck`, `pnpm lint` (0 errors), `pnpm test` i
  `pnpm build`.
- No afegeixis dependències fora del stack sense preguntar.

## Ordres
```bash
pnpm dev         # servidor de desenvolupament
pnpm build       # build de producció + service worker
pnpm test        # vitest (UPDATE_GOLDEN=1 per refer les proves d'or)
pnpm typecheck   # tsc --noEmit
pnpm lint        # oxlint
```

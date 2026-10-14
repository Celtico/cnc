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
- [`docs/prompt/PROMPT-fitxer-moble.md`](docs/prompt/PROMPT-fitxer-moble.md): **desar i obrir mobles com a fitxer `.moble`**;
  [`docs/millores-v1/ambients-fitxer.md`](docs/millores-v1/ambients-fitxer.md): el `.ambient` (estudi i el que s'ha fet).
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
- [`docs/ferratges-import.md`](docs/ferratges-import.md): **(adormit des del 2026-10-08: sense UI, vegeu Preferències ›
  Ferratges)** **importar ferratges del fabricant (Hettich i, §10, Blum)**: estructura de les
  descàrregues, lectors STEP i DXF, proposta de forats, confirmació i col·locació al moble (frontissa + placa, tirador,
  pota; la resta «només 3D»; sense STEP, «només 2D»), tornar a importar (s'amplia l'article, mai es toca un mecanitzat
  confirmat), noms i sèries, el pla del que falta (Cadro, portes corredisses i plegables, taules) i, §8, el **generador
  de mecanitzats**, els **ferratges col·locats a mà**, les capes de mecanitzat dels DXF per peça i **«Com exportar des de
  TopSolid»** (per al germà). §10: **Blum** (E-SERVICES: STEP + «Esquemas de taladrado» en Xilog `*.pgm`).
- [`docs/millores-v1/coherencia-editor.md`](docs/millores-v1/coherencia-editor.md): **auditoria de coherència** de l'editor
  i del sistema de ferratges (avisos i estat amagat, accessoris com a ferratges, un sol lloc per a cada dada, glossari,
  estructura dels inspectors) i l'estat de cada punt.
- [`docs/xat-ia.md`](docs/xat-ia.md): **assistent IA** (xat de l'Editor —mobles i objectes— i dels Ambients amb l'API de
  Claude): fets de l'API comprovats a la documentació (models, navegador, eines, imatges, streaming), les fases 1 i 1b fetes
  i les fases 2 i 4 pendents.
- [`docs/ferratges-jocs.md`](docs/ferratges-jocs.md): **jocs de ferratges paramètrics** llegits del catàleg en PDF (el camí
  principal a partir d'ara): el model `HardwareKit`, els calaixos de doble paret DTC (MAGIC-PRO, MAGIC-STAR ULTRA,
  DRAGON-PRO, PURE-PRO HK i HQ, PURE-BOX HL; catàleg 2026 a `docs/2026 DTC Home and Furniture Fittings Catalogue.pdf`),
  **la resta del catàleg DTC** (frontisses i plaques, guies, suports de prestatge: què és cada item a l'app; el que es
  va deixar fora i per què; les cotes del push latch per al taller), com es construeix, com s'afegeix un joc nou, les
  hipòtesis de lectura pendents del taller i, §Llums, els **jocs de llum Häfele Loox 24 V** (catàleg general Häfele
  `docs/blaetterkatalog.pdf`, no es puja al repo): làmpades encastades amb el mecanitzat i la comanda elèctrica.

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
- **occt-import-js** (OpenCascade en WASM, ~7,6 MB; aprovat per l'usuari el 2026-10-06): només per fer el 3D dels STEP
  dels ferratges importats, **a demanda** (`import()` en un worker, `viewer/occtWorker.ts`); el WASM no es precacheja.
- **`@anthropic-ai/sdk`** (aprovat per l'usuari el 2026-10-09 per a l'assistent IA, `docs/xat-ia.md`): el navegador crida
  l'API de Claude amb la clau de l'usuari (Preferències › Assistent IA, `dangerouslyAllowBrowser`). **A demanda**
  (`import()` a `features/assistant/claudeClient.ts`, en obrir el xat o provar la clau): no és al bloc d'entrada.
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
    file/          # fitxers .moble i .ambient, zip
    import/        # ferratges del fabricant: lector STEP (cilindres) i DXF (vistes 2D), Hettich, proposta de forats
    photo/         # homografia, calibració amb referència, EXIF
    assistant/     # assistent IA: un joc d'eines per document (moble, objecte, ambient; zod), resums, instruccions
  features/        # pantalles: projects (Mobles), editor, composition (arbre i inspectors), cutlist (Peces), nesting,
                   #   export, photo, ambients, objects, settings, file
  components/      # mòduls compartits (Workspace, TopBar, FormRow, MasterDetail, Fold…)
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
- **Tipus de moble** (`Composition.kind`, `compositionKind`, `features/composition/kinds.ts`; per decisió de l'usuari,
  **sense selector «Tipus»**): ve de la plantilla i no canvia; «+ Nou moble» crea
  directament un moble del tipus Moble (`blankMoble("moble")`, **buit**: cap mòdul; per decisió de l'usuari, sense menú de
  tipus; `NEW_MOBLE_KINDS` queda sense UI). Només decideix l'etiqueta de la targeta i la cerca, i a la
  Taula «Afegir mòdul» fa un `tableModule` (tauler + dos laterals de panell, sense base ni fons, cantonades a inglet; el
  Taula nova comença buida com les altres). Els antics: cuina si tenen `runs`, si no moble. Objecte (`objecte`, vegeu Objectes). **`lliure`**
  (el Flat-pack d'abans, «Peces lliures» a la targeta): ja no es crea; els que hi ha (i els llits, capçals i taules de pedra
  del catàleg) continuen igual: no es fan mòduls (es guarden) i l'arbre només mostra peces i objectes.
  **Mobles amb 0 mòduls** (per decisió de l'usuari: «a Moble nou que no fiqui res»): un moble nou (tots els tipus), un
  objecte nou i el moble del qual s'ha eliminat l'últim mòdul no en tenen cap. L'Editor hi treballa igual: el mòdul de
  treball és opcional (sense, la selecció és el moble i el seu inspector), el visor enquadra una escena buida de
  1200 × 900 × 600 (`EMPTY_STAGE`, `isEmptyComposition`) i s'hi pot orbitar, l'Alçat diu com començar, «Materials de tot el moble»
  només surt amb mòduls, la targeta diu «Buit» i una miniatura d'abans es treu.
  `readComposition` ja no hi posa el mòdul de caixa antic. Construcció, llistat, nesting, exports i `.moble` amb 0 mòduls:
  `build/emptyComposition.test.ts`. Pendent (fase 2 de `docs/millores-v1/mobles-peces.md` §3): convertir els `lliure` d'abans
  en `moble` sense mòduls.
- **Sense mòduls especials** (per decisió de l'usuari: la caixa es configura a l'inspector). Queden al codi sense UI els de
  `core/model/modulePresets.ts` (`modulePresetsFor`: cuina —baixos de calaixos, porta, fregadera, fogons, forn; columnes forn i rebost; alts porta i
  abatible—, armari —prestatges, penjador amb maleter, calaixos i prestatges—, taula —consola, menjador, centre, banc, «Taula
  oval»—; al Moble, les plantilles d'un sol mòdul).
- **Posició: dues files, com a les cuines** — *A terra* (baixos) i *Penjats a la paret* (`base.kind = "wall"` amb l'alçada
  des del terra). Dins de cada fila l'ordre és el de l'arbre i cada mòdul va al costat de l'anterior amb `gapBefore`. Posició
  sempre amb `modulePlacements()` / `compositionWidth/Height`, mai a mà. Els `anchor` antics es converteixen en carregar
  (`normalizeComposition`). Tres muntatges (`mountOf`): **Arrambat a la paret**, **Penjat** i **Lliure al terra** (`Module.wallGap`
  = separació de la paret, i **X pròpia** `Module.x`/`freeX`: surt de la fila i no empeny els altres, p. ex. una illa; camp
  «De costat (X)»). Els antics «Al terra» sense `x` continuen a la fila. **Girat 180°** (`Module.turned`, `isTurned`; només lliure al terra; Mòdul › Posició «Girat»; per decisió de l'usuari, 2026-10-13, per fer una illa amb dos mòduls d'esquena): el mòdul es construeix igual i `buildComposition` el gira al voltant del centre de la caixa de les seves peces (ocupa el mateix lloc; `CompositionBuild.modules[].mirrorX`, `moduleWorldX` per al clic i el ressaltat dels compartiments); l'obertura del 3D surt enrere (`opening.ts`, per l'`explodeDir`). Tests `build/turnedModule.test.ts`, `viewer/openingTurned.test.ts`. Taulell i sòcol correguts no tenen en compte `wallGap`.
- **Carcassa** (inspector del mòdul, secció Caixa):
  - **Base**: a terra · sòcol · potes · sense base. Avís `hanging` si un penjat té el fons prim. Amb potes, **«Sòcol ·
    Davant de les potes»** (`Base.plinth.setback`, per decisió de l'usuari, 2026-10-14; `buildLegPlinth`): un tauler del
    gruix i material del cos, de tota l'amplada del mòdul, de terra fins a 5 mm sota la base (l'alçada del sòcol AXILO =
    H − 5), a «Retirada del sòcol» del davant (en encendre'l: el peu de la pota del davant just darrere amb 5 mm de joc);
    avís `hardware` si toca el peu; es fixa amb els clips de sòcol a mà (sense mecanitzat). Test `build/legPlinth.test.ts`. Amb potes, «Pota»:
    les genèriques (només es veuen) o una pota de la biblioteca (`Base.hardware`, còpia): forats de la placa a la cara de
    sota de la base a cada pota (`buildLegs`; una d'importada, només confirmada). Del catàleg: **Häfele AXILO 78 amb la
    placa rectangular per cargolar** (`core/model/hafele/hafeleLegs.ts`, 637.76.333, p. FF 11.79; preferències v34, i v37
    com la munta el taller al TopSolid del germà): el costat llarg al llarg de l'amplada i el clip cap al lateral, l'eix a 48
    dels laterals, a 53 del darrere i a 83 del davant, on va el sòcol: la **de cuina** (per decisió de l'usuari: la del plànol
    a escala `docs/pota-axilo-planta.svg`, mesurada al 3D del taller); una segona, **«· moble»**
    (`leg-hafele-axilo78-screw-moble`, preferències v39), igual amb el davant **per confirmar** (de moment 53, com el
    darrere). Una distància per a cada costat (`insetLeft`, `insetRight`, `insetBack`, `insetFront`; a Preferències
    «Lateral esquerre / dret · Darrere · Davant»; `legSpec()`, `buildLegs`, `hardwarePreview`); el del davant es pot
    canviar per mòdul a Mòdul › Caixa, «Potes al davant», sota la «Pota» (la còpia del mòdul; per petició del taller); 4 prebroques Ø3 × 10 (hipòtesi) a u = −19 / +45, v = ±32 de l'eix; les potes de la dreta en mirall
    (`params.mirror` = 1, `legSpec().mirror`, `buildLegs`). El tub per l'alçada, a les notes de l'item. **Al 3D** (v38):
    sense model importat, `buildLegs` posa a la base un `Panel.fittings` `kind: "leg"` amb `leg` (la placa de l'item,
    `plateU0`/`plateU1`/`plateV`/`plateH`, en mirall a la dreta; l'alçada de la base «Potes»; el peu) i `legSolids`
    (`hardwareSolids.ts`) en dibuixa, com al TopSolid del taller, la part fixa (els dos blocs dels extrems contra la base, el pont del mig, la llosa amb els caps dels 4 cargols i la pestanya del clip) i la mòbil (tub Ø36, cargol del regulador Ø24, plat Ø48 i peu Ø78), amb corbes: cantonades arrodonides (`HwBox.round`) i arestes dels cilindres (`HwCylinder.fillet`; geometries a mida, `roundedBox` / `filletCylinder` a `hardwareShapes.ts`) (visor amb «Ferratges», «Com va muntat» i
    miniatures; sense les genèriques; tot de plàstic negre; com les genèriques, **també al render**: `HwSolid.render`, fora del grup `editorOnly`). A «Com va muntat», el lliscador «Regulació» fa sortir la part
    mòbil fins a +20 (`LEG_ADJUST`, `HardwareMount3D`). Test `build/hafeleLegs.test.ts`.
  - **Fons** (`Carcass.back`): en ranura · cargolat darrere · **encastat** · sense. Encastat (`buildInsetBack`): ocupa la
    llum interior (on falta una peça, fins a fora; parets buides: entre les pells de dins), enrasat o retirat
    `backInsetSetback` (Caixa, «Retirada del fons»); pot ser del tauler del cos (veta vertical, cantell només on no toca
    res). S'uneix com un prestatge fix: 3 espigues per costat (`threeAlong`, `endOffset`) a laterals, base i tapa (no al
    tauler de taula ni on la tapa amb ranura d'aire no arriba); amb menys de 15 mm, sense espigues i avís `back-inset`
    (cargolar-lo). L'interior comença a `backInnerZ` = retirada + gruix; la filera System 32 de darrere es mesura des del
    darrere del fons però mai dins (`max(retirada + 37, backInnerZ + Ø)`); si arribaria a la de davant, no es fa. Més avisos
    `back-inset`: poca fondària davant del fons (< 2 × 37 + Ø) i, amb ranura d'aire, menys de 10 mm entre fons i tapa (el
    cantell de dalt del fons, si és del cos, es canteja). Tapa de reixeta: la franja del fons queda sense ranures. Passar a
    «Encastat» amb un fons de menys de 15 mm el posa «Com el cos».
  - **Cantonades** Normals / A inglet (`Carcass.joint`): la tapa arriba a fora dels laterals; la base també (`mitreBottom`)
    si és a baix de tot (a terra, potes o penjat; amb sòcol no). No surt si no hi ha res a unir (`jointApplies`). Si el
    mòdul només té calaixos i fronts recobrents, **els fronts dels calaixos van a inglet** (`mitreFronts`): laterals fins a
    la cara dels fronts amb el cantell de davant a 45°, fronts de fora a fora, el primer i l'últim també amb tapa i base;
    amb portes no (toparien en obrir). La caixa del calaix queda sempre dins de la llum. El tall a 45° és un post-procés
    (el nesting talla el rectangle). `mitreGeometry` (qualsevol dels 4 cantells), `Panel.mitres` (sense cantell ni espigues,
    avís informatiu), capa DXF `MITRE_45`, «n∠45°» al llistat i al CSV, trapezi al 3D/GLB, 45° al STEP. **Espigues**:
    la tapa i la base a inglet no en porten (s'encolen amb lamel·les o Clamex, avís `mitre`); les de divisors, prestatges
    fixos, fons encastat i una base amb sòcol sí. `carcassDowels` (`core/model/usedHardware.ts`) diu on n'hi ha: un
    mòdul tot a inglet sense divisions ni fons encastat no ensenya la secció **Unió** (l'Espiga; `frontsInspector.test.ts`).
  - **Fronts** Recobrents / Encastats (`fronts.style`; s'edita a Mòdul › Caixa, «Estil dels fronts», al final, després de
    les Cantonades; sense cap front no surt ni compta, `visibleModule`): encastats dins de la llum amb la folgança a tot el voltant, a nivell amb
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
- **Zones** (compartiments): divisions verticals/horitzontals amb mides fixes o «auto» (l'últim «auto» agafa el que sobra;
  a l'editor, l'última zona sempre és el que sobra;
  la mida de cada fill es decideix a la Divisió del pare, no al compartiment: vegeu Editor › Propietats);
  contingut obert, prestatges, porta, calaixos, abatible, reixeta o front fix.
  - **Què aguanta cada compartiment** (`core/model/zoneSupport.ts`, `zoneBoundsMap`; per decisió de l'usuari: en un mòdul
    sense caixa «no són possibles les opcions de prestatges ni accessoris ni Dividir»): a cada costat hi ha una peça si és
    la caixa (lateral; base, menys «Sense base»; tapa, menys «Sense tapa») o un divisor d'una divisió de més amunt (la
    mateixa geometria que `derive`/`layoutZones`/`findLeft…`). **Prestatges** (també les fileres dels regulables) i
    **Accessoris** (barra, llum): una peça a cada costat (`canHoldShelves`); sense, `visibleZone` no els fa (res amagat
    compta: cap prestatge flotant, es conserven i tornen amb els laterals) i no surten. **Dividir**: només les direccions
    on el divisor té on unir-se (`splitDirsFor`: el vertical, a sota i a sobre; el travesser, als dos costats; cap, la
    secció no surt; una divisió que ja hi és es pot treure sempre). **Contingut** (`canHoldFront`): un front (porta,
    calaixos, abatible, reixeta, front fix) només amb el compartiment **aguantat pels quatre costats** (`frontHeld`:
    lateral o divisor a esquerra i dreta, peça a sota i a sobre; els travessers i divisors de dins sempre compten). Per
    decisió de l'usuari («si no té tapa o no té base, es queda com està»), la tapa o la base que el mòdul no té («Sense
    tapa», «Sense base»; `ZoneBounds.noTop/noBase`, només als compartiments de la vora) compten com a aguantades: a la
    pràctica, a sota i a sobre sempre ho són i manen els costats. A sobre, les regles de cada tipus (calaixos, «Dues»
    portes, el costat de les frontisses, la reixeta amb frontisses). Els que no hi poden anar no surten (el triat sí) i
    l'ajuda diu per què (`frontLimitsHelp`; del triat, que no es fa). Res amagat compta: `visibleZone` fa el
    compartiment com obert (el front es conserva, no tapa els de dins i torna amb la peça). Tests
    `model/zoneSupport.test.ts` i `build/hiddenState.test.ts`.
  - **Peces de dins** (`Carcass.innerClearance`, 0–3 mm; per decisió de l'usuari: «no ha de comptar el nivell de divisió,
    ja sigui horitzontal o vertical; només a partir del primer nivell de la divisió, i només a les peces de divisió interior
    1 mm menys»): si l'**arrel del mòdul és dividida**, **tots** els divisors i prestatges fixos (de qualsevol nivell,
    també els de la divisió de l'arrel, horitzontal o vertical, i els prestatges sense «Regulables» dels compartiments,
    també els gruixuts) es fan tants mm més curts de llarg, la meitat a cada cap i **centrats** (`Builder.innerGap`,
    `hasInnerPieces`, `endGap` a les refs): els forats de cara de les peces del voltant no es mouen i l'espiga de cantell
    va al cantell nou, a la mateixa línia (`dowelJoint(…, buttShift)`; tot o res igual). Un mòdul **sense dividir**: els
    prestatges fixos van sencers entre la caixa; la **caixa**, mai; els regulables, mai aquesta (ja porten la folgança
    del prestatge). Els prestatges fixos d'un mòdul dividit porten les dues (la del prestatge i aquesta: 2 mm amb els
    valors inicials, confirmat per l'usuari). Sense el camp (mòduls d'abans): 0, la fabricació no canvia; els mòduls
    nous (`applySettingsToModule`) i les plantilles instanciades (`withInnerClearance`: catàleg, col·leccions, escenes)
    prenen el de Preferències. Es posa a l'**Interior › Divisió** («Peces de dins», amb «Com a Preferències»), només
    amb l'arrel dividida (`moduleHasInnerPieces`; res amagat compta). Tests `build/innerClearance.test.ts`, moble fix
    `inner-clearance` del corpus de les proves d'or.
  - **Front fix ⇒ ni Prestatges ni Accessoris** (per decisió de l'usuari): un compartiment el contingut del qual és
    «Front fix» (el seu, no tapat) no ensenya Prestatges ni Accessoris (`ZonePanel`, `fillsZone`, com els calaixos) i
    `visibleZone` no hi fa prestatges, fileres System 32, barra ni llum (res amagat compta: es conserven i tornen en
    canviar el contingut; `build/hiddenState.test.ts`). El mateix per al **front fix d'una zona dividida** (`buildParentFront`,
    `fixedCover`, `ZonePanel` `coveredByFixed`; la regla es queda al codi): els compartiments que tapa no farien prestatges,
    fileres, pells ni accessoris. Però des del 2026-10-08 aquest front ja **no es fa** (vegeu Front d'una zona dividida): la
    regla no s'aplica a cap moble. Les **portes** de tot el mòdul, no: darrere hi ha prestatges i penjador (armari).
  - **Prestatges gruixuts** (`zone.shelves.thickness`, «Gruixuts (buits)»): pells, tira i llistons. **A ras del davant**
    (`zone.shelves.flush`); amb fronts encastats, només als compartiments sense front (si no, es retiren i avisa).
  - **Front d'una zona dividida** (`buildParentFront`; portes d'armari de dalt a baix amb penjador i maleter darrere): les
    fulles de sota queden `covered`. Per decisió de l'usuari (2026-10-08: «el Front de tota la zona no té sentit que surti a
    totes les divisions; només si es tria una opció de portes»), **només l'arrel i només portes**: les **portes de tot el
    mòdul** (tots els armaris del catàleg) són el front de l'arrel dividida i es trien a **Mòdul › Portes** (`ModuleDoorsSection`,
    `UI_PATHS.doors`): Cap · Una · Dues i les opcions de la porta (`FrontFields` sense la fila «Portes»: frontisses, vidre i
    marc, frontissa, filera System 32 si li toca, tirador), amb la regla dels quatre costats (`canHoldFront` de l'arrel). Un
    mòdul sense dividir fa servir el Front del compartiment (l'«Interior»). Cap zona dividida (ni l'Interior ni les de dins)
    no té Front a l'inspector. Res amagat compta: el **front fix de tota la zona** de l'arrel i **qualsevol front d'una
    divisió de dins** (dades d'abans) no es fan (`visibleZone`; es conserven, no tapen els de dins, que sí es fan; a
    Portes surt «Cap»). Cap plantilla del catàleg no en tenia (proves d'or del catàleg idèntiques); al corpus aleatori, 11
    llavors amb portes en una divisió de dins canvien (`UPDATE_GOLDEN=1` revisat: sense aquella porta, es fan els fronts de
    dins). Tests `build/hiddenState.test.ts`, `composition/zoneLabel.test.ts`.
  - **Accessoris del compartiment** (a la secció «Prestatges i accessoris» del compartiment, a sota dels prestatges: per
    decisió de l'usuari, 2026-10-13, abans una secció pròpia «Accessoris» amb `LuShirt`; auditoria de coherència B,
    `docs/millores-v1/coherencia-editor.md`): la barra i la llum són **ferratges** de la biblioteca (motors `rail` i
    `ledProfile`, categories «Penjar» i «Llums» —els perfils de LED, a «Llums» des de la v40, no a «Perfils i marcs»—), no interruptors de fusta. `Zone.rail` / `Zone.led` =
    `{ hardware?: HardwareItem }` (`ZoneAccessory`: hi és amb el del mòdul, «Com el mòdul», o amb una còpia pròpia; els
    `true`/`false` d'abans es llegeixen com a `{}` / cap). El mòdul en porta el per defecte als llocs opcionals
    `Module.hardware.rail/led/glassFrame` (`ACCESSORY_SLOTS`; sense, l'item d'inici, `moduleSlotItem`).
    - **Barra de penjar** (item d'inici `rail-inox-25`: Ø25 a 50 mm del sostre, `railSpec`): tub d'inox de lateral a
      lateral; va a `ModuleBuild.extras` → «Elements sense nesting». Avís `rail` si el compartiment fa menys de 900 mm.
      Sense mecanitzat (suports: pendent del taller, ho diu el `label` del target).
    - **Tira LED** (item `led-profile-16x8`: perfil de 16 × 8 a 20 mm del davant, `ledSpec`; per decisió de l'usuari,
      com les fotos de catàleg): perfil amb tira LED sota el sostre del compartiment i sota cada prestatge (`buildLed`,
      `buildShelves` torna on és cada prestatge); `extras` (no és de CNC: «Elements sense nesting», amb el llarg per
      tallar el perfil), material «Tira LED» (`LED_MATERIALS`, `glow` 60, càlid; v14 de les preferències). Res amagat
      compta: amb calaixos, front fix o dividit, cap tira (`visibleZone`). Encara sense mecanitzat (ranura per al perfil: pendent
      del taller). La vitrina «Galeria» del catàleg (Saló) en porta (`led.test.ts`).
    - **Jocs de llum** (`HardwareItem.light`, `core/model/lightKit.ts`, items Häfele Loox a `core/model/lights/hafeleLoox.ts`,
      categoria «Llums»; per decisió de l'usuari, 2026-10-13: «munta tot lo que es pugui mecanitzar i els seus
      accessoris per connectar a la xarxa elèctrica»; `docs/ferratges-jocs.md` §Llums): al mateix lloc «Llum», una
      làmpada del catàleg en lloc del perfil: `buildLights` fa a la peça de sobre (tapa, travesser o prestatge, cara de
      sota) el **forat Ø55/Ø60 × 12** (`Hole`, tag `light`; al Maestro, sense broca del Ø, caixera rodona amb la fresa),
      el **rebaix de 205 × 205** o la **ranura 16 × 11 de la barra** (`Groove`) i el **passant Ø8 del cable**
      (`Cutout`, tag `cable`), una cada «Entre llums» (`spacing`) a «Del davant»; tauler massa prim o sense lloc → la
      caixa de sobreposar i avís `light`; el cos a `extras` (`light-…`, «Tira LED»). **Interruptor** un per mòdul: sensor
      de porta amb forat Ø12 × 47 al cantell de davant del lateral esquerre (`light-switch`) si hi ha portes recobrents,
      si no de proximitat. **Comanda per mòdul** (`ModuleBuild.lightKits`, `core/build/lightOrders.ts`,
      `electricalLines`: alimentador 20/40/90 W amb cable EU per la potència amb el pic en encendre, distribuïdor de 6
      vies passades les 6 ranures, interruptor + cable, nota dels cables d'extensió) a Peces › «Llums i instal·lació
      elèctrica» i al LLEGEIX-ME de Maestro. Preferències **v31** (additiu, `V31_ITEMS`); `hardwareParams` amaga «Entre
      llums» i «Rebaix» al perfil de l'app. Tests `build/lightKit.test.ts`.
  - **Porta de vidre** (`front.glass` d'una porta, «Vitrina» › «Porta de vidre amb marc»; per decisió de l'usuari, com les
    vitrines de catàleg): el **marc** és un ferratge (motor `glassFrame`, item `glass-frame-20`: perfil de 20, vidre de
    5; `front.frame` còpia pròpia o el del mòdul, fila «Marc» sota «Vitrina»): `glassDoor` posa a `extras` els 4
    perfils d'alumini (gruix del tauler; del material del marc, `HardwareItem.material`: negre el de l'app, plata anoditzat els Häfele) i el vidre (entra 5 mm al marc): no hi ha tauler de CNC ni cassoletes ni
    tirador. Res amagat compta: sense `glass`, ni la clau ni el marc no hi són (`visibleZone`). El marc de l'app no
    mecanitza res; els **marcs d'alumini Häfele** (23 × 14, 38 × 14, 26 × 14 de marc reduït i 20,6 × 19; preferències
    v35, `core/model/hafele/hafeleCatalog.ts`) són només el perfil; **la frontissa i el tirador es trien com a les portes de
    fusta** (per decisió de l'usuari, v41): la frontissa de perfil **Metallamat A** (`hinge-hafele-metallamat-a`) porta la
    **placa en creu** (316.51.526) al lateral de les frontisses (la placa de la frontissa triada, `cupSpec().plate`; `glassHinges` a `buildModule`: la quantitat per
    alçada, a `endOffset` dels extrems i al mig de dos forats seguits de la filera; dos forats Ø5 × 12 a ±16 a 37 del
    davant, `plateHoles`/`addPlate`, tota o res; els que cauen a la filera passen a ser de la placa, tag `plate`). **Tot es veu** (per decisió de l'usuari, 2026-10-14: «aquí igual s'ha de veure tot»): a cada frontissa col·locada, el cos de la frontissa al perfil i la placa al lateral, el tirador (`glassPull`, el llarg del `pitch` + 25) i, a l'abatible de vidre, un braç a cada lateral (`glassHingeBody`, `glassArm`, `hwBox`: `extras` rol `hardware`, al 3D i al render; no són de CNC). **Tiradors de vitrina Häfele** (v42, `HAFELE_GLASS_PULLS`: 563.25.995 plata i 563.25.095 inox; motor `barHandle` sense forats, es claven al perfil) es trien al «Tirador». Test
    `build/hafeleCatalog.test.ts`.
  - **Abatible de vidre** (`front.glass` d'un abatible, «Vitrina» › «Abatible de vidre amb marc»; per decisió de l'usuari,
    2026-10-14, com la porta de vidre): el marc triat (`front.frame`, fila «Marc») i el vidre a `extras` (`glassDoor` sense
    plaques de frontissa); el braç i el tirador es trien igual, però van al perfil (el braç amb l'adaptador Häfele
    563.25.960): cap abatible de tauler ni forats al tauler (pendent: el cos del braç al lateral i les frontisses de dalt).
    Res amagat compta: sense `glass`, el marc no compta.
    Test a `build/led.test.ts`.
  - **Tiradors mecanitzats**: portes (costat contrari de les frontisses, a mitja alçada), calaixos (centrats) i abatibles
    (al cantell que obre): dos forats passants Ø5 a 128 / 96 / 64 com a talls `circle` `tag: "handle"` (el taller els llegeix
    com els passacables); el 3D no els buida (`visualPanel`) i hi col·loca el tirador. **Una sola font** (auditoria C2):
    el «Tirador» de cada front (`front.handle`, `FrontHandle`) és el del mòdul (res), una còpia d'un item (un d'importat
    confirmat fa els forats a la distància del fitxer, vegeu Ferratges importats) o **«Cap (push)»** (`"none"`: cap
    forat, `Panel.push`, avís `push`). El del mòdul (`module.hardware.handle`, o «Cap (push)» =
    `fronts.handles: "none"`) és només el **per defecte** que hereten els fronts «Com el mòdul» (sense UI des del
    2026-10-08: es tria a cada front); el del front mana. Als calaixos amb joc, el **tancament del
    joc** mana (`isPushClosing`): push-open ⇒ cap tirador i cap Tip-On (la guia ja porta el push: sense `Panel.push`, ni
    post-procés ni 3D ni l'avís `push`; nota al Tirador); triar «Cap (push)» posa
    el joc a push i triar un tirador el torna a suau (`kitClosingFor`).
  - **Calaixos amb joc paramètric** (`docs/ferratges-jocs.md`; per decisió de l'usuari, el model dels ferratges a partir
    d'ara: el **joc** del fabricant llegit del catàleg, no un STEP): a Front › **Guia** es pot triar, en lloc de la guia,
    un joc de **calaix de doble paret** (DTC MAGIC-PRO N/M/K/C/F, MAGIC-STAR ULTRA M/K/C/F, DRAGON-PRO M/B/D/C/F i
    PURE-PRO HK M/K/C, `HardwareItem.kit`, motor `drawerKit`), amb
    **Tancament** (suau · push-open · push + suau, els que ven cada joc), **Darrere** (fusta · metàl·lic) i **Acabat** dels
    laterals (blanc seda · gris mat · negre mat, els del joc; només el color del 3D) (`Front.kit`; res amagat compta: amb una guia normal no es llegeixen). El joc també
    pot ser la **«Guia de calaix» del mòdul** (`module.hardware.slide`, sense UI des del 2026-10-08; `slotAccepts`, `slotSpec` el
    deixa passar amb l'item = el joc): tots els calaixos sense guia pròpia es fan amb el joc, igual que triat al front (el
    front hi llegeix les opcions, «Com el mòdul (joc de calaix)» al selector). El gruix del fons el **demana el joc** (16,
    `TB`): la fitxa del calaix el mostra fix («Fons del calaix: el joc demana 16 mm»), res a triar ni suggerir; el
    material és el de Materials › «Fons del calaix» (`drawerBottomMaterial`; sense, el del fons del mòdul adaptat al
    gruix, o el del cos si fa `TB`). El joc s'adapta al moble (NL = la més gran amb NL + 3 ≤ fondària darrere del front;
    estabilitzador i barra de sincronització per KB = LW + 32) i la fusta s'adapta al joc: **cap lateral de fusta**; fons A
    (LW − 19 × NL − 29, o NL − 27 amb darrere metàl·lic, gruix del joc: 16, material del fons dels calaixos) i darrere B
    (LW − 40 × 63 a la M, tauler del cos). Mecanitzats: **prebroques Ø2 × 10** dels cargols de la guia als dos laterals del
    moble (mirall, a les columnes de cada NL), dels suports de davant al darrere del front i dels de darrere al darrere.
    Els components (guies, laterals de doble paret, suports, darrere metàl·lic, barra tallada a LW − 167 / LW − 238) van
    a `extras` com a peces de només veure (rol `hardware`; surten amb el calaix llevat del **cos de la guia**, fix al
    lateral del moble: `kitfix-`, acer fosc; la guia és telescòpica, un sol article amb el cos fix i la **corredora** que
    surt sota el lateral, `KitShape.mount` / `material`) i la **comanda** amb els números del
    catàleg a `build.hardwareKits` (Peces › «Ferratges dels jocs», LLEGEIX-ME de Maestro, fitxa «Joc» de l'inspector).
    Tot o res per calaix (sense NL, sense lateral o sense alçada: només el front i avís `hardware`). Les alçades de les
    fileres de cargols i la posició vertical del joc són **hipòtesis** del catàleg (`hypotheses`, a l'editor del joc).
- **Illes** (`Composition.islands`, `IslandSchema`, `core/build/islands.ts`; per decisió de l'usuari, 2026-10-13: «les
  opcions que diuen els professionals»: dues files de mòduls d'esquena cargolades, fronts enrasats, remats als costats):
  **sense UI des del 2026-10-13** (per decisió de l'usuari: «treu l'opció illa, això és més fàcil amb peces lliures»;
  treure ≠ esborrar: les que hi ha es conserven i es fabriquen igual; `IslandsForm` es queda sense ús). Era la secció
  «Illes» del moble (amb ≥ 2 mòduls). Davant · Darrere (tots dos
  «Lliure al terra»; «Afegir illa» els hi posa), «Pas de cables» (`gap`), Remat esquerre / dret, gruix (19) i material
  («Com els fronts»). El de darrere es gira 180° i es posa sol a la mateixa X, enganxat al darrere del de davant
  (`buildComposition`; la seva Posició no compta i ho diu); avís `layout` si passaria per darrere de la paret. Els
  **panells de remat** (`islandEndPanels`, rol `side`, «remat e/d») són d'una sola peça de dalt a baix i del darrere al
  davant de les dues files, amb cantell als tres costats vistos; un «mòdul» més per a les refs (després de taulell i
  sòcol). Avís informatiu `island` (es cargolen entre elles, sense forats automàtics). Una illa amb un mòdul que no hi és
  o que no és lliure al terra no es fa. Pendent (part 2): un sol taulell i la base comuna. Test `build/islands.test.ts`.
- **Peces corregudes** (`comp.runs`, `core/build/runs.ts`, `activeRuns`; **sense UI des del 2026-10-13**, per decisió de
  l'usuari: la secció «Taulell i sòcol» del moble ja no surt; treure ≠ esborrar: les que hi ha es conserven i es fabriquen
  igual, i `RunsForm` es queda sense ús; per decisió de l'usuari no es converteixen en peces lliures: es perdria el llarg, el voladís i els forats
  automàtics). Interruptor «Es fa» (`Run.off`): els d'un moble que no era cuina (abans es guardaven sense fer-se) es migren
  apagats en llegir (`migrateRuns`, a `normalizeComposition` i al `.moble`; els nous porten `off: false`); `RunsForm`: cada peça és un
  plegable (`FoldItem` variant `card`) amb un resum —de → fins a · gruix · forats—, dins del taulell cada forat també; una oberta alhora, la nova
  s'obre sola):
  **taulell** d'una peça sobre els baixos de la fila (voladís, forats d'encastar de placa, pica o a mida → talls passants) i
  **sòcol corregut** (davant de les potes, retranquejat). Es numeren com un mòdul més (n + 1) per a les refs. No arriben a
  les illes (`freeX`) llevat que la peça sigui només de l'illa; un forat que travessa el contorn no es fa i s'avisa.
- **Objectes de referència** (`RefObject`): caixa, cilindre o **perfil 2D**, per veure mides i, amb efecte:
  **Obstacle** (avisa si xoca; el cilindre amb la seva secció, `refTouchesBox`) o **Talla** (`build/refCuts.ts`,
  `applyRefCuts`): forat passant a cada peça perpendicular a la seva direcció (z: fons i portes; y: base, tapa, prestatges;
  x: laterals); si arriba a la vora (una **columna de la casa** a la cantonada o a la paret), **la peça es retalla amb la forma de l'objecte** (per decisió de l'usuari, 2026-10-14: «el moble s'ha d'adaptar a la columna»; `notch`, `polygon-clipping`: rectangle, cercle de 64 costats o el perfil; `Panel.outline`, que fan servir el 3D, el nesting —el rectangle—, el DXF, el STEP i el .xcs) i els forats i les ranures que queien a la part treta es treuen (res surt de les peces; una ranura retallada que encara és un rectangle es queda); si la partiria en trossos o se la menjaria, avís `ref-cut`. **De costat** (el fons i els laterals que la columna travessa pel seu pla), un objecte de referència només talla si la travessa de cara a cara amb secció recta (una columna quadrada; `sidewaysCut` `exactOnly`): forat o osca; un tub rodó de costat no fa res, com abans. La vora retallada no es canteja (queda contra la columna): si la columna se'n menja una franja sencera o la parteix, cada tros es fa a la seva mida (`trimTo`; el nesting no reserva la part que s'ha menjat) i el costat del tall perd el cantell (`cutEdges`); els trams del contorn que són el tall queden a `Panel.rawSides` i el 3D els dibuixa sense cantell (`shapedGeometry` reparteix els cantells en [1] amb cantell i [2] sense, segons `edges` als costats rectes i `rawSides`; `cutoutMaterials` = [cares, cantell, tauler vist]); una peça partida (un fons amb la columna al mig) fa **una peça per tros** (`notch` → `added`, ids `<peça>-2`…), amb els seus forats i ranures. Tests `build/refCuts.test.ts` i, als programes, `export/maestroNestXcs.test.ts`. **El moble es tanca al voltant de la columna** (per decisió de l'usuari: «ha de fer les ranures i les traseres que falten i moure la pota»; `core/build/columnWalls.ts`, a `buildComposition` després dels talls): una columna que és una caixa vertical (`axis: "y"`) i entra pel darrere d'un mòdul hi afegeix **fons nous** a les seves cares que queden dins (la del davant i les dels costats; `Fons columna n`, rol `back`, el tauler i el gruix del fons, a la retirada del fons, `backSetback`, de la columna) i, amb el fons en ranura, les **ranures** a la base i a la tapa (fondària i joc de la ranura de sempre); amb el fons cargolat o encastat, sense ranures. Només les que pugen de terra (`y` ≤ 1; una pica o una placa del taulell no compten). Una columna que no arriba a la tapa, que no toca el darrere o que travessa tot el mòdul no s'hi tanca (avís `ref-cut`, que diu què cal canviar); les rodones i de perfil, tampoc (de moment). **Calaixos**: els d'un tram per on entra la columna es fan més curts (per decisió de l'usuari: «les guies i els calaixos haurien de ser més curts»; `columnRearLimits` → `buildModule(m, { rearLimits })`, `Builder.rearAt`): la guia i la caixa (o la NL del joc) es trien amb la fondària que queda davant del fons nou de la columna, i no es retallen. **Potes**: amb la base retallada, una a cada cantonada que sobresurt del contorn i cap a l'osca (`legPoints`, `ViewerModule.legs.points`, `ModuleLegs points`); els forats d'una pota importada només es fan a les quatre de sempre (els de l'osca es treuen); les de l'app dibuixades (la AXILO 78) es tornen a posar a cada un d'aquests punts amb els seus forats i el mirall de la dreta (`relayLegs`, a `buildComposition` després de `columnWalls`; la placa sencera dins de la base o aquella pota no es fa, avís `hardware`). Test `build/columnWalls.test.ts`. Els **passacables** dels mòduls ja no
  tenen UI: es migren a objectes que tallen (`migrateCableHoles`, a `compositionOf` i `buildComposition`). Els objectes
  només foraden en la seva direcció.
- **Perfil 2D** (`shape: "profile"`): Bézier cúbica composta i tancada, extrudida. Nodes `PNode` (`model/polygon.ts`): punt,
  manegadors `in`/`out` relatius, `t` = reflex (cantonada · angle · angle i llarg) i `b` (bulge, arcs d'«Arrodonir»); els
  antics `[x, y, bulge]` es llegeixen amb `toNodes`. Per tallar, les cúbiques passen a arcs i rectes (`cubicToArcs`, error
  < 0,02 mm): DXF amb bulge i STEP amb cares cilíndriques; xocs i 3D amb el contorn mostrejat. Pendent: rebaixos de contorn.
- **Peces lliures** (`Composition.parts`, `model/freePart.ts`, `build/freeParts.ts`): taulers solts col·locats
  com els objectes però que són peces de debò (rol `part`, un «mòdul» més per a les refs). Orientació `front` (X·Y) · `side`
  (Z·Y) · `flat` (X·Z, v cap al fons); `w × h` al seu pla, gruix, material, veta, forma amb l'editor de perfils.
  - **Flat-pack = opció «Encaixos» de cada peça** (per decisió de l'usuari no és un tipus de moble; `FreePart.joinery`,
    **expressa**: absent = sense encaixos, així els mobles d'abans no en fan de cop; `partJoinery`). A qualsevol moble que es
    fabrica, només entre peces lliures que tenen totes dues l'opció (no amb els mòduls; si només una la té i s'encavalquen,
    avís). Els Flat-pack d'abans (`lliure`) es migren en llegir (`migrateFlatPack`, a `normalizeComposition` i al `.moble`):
    cada peça pren el valor que tenia (el camp vell `joints` es treu) i la fabricació és idèntica
    (`flatPackOption.test.ts`). Entra i hi acaba →
    pestanyes + mortalles (passants o ranures cegues `tag: "mortise"`); s'encreuen → mitja fusta; totes dues hi acaben →
    dits; cantell contra cara → espigues. `Composition.joinery` (`DEFAULT_JOINERY`): joc, Ø de fresa dels **dogbones**,
    ample de pestanya. Contorn amb `polygon-clipping`; `build.joints` els llista.
  - **Grups** (`FreePart.group`, `moveGroupBy`, `duplicateGroup`, `movePartToGroup`, `reorderPart`, `removePartFromGroup`). **Els mòduls també en fan** (`Module.group`, per decisió de l'usuari, 2026-10-14; el mateix espai de noms: `groupItems` dona mòduls, peces i models d'un grup): a l'arbre, plegables dins de la seva fila, menú ⋯ «Agrupar en un grup nou» · «Posar a» · «Treure del grup», arrossegar un mòdul sobre un grup, ⌘G; el grup es mou (els mòduls, per la seva fila), s'amaga, es bloqueja i s'esborra sencer; al 3D el primer clic tria el grup.
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
  Només als **Objectes** (per decisió de l'usuari; un moble que ja en tenia els conserva: es veuen i es poden triar i
  eliminar, però sense + ni Duplicar ni enganxar). A l'editor: grup «Models 3D» a l'arbre (⋯ Duplicar · Eliminar, `insertModelCopy`; **grups i arrossegar**, per decisió de l'usuari, 2026-10-14: `ModelObject.group`, el mateix nom de grup que les peces lliures —un grup pot tenir peces i models, es mou, es duplica, es desagrupa i s'esborra sencer: `groupBox`, `groupNames`, `moveGroupBy`, `duplicateGroup`, `renameGroup`, `removeGroup`, `reorderModel`, `setModelGroup` a `editOps.ts`—; al 3D el primer clic tria el grup), clic al 3D per triar-lo (`ModelMesh` a
  `CabinetViewer`), contorn i gizmo (`RefGhost outline`, es mou en viu), fletxes, Supr, Ctrl/⌘ C · V · D, i `ModelInspector`
  (Model · **Material** —un material de Preferències per a tot el model, `ModelObject.material`, o «Com el fitxer»; `modelInstance(m, materials)` el posa a totes les malles amb `finishMaterial` (el camí de les peces: el vidre, translúcid i de dues cares), propi de la instància, `userData.ownMaterial`, que `disposeTree`/`disposeModelInstance` alliberen; 3D, Presentació, render, miniatures, ambients i GLB/USDZ— · Mides amb «Mida original» · Posició amb el Gir a passos de 15°). Compten per enquadrar la càmera.

## Fabricació
### Regles de construcció (`core/build/`)
- **Regles revisades** (`build/manufacturing.test.ts`): amb fronts encastats, divisors i prestatges fixos d'una zona coberta
  es retiren `t + outerGap` (`insetCut`, espigues i System 32 al cantell nou); en un mòdul dividit, tots els divisors i
  prestatges fixos més curts per la folgança de les peces de dins (vegeu Model del moble › Zones); les portes d'una zona pare fan la filera
  System 32 als trams lliures entre prestatges fixos (placa de la frontissa); forats de guia dels calaixos des del davant de
  la caixa (`zFront − 37`); trapa de reixeta darrere del front encastat; ranura del fons sempre dins de la peça, d'ample el gruix del fons + el **joc de la ranura** (`Carcass.grooveClearance`, Preferències › Folgances per defecte › «Joc de la ranura» i Mòdul › Caixa, sota «Ranura del fons»; per decisió de l'usuari, 2026-10-14: «gruix + 0,8»; el joc va cap al davant i el cantell de darrere es queda a `backSetback`; per defecte **0,8** a Preferències (v33: les que el tenien a 0 o sense, el reben) i el copien els mòduls nous i les plantilles instanciades (`applySettingsToModule`, `withInnerClearance`); a Mòdul › Caixa amb «Com a Preferències» i el botó per tornar-hi; un mòdul sense el camp, 0 (els desats no canvien, proves d'or idèntiques); `backGrooveWidth`, test `build/backGroove.test.ts`) i allargada
  `g` on la tapa/base passa per sobre del lateral (inglet, tauler de taula); fons sota el tauler de taula i fins a
  `interior.y1` amb ranura d'aire; frontisses per alçada (2/3/4/5 fins a 900/1600/2100, ara `count` de l'item; `hingeCount`
  només al `buildCabinet` antic) i cassoletes separades ≥ Ø + 10 (si no, menys i avís `hinge`); fons del calaix amb material del seu gruix (avís `drawer-bottom`); peces amb
  alguna mida ≤ 0 fora amb avís `invalid-part`. **Pendent de decidir amb el taller**: joc de les ranures i descompte del
  gruix del cantell.
- **Ferratges com a dades** (millores v1 F1–F2, [`docs/millores-v1/ferratges.md`](docs/millores-v1/ferratges.md)):
  `core/model/hardware.ts` (`HardwareItem`: categoria, motor `engine`, `params`, mecanitzats `targets[].ops` amb fórmules
  `Expr`, `count`/`pitch` = `StepRule`, `lengths`) i `core/model/expr.ts` (`evalExpr`, analitzador propi **sense `eval`**:
  `+ − × ÷`, parèntesis, `min/max/abs/floor/ceil/round`, variables). Motor pur `core/build/hardware.ts`: `applyHardware`
  (ops → `Hole`/`Cutout` en un punt d'ancoratge, mirall i gir), `drillSpec`, `cupSpec`… i `slotSpec`/`resolveKit` (un item
  que no serveix → el d'inici i avís `hardware`; mai mig ferratge). Les **regles** de col·locació es queden a `buildModule`
  (cassoletes a la filera, guies a `zFront − frontOffset`, espigues…): els números i els forats surten de l'item. Llocs
  (`HARDWARE_SLOTS`): frontissa, System 32, espiga, guia, braç d'abatible, imant, tirador i els **accessoris** opcionals
  barra de penjar, tira LED i marc de vitrina (`ACCESSORY_SLOTS`). Cada mòdul en porta una **còpia** (`Module.hardware` =
  `ModuleHardware`; els accessoris poden faltar: l'item d'inici, `moduleSlotItem`) i la porta, el calaix, l'abatible, la
  reixeta (imant) o l'accessori en poden triar un altre (`front.hardware`, `zone.rail.hardware`…, còpia; la porta de
  vidre no, `visibleModule`). **Només es resolen els llocs que el mòdul fa servir** (`resolveKit` a demanda,
  `Builder.frontHardware`/`frontHandle` amb getters; auditoria A1): un item dolent al lloc «frontissa» d'un mòdul només
  de calaixos no avisa; `usedHardwareSlots` (`core/model/usedHardware.ts`, **l'única**, declarativa, del model) diu els
  mateixos llocs a l'inspector (els fronts tapats no compten; l'espiga, només on hi ha unions a topar, `carcassDowels`).
  **La còpia de cada lloc es llegeix sencera o res** (`repairAtomically`, com el ferratge
  d'un front; A2): un joc amb el `kit` dolent torna a l'item d'inici amb avís de reparació, mai un joc sense `kit`; si
  n'arriba un, el missatge diu «joc de calaix malmès», no «no és del tipus que toca» (`moduleSlots.test.ts`). Migració: mòduls d'abans en llegir (`z.preprocess(migrateModuleHardware)`,
  `normalizeComposition`, i `buildModule` amb dades crues; un número dolent, camp a camp) i preferències **v19**
  (`hardware` → `hardwareLibrary` + `hardwareDefaults`, `libraryFromLegacy`, `fixHardwareDefaults`): **proves d'or idèntiques**.
  Ara les guies i l'abatible porten els seus números (abans `system32.edgeOffset` i `hinge.cupOffset`). `hardwarePreview`
  (peces d'exemple amb el motor) per al dibuix de Preferències i `hardwareMount` / `mountPlan` (el ferratge muntat en un
  mòdul petit per `buildModule`, en 3D i en pla). Tests a `build/hardware.test.ts`, `build/hardwareMount.test.ts` i
  `model/expr.test.ts`. Cada mòdul en porta una **còpia** per lloc (`Module.hardware` = `ModuleHardware`).
- **Jocs paramètrics** (`core/model/hardwareKit.ts`, dades a `core/model/kits/` —constructor comú de les sèries DTC
  `dtcDoubleWall.ts` i una dada per sèrie: `dtcMagicPro.ts`, `dtcMagicStarUltra.ts`, `dtcDragonPro.ts`, `dtcPurePro.ts`—,
  constructor `core/build/drawerKit.ts` + `buildKitDrawers`, comanda `core/build/kitOrders.ts`; preferències **v23**,
  additiu: els jocs inicials s'afegeixen si no hi són; **v27**: els del catàleg DTC 2026 —MAGIC-STAR ULTRA, DRAGON-PRO,
  PURE-PRO HK— s'afegeixen si no hi són, `V27_ITEMS` (els push latch DTC MS d'aquella versió es van treure a la v29);
  test `build/dtcKits.test.ts`;
  **v28**: la resta del catàleg DTC 2026 (`V28_ITEMS`, `DTC_CATALOGUE_ITEMS`, `core/model/dtc/`: **frontisses** de
  cassoleta C80/C81/C82/B80/B85 amb la placa de dos forats euro a la filera (`dtcHinges.ts`, motor `cup`), **plaques**
  (`dtcPlates.ts`, motor `plate`), **guies** ocultes, de boles i de rodets (`dtcSlides.ts`, motor `slide`: només els dos
  forats del motor; les columnes del catàleg a `tags`), suports de prestatge (`system32`, `dtcMisc.ts`) i els jocs
  PURE-BOX HL (`kits/dtcPureBox.ts`) i PURE-PRO HQ de vidre; test `build/dtcCatalogue.test.ts`). **Cap «només 3D»** (per
  decisió de l'usuari, 2026-10-13: «els que no pots ficar els mecanitzats, els treus»; «els que posa només 3D i estan
  buits, treu-los»): a la biblioteca només hi ha ferratges que un motor de l'app col·loca; elevables, portes corredisses,
  suports DM, calaixos de paret simple, unions, frontissa D, door opener i push latch no hi són (la v29 els treu de les
  preferències desades; les cotes del push latch i de les unions, a `docs/ferratges-jocs.md`). **El per defecte de cada lloc és sempre l'item de l'app** (`appItemOfEngine`: sense
  fabricant), mai el primer del catàleg del mateix motor (`kitFrom`, `fixHardwareDefaults`, `HardwarePane`)):
  vegeu Model del moble › Calaixos amb joc paramètric i `docs/ferratges-jocs.md`.
  Preferències **v24**: els jocs inicials (`builtin`) reben les dades del joc d'ara (guia de dos cossos, acabats); nom i
  prebroca es queden; les còpies dels mobles no es toquen (es veuen com abans fins a tornar a triar el joc).
  Categoria «Calaixos de doble paret» (`drawer-system`); l'editor del joc (`settings/KitSections.tsx`) és **només lectura**
  (variants, opcions, regles, components, fusta, mecanitzats, hipòtesis; duplicar-lo per canviar la prebroca a «Mides»).
  **Regla del taller «prebroca dels cargols»** (Preferències › Regles de mecanitzat › «Prebroca dels cargols», **una sola font**:
  `Settings.kitPilot`, `KitPilot`; Ø2 × 10, activada; les preferències d'abans la prenen del primer joc,
  `kitPilotFromLibrary`): un forat guia a cada cargol d'un ferratge que no té mecanitzat propi; els jocs de la biblioteca
  en copien els números (`setKitPilot`) i les còpies dels mòduls la **segueixen en construir** (`setKitPilotRule` des de
  `db/settingsStore.ts`, `planKit` llegeix `kitPilotRule()`; sense regla —tests— els `params` de la còpia). A «Mides» del
  joc ja no s'edita (`HARDWARE_PARAMS.drawerKit = []`). Els ferratges de sempre ja foraden cada cargol: guia Ø5 / Ø4,
  placa i System 32 Ø5, espigues, imants, braços; l'ala de la frontissa genèrica no en té de posicions conegudes. El `ModuleHardware` (abans `HardwareKit`) és la còpia dels items
  per lloc del mòdul; `HardwareKit` és ara el joc paramètric. Tests `build/drawerKit.test.ts` i el moble fix `kit-dtc-ht11`
  del corpus de les proves d'or (`testCorpus.ts`).
- **Ferratges importats del fabricant** (Hettich, [`docs/ferratges-import.md`](docs/ferratges-import.md); preferències
  **v20**, additiu: `HardwareItem.imported`, `plate`, motor `plate`): una frontissa importada fa servir les regles de
  sempre (`addCups`: quantitat per alçada, filera System 32, `cupOffset`, cara A) amb **tots** els forats del target
  `door` (cassoleta + cargols/espigues del fitxer, tags `hinge-screw`/`hinge-dowel`) i, amb una placa aparellada
  (`addPlate`), els forats de la placa (target `side`, tag `plate`) a la cara de dins del **lateral de les frontisses**, a
  `zFront − plateSetback` (37) i a l'alçada de cada cassoleta + `plateOffset`; un forat de placa sobre un del System 32
  es queda el més gros (cargol euro Ø5 × 12 = el mateix forat). **Sense confirmar (`imported.confirmed`), cap forat**
  (ni a la porta ni al lateral) i avís `hardware`: el taller no rep res que no s'hagi revisat. El model només per veure
  (`Panel.fittings`, GLB de `hardwareAssets`). **Mai mig ferratge ni una frontissa que no s'ha revisat**: un importat que
  no passa l'esquema es llegeix **inert** (`sanitizeImportedHardware` a `HardwareItemSchema`: preferències, mòduls,
  fronts i `.moble`; marca `imported.damaged`, avís «ferratge importat malmès: no es mecanitza»); un importat que fa
  fallar el motor queda sense forats (`inertHinge`), mai el d'inici ni el del mòdul; tot el patró (cassoleta i cargols) a
  la porta i la placa sencera al lateral i fora de les unions amb base, tapa i prestatges fixos, o res d'aquella frontissa;
  placa més fonda que el lateral → gruix − 1 i avís; sense lateral → avís; amb fronts encastats la placa es mesura des
  del darrere de la porta (sola). La placa aparellada és **per referència** (`syncPairedPlates` a cada canvi de la
  biblioteca; si en canvien els forats, la frontissa es desconfirma); no es confirma una frontissa amb la placa
  pendent, ni una placa sense forats (`confirmProblem`); canviar Ø/fondària de la cassoleta o on va la placa desconfirma
  (`setHardwareParam`). `proposePlate`: només els forats de muntatge de la cara del lateral, per parells simètrics; si
  no, cap forat (s'entren a mà). Tests `build/importedHardware.test.ts`, `build/importedHardwareSafety.test.ts`,
  `core/import/*.test.ts` i `core/import/hettich.roundtrip.test.ts` (`HETTICH_DIR` = carpeta amb els ZIP de Hettich; no
  es copien al repo).
  **Qualsevol article es pot importar** (amb STEP; sense, amb les vistes DXF, **«només 2D»**: motor `model` sense caixa ni
  3D fins que s'hi afegeix el STEP; `classifyHettich` per la família i la subcarpeta, `proposeArticle`):
  **tiradors** (`Griffe`, `proposeHandle`: els forats de la cara de muntatge → distància entre centres a la de catàleg si
  és a ≤ 0,5 mm, forat passant Ø del tirador per defecte o cargol + 1; un forat = pom; 3–4 = el parell centrat) al motor
  `barHandle` de sempre amb `pitch` sense graons, triable a cada front (`front.handle`) o al mòdul; **potes**
  (`Moebelfuesse`, `proposeLeg`: pilots a la placa) amb motor nou `leg`, triables a la base «Potes» (`Base.hardware`):
  `buildLegs` fa els forats a la cara de sota de la base a cada pota (a `inset` dels cantells, totes o cap); i la resta
  **«només 3D»** (motor `model`: estructures i guies de taula, Cadro, portes corredisses i plegables, accessoris,
  electrònica, carpetes desconegudes, i els tiradors/potes sense patró): el model i el volum, **mai cap forat**, GLB per
  baixar. Tiradors i potes: **sense confirmar, cap forat** i avís `hardware`; malmesos o que fallen, inerts. Preferències
  **v21** (categories `table` «Taules» i `door-system` «Portes corredisses i plegables»). Tests
  `build/importedHandleLeg.test.ts` i `core/import/hettich2.roundtrip.test.ts` (`HETTICH2_DIR`).
  **Tornar a importar un article amplia el que ja hi és** (per decisió de l'usuari: «mira si ja existeix la referència i si
  el document importat porta nova informació, la col·loques»; clau fabricant + article, `core/import/merge.ts`,
  `mergeImported`): el STEP hi afegeix el 3D, la caixa i la proposta si no en tenia (un «només 2D» passa a frontissa,
  tirador…, sense confirmar, mateix id i nom; les vistes d'abans es registren, `registerStoredView`); el DWG/DXF, les vistes
  i els punts de connexió; els plànols de muntatge (`dxf_einbau`, exemples, PDF) que nomenen l'article s'hi adjunten
  (`HardwareAsset.docs`). **Mai es toca un mecanitzat confirmat** (ni uns forats editats): si els fitxers donen una altra
  proposta, va a `imported.update` («Hi ha una proposta nova: revisar» a l'editor, amb la comparació; aplicar-la la deixa
  sense confirmar, `applyImportUpdate`; descartar-la, `dismissImportUpdate`); `imported.proposedParams` diu els números de
  la proposta (Ø i fondària de la cassoleta, Ø i distància del tirador). Noms «<nom> <sèrie> · <article>» sense la carpeta de
  l'usuari ni la del ZIP (`core/import/hettichNames.ts`: `cleanFolders`, `hettichLabel`, `hettichSeries`); els noms
  automàtics d'abans es migren en llegir les preferències (`migrateImportedNames`, només si no s'han canviat). Tests
  `core/import/merge.test.ts` i `core/import/hettichMerge.roundtrip.test.ts` (`HETTICH_DIR`/`HETTICH2_DIR`/`HETTICH_DXF_DIR`).
  Els mecanitzats del generador (`machining`) també: confirmats no es toquen (pendents a `update.machining`) i un DXF
  del taller amb capes de mecanitzat és informació nova. Detall a `docs/ferratges-import.md` §6–§7.
- **Generador de mecanitzats i ferratges col·locats a mà** (millores v1 F4, `docs/ferratges-import.md` §8; per decisió
  de l'usuari: «selecciones l'eina i el que li ha de fer a la fusta… i que es pugui posar»). **Sense UI des del
  2026-10-08** (per decisió de l'usuari: «el Generador de mecanitzats no cal… ara ho fiquem nosaltres a partir del
  catàleg»): no hi ha ni el formulari, ni el dibuix, ni «Llegir un DXF…», ni «Afegir ferratge»; el model, la fabricació
  i els col·locats que ja hi són es queden igual (treure ≠ esborrar; proves d'or idèntiques). Preferències **v22** (additiu):
  `HardwareItem.machining` = `GenOp[]` (`core/model/hardwareOps.ts`): per peça (`PART_KINDS`: porta/front, lateral, base,
  tapa/tauler de taula, prestatge, fons, caixa del calaix, peça lliure) forat (cara A/B, passant o **de cantell**), ranura
  (amplada, al llarg de P o Q, llargada o de cantell a cantell), caixera (rectangle, radi) i contorn (passant, o rectangle
  si és cec); posició del **centre** en els **eixos del moble** del pla de la peça (`planeAxes`: de cara X·Y, de costat
  Z·Y, estirada X·Z = P·Q) des del **punt de referència** o d'un cantell / del mig (`Pos`); eina de la màquina per
  defecte (`GenTool`). `machiningProblems` (pur) valida mides, cantell, contorn i eina (tipus, Ø, amplada, fondària útil);
  la llista es llegeix **sencera o res** (`MachiningListSchema`, `repairAtomically`). Editar-los en un importat el
  desconfirma (`setMachining`); un «només 3D» amb mecanitzats es confirma (`confirmProblem`). **Col·locats**
  (`Composition.hardwarePlacements`, `HardwarePlacementSchema` atòmic: còpia de l'item, `targets` = peça del mòdul
  (`module` + id local del constructor) o `freePart`, i quin grup de l'item hi va; `p`/`q` del punt de referència;
  `repeat`; `turn` del model 3D): `core/build/hardwarePlace.ts` (`applyHardwarePlacements`, a `buildComposition` abans dels
  objectes que tallen; `partFrame`: P·Q des de la normal de la peça i `toLocal`): `Hole` / `Groove` / `Cutout` amb tag
  `fitting`. **Tot o res** per col·locat (una operació fora de la peça o més fonda que el gruix → cap i avís `hardware`);
  importat sense confirmar, malmès, «només 3D» sense operacions, operació dolenta, peça que no hi és (res amagat compta) o
  que no és de CNC → cap forat i avís. Els grups de l'item sense peça triada no es fan (els «mirall» només si es trien).
  3D: `Panel.fittings` `kind: "item"` amb `placement` = l'id del col·locat (GLB o el volum de les operacions;
  `hingeVolumes` no el confon amb una frontissa); el model es veu també quan no fa cap forat (sense confirmar, mecanitzat
  dolent o que no hi cap: només visual, per trobar-lo i triar-lo al 3D).
  **Paramètrics** (per decisió de l'usuari: «la col·locació al moble no hauria de ser paramètrica?»; `PlacePos` i
  `Repeat` a `core/model/hardwareOps.ts`, `refPoints`/`placeAt` a `hardwarePlace.ts`): per eix, ancoratge des de l'inici
  (`min`), des del final (`max`), el mig o un `%` (`ratio`, `pct`) més el desplaçament `at` o una **fórmula** `expr`
  (`evalExpr`, sense `eval`; **L** llarg, **A** ample, **G** gruix de la peça, **M** la mida al llarg de l'eix; una fórmula
  dolenta → cap forat i avís); repetició `step` (des del punt, la d'abans) · `centred` · `span` (repartides entre els
  `margins`) · `pitch` (cada `spacing` entre marges, centrades), amb la quantitat fixa o per regla segons la llargada de la
  peça (`rule`, `StepRule` com `hingeCount`; `repeatCount`/`repeatOffsets`); **mirall esquerra/dreta** (`mirror`: al
  lateral de l'altre costat —`otherSideId`, la mateixa P·Q i cara de dins— o, a una peça de costat a costat, reflectit
  respecte del seu mig amb les operacions reflectides, `mirrorOpP`; sense peça a l'altre costat, cap forat; un mecanitzat
  repetit pel mirall es fa un cop). Es recalcula a cada construcció: si el mòdul canvia de mida, el ferratge el segueix;
  tot o res també amb les còpies i el mirall. Les posicions d'abans «des de la referència» (`ref` = des de l'inici) es
  llegeixen `min` (`migratePlacePos`, `z.preprocess` a `HardwarePlacementSchema`, idempotent): el mateix resultat.
  `StepRule`/`stepValue` són ara a `hardwareOps.ts`. Tests `build/hardwarePlaceParam.test.ts` (canviar l'amplada i
  l'alçada → les posicions segueixen; regla per mida; marges; mirall; fórmules; migració; `.moble`).
  `eachHardware` els recorre (confirmar/eliminar a Preferències hi passa; `.moble` **v3**, `mobleVersionFor`). **DXF del
  taller** (`core/import/dxfMachining.ts`): capes `DRILL_D<Ø>_P<f>` (`DRILL_B_…`), `GROOVE_W<a>_P<f>`, `POCKET_P<f>`,
  `CUT_THROUGH`, `CONTOUR` (el contorn que ho envolta tot no es talla) → operacions exactes; peça pel sufix del nom
  (`partFromFileName`: `_porta`, `_lateral`, `_tapa`…); en importar (`settings/hardwareImport.ts`, tret amb la UI el 2026-10-08) manen sobre el STEP. Tests
  `core/import/dxfMachining.test.ts`, `build/hardwarePlace.test.ts`, `build/hardwarePlaceExports.test.ts`. **Proves d'or
  idèntiques.**
- **Blum i un sol camí per fabricant** (per decisió de l'usuari: «estén el pipeline, no el dupliquis»; `docs/ferratges-import.md`
  §10): `core/import/makers.ts` (`detectMaker`, `importFileKind`, `importCandidate`, `groupImport` = Hettich +
  `groupBlum`, `makerOf`; `HettichArticle.maker`) i la resta comuna (`articleItem`, `mergeImported` amb la clau fabricant +
  article; el diàleg i `settings/hardwareImport.ts`, trets amb la UI el 2026-10-08). Blum (`core/import/blum.ts`): fitxers `<article>_<doc 8 xifres>[_R|_L].<ext>` (solts o
  als ZIP amb el nom del producte en castellà, NFC), un item per article (mà al nom; amb les dues mans del mateix
  article, la dreta i nota), `classifyBlum` pel producte o el prefix (CLIP top → porta, plaques/guies/AVENTOS/TIP-ON →
  lateral, accessoris o desconeguts → **«Sense assignar»**, `PartKind` `any`: es pot col·locar però no es confirma fins
  que s'assigna, «Assignar a» al generador). **Programes Xilog** (`core/import/xilogPgm.ts`, `readXilog` /
  `machiningFromXilog`, pur, mai llança; registres ASCII del contenidor binari; hipòtesis documentades: `XBO` X/Y des del
  punt de referència, Z negatiu = fondària, `Z ≤ −DZ` passant, F 1 = cara A, 2–5 cantells, 6 cara B, R = total amb pas
  x/y; fresats i desconeguts a les notes): mecanitzats **exactes** del generador (X → P, Y → Q), motor `model`, sempre
  **col·locats a mà** i **sense confirmar, cap forat**. 3D: STEP (tots els del joc), si no `.dae` (`ColladaLoader`), si
  no `.glb`/`.gltf` (`GLTFLoader`, m → mm); el `.dxf` de Blum és ACIS (no es llegeix). **Formats: una sola taula**
  (`core/import/formats.ts`, `IMPORT_FORMATS`) per al classificador (`hettichFileKind`/`importFileKind`, `MODEL_3D_KINDS`)
  i per a l'`accept` de «Triar fitxers…» (`IMPORT_ACCEPT`, extensions i MIME: el diàleg del Mac deixava el `.dae` en gris);
  els que només es llisten (DWG, SAT, MAX, `*.mpr`, CAM d'altres màquines) també hi són. Molts fitxers solts de tipus
  barrejats alhora (Blum els baixa d'un en un). Test `formats.test.ts`. Hettich, formats de més: IGES (`ReadIgesFile` al mateix worker d'OpenCascade) i
  3DS (`TDSLoader`, mm) donen el 3D d'un «només 3D» sense STEP (`components/viewer/modelMeshes.ts`); SAT i MAX no; els
  PDF sense número s'adjunten per sèrie (≤ 12 articles) o surten «sense article» al diàleg (`ImportSource.loose`). Tests
  `core/import/xilogPgm.test.ts`, `blum.test.ts`, `blum.roundtrip.test.ts` (`BLUM_DIR`) i `hettich3.roundtrip.test.ts`
  (`HETTICH3_DIR`: `IGES_Griffe.zip`, `3DS_Griffe.zip`). **Proves d'or idèntiques.**
- **El lloc de cada ferratge importat («Què és»), el marc de muntatge i la col·locació a mà mínima** (per decisió de
  l'usuari: «la col·locació a mà és massa complicada», «una frontissa importada s'hauria de substituir pel paramètric que
  ja tenim», «el 3D hauria d'entrar tal com es veuria col·locat a la realitat»; `docs/ferratges-import.md` §11):
  cada importat té un **lloc** = un motor de l'app (`engine`; `HARDWARE_ROLES`: frontissa, placa, tirador, guia, braç,
  pota, imant, espiga, filera) o **«només 3D»** (`model`). Els d'un lloc els posen **les regles de sempre** del mòdul
  (cap col·locació a mà) i els seus números són a l'item, prefilats del STEP i editables. Si el STEP no dona el patró, la
  proposta és **parcial** (`partialProposal`): l'item surt del tipus que toca amb els números per defecte, «mides per
  omplir», mai «només 3D». Blum: frontisses, plaques, tiradors i potes amb 3D van al seu lloc (el Xilog, de referència).
  **«Què és»** a l'editor (`retargetImported`, pur; `settings/hardwareReframe.ts`): canvia el motor amb els números per
  defecte, sense confirmar, i **refà el GLB al marc estimat de la malla**. **Marc de muntatge** (`imported.mountFrame`,
  `frameFrom` step/mesh/file): del STEP (`proposal.ts`) o **de la malla** (`core/import/meshFrame.ts`: anells de vèrtexs
  en cercles per eix, RANSAC per anell; la cassoleta Ø25–41 amb ≥ 2 anells, els cargols Ø3–7 al voltant; sense
  cassoleta rodona —CLIP top EXPANDO T— el parell de fixacions a 28–50 mm; placa, tirador i pota per la cara d'on neixen
  els forats); amb els fitxers reals dona el mateix marc que els cilindres del STEP. El visor posa el GLB amb la mateixa
  transformació que el motor (`fittingMatrix`): el 3D entra col·locat (tancat; no s'articula). **Col·locació a mà**
  només per als «només 3D» (`isPlaceable`), només peça i posició (cantell o mig + mm); repeticions, fórmules, mirall i
  gir fora de la UI però tolerats (es llegeixen i fabriquen igual; «Avançat» + «Simplificar», `placementAdvanced`,
  `simplifyPlacement`). **Sense barra flotant** al 3D (`FittingToolbar` eliminat; editar/duplicar/eliminar a la llista
  de l'inspector); un ferratge triat es dibuixa opac i sencer (caixa sense model també opaca). Tests
  `core/import/slot.test.ts`, `meshFrame.test.ts`, `meshFrame.roundtrip.test.ts` (`HETTICH_DIR`/`BLUM_DIR`, tessel·lat
  amb `occt-import-js` al Node), `features/composition/placements.test.ts`. **Proves d'or idèntiques.**
- **Forats que es trobarien per dins** (`build/holeClash.ts`, `resolveHoleClashes`): System 32 a banda i banda d'un divisor
  → tots dos a (T − 1)/2; si un és d'un ferratge (placa, frontissa: `shortenFitting`), primer s'escurça l'altre, sempre amb
  avís `hole-clash` i mai per sota de 8 mm (si no, no es toca i ho diu); espiga de cantell contra un forat de cara →
  l'espiga s'atura 1 mm abans (mínim 10 mm, si no avís `hole-clash`). Els forats de guia de la caixa del calaix no arriben a la ranura del fons.
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
- **Cantells de la caixa** (`edges` a `buildModule`): laterals, base, tapa, divisors i prestatges, el de davant; amb el mòdul **lliure al terra separat de la paret**
  (`mountOf` = `floor`, `wallGap > 0`), també el de darrere, que queda a la vista (`rearEdge`; per decisió de l'usuari,
  2026-10-13: arrambat o penjat, no es veu; 2026-10-14: «el laminat del darrere només si no és moble de paret», també
  amb fons): laterals, base i tapa sempre llevat del fons cargolat (que els tapa), i divisors i prestatges només sense
  fons (`innerRearEdge`; amb fons queden darrere). Proves d'or: les dues illes de les plantilles de l'app canvien. Un material **massís** (`MaterialPref.solid`, Preferències › Materials › Fabricació «Massís · No es
  canteja»; amaga el Cantell) no es canteja: `buildComposition` treu tots els cantells de les seves peces al final
  (`isSolidMaterial`, que posen les preferències amb `setSolidMaterials` a `db/settingsStore.ts`, com la prebroca; sense,
  tot es canteja) i al 3D el cantell és la mateixa fusta. Test `build/edgeRules.test.ts`.
- **Peces iguals**: **sense avís** (per decisió de l'usuari, 2026-10-13: «el taller les identifica per l'etiqueta»,
  A.1.L.1 ≠ A.1.L.2). L'avís `same-size` d'abans (dues peces de la mateixa mida i material amb mecanitzats diferents) es
  va treure de `buildComposition`; `build/sameSize.ts` (`sameMachining`, `sameSizeConflicts`) es queda amb els tests.
- **Res amagat compta** (regla): el que s'amaga a la UI es conserva (tornar a encendre l'opció recupera els valors), però
  `buildModule` construeix des de `visibleModule` (`model/composition.ts`), que posa a un valor fix els camps de les opcions
  apagades: fons (material i gruix sense fons; ranura sense ranura; retirada si no és encastat), inglet si Cantonades no
  surt (també els fronts dels calaixos), tauler de taula sense tapa sencera, prestatges i barra als calaixos, al **front fix** i als
  compartiments dividits, gruix i «a ras» sense prestatges, alçades de calaix de més, frontissa de les dues portes, patró de
  reixeta de l'altre tipus, l'imant triat d'una reixeta amb frontisses i sense trapa, el marc d'una porta que no és de vidre,
  el «Fons del calaix» sense calaixos, els prestatges, les fileres, la barra i la llum d'un compartiment sense una peça a cada costat i el front d'un compartiment que no és aguantat pels quatre costats (`zoneSupport.ts`), l'estil dels fronts sense cap front, la folgança de les peces de dins d'un mòdul sense dividir, el front d'un compartiment **tapat** per
  les portes de tot el mòdul (el compartiment és com obert: prestatges i accessoris sí), el front d'una zona dividida que no
  són les portes de l'arrel (el front fix de tota la zona, els de les divisions de dins: no es fan ni tapen res), i els **fronts recordats** (`Zone.fronts`). Sense fons, el fons dels calaixos surt
  del material del cos. Sense cap prestatge, «Regulables» es veu i compta (fileres System 32). **Els llocs de ferratge que
  el mòdul no fa servir no es llegeixen** (vegeu Ferratges com a dades). **Una opció nova que amaga camps s'afegeix a
  `visibleModule` i a `build/hiddenState.test.ts`** (camps amagats a l'atzar i camins de la UI en un altre ordre → les
  mateixes peces i avisos).
- **Canviar el contingut d'un compartiment no llença res** (auditoria E1): `setFront` recorda l'últim front de cada tipus
  a `Zone.fronts` i `switchFront` («Contingut») el recupera sencer (calaixos, alçades, joc i opcions, ferratge, tirador) o
  comença en blanc (`defaultFront`, amb el tirador del front d'abans si el nou tipus en pot portar); els prestatges, la
  barra i la llum **no es toquen** en passar a calaixos (`visibleZone` els amaga per construir i tornen amb el contingut
  d'abans). Un front recordat sota una altra clau o dolent es treu en llegir, idempotent (`frontMemory.test.ts`).
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
  plegar a ASCII, cadenes C# escapades (`cs`); fitxers en **UTF-8 amb BOM** o sense (`Machine.xcsEncoding`, «Codificació»;
  `xcsBytes`/`xcsZip` amb l'`encoding` de l'export; LLEGEIX-ME sempre amb BOM; sense BOM i noms no ASCII → avís).
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
  (`Machine.nesting`, `machineNesting`: 10 mm, Ø + 2, martiri 0,3 mm; o, amb `edgeTrimMode: "tool"`, Ø de la mateixa fresa +
  `edgeTrimExtra`, `boardMargin`; `cncNestOptions` torna el `margin`). La mateixa xifra al LLEGEIX-ME, la capçalera i la
  targeta d'Exportar. **El mateix nesting a tot arreu** (`core/nesting/machineNest.ts`, `nestPlan`, a `useNesting`): amb una
  màquina per defecte, la pàgina Nesting, el CSV de TopSolid, el JSON i els .xcs fan servir aquesta separació i marge; sense
  màquina, el `kerf`/`margin` del projecte (que de nou surten de `Settings.boards`, sense UI a Preferències: es queden a
  l'esquema com a valors inicials). Taulers, taulers per material i veta són sempre els del projecte (`project.nesting`).
- **Avisos ≠ post-processos** (per decisió de l'usuari): `warnings` només amb problemes de debò (eina, forat que no es pot
  fer…); el que toca després (`postProcesses`: inglets a la serra, cantejar, forats de cantell que no fa la CNC, encolar,
  push; al per peça també «Programa cara B: <ref>Volt.xcs») i la ruta («CNC: … → serra (inglets) → cantejadora») van al
  LLEGEIX-ME, al plegable «Després de la CNC» d'Exportar i com a comentaris ASCII a la capçalera (mai missatges a
  l'operari). Cantells amb la numeració de l'app (pendent de confirmar amb el taller).
- **Avís de calor de la reixeta** (`material-heat`): una reixeta pot ser cobreradiador o decorativa (acanalats), així que
  diu «si va davant d'un radiador…», un sol cop per mòdul i cap si la reixeta ja és d'un material lacat.
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
- **Opcions pendents del taller** (millores v1, `docs/millores-v1/preguntes-germa.md`, el missatge per al germà): codificació,
  marge, pell dels forats gairebé passants, sentit del fresat i capçalera ja són preferències **amb el valor d'abans com a
  inicial** (cap diff del golden; tests a `export/xcsShopOptions.test.ts`). Quan respongui, es canvia l'inicial i
  `UPDATE_GOLDEN=1`. Pendents de construir: ranura del perfil LED i frontisses de porta de vidre.

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
  `webkitGetAsEntry`; component compartit `components/ImportDropZone`, `components/pickedFiles.ts`): la carpeta `<sèrie>.machinecontext`, un projecte `.pgmx` (zip o carpeta desplegada amb l'XML,
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
  ranures disc/fresa, codificació amb/sense BOM), «Programes per tauler» (separació, marge fix o «Ø de la fresa +», martiri,
  peces petites al final/principi i la capçalera del nesting: opcions mecàniques amb l'hex i els bits al costat, `bitsLabel`;
  posició X/Y/Z/gir; paràmetres de `Pload` com a text, `loadMacroArgs`, es desen en sortir si són vàlids) i **taula d'eines per tipus** (codi · nom · Ø · fondària · posició; tocar-ne una l'edita; «Afegir eina» per a les
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
  `core/machine/rules.ts`; detall a `docs/maestro-xcs.md`. A sota, el grup **«Prebroca dels cargols»** (`Settings.kitPilot`;
  per decisió de l'usuari, aquí i no a Ferratges: no és un ferratge, és una regla del taller). Inicials (`defaultMachineRules`): ranures «8mm diamant» a 6 mm per
  passada (`CreateBidirectionalMillingStrategy`), caixeres «12mm diamant nesting» (`CreateContourPocket`), perfilar per gruix
  (8–22 → «12mm diamant nesting», 23–41 → «14mm diamant nesting»), rampa als perfilats del nesting (`SetApproachStrategy(true,
  false, k)`, des del mig del costat recte més llarg), peces petites (menys de 0,8 m²; `maxSide` 0 = no compta) en 3 passades
  (Z/XY 1/1, 0,5/0 i la final al martiri o als passants, `overMaterial`). Opcionals, amb el comportament d'abans si no hi
  són: **pell dels forats i ranures gairebé passants** (`blind`, `cncBlindDepth`: 1 mm a partir de gruix − 0,5, el que es feia sempre; només al
  .xcs, el STEP es queda amb 1) i **sentit dels contorns i talls** (`cutMode`: `asIs` · `conventional` = en oposició, com
  TopSolid · `climb`; `cutLoop`, i a la Vista CAM una punta amb el sentit).
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
- **Coherència (ronda 5)**: les eines surten igual a tot arreu, «codi · nom · Ø» (`toolLabel`, `core/model/machine.ts`: Màquines,
  Regles i Nesting); els fronts de calaix «auto» es fan a mig mil·límetre cap avall (`snapAutoHeights`: fronts iguals,
  mateixa mida i mateixos mecanitzats; el que sobra queda al joc de dalt); la separació del nesting només compta les peces que
  caben en algun tauler (`cncNestOptions`: un taulell de 3500 mm no fa més ampla la separació).
  A Peces, el detall de la fila diu els cantells i inglets **reals** de cada peça (ref), com el LLEGEIX-ME d'Exportar (la fila
  els dona normalitzats per agrupar les mirall). A Exportar, els avisos del STEP es calculen quan el navegador és lliure.

## Pàgines del moble
Pestanyes del moble obert (`PROJECT_NAV`): **Editor · Peces · Nesting · Exportar**, cadascuna amb un sol propòsit.
- **Peces**: taula (peces iguals agrupades) + **plànol de la peça seleccionada** al costat; sense botó d'exportar.
  Agrupació (`toCutList`, `groupKey`): rol, mides, gruix, material, veta, cantells i inglets normalitzats (`canonicalSides`:
  mirall esquerra/dreta, dalt/baix o girada 180° cauen a la mateixa fila), 2a cara, forats de cantell, encolar, push i, de
  qualsevol rol, contorn i talls (peces lliures: també forats i ranures). CSV de peces: cometes als números si la coma
  decimal és el separador i als textos amb `\r`. Al mòbil, una **targeta per peça** i la triada porta el plànol a dins.
  «Elements sense nesting» per a `build.extras` (sense els components dels jocs, rol `hardware`) i **«Ferratges dels
  jocs»** (`build.hardwareKits`, `kitGroups`: la comanda dels calaixos de doble paret amb els números del catàleg i la
  fusta per calaix).
- **Nesting**: mides del tauler i, amb màquina, la línia «Separació X mm i marge Y mm de la màquina … (Preferències ›
  Màquines CNC)»; sense màquina, «Separació (fresa)» i «Marge tauler». Les peces amb `outline` es dibuixen amb el contorn
  real (el rectangle que ocupen, discontinu); el nesting reserva el rectangle. Marca de veta al tauler (`BoardDrawing`):
  horitzontal si `(grain === "x") === (angle === 0)`, vertical si no, cap sense veta. Forats de cara plens a la cara A, buits
  a la B.

## Editor
- **Tres columnes, com Figma / Fusion 360** (`features/editor/EditorScreen.tsx` sobre `Workspace`): Estructura (arbre) ·
  Visor · Propietats. Arbre de 280 px i propietats de 340 px per defecte, amb vora arrossegable (`ResizeHandle`, 48–900 px,
  nansa al mig; amplades recordades per editor); si el panell és més estret que el contingut, desplaçament horitzontal (com
  IntelliJ). Visor amb mínim de 320 px; si fa menys de 640 px, pestanyes només amb icona, i botons en columna. Cada panell lateral es plega amb els botons de les cantonades del visor
  (`LuPanelLeftClose/Open` · `LuPanelRightClose/Open`). L'app ocupa just la finestra; cada panell té la seva barra de
  desplaçament fina amb lloc reservat (`scrollbarGutter: stable`). **Mòbil**: visor a dalt i pestanyes `Estructura` ·
  `Propietats` (triar a l'arbre porta a Propietats); «Ampliar el visor».
- **Una sola selecció** (`Selection`), sincronitzada entre arbre, 3D i alçat. **Maj + clic** (per decisió de l'usuari, 2026-10-14, com Figma i el Finder): **a l'arbre, el tram** del darrer triat a aquest, del mateix tipus i en l'ordre de l'arbre (`treeOrder`, `rangeAnchor`; també als Ambients, per apartat, `sectionOrder`); Maj + clic a un que ja és triat el treu, només aquell; **⌘/Ctrl + clic** a l'arbre, i Maj o ⌘/Ctrl + clic al 3D i al plànol, afegeix o treu peces lliures, models 3D, objectes de referència i **mòduls** (els mòduls es mouen pel camí de la nansa, `moveModuleBy`; Material = el del cos, només taulers; Mides = les del cos; s'eliminen amb `removeModule`; no fan grups) a una **selecció múltiple** (`{ kind: "multi", items }`, `MultiItem`, `toggleMulti`; es llegeix la tecla del `pointerdown`): una caixa amb el gizmo els mou tots junts (`CabinetViewer selectedSet`/`onMoveSet`, `moveMultiBy`), també les fletxes del teclat; Supr els elimina (`removeMulti`); l'inspector (`MultiInspector`; **un grup triat fa servir el mateix inspector** amb els seus elements, per decisió de l'usuari, 2026-10-14, també als Ambients amb el nom editable) diu la posició de tots, les **propietats comunes** (el valor si tots el tenen igual, si no «Diversos» i el que hi posis va a tots: Material —`setMultiMaterial`, a les peces com el seu inspector—; amb un sol tipus, Mides —Ample · Alt · Gruix o Fondària, `setMultiSize`— i, als models, el Gir, `setMultiRot`), **Alineació** (com Figma: per X, Y i Z, a l'inici, al mig o al final de la caixa de tots, `alignMulti`; amb tres o més, «Repartir» amb el mateix espai, `distributeMulti`; amb dos o més, «Espai entre ells» (mm, a dalt) i el darrer botó de cada fila els posa a aquest espai l'un de l'altre, `spaceMulti`; icones `LuAlign…`), el **Grup** de tots (Sense grup · els que hi ha · «+ Grup nou», com el d'una peça; `groupMulti`, `ungroupMulti`; dreceres ⌘G grup nou i ⇧⌘G fora del grup, també amb una peça, un model o un grup triats); **arrossegar a l'arbre** una fila triada arrossega tots els triats: sobre un grup hi entren, al costat d'un element s'hi posen i n'agafen el grup, i a «Treure del grup» en surten (`StructureTree` `drag.multi`), la llista (tocar-ne un el tria sol) i «Eliminar». Amb algun bloquejat, no es mouen. Controls nous: decideix a quin nivell pertanyen
  i posa'ls a l'inspector d'aquell nivell.
- **Estructura** (`composition/StructureTree.tsx`): moble › mòduls (agrupats per fila) › compartiments, peces lliures,
  objectes de referència i models 3D. L'arrel de cada mòdul surt com a **«Interior · …»** (`zoneLabel(z, { root })`; «Interior ·
  2 portes» si porta les portes de tot el mòdul, Mòdul › Portes; un altre front de l'arrel dividida no es fa i no hi surt) amb els compartiments a sota:
  seleccionar-la dona Divisió (les mides de les zones, «Afegir zona» · «Treure la divisió» i «Peces de dins» si n'hi ha);
  sense dividir, el seu Front. Pujar des d'un compartiment (clic al 3D, eliminar) passa per l'Interior abans del mòdul;
  Supr / ⌘X a l'Interior no fa res (avís: `deleteZone` buidaria tot el mòdul). **Objectes de referència només als mobles i
  Models 3D només als objectes** (per decisió de l'usuari; treure ≠ esborrar: si el document ja en té, el grup surt sense +
  ni Duplicar, i enganxar-ne avisa). **Un + a cada grup** (Mòduls · Peces lliures · Objectes de referència · Models 3D; per
  decisió de l'usuari, així es veuen els tipus): demana el nom (`NameDialog`, «Mòdul 3», «Peça 2», «Objecte 1», seleccionat;
  `addElements.ts`) i crea l'element sense més opcions: **mòdul buit** (`emptyModule`, per decisió de l'usuari, el que
  es va deixar preparat al navegador: 600 × 100 × 560, directe a terra, sense laterals, tapa ni fons, obert i sense
  prestatges; materials, gruixos, folgances i ferratges de Preferències; a la Taula, `tableModule`), peça de cara, caixa de 600 × 600 × 100. L'últim mòdul també s'elimina (queda el moble buit). Res de mòduls
  especials, passacables ni plantilles al +. **Excepcions** (per decisió de l'usuari): el + d'«Objectes de referència» obre
  un menú amb els de Preferències › Objectes de referència (els no amagats; `refFromPreset`: de paret, a la seva distància;
  de terra, estirat; sense fondària, 5 mm) i «En blanc…»; el de «Models 3D», un menú amb «Quin fitxer?»
  (`MODEL_FORMAT_HELP`: formats, Poly Haven, què no serveix i com passar-ho per Blender, mida, unitats, on trobar-ne),
  «Triar fitxers…» i «Triar carpeta…» (vegeu Visor › Models 3D › De l'usuari). `SectionTitle menu`.
  **Ull i cadenat** a cada fila (per decisió de l'usuari, 2026-10-14, com Figma; `TreeRow flags`, `core/model/viewFlags.ts`:
  `hidden`/`locked` a mòduls, peces lliures, objectes de referència, models 3D i, als Ambients, elements i parets; els d'un
  grup canvien tots els seus): **amagat** = no es dibuixa a l'editor (3D, plànol, Presentació i Render), però es fabrica i surt
  a Peces, Nesting, Exportar, miniatures i AR; **bloquejat** = no es mou (sense gizmo ni nansa, fletxes no; als Ambients,
  `keepLocked` torna la posició a qualsevol canvi i `mergeHidden` hi torna els amagats). Surten en passar per sobre, sempre
  si són actius i a les pantalles tàctils. Test `model/viewFlags.test.ts`.
  Menú ⋯ per afegir/duplicar/moure/eliminar (manté «Moure amunt/avall», «Moure a l'esquerra/dreta»). **Arrossegar per
  ordenar** (`reorderModule`, `reorderRef`): mòduls dins de la seva fila i objectes; una línia marca on cau. Arrossegar una
  peça lliure sobre la fila d'un grup la hi posa; al costat d'una peça n'agafa el grup; la zona «Treure del grup» surt
  mentre s'arrossega una d'un grup.
- **Propietats** del que hi ha seleccionat i **només d'això**, en seccions plegables amb **una sola oberta alhora** (per decisió de l'usuari, 2026-10-13: `FoldGroup multiple={false}` a l'inspector, recordada a la sessió `mobles:inspector-open`; les subseccions `size="sm"` de dins continuen independents; vegeu UI):
  - Moble: Resum (i avisos de fusteria), Encaixos (si alguna peça en fa),
    Materials de tot el moble (aplica a tots els mòduls), Acabats de l'escena (`Composition.scene`: `floor`, `wall` per a Presentació i miniatura; buit = «Com a
    Preferències»; `CabinetViewer sceneFinish`, `renderThumb(…, finish)`).
  - Mòdul: Posició · Mides · **Caixa** · **Portes** (només amb l'Interior dividit) · **Unió** (si la caixa en fa) ·
    **Materials** (en aquest ordre per decisió de l'usuari, 2026-10-13). **Sense «Acabats»** (per decisió de l'usuari,
    2026-10-08: «això dels acabats no està bé»; abans una secció `mod-joinery`, `LuHammer`): cada fila és a la secció del
    que toca, **un sol lloc per decisió i només el que la construcció llegeix** (`moduleRows` a
    `core/model/usedHardware.ts`, `frontsInspector.test.ts`), en cascada:
    - **Caixa** (`mod-structure`, `LuFrame`; abans «Estructura», es confonia amb la pestanya de l'arbre; `CarcassForm`):
      base —amb la «Pota» pel mateix `HardwarePick`—, fons i, just a sota, **Ranura del fons** (en ranura) o **Retirada
      del fons** (encastat), tapa, laterals, parets, cantonades i, al final, el que és de tots els fronts del mòdul:
      **Estil dels fronts** (Recobrents / Encastats) i Folgança front–cos si hi ha algun front que es fa (un front fix
      també) · Folgança entre fronts amb dues portes, dos calaixos o un front recobrent al costat d'un divisor ·
      Retranqueig dels prestatges amb prestatges que es retiren o una tira LED (`frontOptionsUse`; totes amb «Com a
      Preferències» quan coincideixen amb Preferències › Folgances per defecte i un botó per tornar-hi). Insígnia
      Recobrents/Encastats si hi ha estil.
    - **Portes** (`mod-doors`, `LuDoorClosed`, `ModuleDoorsSection`; per decisió de l'usuari, 2026-10-08): només amb
      l'arrel dividida; les portes de dalt a baix de tot el mòdul (Cap · Una · Dues i les opcions de la porta; vegeu Model
      del moble › Zones › Front d'una zona dividida). Insígnia «Una porta» / «Dues portes». Després de la Caixa (els
      laterals diuen on hi caben) i abans dels Materials (Fronts, que en depèn).
    - **Materials** (`mod-materials`, `LuPalette`, `MaterialsForm`): cos, **Fronts** (`frontMaterial`, «Com el cos»;
      només amb algun front que es fa, com l'Estil), fons i, amb calaixos, **«Fons del calaix»**
      (`Carcass.drawerBottomMaterial`).
    - **Unió** (`mod-joint`, `LuBolt`, `JointForm`; per decisió de l'usuari: «l'espiga fes-ne un acordió que es digui
      Unió»): l'**Espiga** (`module.hardware.dowel`) només si la caixa en fa (`usedHardwareSlots`, `carcassDowels`);
      sense, la secció no surt.
    **Sense «Per defecte dels compartiments»** (per decisió de l'usuari: «això es tria a l'obertura»): el tirador
    (`module.fronts.handles`) i els ferratges del mòdul (`module.hardware`: frontissa, guia o joc, braç, imant, barra,
    llum, marc) no surten a l'inspector del mòdul; **es conserven** i són el que hereten els fronts i accessoris que diuen
    «Com el mòdul» (el selector del compartiment ensenya el nom de l'heretat). Cada compartiment tria el seu al Front o
    als Accessoris; el per defecte ja no es canvia per a tot el mòdul (acceptat per l'usuari). Caixa, Materials
    i Unió editen `module.fronts`, `module.carcass` i `module.hardware`; amagats es conserven. **La «Filera System 32» no hi és** (per decisió de l'usuari, 2026-10-08: és dels
    prestatges): surt a l'inspector del compartiment, on diu `system32RowPlace` (`core/model/usedHardware.ts`,
    `system32Row.test.ts`), i edita la del mòdul (`module.hardware.system32`, una per mòdul; `System32Pick`, ajuda «La de
    tot el mòdul: …»): als **Prestatges**, després de «Regulables», dels compartiments amb regulables que es fan; si no n'hi
    ha cap, al **Front** (després de la «Frontissa»; a la reixeta amb frontisses, després de «Muntatge») dels compartiments
    amb una porta que no és de vidre o una reixeta amb frontisses (placa de la frontissa); les portes de tot el mòdul,
    a **Mòdul › Portes**, després de la «Frontissa». Mai a tots dos llocs; si no és cap d'aquests (p. ex. només el fons encastat, que en llegeix els números per a
    l'avís), enlloc. **Sense «Ferratges»** a l'inspector del mòdul (per decisió de l'usuari,
    2026-10-08: la secció `mod-hardware`, `LuWrench`, amb la llista dels col·locats a mà i **De les regles del mòdul**,
    no surt; el codi es queda: `composition/HardwarePlacements.tsx`, `placements.ts`, `ruleHardwareCounts` a
    `core/build/hardwareSummary.ts`). Treure ≠ esborrar: els col·locats a mà es conserven, es fabriquen i es veuen al 3D,
    on es trien (i llavors s'editen, es dupliquen o s'eliminen al seu inspector o amb el teclat). La peça lliure (no als
    objectes) sí que té «Ferratges» (`HardwarePlacements`, sense les regles; Editar · Duplicar · Eliminar, `LuPencil` ·
    `LuCopy` · `LuTrash2`, `PlacementButtons`), només si ja en porta (**sense «Afegir ferratge»** des del 2026-10-08).
    Un **col·locat triat** (selecció `hardware`, `PlacementInspector`): capçalera «Ferratge · <mòdul>» amb Pare ·
    Duplicar · Eliminar i anterior/següent dins del mateix mòdul, i la secció **Col·locació**, mínima (Ferratge amb el
    `HardwareSelect` · Peça · «Mecanitzats de» · **previsualització en viu** (`PlacementPreview`) · posició per eix
    (`PlacePosRow`: Des de l'esquerra/dreta… · Mig, i la distància) · «També: <peça>»). Els col·locats d'una versió
    anterior amb repetició, mirall, gir o fórmula surten com a **«Avançat»** (només lectura) amb «Simplificar».
    El Front de cada compartiment és al compartiment; les portes de tot el mòdul (Interior dividit), a **Portes**.
  - Compartiment (`ZonePanel`): accions com a icones a la capçalera (Pare · Duplicar · Eliminar; a l'«Interior», l'arrel,
    cap: no es duplica, no es retalla ni s'elimina, i ⌘D, ⌘X i Suprimir avisen sense tocar el porta-retalls) i Front ·
    **Prestatges i accessoris** (`LuRows3`, una sola secció per decisió de l'usuari, 2026-10-13; insígnia «3 · Barra · LED»:
    primer els prestatges —Quantitat · Regulables · Filera System 32 si li toca, vegeu Mòdul · A ras · Gruixuts— i a sota
    els accessoris —Penjar (Barra de penjar) i Llum (Tira LED), interruptor + `HardwarePick` «Com el mòdul»—) · Dividir (Prestatges, Accessoris, Dividir i els tipus
    de Contingut, només si el compartiment els pot aguantar: Model del moble › Zones › Què aguanta cada compartiment; Prestatges i Accessoris tampoc amb calaixos o un front fix propi; Dividir tampoc darrere d'un front fix, per decisió de l'usuari). Als **Calaixos**, sota la quantitat, «Alçada 1»… de cada front com les mides de la Divisió (`DrawerHeights`, `setDrawerHeight`: n−1 editables, «Auto» amb els mm reals de `ModuleBuild.drawerHeights`, l'última el que sobra; per decisió de l'usuari, 2026-10-13). **L'alçada del calaix mana sobre el joc** (per decisió de l'usuari, 2026-10-14): si el joc triat no hi cap (el de dalt, sota la tapa; els altres, fins a la guia del de sobre), aquell calaix porta el més alt de la mateixa sèrie que sí que hi cap (`kitFamily` a `drawerKit.ts`: K → M → N del catàleg de l'app, amb la prebroca de l'item); la comanda ho diu per calaix. Si ni el més baix hi cap, només el front i avís `hardware`. **Una guia per a cada calaix** (per decisió de l'usuari, 2026-10-14: «si en canvies un, el següent igual que l'anterior»; `Front.drawerSlides`, de baix a dalt): amb un joc i alguna alçada a mida (`perDrawerSlides`; totes «Auto» = una sola guia), la «Guia de calaix» passa a dir-se «Guia del calaix 1» i a sota surt «Guia del calaix 2»… (`DrawerSlides` a `ZonePanel`, el `HardwareSelect` amb els jocs de la biblioteca), cadascuna «Com el calaix n» (el de sota) o un joc propi, de qualsevol sèrie; l'ajuda diu amb quin joc es fa. Cada calaix fa el seu pla (`planOf`), la seva fusta, els seus components al 3D i la seva comanda; si no hi cap, el més baix de la seva sèrie. Res amagat compta: sense joc, `visibleZone` el treu (`drawerKit.test.ts`, `hiddenState.test.ts`). Als abatibles, «Opcions del tirador» amb només la distància al cantell que obre (`Front.handleInset`; sense, el `inset` del tirador; com a molt, el mig). Als calaixos, després del Tirador (si n'hi ha), **«Posició del tirador»** Centrat · A dalt (cada tria amb les seves opcions en un acordió petit a sota, `LuSettings2`: «Alçada dels calaixos» amb les alçades, «Opcions de la guia de calaix» amb les del joc, `KitFields`, i «Opcions del tirador» amb la posició) (`Front.handleTop`: mm del cantell de dalt a l'eix, 40 en triar-lo, com a molt el mig; per decisió de l'usuari, 2026-10-13; test `build/drawerHandle.test.ts`). Al Front: el ferratge del tipus (frontissa,
    guia o joc, braç; a la reixeta, l'**imant** després de «Muntatge» i «Trapa»; a la vitrina, el **marc**) i el «Tirador» (amb «Cap
    (push)»). **Sense «Mida»** (per decisió de l'usuari, 2026-10-08: «a les obertures no té sentit l'amplada; ha
    d'anar a la divisió»): l'amplada o l'alçada de cada compartiment és a la **Divisió** del pare (`SplitSizes` a
    `ZonePanel`): una fila per fill, en ordre, **«Amplada 1», «Amplada 2»…** (divisió vertical) o **«Alçada 1»…**
    (horitzontal) (`splitRows` a `zoneLabel.ts`, `zoneLabel.test.ts`; clicar-lo selecciona el compartiment, el nom de
    l'arbre surt a l'ajuda). Per decisió de l'usuari («si només hi ha dos, només pot posar una mida; si n'hi ha 3, 2»):
    **amb n zones s'editen les n−1 primeres** («Auto» o els mm; en treure l'«Auto», els mm que feia) i **l'última no
    s'edita**: diu el que sobra («412 mm (el que sobra)»). Al costat de cada «Auto», els mm que fa. Les mides reals són
    les de la construcció (`splitChildSizes` a `build/layout.ts` sobre `ModuleBuild.layout`: després dels gruixos dels
    divisors i `fitSizes`; `build/splitSizes.test.ts`). **Dades d'abans amb l'última fixa** (potser amb una altra
    «auto»): la construcció no canvia (l'última s'ajusta, `fitSizes`, avís `layout` si no quadrava); en editar qualsevol
    mida de la divisió (`setSplitSize`), primer les «auto» que no són l'última passen als seus mm i l'última a «auto»,
    sense canviar la geometria (mateixes peces), i després s'aplica el canvi. Després, «Afegir zona» · «Treure la divisió» (i a l'«Interior», «Peces de dins»). Una zona dividida
    (l'«Interior» o una de dins) dona només la Divisió: **cap «Front de tota la zona»** (per decisió de l'usuari,
    2026-10-08: les portes de dalt a baix són a Mòdul › Portes). **L'«Interior» (l'arrel) no té opcions de tots els fronts** (per decisió de l'usuari, 2026-10-08: l'estil, les
    folgances i el retranqueig són a Mòdul › Caixa i el material dels fronts a Mòdul › Materials; vegeu Mòdul). Un compartiment **tapat** per les portes de
    tot el mòdul (`coveringZone`) ensenya «Front · Tapat» sense opcions (diu on són: `UI_PATHS.doors`): el seu front no es
    fa (es conserva) i els prestatges i accessoris de dins sí (`walkBuiltZones`, `visibleZone`). **Una sola paraula per a la precedència** (auditoria C3):
    **«Com el mòdul»** = heretat i **«Còpia pròpia»** = una còpia que no és a la biblioteca tal qual (`INHERITED_LABEL`,
    `OWN_COPY_LABEL`, a `HardwarePick`, `HardwareSelect` i `hardwareChoices`). Els camins de secció dels avisos i les
    ajudes surten d'`UI_PATHS`. **Sense «General»**: cada apartat és una secció pròpia amb la seva icona i el valor triat a la insígnia
    (icona dinàmica on hi ha opcions, com els compartiments); el que no toca no surt. Peça lliure (`PartInspector`): Efecte ·
    Orientació · Mides · Material (amb la Veta) · Forma · CNC (amb el Cantell) · Encaixos (de CNC, no als objectes) · Grup · Enganxada (si
    hi ha mòduls) · Posició · Encaixos (tot el moble, si la peça en fa); la que talla no té Material ni CNC. Objecte (`RefInspector`, accions
    Desar a preferències · Eliminar): Efecte · Forma · Orientació (la direcció del cilindre i el perfil, o del tall d'una caixa
    que talla) · Mides · Material (no als que tallen) · Enganxada (Al terra / A la paret) · Posició. Model (`ModelInspector`).
    A la pestanya Foto, el calibratge.
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
  Explosió, Ferratges, Render i Veure a casa (AR); a sota, les vistes (l'únic lloc on es trien), l'obertura, l'**opacitat** i la imatge. **Opacitat** (`ViewerState.opacity`, `LuBlend`, 10–100 %; per decisió de l'usuari, 2026-10-14: «per veure tot el mecanitzat de les peces»): per sota del 100 % totes les peces es fan translúcides amb aquella opacitat (`CabinetViewer seeThrough` → `PanelMesh seeThrough` numèric, la mateixa `veil` de «Com va muntat»: sense escriure la profunditat) i els forats, les ranures i els talls es veuen sempre (com a l'Explosió; «Forats» surt marcat); els ferratges continuen opacs. El **Render la conserva** (per decisió de l'usuari: `veil` marca els materials `userData.seeThrough` i `sceneData` els passa amb la seva opacitat, com el vidre, en lloc de treure'ls com a fantasmes; les marques dels forats no hi surten, només els forats que travessen); l'AR i la miniatura no la fan servir; no es desa.
  **Explosió**: cada peça se separa 160 mm (`EXPLODE_MM`) per la seva `explodeDir` i hi van **els forats i les ranures
  sempre** (Forats surt marcat mentre dura) i tot el que hi va muntat: frontisses, tiradors, plaques, potes importades i
  col·locats a mà (`Panel.fittings`, dins del grup de la peça) i les potes de l'app amb la base (`ExplodeWith`, la mateixa
  animació, `useExplode`). El visor de tots els documents
  (moble, objecte i ambient) amb el mateix aire: 16 a dalt al mòbil i 16 al voltant a l'ordinador.
- **Mode del visor** (`VIEW_MODES`): **Per peça** (`LuShapes`: colors per tipus de peça, paleta `ROLE_GROUPS` a
  `viewer/roleColorMap.ts` i llegenda a `viewer/roleColors.tsx`; «Ferratges» = rol `hardware`, els components dels
  jocs), **Textura** (`LuTrees`: materials i veta) i
  **Presentació** (`LuSparkles`: ombres, sense perfils, graella ni «+»; terra i paret amb llum d'estudi,
  `viewer/PresentationRoom.tsx`, escena a `viewer/presentationScene.ts`). Per dins: la qualitat (`viewer/renderQuality.ts`:
  fast / presentation, també a Preferències › Visor 3D) més `mobles:viewer-role-colors-fast` (els objectes en tenen una de
  pròpia, `mobles:viewer-role-colors-object`, i s'obren amb la textura).
- **Selecció al 3D**: **mòdul seleccionat sòlid amb contorn taronja** (com Figma o SketchUp; per decisió de l'usuari:
  translúcid semblava que canviés de color); només es fa **translúcid amb un compartiment triat**. El primer clic tria el
  mòdul i el segon entra al compartiment tocat (`selectFrom3D`); tornar a clicar el seleccionat puja al pare; clicar la
  carcassa torna al mòdul. **Ratolí a sobre** (`BoxFrame`): contorn prim del color de selecció per sobre de tot (objectes i
  mòduls); seleccionat, gruixut.
- **Ferratges col·locats al 3D** (amb «Ferratges» visible): clicar-ne un el tria (selecció `hardware`; zona de clic = la
  seva caixa + 8 mm, malla invisible); contorn en passar-hi per sobre, gruixut triat (el triat es veu sencer també amb
  «Ferratges» amagat; mai translúcid). **Cap barra flotant** (per decisió de l'usuari): editar, duplicar i eliminar són a
  l'inspector del col·locat (i a la llista de la peça lliure, `PlacementButtons`) i al teclat, un sol camí (`hardwareActions` a `EditorScreen`:
  `duplicatePlacement` —50 mm més cap a dins al llarg de P—, `removePlacement`), un pas de desfer. Els de les regles
  (frontisses, tiradors, potes) són del mòdul: clicar-los tria el mòdul.
- **Moure** (per decisió de l'usuari **el cos no s'arrossega**, així sempre se sap cap on es mourà):
  - **Gizmo** (`viewer/MoveGizmo`): tres fletxes (vermella X de costat, verda Y amunt, blava Z endavant), de mida constant i
    per sobre de tot; cada una arrossega només en la seva direcció (pla que conté l'eix i mira a la càmera). S'amaguen les
    fixades (al terra: Y; a la paret: Z) i la que mira a la càmera (`useFacingAxis`, |cos| > 0,97: vistes de costat o de dalt). `frontRaycast`: les fletxes es
    poden agafar encara que l'objecte sigui dins d'un altre, i el seu clic no tria el que hi ha davant. Per a objectes de
    referència (`RefGhost`), peces lliures, grups i models 3D. Imant de 15 mm a les vores dels mòduls, altres objectes, terra
    i paret (Alt: sense); etiqueta amb la posició mentre s'arrossega; es desa en deixar-lo anar (un pas de desfer). Grups de
    peces: caixa del grup amb el gizmo; el primer clic selecciona el grup i el segon la peça.
  - **Mòduls**: nansa ↔ (`MoveHandle`) uns píxels per sobre de l'aresta de dalt (en un mòdul alt que no hi cap, baixa fins a
    sota de la barra del visor); **sense els + als costats** (per decisió de l'usuari, 2026-10-08: els mòduls s'afegeixen amb el + de l'arbre; `AddButton`/`onAddModule` queden sense ús); arrossegar-la el mou a la
    seva fila (`moveModuleBy`: els de la dreta es queden on eren) i, si és penjat, amunt i avall; al terra, de costat i
    endavant/enrere (`dz`); amb Maj, tot el moble (`moveAllBy`). Imant a les vores dels mòduls i dels objectes. Nanses, + i gizmo són malles 3D de mida constant
    (`usePixelScale`), no `Html` de drei (fallaven en muntar-se i desmuntar-se amb React 19), amb `userData.editorOnly` (la
    imatge per al Render no els porta). La nansa surt també a Presentació.
  - **Posició dels objectes**: camps «↔ De costat X», «↕ Alçada Y», «⤢ Fons Z» (`AxisLabel`, colors com les fletxes;
    `NumberField.label` accepta un ReactNode). «Al terra» (y = 0) i «A la paret» (z = 0) (`RefObject.onFloor`, `onWall`,
    `anchorRef`, aplicat a l'inspector, a l'arrossegament i a les fletxes; el camp fixat queda desactivat).
  - Teclat: fletxes 1 mm (Maj 10), Re Pàg / Av Pàg per a Z.
- **Objectes de referència al 3D**: amb material (`RefObject.material`, secció Material; no als que tallen) es veuen sòlids
  (`surfaceMaterial`, amb ombres) i surten a la Presentació i al render; sense («Cap (fantasma)»), fantasma translúcid que el
  render no pinta. Els que tallen (i les peces lliures que tallen, id `part:<id>`) **es veuen sempre**, a través del moble (per decisió de
  l'usuari, 2026-10-14): en **verd** si toquen alguna peça (`CompositionBuild.cutting`, de `applyRefCuts`) i en **vermell** si no
  en toquen cap (mal col·locats) o tenen un avís; seleccionats, en taronja. Els forats del mòdul seleccionat es marquen en taronja a través de les portes (`CableMarks`).
- **Desfer/refer** (⌘Z, ⇧⌘Z, Ctrl Y; vegeu «Desfer/refer comú» a Mòduls compartits): 50 passos, canvis a menys de
  500 ms = un pas (escriure «1180», arrossegar el gizmo); cada càmera desada també és un pas; la miniatura en queda fora. No als camps de text
  lliure ni dins d'un diàleg ni amb un diàleg modal obert (amb l'editor de perfils obert, ⌘Z desfeia el moble del darrere).
- **Teclat**: Ctrl/⌘ C · X · V · D i Supr per al mòdul, l'objecte, el model o el compartiment (`core/model/editOps.ts`);
  per a un ferratge col·locat, Ctrl/⌘ D (duplicar) i Supr (sense porta-retalls). El
  porta-retalls és a localStorage (`mobles:clipboard`, entre mobles), validat amb zod (`parseClip`); una peça enganxada a un
  mòdul d'un altre moble queda solta, una illa es duplica al costat i no s'enganxen mòduls a un moble només de peces (`lliure`) o objecte. Ctrl/⌘ D
  en un compartiment fa `duplicateZone`. **Eliminar un mòdul** = `removeModule`: peces enganxades soltes al mateix lloc,
  taulell i sòcol al mòdul més proper del tram (o fora) i forats del taulell seus fora.
- **Vistes** (per decisió de l'usuari): només **Davant · Darrere · Esquerra · Dreta · Dalt**, botons de text sense estat triat
  (`CameraViews` a `ViewerControls`, `viewNames.ts`) en un sol lloc, Opcions de vista (ordinador i mòbil). **Sense perspectiva i
  amb fils** (per decisió de l'usuari, 2026-10-14: «que siguin de 0 perspectiva, i els renders amb fils, per poder moure
  la peça seleccionada»): càmera **ortogràfica** d'aquell costat amb el zoom que hi fa cabre el moble (`CameraRig`,
  `OrthographicCamera`; es pot orbitar i fer zoom) i el moble en **línies**: les peces gairebé transparents
  (`WIRE_OPACITY`, la `veil`), el perfil fosc i els forats sempre a la vista (`PanelMesh wire`); el gizmo i la selecció
  funcionen igual. Una vista no es desa com a càmera. «Enquadrar» torna al 3/4 en perspectiva i només surt marcat amb el
  3/4. Sense cotes (són a l'Alçat).
- **Càmera**: s'enquadra en obrir, triar una vista, redimensionar o amb «Enquadrar» (`LuVideo`); editar no la mou. El botó
  surt **marcat** mentre la càmera és a l'enquadrament (`onFramedChange`). **Es recorda per moble** (`Composition.camera`,
  `CameraPose` a `core/model/camera.ts`: posició, punt mirat i fov; una de no vàlida es descarta): 1 s després d'orbitar,
  d'«Enquadrar» o de triar una vista es desa amb `saveProjectCamera`, **sense tocar `updatedAt` ni `edited`**; és **un pas
  del desfer** (per decisió de l'usuari, 2026-10-14: l'historial de l'editor és `{ comp, cam }`; ⌘Z / ⇧⌘Z hi tornen, el
  visor hi va amb `CabinetViewer cameraGoto` i es desa); el **zoom** va de 2 cm a 60 m (`MAX_DISTANCE`); `updateProjectComposition` conserva la desada. En obrir-lo `CabinetViewer initialCamera` hi torna; redimensionar no
  la treu fins que s'orbita, s'enquadra o es tria una vista. Va al `.moble`.
- **Editor de perfils** (`composition/ProfileEditor.tsx`, com el mode vector de Figma): **Moure** (nodes i manegadors en
  rombe; Alt trenca el reflex; doble clic node ↔ corba), **Ploma** (clic = cantonada, clic i arrossegar = manegadors
  simètrics, clicar el primer node o Retorn tanca, Esc descarta), **Corbar** (arrossegar el punt del mig d'un costat,
  `bendEdge`; clic a un node commuta corba/cantonada) i **Esborrar**; clic al punt del mig afegeix un node sense canviar la
  forma (`splitEdge`, de Casteljau); radi de cantonada; opcions de la dreta en `FoldItem` `size="sm"` (**Selecció**, oberta,
  amb el node a la insígnia i la paperera a `actions` · **Arrodonir la punta** · **Com funciona**, tancades) i el dibuix
  quadrat com a molt de `100dvh − 300px` (`--profile-canvas`): a l'ordinador (1440 × 900, 1280 × 720) no es desplaça; mides
  i àrea a la línia de sota; imant a la quadrícula (Ctrl/⌘: lliure, 0,1 mm). **Maj = angles de 45°** (per decisió de l'usuari, com a Figma: `snapAngle45`) al node nou de la ploma respecte de l'anterior i als manegadors (arrossegant-los o amb la ploma); la línia del manegador es posa vermella. **Desfer/refer propi** (el comú, botons
  `UndoRedo` al costat de les eines; dreceres només dins del diàleg, `useUndoKeys scope`; el moble del darrere no es toca):
  un pas per arrossegada, per node de la ploma (⌘Z treu l'últim; sense cap, cancel·la la ploma i torna la forma d'abans) i
  per acció; escriure a X/Y o les fletxes seguides, un pas (`group`). Es reinicia en obrir-lo. (Què fan Maj/Alt a la
  ploma: pendent de decidir, `docs/millores-v1/editor-formes.md` §2.)
- **Assistent IA** (`docs/xat-ia.md`; per decisió de l'usuari, la clau a Preferències i el navegador crida l'API
  directament). **Un sol assistent personal per a tota l'app** (per decisió de l'usuari, 2026-10-13: «un botó de
  l'assistent personal al menú principal… amb tot el context de l'app, que pugui fer tot el que pot fer una persona i
  que sàpiga si tinc alguna cosa seleccionada»): botó **«Assistent»** (`LuMessageSquare`) al menú principal, sota Mobles ·
  Ambients · Objectes (i a la barra de baix del mòbil), que obre un calaix (`features/assistant/GlobalAssistant.tsx`, a
  demanda; es munta el primer cop i es queda muntat; sense historial desat). **A l'ordinador és una columna a la dreta** (per decisió de l'usuari: «encara que estigui obert, s'ha de poder navegar»): l'app s'estreny i es pot seguir treballant i navegant; al mòbil, el calaix a pantalla completa. **No es tanca sol** (ni clicant fora ni amb Esc); només la ✕, que, si hi ha conversa, pregunta «Tancar l'assistent?» (es perd la conversa) i en tancar-lo la buida. Si l'usuari puja a llegir, el xat no el torna avall mentre arriba text (només si ja era al final). **L'amplada de la columna es canvia arrossegant-ne la vora esquerra** (per decisió de l'usuari, 2026-10-14: sense cap barra a la vista; la nansa només surt amb el ratolí a sobre, `ResizeHandle` `quiet`; 48–900 px com les Propietats, doble clic torna a 400, recordada a `mobles:assistant-width`). **Els fitxers es poden deixar anar a sobre del xat** (per decisió de l'usuari, 2026-10-14): fotos i plànols (≤ 1568 px JPEG), PDF (bloc `document`, ≤ 30 MB) i fitxers de text (dins del missatge, ≤ 200.000 caràcters), diversos alhora, també amb el clip (`assistant/attachments.ts`). **Ja no hi ha pestanya «Assistent» a
  l'Editor ni als Ambients** (`Workspace extra` sense ús). El document obert s'hi registra (`assistantHub.ts`:
  `registerDoc` amb el `ChatTarget` i una funció que diu la selecció amb els ids de les eines —mòdul, compartiment,
  peça, objecte de referència, element o paret de l'ambient—) i l'app hi posa la navegació (`registerNav`). Eines de
  l'app (`appTools.ts`): on ets (`get_app`), documents (`list_documents`, `open_document`, `create_document`,
  `rename_document`, `duplicate_document`, `move_to_group`, `delete_document` —només amb `confirmed` després d'un sí al
  xat; un moble que és en un ambient no s'esborra—), Peces i Nesting del moble obert (`get_cutlist`, `get_nesting`,
  `set_sheet`), Exportar (`export_files`: xcs, step, csv_topsolid, dxf, cutlist_csv, glb, amb els avisos; baixa el
  fitxer i el treu d'esborrany), ferratges (`list_hardware`, `get_hardware` —paràmetres amb els límits de `hardwareParams`—, `edit_hardware` —nom, fabricant, número i paràmetres amb `setHardwareParam`; els de l'app (`builtin`) només duplicant-los—, `set_hardware_default`, `set_front_hardware`: frontissa, guia o joc, braç, imant, tirador —«none» = push—, barra, LED i marc d'un compartiment del moble obert, amb `slotAccepts`; còpia de l'item), Preferències (`get_settings`, `set_pref_material` —també color, rugositat, acabat sencer o tornar a un d'abans amb `switchFinish`/`restoredFinish` (la foto no), reflex, vellut, llum que passa i que fa, i el nom amb `renameMaterialEverywhere` com Preferències, també al document obert—, `set_pref_defaults`, `set_pref_gaps`,
  `set_default_machine`; validat amb `SettingsSchema`; la clau de l'API mai), `go_to` i **la base de dades** (per decisió de l'usuari: «li pots donar accés a l'IndexedDB?»; `db_tables`, `db_read` —qualsevol taula, camí amb punts i `#id`, sense imatges, fitxers ni la clau (`dbSafe`), com a molt ~40.000 caràcters— i `db_write` —només `projects` (`name`, `composition…`), `ambients` (`name`, `data…`) i `settings` (`data…`, mai `apiKey`), validat amb `CompositionSchema` / `AmbientSchema` / `SettingsSchema`; al document obert torna el document (un pas de desfer); als altres, només amb `confirmed` després d'ensenyar-ho, perquè no es desfà). Amb un moble obert, també les **peces lliures** amb les eines dels objectes (`objectToolSet({ fabricated: true })`: `nest` segons el material, `nestFor`; forma `polygon` = punts amb bulge opcional → `PNode`, la forma a mida de l'editor de perfils). **Sempre el mateix joc
  d'eines** (`allToolSet`: les de l'app i les dels tres tipus de document; cada eina de document només serveix amb un
  document del seu tipus obert): l'API lliga els blocs de pensament a les instruccions i a les eines, i canviar-les a
  mitja conversa (en obrir un document) trencava el torn (`runTurn` `refresh` queda per a qui el necessiti); cada missatge porta davant «[Context de l'app: …]» (`contextLine`); en acabar el torn, un pas
  de desfer a cada document tocat. Tests `features/assistant/appTools.test.ts` i `chatTurn.test.ts`. Abans era una
  pestanya a cada document; el que segueix és el xat comú i les eines de cada document: als mobles i als **objectes**
  (no als `lliure` d'abans) i als **Ambients** (vegeu Ambients › Assistent IA). **Un sol xat per a tots els documents**
  (per decisió de l'usuari: «i a Objectes i Ambients?»): el document diu el seu **joc d'eines**
  (`core/assistant/toolset.ts`, `AssistantToolSet<D>`: instruccions, eines, `run` —pot ser asíncrona—, `payload` i
  `describe`) i el xat rep un `ChatTarget` (`features/assistant/chatTarget.ts`: `toolset` a demanda amb `import()`,
  `getDoc`, `apply`, `commit`, el text del xat buit i les propostes). `mobleToolSet` (`tools.ts`), `objectToolSet`
  (`objectTools.ts`) i `ambientToolSet` (`ambientTools.ts`); les eines no són al bloc de l'editor (es carreguen amb el
  primer missatge). `features/assistant/ChatPanel.tsx` (a demanda, `React.lazy`; es munta el primer cop que s'obre i es queda
  muntat, la conversa dura mentre l'Editor és obert): missatges, text en directe, cada eina en una línia, aturar
  (`AbortController`), «Nova conversa», adjuntar una foto o un plànol (`shrinkImage` a ≤ 1568 px JPEG, la imatge abans
  del text). Sense clau: avís amb l'enllaç a Preferències › Assistent IA (`openSettings`, esdeveniment
  `mobles:open-settings`); sense connexió, ho diu (`errors.ts`, errors del SDK en català). El torn
  (`features/assistant/chatTurn.ts`, sense React, genèric): `messages.stream`, `tool_use` → `toolset.run` → `tool_result`
  (tots junts, `is_error` si falla) fins a `end_turn`; reenvia el `content` sencer de l'assistent (blocs de pensament
  amb la signatura; si l'API els rebutja perquè l'app ha canviat d'eines o d'instruccions, `stripThinking` els treu i es torna a provar un cop); instruccions i eines a la memòria cau (`cache_control`). **Eines** = `core/assistant/tools.ts`,
  pures, entrada validada amb zod (el mateix esquema fa el JSON Schema, `z.toJSONSchema`): `get_moble`, `add_module`,
  `remove_module`, `rename_module`, `set_module_size`, `set_module_position` (`setModuleMount`, el mateix camí que la
  «Fila» de Mòdul › Posició), `set_carcass`, `split_zone`, `unsplit_zone`, `set_zone_size` (`setSplitSize`: l'última
  zona és el que sobra), `set_front` (`switchFront`/`setFront`; portes de tot el mòdul només a l'Interior dividit; un
  compartiment tapat no en porta), `set_shelves`, `set_material` (només els de Preferències). Les mateixes regles que la
  UI (`zoneSupport.ts`: què aguanta cada compartiment); el resultat porta el resum del moble (`summary.ts`: mòduls,
  caixa, zones amb ids, llums i què hi pot anar) i els **avisos de fusteria nous** perquè el model es corregeixi.
  **Objectes** (`core/assistant/objectTools.ts`, instruccions `OBJECT_SYSTEM_PROMPT`: decoratiu, no es fabrica; mm; Y amunt,
  terra y = 0; Z endavant): `get_object` (peces amb id, nom, orientació, w × h, gruix, cantonada x/y/z i caixa, material,
  forma, grup; models 3D; materials de `partChoices` per categoria), `add_part` (orientació front/side/flat, mides,
  posició, material de Preferències —també Simulació—, forma rectangle · arrodonit amb radi · el·lipse · cercle amb
  `roundRect`/`ellipse` d'`objectShapes.ts`, grup), `update_part` (qualsevol d'aquests; `reorientPart` conserva el centre;
  una forma arrodonida o el·líptica es refà a la mida nova, `partShapeKind`), `remove_part`, `duplicate_part`
  (`insertPartCopy`, o a dx/dy/dz), `set_group`, `move_group` (`moveGroupBy`: no baixa de terra) i `duplicate_group`
  (`duplicateGroup`); sempre `nest: false`.
  **Desfer**: cada torn és **un sol pas** (`set(…, { commit: false })` per eina i `commit()` en acabar o aturar; dins
  d'una tanda, cada eina parteix de la de l'anterior). Res de la clau a la consola (`logLevel: "off"`), cap telemetria.
  Tests `core/assistant/tools.test.ts`, `objectTools.test.ts`, `ambientTools.test.ts` i `features/assistant/chatTurn.test.ts`
  (client fals, sense xarxa).
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
- **Ferratges visuals** (`viewer/Hardware.tsx`, «Ferratges» a Opcions de vista, `mobles:viewer-hardware`): tirador de
  barra, potes regulables i el **dibuix 3D dels ferratges de sèrie** (per decisió de l'usuari, 2026-10-08: «els ferratges
  que teníem de sèrie fes el dibuix 3D»; `core/build/hardwareSolids.ts`, pur: caixes i cilindres en coordenades de la
  peça, posats amb els forats i els accessoris que fa el motor; `builtinHardwareGroup` a `viewer/hardwareShapes.ts` els
  fa malles amb geometries unitàries i materials niquelat / acer / gris fosc / plàstic / faig / alumini compartits):
  **frontissa** (cassoleta dins del forat amb l'ala i el braç, amb el front; la **placa**, fixa al lateral: `fixedSolids`
  la calcula des del front i la torna per la peça a la cara de la qual toca —lateral, divisor, tapa o base— en les seves
  coordenades, així en obrir només es mou el que va collat a la part mòbil, per decisió de l'usuari, 2026-10-13; el
  visor, «Com va muntat» i les miniatures la passen amb els `pins`),
  **suport de prestatge** als forats System 32 just sota un prestatge (`shelfPins`), **espiga** de faig des del forat de
  cara (un cop per espiga), **guia** (cos al lateral des de 34 mm davant del primer forat, corredora a la caixa),
  **braç d'abatible** (placa i braç), **imant** (catxet al cantell, placa d'acer a la cara), **push** (cos del Tip-On a la
  vora que obre, **fix al moble** com la placa: al lateral de la vora que obre o a la peça de darrere del front), **barra** (suports dels extrems) i **tira LED** (perfil d'alumini). **Surten al render** (per decisió de l'usuari,
  2026-10-14: «la foto ha de ser hiperrealista, ha de sortir tot»; abans eren `editorOnly`) i, en obrir el Render,
  «Ferratges» s'encén; als ambients també (`buildScene` amb `hardware`, i les potes genèriques amb `genericLegsGroup`); a
  l'AR i a les exportacions GLB/USDZ, no. Només es dibuixen. Els **importats** (`PanelFittings`, `Panel.fittings`, `kind`
  hinge/plate/handle/leg): el GLB de la frontissa a cada cassoleta, el de la placa al lateral, el del tirador a la cara de
  fora del front (sense la barra genèrica) i el de la pota a cada cantonada de la base (sense les genèriques,
  `ViewerModule.legs.fitted`) (`loadModel` dels `hwa-…`, taula Dexie `hardwareAssets`,
  v6), al marc del ferratge (u = v × n, `fittingMatrix`); sense el model, la caixa. No surten al render, l'AR ni les
  exportacions (sí a les miniatures de Preferències › Ferratges). El marc, el dibuix dels de sèrie
  (`builtinHardwareGroup`) i les marques dels forats (`holeMarkMatrices`) són a `viewer/hardwareShapes.ts`: visor,
  «Com va muntat» i miniatures.
  Els col·locats a mà es trien al 3D (`PanelFittings selected/onSelect`, vegeu Editor › Ferratges col·locats al 3D). El GLB
  d'un importat ja és al seu **marc de muntatge** (`imported.mountFrame`, §11 de `docs/ferratges-import.md`): a la
  cassoleta hi entra tal com es veuria col·locat.
  `PanelMesh proposedTags`: els forats amb aquestes etiquetes, en taronja (els proposats d'un importat sense confirmar al
  muntatge de Preferències › Ferratges); `PanelMesh pins` (suports de prestatge) i `seeThrough` (fusta translúcida a
  0,4 sense escriure la profunditat, al muntatge); `MovingPanel` s'exporta per al mateix muntatge.
- **Components dels jocs de calaix** (`extras` amb rol `hardware`, `kitSolidPanels`): peces de caixa normals, **massisses**
  (`panelMaterials`: totes les cares amb l'acabat del material, mai el color del tauler vist als cantells) i pintades pel
  nom del material amb `resolveFinish` (paraula clau si no és a Materials: «Acer fosc» → gris fosc metàl·lic, «Blanc
  seda» / «Gris mat» → blanc / gris mat; `materialIssues` no avisa d'aquests noms). En obrir un calaix (`opening.ts`,
  `movingGroups`), surten els `drawer-<k>-…` (laterals de doble paret, corredora de la guia, suports, darrere, barra) i el
  **cos de la guia** (`kitfix-<k>-kit-slide-…`, acer fosc) es queda fix al lateral del moble: es veu de seguida què és fix
  i què es mou. La NL de l'obertura surt del gruix del cos fix.
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
    precachegen. **Herba (2 × 2 m)** (`grass-patch`, `models/grass_patch.glb`, 40.000 triangles, 0,75 MB): ~120 mates
    de `grass_medium_01` escampades (`scripts/polyhaven-grass.py`, `mode: "patch"`); al Showroom, fora de la vidriera. El render per CPU també retalla les fulles (`RenderMaterial.alphaCut`, `alphaAt`).
  - **De l'usuari** (sense llista de models al + —només l'explicació del format i «Triar un fitxer .glb…»—, per decisió de l'usuari: les plantes de l'app són al catàleg d'Objectes;
    a l'inspector, «Model» diu el nom i «Canviar» n'importa un altre; `composition/ModelUpload.tsx`): taula Dexie **v5**
    `models` (`UserModel`: id `user-…`, nom, `blob`, mida en mm); `db/userModels.ts` (`addUserModelBuffer` valida amb
    `GLTFLoader` + meshopt i mesura; sempre es desa un `.glb`; avís si fa més de 15 MB).
  - **Importar** (`composition/ModelImportDialog.tsx`, finestra amb el progrés, el resultat i les alternatives si falla;
    `composition/modelImport.ts`; pur a `core/import/modelFiles.ts` i `core/import/polyHaven.ts` amb tests): fitxers,
    carpeta o `.zip` (`expandPicked`). El model del conjunt (`pickMainModel`: glb › gltf › fbx › blend › usd): `.glb` tal
    qual; `.gltf` + `.bin` + textures amb `GLTFLoader` i un `LoadingManager` que serveix el conjunt amb URL de blob
    (`resolveUri`/`findFile`: `%20`, `../`, camins absoluts, pel nom si la carpeta no hi és; el que falta no va a la xarxa) i
    `GLTFExporter` → un `.glb` (l'ARM de Poly Haven és el `occlusionRoughnessMetallic` estàndard); `.fbx` amb `FBXLoader`
    (`UnitScaleFactor` → metres, Phong → estàndard, textures EXR descodificades). **`.blend`/`.usd` no es poden llegir al
    navegador**: si el nom és de Poly Haven (`<id>_<res>.blend`, `parsePolyHavenName`), es baixa **el mateix model en glTF**
    de l'API (CORS obert, `features/file/polyHavenApi.ts`; `/files/<id>` → `planPolyHavenDownload`: la mateixa resolució,
    com a molt 2k; les textures del zip amb el mateix nom —també el `nor_gl`/`rough` en EXR, passats a PNG— no es tornen a
    baixar) amb el progrés en MB; sense connexió o si no és de Poly Haven, error amb les alternatives (baixar-lo en glTF,
    Blender, `scripts/polyhaven-tree-to-glb.py`). Un zip de **textura** de Poly Haven (`/info` `type` 1) o sense model:
    «No és un model 3D» i les textures a Materials. Després, `addUserModelBuffer` (optimitzar, mesurar, desar). El nom, el
    de l'API si es pot. **«Afegir les textures a Materials»** (`settings/textureMaterials.ts`, `materialsFromTextures`): un
    material de **Simulació** per joc (`groupTextureSets`/`textureSetKey`: el nom del fitxer sense el mapa ni la resolució),
    acabat de foto amb relleu i brillantor (`withTextureSet`, `pbrSetMaterial`, nom únic `uniqueMaterialName`), mida real
    a la finestra (per defecte, la de Poly Haven o la caixa del model). **S'optimitzen en pujar-los**
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
  - **La configuració es desa per document** (per decisió de l'usuari; `RenderDialog saveKey`: `ambient:<id>`, `moble:<id>`;
    `renderPrefs.ts`, `localStorage` `mobles:render:<clau>`): opcions, imatge, ambient de llum, resolució, límit, escena,
    format i cel (no un .hdr propi). En obrir-lo mana sobre la de l'escena (`renderPreset`) i la de defecte; `mergeSaved`
    només agafa els valors del mateix tipus. No es desa en obrir (`skipSave`). El motor ja es desava (`mobles:render-engine`).
  - **Comença aturat**: obrir el diàleg mostra la imatge del visor (`SceneGetter.snapshot`) i «Començar»; després, les
    opcions de qualitat, motor, escena i llum tornen a començar; aturar/continuar, límit de passades, passades per segon.
  - `extractScene` passa l'escena a triangles + materials + textures; tots dos motors fan servir el **mateix BVH** (`bvh.ts`,
    SAH per calaixos, 8 paraules per node), llums (`lights.ts`) i constants (`shading.ts`). Contracte (`engine.ts`): sumes RGBA
    + AOV (albedo i normal) i nombre de mostres; el diàleg divideix, filtra el soroll, fa el to i desa el PNG.
  - **GPU sense textures de GPU**: tot en buffers d'emmagatzematge (`gpuScene.ts`; textures RGBA8 en un buffer de u32 amb
    bilineal fet a mà, reduïdes a la meitat si no hi caben): així no hi ha el límit de 16 unitats de textura. Respecta
    `maxStorageBufferBindingSize`/`maxBufferSize` (si no hi cap, CPU). Tandes de files de ~10–30 ms (més mostres per passada
    si va de pressa) perquè la pàgina no s'encalli; llegeix el resultat a cada passada sencera (cada cop menys sovint si costa).
  - **Vernís i vellut** (per decisió de l'usuari, com els lacats i els vellut dels catàlegs): `RenderMaterial.coat`
    (capa transparent: GGX nítid `COAT_ROUGHNESS` 0,08, F0 0,04; la base rep `1 − coat·F(n·v)`; es tria en rebotar amb
    `PC = coat·min(0,5; 0,15 + F)` i la densitat és la mescla) i `sheen` (Disney: `sheen·(1 − l·h)⁵`, del color de la tela
    cap al blanc), als dos motors (`COAT`, `CA2`, `CFV`, `PC`, `SH`; a la GPU, `g.zw` del material). Dels materials:
    `MaterialPref.coat` / `sheen` (0–1, «Al render» a l'editor de materials: «Reflex», «Vellut» i «Llum que passa» =
    `translucent`); sense valor, el de l'app
    (`core/model/materialFx.ts`: teles i vellut per id, cuir, parquet, rajoles, ceràmica, pantalla; pedra polida → vernís),
    així les preferències d'abans també en tenen. Lacats brillants nous (`GLOSS_MATERIALS`, v15): «Lacat negre brillant»
    i «Lacat blanc brillant» (taulers, vernís 1).
    Més materials (`RIFT_MATERIALS`, v16): «Roure de fil» i «Noguera de fil» (veta recta, sense flama), «Vidre ambre»,
    «Ceràmica sorra», «Marbre blanc» i «Marbre negre» (pedra polida). v17: «Revestiment de roure de fil»
    (`CLADDING_MATERIALS`; la xapa de foto del «Revestiment de roure» feia flames a la paret) i «Pantalla de lli» amb
    `glow` `LAMPSHADE_GLOW` (2,2; abans 4, sortia blanca cremada; només si encara tenia el 4).
  - **Vista per les finestres** (per decisió de l'usuari): panorames de foto (`backdrops.ts`): Jardí i Mar són fotos
    360° de Poly Haven (CC0, `public/backdrop/*-2k.jpg`, de les JPG tonemapejades de symmetrical_garden_02 i
    simons_town_rocks; a la memòria cau del SW en fer-les servir) i «La meva foto» (`saveBackdropPhoto`, Cache Storage
    `mobles-backdrop-v1`; una foto normal es fa panorama amb `photoPanorama`: 70° davant, mirall als costats, alfa 0 per
    sobre; una 2:1 tal qual). `aimBackdrop` gira el panorama perquè `hero` quedi on mira la càmera. «El cel (HDRI)»: res
    (un .hdr propi es veu tal qual per les finestres i també fa llum; en carregar-ne un es tria sol). `RenderOpts.view`
    l'afegeix com a textura i `RenderScene.backdrop` n'és l'índex (GPU: `P.emit.z` = índex + 1). Només el veuen els raigs
    de càmera directes (`vertex < 0`) que no toquen res: no fa llum; es multiplica per la llum del cel a l'horitzó ×
    `BACKDROP_GAIN` (2). Els models 3D d'arbres (Xicranda, Avet) es poden posar fora (plantilla: `outside: true`).
    Terra de fora (`Ambient3D`): una habitació tancada (3+ parets) amb algun element que surt més de 300 mm de les parets té el terra
    de dins fins a l'eix de les parets (on és el vidre: el parquet no surt per la finestra) i fora un pla 4 mm més avall amb `Ambient.outsideFloorMaterial` (Acabats › «Terra
    de fora»; sense, «Gespa», `sim-lawn`, v17). **v18**: la «Gespa» és una foto (`LAWN_FINISH`,
    `public/textures/grass_lawn/`, 2 × 2 m sense junta) feta amb Blender a partir de les mates d'herba de Poly Haven
    `grass_medium_01` que va passar l'usuari (`scripts/polyhaven-grass.py`, `mode: "tex"`: vista de dalt amb Cycles; relleu i
    brillantor de la lluminositat); la de tela de la v17 hi passa sola, una de retocada no.
  - **Materials**: difús + GGX amb Fresnel, metalls, vidre fi (no fa ombra), retall per l'alfa. **Arestes arrodonides** (2 mm,
    `BEVEL_RADIUS`, `userData.bevel`, `bevelNormal`). **Veta amb relleu** (`userData.grain`). **Normals llises**
    (`RenderScene.normals`, `smoothNormal`; GPU: `encodeNormal`); la geomètrica es queda per desplaçar rajos; cantells corbs
    llisos (`creaseNormals` a `cutoutGeometry`, < 30°). **Mapes PBR** (`normalMap`/`roughMap`, `tangentFrame`/`perturbNormal`).
    **Llums que fan llum** (`MaterialPref.glow` → `RenderMaterial.emission`, mostra directa dels emissors, `emitters.ts`;
    «Llums enceses» + intensitat; la llum que es **veu** d'un emissor amb textura va multiplicada per la textura respecte de
    la seva mitjana, `emK`, als dos motors: a la pantalla de lli es veu la tela en lloc d'una taca blanca; la que fa llum,
    la mitjana; **«Llums · com es veuen»** (`RenderOpts.lampView`, 0,35 per defecte, `LightSetup.lampView`, GPU `P.lamp.z`):
    multiplica només la llum dels emissors que veu la càmera directament (`vertex < 0`), no la que fan a l'habitació:
    la pantalla es veu de tela i no una taca blanca encara que l'exposició automàtica pugi). **Translucidesa** (`MaterialPref.translucent`).
  - **Llum**: sol amb mida (ombres suaus; el reflex s'eixampla amb la mida) i halo ample al cel de dia; cel amb mostra directa
    a cada rebot i MIS: cel llis, **HDRI per importància** (`envSampling.ts`) i, als
    interiors, per les finestres (portals). **Sense ateses**: la indirecta té un màxim relatiu a la llum de l'escena
    (`sceneKey`, la mateixa als dos motors; ×20 indirecta, ×400 directa) i després d'un rebot difús els reflexos són més rugosos
    (`PATH_ROUGHNESS`).
  - **Interiors com les fotos de revista** (ambients): cel de dia (`daySky`, `scene.userData.daylight`) i sol tres vegades més
    fort; les habitacions tancades porten **sostre** (`userData.renderOnly = "ceiling"`, es veu quan la càmera és a dins, al visor i al render;
    **només si hi ha alguna finestra**: sense, l'habitació sortia negra) i els vidres són **portals** (`userData.portal`). Exposició automàtica (mitjana geomètrica de les superfícies al gris del
    18 %, fins a ×40; per defecte als ambients) i temperatura càlida per defecte.
  - **Càmera de fotògraf** (`photoCamera` a `sceneData.ts`, s'aplica a la càmera del visor en començar el render):
    **Verticals rectes** (per defecte; `RenderOpts.straight`): càmera anivellada i descentrament de la lent
    (`RenderCamera.shift`, `ly = nyp·scale + shift`; a la GPU va a `cam3.w`) perquè el centre de la imatge sigui on
    mirava; mirant de més de 60° no es fa. L'enfocament fa servir el raig del centre amb el descentrament. **Objectiu**
    (`focal`: Visor · 24 · 35 · 50 mm, equivalent de 35 mm amb el costat llarg de 36 mm). Tests a `render.test.ts`.
  - **Ambient de llum** (`MOODS`, a Llum): Dia · Capvespre (sol baix, poc cel, llums ×1,5, més càlid) · Vespre (sense
    sol, cel 0,05, llums ×2,5): canvien la llum i l'exposició; al capvespre i al vespre l'exposició automàtica deixa la
    llum mitjana més fosca (`Look.key` 0,1 / 0,06 en lloc de 0,18) i amb més contrast. El fons (raigs que no toquen res)
    es multiplica per la llum del cel als dos motors (al vespre, fosc). Obrir el Render des de l'editor treu els colors
    per rol del mode Ràpid (si no, el render sortia amb els colors de les peces).
  - **Opcions** en seccions plegables (`FoldItem`: Qualitat, Càmera, Escena, Llums, Imatge, amb el resum a la insígnia; a
    Llums, l'Ambient a dalt i les subseccions `size="sm"` **Sol** · **Cel** · **Llum** (la dels materials que fan llum); la
    columna porta 3 px a l'esquerra perquè el desplaçament no talli els controls, i els interruptors són el `Switch` de l'app):
    motor, resolució, rebots, aturar a N passades; format (visor, 3:2, 4:5, 16:9, 1:1) i desenfocament (lent fina, enfoca el centre); escena (habitació de
    Presentació / només terra / cap, `userData.room`); sol, intensitat, ombres, **Cel** (`render/skies.ts`: «Dia» procedural,
    «Núvols» i «Interior» HDRI de Poly Haven reduïts a 1K a `public/hdr/` (el cel que es veu es llegeix **bilineal** als dos motors, `envSky`: amb el píxel més proper sortia a quadres per les finestres; la mostra per importància continua per píxel), precachejats, o un `.hdr` propi, `hdr.ts`, que es pot
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
  «Carregar joc de textures…» (diversos fitxers o un `.zip`, `unzip`; el `.zip` de Poly Haven tal com es baixa, en
  qualsevol format), «Carpeta…» (`webkitdirectory`) o deixar-los anar a sobre (`pickedFromDrop`). **EXR** (els zips «Blend»
  de Poly Haven porten el normal i la rugositat en EXR): `components/viewer/exrImage.ts` (`EXRLoader` de three a demanda,
  `floatToRgba8`: 0–1 → 8 bits, files de baix a dalt; el normal es queda OpenGL); entre dos fitxers del mateix mapa, la
  imatge guanya a l'EXR. Un joc de Poly Haven (`<id>_<res>` als noms, `readPickedTextureSet`) pren la mida real de l'API
  (`/info` `dimensions`; sense connexió, la d'abans). **Biblioteca › «Joc de textures…»** fa un material nou de Simulació
  amb el nom del joc (el de Poly Haven si hi ha connexió). Es reconeixen pel nom (`classifyTextureFile`/`planTextureSet`: mana l'última paraula que és un
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
  materials fets (fustes, lacats, pedres, metalls, vidres, teixits, terres, parets), «En blanc» i «Joc de textures…» (vegeu Mapes PBR). `libraryItems.test.ts`.
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
  objectes i models —un model girat de prop de 90° té l'ample i la fondària creuats—; s'apliquen en sortir dels camps, amb Retorn o amb «Aplicar» —mentre s'escriu, no—; **són un pas del desfer de l'ambient** (l'historial porta `{ amb, linked }`, la composició de cada moble tocat; ⌘Z la torna i la desa); els gruixos no; una divisió amb totes les mides fixes deixa l'última «auto») i la posició; «Obrir a
  l'editor» per a l'interior. Els objectes es col·loquen igual. El + de «Mobles» / «Objectes» obre la galeria a **pantalla
  completa** (`AmbientPicker`: `Drawer` full amb la de Mobles, `NewMobleGallery`, o la d'Objectes) **sense** botó «Nou moble» / «Nou objecte»
  (per decisió de l'usuari: un moble en blanc a l'ambient no servia i despistava), amb les mateixes seccions que la pàgina:
  **Historial** (sense grup), **Projectes** (els grups, `FolderedGrid show="folders"`) i Catàleg; sense «Seleccionar», «Grup
  nou» ni el menú dels grups (aquí només es tria: tocar una targeta o «Afegir» la col·loca); una plantilla crea el moble i el col·loca. Els que ja són en un ambient
  porten la marca (`useAmbientMembership`, `ProjectCard`), destacada (✓ i vora) a la finestra de l'ambient obert.
- **Blocs** (`kind = "block"`, `blockComposition`): llegat; els antics es veuen i s'editen (inspector «Bloc»), però no se'n
  creen de nous: els `BLOCK_PRESETS` són ara objectes (`object-<id>`). Tot es dibuixa pel mateix camí: build → peces →
  `buildScene`.
- **Editor** (`features/ambients/AmbientEditor.tsx`, sobre `Workspace`): pestanyes **Plànol · 3D** a dalt al mig del visor
  (es recorda, `AMBIENT_TAB_KEY`; els creats del catàleg s'obren al 3D). **Arbre a l'esquerra com l'Estructura de
  l'editor** (mateixes files, `TreeRow`): fila de dalt amb `LuHouse` i el nom de l'ambient, que el selecciona (= cap
  selecció, `sel === null`: clic al buit i Esc fan el mateix; Supr no hi fa res); grup plegable **Parets** («Paret N» amb
  la llargada; triar-ne una = la selecció `wall` del plànol, que l'obre sola); **Mobles** amb el seu + i a sota
  **Objectes** amb el seu + (per decisió de l'usuari, la mateixa lògica que «Peces lliures +» i «Models 3D +» de l'editor:
  `TreeSection onAdd`, el + obre la galeria de Mobles o d'Objectes), cadascun amb els seus elements i grups (els blocs
  d'abans, a Objectes; un moble que ja no hi és, a Mobles, amb `LuTriangleAlert`). **Un grup amb mobles i objectes surt
  als dos apartats**, a cadascun amb els seus (plegat per apartat); triar-lo des de qualsevol tria tot el grup (les dues
  files queden marcades). **Selecció múltiple** (Maj + clic a l'arbre, al plànol o al 3D, com a l'editor; `Selection` `{ kind: "multi", ids }`, `selIds`; **també les parets**, `selWallIds`: a l'arbre i al plànol, es mouen —arrossegant-ne una de triada, fletxes, X/Y—, s'agrupen i s'eliminen amb els elements; `moveWalls`; les parets poden ser de grups, `Wall.group`, el mateix espai de noms que els elements, `groupWallIds`, `setWallGroup`, plegables dins de «Parets»): moure (arrossegar, fletxes, X/Y del centre), girar, duplicar, eliminar, **Alineació** al plànol (X i Y: inici, mig, final; «Repartir» amb tres o més i amb un «Espai entre ells»; `alignItems`, `distributeItems` amb la petjada de cada element) i el **Grup** de tots (`MultiInspector` dels Ambients; ⌘G grup nou, ⇧⌘G fora del grup, com a l'editor). **Arrossegar per ordenar** (per decisió de l'usuari, 2026-10-14, com les peces lliures de
  l'editor; `reorderItems`, `moveItemToGroup` a `core/model/ambient.ts`): un element deixat al costat d'un altre n'agafa
  el grup, sobre la fila d'un grup hi entra, la fila del grup arrossega el grup sencer i, mentre s'arrossega un element d'un
  grup, surt la zona «Treure del grup». Un moble buit (sense mòduls ni peces, `isEmptyGeometry`) diu «Buit» a l'arbre, al plànol és el
  requadre discontinu de 600 × 600 (com un esborrat) i l'inspector diu que s'ha de fer a l'editor (sense Mides generals). Inspector (element, bloc,
  paret, grup, ambient) en `FoldItem`; el de l'ambient comença amb **Resum** (com el del moble: parets, m² de terra de
  les habitacions tancades —`floorArea`, als eixos—, caixa, mobles, objectes, finestres, portes, vidrieres, grups i un
  avís amb «Treure'ls de l'ambient» si en falta algun; `ambientSummary` a `core/model/ambient.ts`), després Parets noves,
  Acabats, Plànol de fons.
- **Plànol** (`PlanCanvas`, com Figma): roda o dos dits per desplaçar, Ctrl/⌘ + roda o pessigar per fer zoom al punt, espai
  + arrossegar; − / + i l'escala (1:50…) a baix a la dreta; la barra d'eines flota a dalt. Eines en columna a l'esquerra: **Seleccionar** (V), **Paret** (P,
  ploma: angle a 15°, imant als extrems, clicar el primer punt tanca, Retorn/Esc/doble clic acaben; **clic i arrossegar fa
  la nansa del punt, com Figma: parets corbes** (la nansa i el tram corb es veuen mentre es dibuixa; **Maj = el tram recte**,
  sense nansa; Alt, del tot lliure), Bézier cúbica, `Wall.curve` `{ c1, c2 }`, per decisió de l'usuari, 2026-10-14;
  triada, els dos punts de control són rombes que s'arrosseguen; a l'inspector «Forma» Recta · Corba; una corba no porta
  obertures; al 3D, al render i a les miniatures és una làmina llisa que segueix la corba, en 16 trossos per a la casa de nines (`curvedWallPieces`, 128 mostres i normals de tota la corba); l'imant la fa de trams rectes, `expandWalls`/`wallPoints`; `wallLength`, la
  de la corba), **Habitació** (H, rectangle → 4 parets),
  **Finestra** (F), **Porta** (D), **Calibrar** (dos punts del plànol de fons i la mida real). Maj: sense angles (a la quadrícula); **Alt: del tot lliure**
  (al mm: sense angle, quadrícula, extrems ni parets; també en moure parets, extrems, elements i obertures). Arrossegar una paret mou les enganxades; els extrems de la seleccionada s'arrosseguen (només mouen les parets
  enganxades en començar). Elements arrambats a les cares de les parets (`snapToWalls`), R gira 90°, fletxes (Maj ×10), Supr,
  Ctrl/⌘ D, desfer/refer (Ctrl/⌘ Z, Maj+Ctrl/⌘ Z, Ctrl Y; el comú, 100 passos, arrossegar = un pas). **Ctrl/⌘ C · X · V** (plànol i 3D): els elements seleccionats
  (o el grup) a `localStorage` `mobles:ambient-clipboard` (`AmbientClip`, `parseAmbientClip`), també d'un ambient a un
  altre; `pasteItems`: ids nous, desplaçats 300 mm si els originals hi són (i 300 més a cada enganxada), si no al mateix
  lloc; grups com «Duplicar». Els mobles enganxats són el mateix moble enllaçat (com «Duplicar»). Es desa sol. «Encabir» deixa l'habitació fora de les eines i barres (`PLAN_INSETS`); noms i mides
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
  de la fletxa amb un sol element, Alt sense imant, un pas de desfer). **La verda (Y) mou l'alçada** («Del terra», mai
  sota 0; per decisió de l'usuari): amb l'imant, a 60 mm s'enganxa al terra o a sobre d'un altre element que tingui a
  sota (planta que se solapa: una taula, un moble). Ratolí a sobre: contorn prim (`BoxFrame`); seleccionat, gruixut. Les peces d'un
  element només es refan si en canvia la geometria o els materials (moure'l només en canvia la posició) i les que ja no es
  dibuixen s'alliberen. La càmera mira el punt de l'obertura (o d'«Enquadrar»), no segueix la caixa de l'ambient. **Interior** (`LuEye`, `eyePose`): càmera anivellada a 1,35 m al costat de la paret de davant
  mirant la del fons, fov 55 («Enquadrar» torna a 40). **La càmera es recorda per ambient** (`Ambient.camera`, `pose` =
  «home»/«eye»; `saveAmbientCamera` 1 s després, sense `updatedAt` ni desfer; `updateAmbient` la conserva); en obrir el 3D s'hi torna i el botó surt marcat només si és la mateixa d'ara. **Bloquejar la càmera i
  «Càmera d'abans»** (per decisió de l'usuari: buscant l'enquadrament del render, un cop de ratolí la movia), a baix a
  l'esquerra del 3D: el cadenat (`LuLock`/`LuLockOpen`, es recorda per ambient, `mobles:ambient-camera-lock:<id>`) treu el
  ratolí i els dits a `OrbitControls` (`enabled`; el gizmo, en acabar, no el torna a encendre); els botons (Enquadrar,
  Interior) sí que la mouen. `LuUndoDot` torna a l'anterior de les 30 últimes càmeres desades (`camPast`, `cameraGoto`; no
  és el desfer de l'ambient). **Sostre**: opció
  de vista (`mobles:ambient-ceiling`) i material a Acabats (`Ambient.ceilingMaterial`), amb una mica de llum pròpia. Fons del
  3D transparent sobre el gris del plànol (`bg.subtle`); el render fa servir el clar (`scene.userData.renderBackground`).
- **Teulada** (`Ambient.roof`, `RoofSchema`, `roofBox`; `features/ambients/roof3d.ts`, `roofGroup`; per decisió de l'usuari,
  2026-10-14: «la teulada, recta o amb forma de casa en V, o amb claraboies»): Propietats de l'ambient › **Teulada**
  (`LuWarehouse`): Tipus Cap · Plana · Una aigua · Dues aigües, Pendent (°), Carener (al llarg de X / Y), Voladís, Gruix,
  Alçada (sense valor, la paret més alta), Material («Formigó» per defecte) i **Claraboies** (centre X/Y al plànol, ample en X
  i fondària en Y; les que no caben a un pla, a 50 mm de les vores, no es fan). Cobreix la caixa de les parets amb el
  voladís; a dues aigües i a una aigua, les puntes (i a una aigua la paret alta) es tanquen fins a la teulada amb el
  material de les parets. Al 3D: les peces compten com a parets al render (`userData.room = "wall"`) i cada claraboia
  porta un vidre que fa de portal; el sostre de dins (amb el seu material) es queda, just sota la paret més baixa; amb la casa de nines, des de fora es
  fa transparent (des de dins, sòlida). Opció de vista «Teulada» (`mobles:ambient-roof`, només si n'hi ha). Al plànol, el
  contorn discontinu, el carener (a una aigua, la vora alta gruixuda) i les claraboies. **No surt a les miniatures** (de
  dalt taparia l'habitació). Una teulada dolenta es treu en llegir sense perdre l'ambient. Tests a `ambient.test.ts`.
- **Catàleg d'ambients** (`core/model/ambientTemplates.ts`, `AMBIENT_TEMPLATES`, per categories `AMBIENT_CATEGORIES`):
  habitacions «de revista» per a renders; referències `store:<cat>:<nom>`, `app:<id>`, `object:<id>`, `mag:<id>`, `col:<id>`,
  arrambades a una paret (N/S/E/O, `placeTemplateItem`) o lliures. **Escenes amb plantes de debò** (`PLANT_SCENES`, les
  primeres: models 3D, `F(id)` = `object:object-model-<id>`), **escenes de revista** (`MAG_SCENES`: 14 fetes a partir de fotos;
  la plantilla pot dur `height`, `walls`, `low`, `open`, `openings`; `templateWalls`; mobles `MAG_FURNITURE`,
  `magFurniture.ts`, fets amb `storeBuilders`) i les dues **«Col·lecció · …»** (`COLLECTION_SCENES`).
  **Render a punt** (per decisió de l'usuari): una plantilla pot dur `render` (`AmbientRender`: `mood` dia/capvespre/vespre i
  `focal`), que es copia a l'ambient (`Ambient.render`, tolerant) i el 3D passa al Render (`scene.userData.renderPreset`:
  el diàleg l'aplica en obrir-se), i `eye` (el 3D s'obre amb la càmera d'Interior, `eyePose`, desada com a `camera` amb
  `pose: "eye"`). La primera és **«Saló al vespre»** (`amb-evening-living`): vitrina «Galeria» amb LED a la paret del fons,
  res a la paret de davant (hi va la càmera), vespre amb 24 mm; llibres, gerros, bol i ampolles als prestatges i una
  xicranda fora de la finestra.
  La segona és **«Showroom»** (`amb-showroom`), per ensenyar el render: vitrina `show-vitrine` (roure de fil, portes de
  vidre amb LED), bufet `show-sideboard` (lacat negre brillant, sobre de marbre), tauleta `show-coffee`, ampolles ambre,
  gerros, copes, llibres i bol, sofà de vellut i vidriera al jardí (amb una xicranda i un avet fora); capvespre amb 24 mm.
  `createAmbientFromTemplate` (`features/ambients/fromTemplate.ts`) crea cada moble i objecte (un per plantilla, a l'Historial
  o al grup del client) i l'ambient enllaçat. **Una escena del catàleg s'obre directament** i va a l'Historial (per decisió de l'usuari, sense preguntar).
- **Ambients per a clients**: menú ⋯ › «Duplicar (per a un client)…» (`duplicateAmbient`): «escena · client», duplica els
  mobles i objectes enllaçats i ho posa tot al grup del client: dos clients no comparteixen cap moble (`remapMobleItems`,
  el mateix que en obrir un `.ambient`).
- **Desar com a fitxer** (`.moble`, vegeu Desar i fitxers › Fitxer d'ambient): menú ⋯ de la targeta i ⋯ de la barra de l'ambient obert.
- **Assistent IA** (`docs/xat-ia.md`; el mateix xat que l'Editor, vegeu Editor › Assistent IA): pestanya «Assistent» a la
  columna de la dreta (`Workspace extra`; al mòbil, la tercera pestanya). Eines (`core/assistant/ambientTools.ts`, pures
  i asíncrones; instruccions `AMBIENT_SYSTEM_PROMPT`: mm, plànol x a la dreta i y avall, elements pel centre, gir en graus
  horari vist des de dalt, rot 0 = el darrere mira amunt): `get_ambient` (parets «Paret N» amb id, extrems, llargada,
  gruix, alçada i obertures per índex; elements amb tipus, nom, `project_id`, w × h × d, centre, gir, alçada, grup i
  caixa; materials; m² i habitacions tancades), `add_room` (`roomWalls`; `inner` = mides per dins), `add_wall`,
  `update_wall` (`setWallEnds`: les obertures es queden al seu lloc), `remove_wall`, `add_opening` / `update_opening`
  (finestra · porta · vidriera, `OPENING_DEFAULTS`, `clampOpening`; no trepitja les altres i diu els trams lliures) /
  `remove_opening`, `list_library` (els mobles i objectes de l'usuari amb les mides i les plantilles del catàleg
  —`catalogueEntries`: botiga, col·leccions, objectes, revista, app; referències de `resolveTemplateRef`—, cerca sense
  accents, compacte), `place_item` (un moble o objecte de l'usuari, o una plantilla que es crea pel camí de les galeries:
  `withInnerClearance` als mobles, `uniqueName`, `createProject`, a l'Historial; `against_wall` = el darrere contra la
  cara de dins de la paret i girat, `againstWall`, i `snapToWalls`), `move_item` (també arrambat a una paret; un grup,
  dx/dy), `rotate_item` (`rotateItems` per als grups), `remove_item`, `set_item_group` i `set_materials` (terra, parets,
  sostre, terra de fora; noms de Preferències). El de fora de l'ambient (la llista de Dexie amb la caixa de cada moble,
  memoritzada per `id:updatedAt`, i crear de plantilla) és `features/assistant/ambientLibrary.ts`. **Desfer**: el
  `useHistory` de l'ambient, canvis en viu (`commit: false`) i un `commit()` en acabar el torn: ⌘Z ho desfà tot (les
  parets, les obertures i els elements). Un moble o objecte creat d'una plantilla **es queda a la llista** (com
  «Afegir» de la galeria): el desfer només el treu de l'ambient. Un plànol o foto adjunts: llegeix les cotes i demana
  les que no es veuen.

## Objectes
- Un objecte (sofà, làmpada, planta…) és un moble del tipus **`objecte`** (`partsOnlyKind`: només peces lliures, com el
  `lliure` d'abans): s'edita amb el **mateix Editor** (peces amb forma, «Talla», materials per categories) però **no es fabrica**
  (`buildComposition` en treu el nesting i els encaixos; al menú només hi ha l'Editor; la molla de pa diu «Objectes»). No surten
  a l'historial de Mobles (`isObject`).
- `OBJECT_TEMPLATES` (`ambient.ts`): els blocs d'abans i cadira, làmpada, planta, mirall, taula rodona. **Objectes de revista**
  (`magObjects.ts`, `MAG_OBJECTS`, formes de `objectShapes.ts`: `ellipse`, `roundRect`, `leaf`, `wave`, `blob`): sofàs,
  butaques, quadres, miralls, tele, cortines, llums, plantes, catifes, taules, llibres drets, ampolles, gerros, bol, copes…
  **Làmpades com les de debò** (per decisió de l'usuari, que en va fer una amb un objecte que talla): pantalla = tub obert
  de «Lli blanc» (`tube` a `objectShapes.ts`: dues meitats d'anella, perquè una peça no té forats; peça estirada, v = 0
  al davant) i una «Bombeta» a dins amb portalàmpades: la llum surt per dalt i per baix i la tela brilla per la
  translucidesa (Làmpada de peu de llautó, de taula, de sostre de lli i la «Làmpada de peu» d'`OBJECT_TEMPLATES`).
  «Pantalla de lli» (tela que fa llum sola) es queda per als objectes d'abans. **Columnes i escales** (categoria «Columnes i escales», per decisió de l'usuari, 2026-10-14): columna
  quadrada (300 × 300) i rodona (Ø300) de 2600 (l'alçada de les parets noves) i una escala recta d'un pis (15 graons de
  roure de 180 × 260, contrapetges blanques, 900 d'ample); a l'ambient s'ajusten amb les mides generals. Tot és geometria (perfils extrudits), no física
  ni shaders: el render ho veu igual que el visor. Categories `OBJECT_CATEGORIES` / `objectCategory`
  (`core/model/objectCategories.ts`).
- **Mides al mm**: `tidyMm`/`tidyPart` (`freePart.ts`) arrodoneixen al mm els valors amb més d'un decimal (els de l'usuari,
  com 22,5, es queden) en crear l'objecte i en carregar-lo (`normalizeComposition`).
- **Assistent IA**: la pestanya «Assistent» de l'Editor també als objectes, amb les eines de peces lliures, formes
  senzilles i grups (`objectToolSet`; vegeu Editor › Assistent IA).

## Galeries (Mobles · Ambients · Objectes)
- **Les tres pàgines fan igual**: capçalera `PageHeader` (títol gran i l'explicació), **cercador amb el botó principal al
  costat, a l'esquerra** (per decisió de l'usuari: primer els botons i després el cercador; `components/SearchBar`: «+ Nou moble» · «+ Nou objecte» · «+ Nou ambient», `colorPalette="wood"`, **buits** (per
  decisió de l'usuari: «que no fiqui res»): `projects/blank.ts` (moble sense mòduls, objecte sense peces) i l'ambient
  sense parets (`EMPTY_AMBIENT`); «+ Nou moble» crea el moble directament (sense menú); amb text a l'ordinador i només la icona al mòbil, amb `aria-label` i tooltip; **«Obrir
  fitxer»** (`LuFolderOpen`, `file/OpenFileButton.tsx`) a les tres, a la mateixa fila, entre el «+» i el cercador (vegeu
  Desar i fitxers › Obrir fitxer); sense accents; obre les seccions i categories amb resultats) i acordions
  **tots tancats** en obrir l'app (estat de la sessió, p. ex. `mobles:gallery`): **Historial**, **Projectes** i **Catàleg**;
  a Mobles, a més, **Col·leccions de mobles**. Les galeries de les finestres «Afegir un moble» / «Afegir un objecte» dels ambients
  (`ambients/AmbientPicker.tsx`) no porten el botó (`add` opcional) ni la fila d'eines, però sí Historial · Projectes (amb els
  grups) · Catàleg. No hi ha filtre de tipus (el tipus també es busca). Fila d'eines dins dels acordions
  («Grup nou», «Seleccionar», «Esborrar») **a l'esquerra**.
- **Mobles** (`projects/ProjectsScreen.tsx` + `projects/NewMobleGallery.tsx`, també a la finestra «Afegir un moble» dels ambients).
  Les **plantilles de l'app** (`BUILTIN_TEMPLATES` a `templates.ts`) **ja no surten a la galeria**: les fan servir les escenes
  (`app:<id>`), el corpus golden, els tests i `modulePresetsFor`. Són: les vitrina (`SHOWCASE`: Aparador sobre ferro, Moble TV
  flotant, Moble de bany amb pedra, Cuina amb illa de pedra, Vestidor amb barres, Escriptori flat-pack), les inspirades en
  fotos d'interiors (`INSPIRED_TEMPLATES` a `inspiredTemplates.ts`: Moble TV llarg, Llibreria amb baixos negres, Lliteres
  encastades, Consola de noguera a inglet, Moble penjat de noguera, Tauleta cub, Cuina de roure amb illa de calaixos), les
  flat-pack («Prestatgeria d'encaix», «Tamboret flat-pack», `model/flatPack.ts`), les de `kind` taula (Consola, Taula de
  menjador); `showcase.test.ts` comprova que no fan avisos de xoc ni de talls. Cap plantilla de l'app fa avisos de disseny
  (per decisió de l'usuari): l'Armari 2 portes té una divisió al mig (prestatges de 471 de llum), el Vestidor fa 2.280
  d'alçada (portes ≤ 2.200; el de doble barra, maleter de 300 perquè les barres tinguin 900) i el mòdul del mig, dues portes.
  `TV_LIVING_ROOM` es queda amb portes de 616 (és el moble real de casa). Tretes per decisió de l'usuari: Consola ona, Moble TV 3 portes i Moble TV
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
  de pedra) són del tipus `lliure` («Peces lliures»). Aparadors sobre potes de peces lliures: caixa «penjada» a l'alçada de les potes.
  `storeCatalog.test.ts`: totes sense avisos de disseny. Les mides de la descripció (`compositionDims`, també a les
  Col·leccions) són la caixa del moble (min…max), no la distància a la paret (`wallGap`) ni a l'origen (`x`); l'alçada,
  des de terra, menys si tot va penjat (`compositionDims.test.ts`). Objectes: per tipus (`OBJECT_CATEGORIES`). Ambients: per habitació.
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
  `setProjectsFolder`, `setAmbientsFolder`. Menú ⋯ de cada targeta: desar com a fitxer (`.moble`, també els ambients), duplicar, **moure a un grup…**
  (`MoveToFolderDialog`), esborrar. **«Grup nou»** (nom i després es toquen les targetes) i **«Seleccionar»**
  (`FolderedGrid selection`): diverses targetes → moure-les a un grup o esborrar-les (els mobles i objectes que són en un
  ambient es conserven). **Modificats** (`Project.edited`, de `updateProjectComposition`; `isEdited` per als antics):
  etiqueta «Modificat». **«Esborrar»** de l'Historial (`projects/ClearHistory.tsx`, `title` «Esborrar l'historial»; el
  diàleg de confirmació es diu «Esborrar l'historial?» i respecta la cerca): no toca
  els Projectes ni els mobles/objectes que són en algun ambient (a Ambients esborra els ambients, els seus mobles es queden);
  avisa dels modificats i permet «Esborrar només els no modificats».
- **Esborranys** (per decisió de l'usuari: a l'Historial només hi entra el que s'ha fet servir): obrir una plantilla
  (catàleg, col·leccions, objectes) o un moble en blanc crea el moble amb `Project.draft` (l'editor el necessita a la base
  de dades). No surt a `useProjects` (Historial, selectors d'ambients) ni als usos d'un material. Deixa de ser esborrany
  (`draft` fora) amb qualsevol canvi (`updateProjectComposition`, nom, nesting, foto), en posar-lo en un grup, en
  exportar-lo (qualsevol descàrrega d'Exportar: s'ha de poder trobar què es va enviar al taller) i en desar-lo com a fitxer
  (`keepProject`). Moure la càmera i la miniatura no compten. En deixar-lo (`App`, 1,5 s després perquè el desat pendent de
  l'editor el salvi; `dropIfDraft` en una transacció) s'esborra si encara ho és; en obrir l'app, `dropDrafts` esborra els
  que hagin quedat menys el moble obert. Els `.moble` oberts, els creats per un ambient i les còpies no són esborranys.
- **Miniatures 3D** (per decisió de l'usuari, en lloc dels dibuixos de línies): **sense cap 3D viu per targeta** (a l'iPhone
  farien tancar la pàgina). `components/viewer/thumbRenderer.ts`: un sol renderitzador fora de pantalla (s'allibera 3 s
  després de buidar la cua) que pinta les peces amb els materials reals sobre el terra i la paret de Presentació, amb ombres,
  en un JPEG 2:1 de 480 px; cua d'una en una quan el navegador és lliure (`enqueueThumb`; `projects/projectThumbs.ts`;
  `request…Thumb` torna la funció per cancel·lar). Es pinta quan les fotos de textura hi són (`drawWhenReady`; `snapshot` torna
  `null` si se'n baixen); si alguna falla (`photoTextureFailures`), no es desa. Es desa al projecte (`Project.thumb`,
  `thumbAt`, `thumbV` = `THUMB_VERSION`); les de plantilles (catàleg, objectes, escenes del catàleg d'ambients), en memòria
  i a la **Cache Storage** (`projects/thumbStore.ts`, cau `mobles-thumbs-v1`): clau = tipus/id/`THUMB_VERSION`-empremta
  de la plantilla (`templatePrint`, ids renumerats perquè `newId` canvia cada cop)-empremta dels materials; en desar-ne
  una s'esborren les velles de la mateixa plantilla. Segona obertura del catàleg: ~6 s → instantani. Ambients (`ambients/ambientThumbs.ts`): terra,
  parets (sense les de davant) i els mobles i objectes, de dalt i de davant, **sense fons** (PNG transparent);
  `AmbientRow.thumb`; les del catàleg, a la Cache Storage com les plantilles (l'empremta inclou les plantilles de les seves referències).
  **Totes les que no són de l'usuari** (plantilles, escenes del catàleg, ferratges) passen per `requestStoredThumb(kind, id,
  sig, render, onDone)` / `storedThumb` (`projectThumbs.ts`: memòria, Cache Storage i la cua comuna; la mateixa feina un sol
  cop, totes les targetes la reben). L'estudi (terra i paret de Presentació, fons del color de la paret) és `thumbStudio`
  (opcions `floor`/`wall`/`reach`) i la llum `thumbLights` (`sun`, `normalBias` per als primers plans). **Amb la càmera desada** (`Composition.camera`, `Ambient.camera`) es fa des d'allà (`viewerSize`,
  `thumbPose`); sense, enquadrament automàtic. `thumbCam` (`cameraSignature`) i `thumbIsStale` la refan si la càmera ha
  canviat; desar la miniatura no toca `updatedAt` ni `edited`. `SnapshotThumb` (2:1, sense fons); sense foto encara, el
  mateix requadre buit (la graella no salta). Cal `scene.updateMatrixWorld(true)` abans de mesurar la caixa.

## Preferències
- **Com la Configuració de macOS / Figma** (`SettingsPages` + `Pane` a `SettingsScreen`): a l'esquerra els apartats per
  categories (`SETTINGS_GROUPS`; no és un acordió): **Fabricació** — Màquines CNC, Regles de mecanitzat, Ferratges
  (biblioteca, vegeu més avall), Folgances per defecte (fronts, prestatges i fons —amb el «Joc de la ranura» del fons— i **Divisions** › «Peces de dins», 1 mm:
  tots els divisors i prestatges fixos d'un mòdul dividit), Materials, **Taulers** (camp de treball de la màquina per
  defecte o «importa-la a Màquines CNC»; «Mides de tauler de fàbrica» per material; «Distribució»: girar les peces amb veta;
  sense «Tall»: separació i marge són de la màquina; sense avís si el tauler passa del camp: 2800 × 2070 sobre 5020 × 1905 va
  bé), Etiquetes —, **Foto i visor 3D** — Objectes de referència, Visor 3D — i **App** — Visualització, Tema, **Assistent
  IA** (`settings/AssistantPane.tsx`, `LuMessageSquare`: la clau de l'API de Claude —camp de contrasenya; després només
  se'n veuen els 4 últims caràcters, `maskKey`—, «Provar la clau» (`models.retrieve`, sense tokens) i el model amb
  `ChoiceChips`: Sonnet 5.5 per defecte, Opus 5.5; l'explicació del cost i de la connexió) —. A la dreta la
  pàgina triada (icona, títol, explicació i «Restaurar valors inicials»): **una sola columna de 760 px** (`FoldGrid` = pila)
  de **grups sempre oberts** (`components/SettingsGroup`: targeta amb capçalera, res no es plega). Al mòbil, navegació en
  profunditat: apartats › pàgina › element, amb «‹ Tornar»; l'apartat i l'element es recorden durant la sessió
  (`useSessionString`). Les referències creuades als textos diuen «Preferències › <títol de la pàgina>».
- **Llista i detall** (`components/MasterDetail`: llista agrupada amb mostra; `SearchBar` amb «Afegir» (només icona,
  `iconOnly`) i a sota les categories; `head` = títol de la pàgina a dalt de la llista —`PaneHeadContext` a les pàgines `wide`—; `footer` = sota el
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
  - Tocar una targeta obre l'**editor a pantalla completa** (`components/EditorDialog`, també el dels ferratges: `Dialog size="full"`, 100vw × 100dvh,
    zona segura als quatre costats, ✕ a `calc(env(safe-area-inset-top) + 8px)` i el títol a la seva altura: nom del material
    i categoria). Mostres (`MaterialStage`, fora de la `MaterialCard` amb `key`: canviar de material no refà el 3D): la
    **tira a escala real** (`MaterialHero fill`, 600 mm = l'amplada, «A escala real») i la **bola de material**
    (`settings/MaterialBall.tsx`, «Bola de material»: esfera de 300 mm, `ballMaterial` a `viewer/ballMaterial.ts` = el
    mateix camí que les peces, `finishMaterial` d'`exportablePanel.ts`; u = π·D i v = π·D/2, repeticions en u enteres si
    cal estirar ≤ 12 % (`ballSpanU`), si no costura darrere; un sol `Canvas` `frameloop="demand"`, dpr ≤ 2 / 1,5
    `LOW_MEMORY`, `resize offsetSize` —el diàleg s'obre escalat—, `StudioEnvironment` + llum principal forta i retall,
    terra de caselles de 50 mm que s'esvaeix sobre el fons d'estudi CSS clar/fosc, ombra de contacte de textura;
    `OrbitControls` sense zoom ni desplaçar; el material es refà per `ballKey` —acabat, llum, translucidesa, Reflex i
    Vellut— i s'allibera; només muntada amb l'editor obert; en DEV `window.__materialBall` = el renderitzador per mirar
    `info.memory`). **La bola diu la veritat** (`physicalBall`): còpia `MeshPhysicalMaterial` amb les mateixes textures,
    «Reflex» = `clearcoat` amb la rugositat del render (`COAT_ROUGHNESS`), «Vellut» = `sheen` del color de la tela cap al
    blanc, «Llum que passa» = una mica de llum pròpia (aproximació) i la llum que fa, encesa (`applyFinishFx`). **La bola és
    la protagonista**: a l'ordinador gran (`lg`) omple la columna de l'esquerra i la tira va a sota, baixa
    (`clamp(140px, 24dvh, 220px)`), i el formulari a la dreta (560 px, amb el seu desplaçament); a `md`, bola de 360 px i la
    tira al costat; al mòbil, bola quadrada a tota l'amplada i la tira a sota (3:1); el formulari (760 px com a molt) a
    sota, tot es desplaça. Les targetes de la graella es queden en CSS. Formulari (`MaterialCard`): nom editable amb Duplicar/Eliminar i
    les seccions plegables (`FoldItem` sols, recordats a la sessió; només **Aspecte** obert d'entrada; insígnia amb
    l'acabat i la categoria) **Aspecte** (`LuSwatchBook`; Acabat, Color/Espècie/Foto, mapes de relleu i brillantor, Rajola, Textura, Joc PBR) i
    **Fabricació** (`LuFactory`; Gruixos `ThicknessChips`, Cantell, Veta, Categoria; als de simulació només Categoria) i, als taulers i
    fons, **«Per defecte als mòduls nous»** (`LuStar`, `DefaultPick`). Esc i ✕ tornen a la graella; **Esc amb el nom a mig escriure
    només el desfà** (no tanca). El focus va al ✕ (al mòbil no surt el teclat), llevat d'un material nou.
  - Un material nou (biblioteca o «En blanc»; nom únic, «Material nou 2», a la categoria oberta si només n'hi ha una) o
    duplicat **obre l'editor** amb el nom seleccionat; «Obrir el meu» de la biblioteca també l'obre. **Eliminar** des de
    l'editor el tanca. Al mòbil l'editor fa de pàgina de detall: el seu ✕ és el «Tornar» (cap «‹ Materials»; la pàgina de
    la graella només té «‹ Preferències»). Controls de 280 px com a molt.
- **Ferratges: graella i editor a pantalla completa, com Materials** (`settings/HardwarePane.tsx`, `HardwareList`): cercador
  amb «Afegir» (menú per tipus: copia el per defecte d'aquell lloc), acordió per categoria (`HARDWARE_CATEGORIES`, icones a
  `settings/hardwareIcons.ts`; oberta la de Frontisses, `mobles:md-open:hardware`) i, dins, **per sèrie** (per decisió de
  l'usuari: Frontisses › Sensys · Intermat, Tiradors › Classic · Modern, Portes corredisses › SlideLine 55…; `itemSeries`, la
  carpeta del fabricant; `FoldItem` niats `nested` amb el nombre, `mobles:md-open:hardware-series`, munta en obrir; els de
  l'app i els que no en tenen, a dalt de la categoria; la cerca —també pel número i la sèrie— obre les que hi coincideixen;
  `seriesGroups`), `GalleryCard` amb la **miniatura 3D com
  les de Mobles, Objectes i Ambients** (per decisió de l'usuari: «A Ferratges fes preview 3D com als apartats principals»;
  `SnapshotThumb` 2:1, buida mentre es fa), resum i «★ Per defecte». La miniatura (`settings/hardwareThumbs.ts` →
  `hardwareThumbJob.ts` amb `import()` → `components/viewer/hardwareThumb.ts`, `renderHardwareThumb`): el mateix
  renderitzador fora de pantalla i la mateixa cua (`requestStoredThumb`, tipus `ferratge`), a la Cache Storage amb la clau
  `THUMB_VERSION.HARDWARE_THUMB_VERSION`-empremta de l'item i del mòdul d'exemple (`templatePrint([item, base])`: editar-lo,
  confirmar-lo o canviar el tauler o els ferratges per defecte la refà)-empremta dels materials. Hi surt el muntatge de «Com va
  muntat» (`hardwareMount` amb el mateix mòdul d'exemple que l'editor) amb els materials de debò, els forats (els proposats
  d'un importat sense confirmar, en taronja), el GLB importat o, si no hi és, la caixa (`bbox`), el dibuix 3D dels ferratges
  de sèrie (`builtinHardwareGroup`, el mateix del visor) i el tirador de l'app (`buildScene(…, { fitted: true })`: sense la
  barra genèrica on hi ha un tirador importat), la **fusta translúcida** (0,4, sense ombra; les peces que són el
  ferratge, `HardwareMount.solid`, opaques), tot posat a terra (el més baix a y = 0), amb **la mateixa càmera que el 3D de l'editor en obrir-lo**
  (`mountCamera`, fov 32°) i l'estudi de les altres miniatures (sense terra si es mira de sota, sense paret si és darrere la
  càmera); un «només 3D», el model sol a terra. **La càmera enquadra el ferratge sempre** (per decisió de l'usuari: «mira
  d'enquadrar l'objecte, a vegades no es veu»): `hardwareMount` calcula la **regió** (`HardwareMount.region`, mm del
  mòdul: el ferratge —GLB o caixa, el tirador de l'app, els components d'un joc, els perfils d'un accessori i el dibuix
  dels de sèrie que toca el ferratge (`builtinSolids` a ≤ 30 mm: no les espigues de la caixa d'un lateral)—, els forats que fa amb la fondària i 40 mm de peça al voltant; els que es repeteixen —frontisses,
  filera System 32, espigues, imants, potes— només a 120 mm del forat principal: la frontissa de baix amb la placa, una
  pota amb la cantonada de la base; guia, braç, tirador, joc, barra, LED i marc sencers) i `mountCamera` hi fa cabre
  **exactament** la càmera (`fitCamera`, la mateixa cerca que `modelCamera`) per a la direcció de cada tipus (les de
  sempre) i l'aspecte real (miniatura 2:1, editor el del visor), entre `MOUNT_CAMERA_DIST` (260–1600 mm: ni un punt ni
  retallat). Test `build/mountCamera.test.ts`: la regió projectada cau dins la imatge amb marge a tots els de l'app, els
  jocs, importats de mostra i, amb `HETTICH_DIR` / `BLUM_DIR`, els de debò. Els GLB es llegeixen **fora de la memòria compartida de models**
  (`readHardwareModel`: n'hi pot haver centenars i cadascun serveix un sol cop) i s'alliberen sencers (`disposeTree`) en
  acabar; el renderitzador s'allibera com sempre (`releaseThumbRenderer` → `releaseModelGpu`). Si canvia com es fan, s'apuja
  `HARDWARE_THUMB_VERSION` (ara 8: ferratges de sèrie en 3D, fusta translúcida, sense les espigues de la caixa fora del muntatge de l’espiga i les potes mirades des de la del davant). Un **«només 3D»** s'enquadra a la seva caixa
  (`modelCamera`, a `mountCamera(m, aspect)`, la mateixa al 3D de l'editor i a la miniatura): la càmera més a prop que la
  veu sencera i, si és llarg i prim (perfil de porta corredissa de 1560 × 12,5 × 6,5), mirat al llarg des d'un extrem perquè
  se'n vegi la secció (abans sortia una ratlla). **Al 3D, cap cota** (per decisió de l'usuari: «a les vistes posar les mides
  de tot, i al 3D cap mida»; ni a «Com va muntat» ni als «només 3D» ni a les miniatures): les mides són als plànols 2D.
  **Plànols acotats** (`components/dims.ts` `layoutDims` + `components/DimLine.tsx` `DimLine`/`DimLayer`, el mateix
  primitiu que el Pla del muntatge): mida total, cotes encadenades des dels cantells, entre forats i amb el punt de
  referència, i l'etiqueta de cada element (Ø × fondària, ranura, caixera) on no tapi res (els textos que no caben pugen
  de fila, `shift`); al dibuix del generador (i a sota, la llista «referència … · cantells …», `opPlace`), a les vistes
  DXF del fabricant (cercles `viewCircles` amb el Ø) i a la peça d'exemple (`PanelDrawing dims="full"`). Lletra
  proporcional (`dimFont`), `style={{ fontSize }}`. Test `components/dims.test.ts`.
  Un «només 2D» (sense STEP): la vista frontal del DXF a la targeta. L'editor (`components/EditorDialog`, el mateix que Materials) comença amb **«Com va muntat»** (vegeu
  més avall), dibuixa les peces d'exemple (`hardwarePreview`) amb un **Detall** acotat (`PanelDrawing dims`) i a la dreta
  les opcions en **l'acordió de l'app, com l'editor de materials** (`FoldItem` sols, recordats a la sessió, insígnia amb el
  resum; `data-testid="hardware-sections"`): **General** (`LuInfo`, oberta; tipus a la insígnia; fabricant, referència,
  «Per defecte als mòduls nous») · **Importat del fabricant** (`LuUpload`, oberta; només als que ja s'havien importat:
  Confirmat / Sense confirmar / Només 3D) · **Plànols i documents** (`LuFileText`; GLB i plànols, si n'hi ha) · **Placa
  de muntatge** (`LuSquareDot`) · **Mides** (`LuMoveDiagonal`; `HARDWARE_PARAMS`, `NumRow`, llargades de guia) ·
  **Quantitat per alçada** (`LuListOrdered`, «2–5») · **Distància entre forats** (`LuRuler`, `StepRule`) ·
  **Mecanitzats** (`LuCircleDot`, «n forats») i, als jocs, les seves seccions (`KitSections`: Del catàleg · Llargades i
  números d'article —la taula es desplaça de costat amb la columna NL fixa, també al mòbil— · Regles de tria ·
  Components · Peces de fusta · Mecanitzats del joc · Hipòtesis).
  **Treure ≠ esborrar** (per decisió de l'usuari, 2026-10-08): **sense «Importar del fabricant»** («millor que ho anem
  fent nostres»: els jocs llegits dels PDF del catàleg, [`docs/ferratges-jocs.md`](docs/ferratges-jocs.md), són el camí)
  i **sense «Generador de mecanitzats»** («ara ho fiquem nosaltres a partir del catàleg»). Se'n va treure la UI
  (`HardwareImportDialog`, `settings/hardwareImport.ts`, `MachiningGenerator`, `machiningDraw.ts`); el codi del nucli
  (`core/import/*`, amb els tests), `HardwareItem.machining`/`GenOp`, `hardwarePlace.ts` i els col·locats es queden
  **adormits**: els importats i els col·locats que ja hi són es llegeixen, es fabriquen igual (proves d'or idèntiques)
  i es poden confirmar, editar i treure. «Què és» d'un importat (`hardwareReframe.ts`) continua.
  **Eliminar** (`DeleteHardwareDialog`, com el dels materials): si és un per defecte o el fa servir algun moble desat
  (`hardwareUsage`), cal un substitut del mateix tipus; els mobles hi passen (`replaceHardwareEverywhere`, sense `updatedAt`).
  Només les còpies **iguals** a l'item (`isCopyOf`: mateix id i `sameHardware`, el contingut sense nom/fabricant/versió); una
  amb el mateix id i un altre contingut (un mòdul d'abans amb una cassoleta de 30) és la que es fabrica i no es toca.
  «Restaurar valors inicials» torna biblioteca i per defecte. **A l'editor, un sol selector** (per decisió de l'usuari: «el
  selector a Mobles que surti amb un drawer com fa la col·locació de materials i objectes als ambients»):
  `settings/HardwareSelect.tsx` (`HardwareSelect` = botó amb la miniatura 3D de la targeta i el nom; `HardwareDrawer` = el
  calaix sol) sobre el calaix comú `components/PickerDrawer.tsx` (`PickerDrawer`, `PickerButton`, `PickerRow`; el
  mateix que el `MaterialSelect`): cercador (`hardwareMatches`), categories › sèries (`seriesGroups`, a
  `settings/hardwareGroups.ts`, com Preferències) i `GalleryCard` amb la miniatura (`settings/HardwareThumb.tsx`, mòdul
  d'exemple `useMountBase`: les mateixes miniatures desades). Frontissa, guia, braç, tirador de cada front
  (`HardwarePick`, a dalt «Com el mòdul»), l'Espiga (Mòdul › Unió), la Pota de la base (a dalt
  «Genèriques») i el Ferratge d'un col·locat (només els compatibles amb les peces, `placeableOn`). Les
  còpies que no són a la biblioteca tal qual (`hardwareChoices`, per contingut, no per id) surten a part, «Còpia pròpia»,
  triades: es veu el que es fabrica i s'hi pot tornar; els importats sense confirmar porten «Sense confirmar» i la nota a
  dalt del calaix (es poden triar, no fan cap forat); triar-ne un de la biblioteca canvia la còpia.
  - **«Com va muntat»** (per decisió de l'usuari: «preview 3D i en pla, amb el panell de com va muntat al moble»;
    `MountPreview` a `HardwarePane`): el ferratge **muntat** en un mòdul petit fet pel **camí de fabricació de sempre**
    (`core/build/hardwareMount.ts`, `hardwareMount(item, base)`: `buildModule` amb l'item al seu lloc del joc; el mòdul
    surt de `applySettingsToModule` —tauler, gruix, jocs i ferratges per defecte de les preferències en edició, `settings`
    de `HardwareList`—). Se'n queden les peces on fa forats (frontissa i placa: la porta i el lateral de les frontisses;
    System 32: lateral i prestatge; abatible, imant, tirador), **menys les que taparien el ferratge** (`Recipe.drop`):
    l'espiga, només el lateral (la base i la tapa amaguen els forats dins la unió); la guia, el lateral i el front (sense
    la caixa del calaix, que tapa els forats del lateral); i la reixeta de l'imant s'aparta 60 mm del davant
    (`Recipe.shift`) perquè es vegin l'imant del cantell i la placa.
    Una placa sola es munta amb la frontissa per defecte (o la d'inici, si aquella és un importat pendent). Un tirador,
    en un calaix (3D mirat des de fora, `focus.view`); una pota, en un mòdul baix sobre potes (la base amb les quatre
    plaques); un «només 3D», el model sol (`HardwareMount.model`, `ModelPreview`) amb «Baixar el model 3D (.glb)». Un importat
    **sense confirmar** es construeix amb una còpia confirmada i els seus forats surten com a **proposats**
    (`proposedTags`, en taronja, amb l'avís): el moble real continua sense fer-ne cap. Dues vistes amb el `SegmentGroup`
    de les pestanyes de l'editor (`LuRotate3D` 3D · `LuMap` Pla, recordada a la sessió `mobles:hardware-mount-view`):
    **3D** (`HardwareMount3D`, `React.lazy`: un sol `Canvas` `frameloop="demand"`, dpr ≤ 2 / 1,5 `LOW_MEMORY`,
    `StudioEnvironment`, `OrbitControls`, colors per peça; les peces amb el `PanelMesh` del visor —forats, el GLB importat
    o el dibuix 3D dels de sèrie (`PanelHardware`, amb els suports de prestatge `shelfPins`)— amb la **fusta translúcida**
    (`seeThrough`, per decisió de l'usuari: el ferratge és el protagonista; `HardwareMount.solid` opac) i `MovingPanel` + `movingGroups` per obrir la porta, l'abatible
    o el calaix amb el lliscador «Obertura»; càmera `mountCamera` (pura, a `hardwareMount.ts`, la mateixa de la miniatura de
    la targeta): des de la cara on entra el forat principal —a les frontisses, des de dins—, un tirador des de fora, una pota
    de davant i una mica de sota, un joc des de dins i del darrere, enquadrant la **regió** del ferratge (vegeu Galeries ›
    Miniatures 3D); un «només 3D», `modelCamera`; `releaseModelGpu` en tancar; en DEV
    `window.__hardwareMount` = el renderitzador) i **Pla** (`mountPlan` + `HardwareMountPlan`: vista de dalt tallada a
    l'alçada de la cassoleta de baix —o del forat principal—, el davant a baix: peces en secció amb el gruix, forats
    tallats buits i els de ±40 mm discontinus, el ferratge projectat —la caixa del model o el volum simplificat— i cotes:
    joc, recobriment, cantell → centre de la cassoleta, C (cantell → vora), fondària i la filera del lateral des del
    davant (placa o System 32); als altres, el forat fins als cantells, la fondària i, si n'hi ha dos, la distància). Els
    textos de l'SVG van amb `style={{ fontSize }}` (l'atribut `font-size` el tapa el CSS global). Tests
    `build/hardwareMount.test.ts`.
- **Objectes de referència inicials** (`BUILTIN_REFERENCES`): genèrics (A4, rajoles, portes, **una sola tele** de 55″,
  radiador, endoll; per decisió de l'usuari, no una llista de teles). Les teles antigues es treuen (`RETIRED_REFERENCES`,
  `isRetired`, també les còpies «TV Sony KD-55XD8505…»).
- **Visor 3D**: qualitat, escena de Presentació (terra i paret: materials de la biblioteca, `PresentationScene.floorMaterial`
  / `wallMaterial`, o les mostres ràpides; terra per defecte «Parquet de roure»), llum i «Cel del render». **Tema**:
  dia/nit/sistema i color principal (`theme/accent.ts` redirigeix les variables CSS de `wood`).
- **Versions i lectura** (`core/model/settings.ts`, `SETTINGS_VERSION`, ara 42 (els tiradors de vitrina Häfele, `V42_ITEMS`, additiu); 41 (a les vitrines, la frontissa —la Metallamat A, `V41_ITEMS`— i el tirador es trien com a les portes; els marcs Häfele, només perfil, es refan); 40 (els perfils de LED a «Llums»); 39 (la pota AXILO 78 de mobles, `V39_ITEMS`, additiu); 38 (la pota AXILO 78 amb la placa per dibuixar-la al 3D, refeta si és d'una versió anterior de l'item); 37 (la pota AXILO 78 com la munta el taller, refeta si encara és la de la v34); 36 (el material del que es veu d'un ferratge, `HardwareItem.material`: els marcs Häfele en «Alumini anoditzat plata», material nou `FRAME_MATERIALS`; el de l'app, negre); 35 (catàleg general Häfele, `V35_ITEMS`: marcs d'alumini amb la placa de la Metallamat A, 9 tiradors, 2 suports de prestatge i el perfil Loox d'11 mm per encastar amb la tira LED 3015, additiu); 34 (potes de sòcol Häfele AXILO 78, `V34_ITEMS`, additiu); 33 (el joc de la ranura per defecte a 0,8, `DEFAULT_GROOVE_CLEARANCE`); 32 (joc de l'ample de la ranura del fons, `gaps.grooveClearance` 0, additiu); 31 (jocs de llum Häfele Loox, additiu); 30 (la neteja de la 29 amb la regla sencera); 29 (fora els «només 3D»: tots els inicials del motor `model`, els importats sense `machining` i els inicials DTC que ja no són a la biblioteca); 28 (la resta del catàleg DTC 2026, additiu); 27 (catàleg DTC 2026: jocs i push latch, additiu); 26 (`assistant`: clau de l'API i model,
  additiu; **la clau no surt mai** a l'export, `settingsToJson`, ni al `.moble`, i importar unes preferències no la toca,
  `importSettingsJson`); 25: `gaps.innerClearance`, 1 mm, additiu; 24: jocs inicials amb les dades d'ara; 23: jocs paramètrics de calaix (DTC MAGIC-PRO); 22: generador de mecanitzats; 21: tiradors, potes i «només 3D» importats; 20: ferratges importats; 19: biblioteca de ferratges; sense versió, additius en llegir: els accessoris de la biblioteca (`fixHardwareDefaults` afegeix l'item d'inici de cada lloc que falta) i la regla `kitPilot`): les migracions depenen només de la versió
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

### Mòduls compartits (com les apps professionals)
Tots els editors fan servir les mateixes peces, no còpies; una funcionalitat nova d'un editor es fa al mòdul compartit:
- **`Workspace`** + `useWorkspace(id)` (`components/`): estructura · visor · propietats, vores arrossegables, plegar amb els
  botons de les cantonades, pestanyes Estructura · Propietats al mòbil, amplades recordades; a l'Editor i als Ambients.
  `extra` (l'Assistent de l'Editor i dels Ambients): un segon panell a la columna de la dreta, pestanyes Propietats · <extra> a dalt
  a l'ordinador i una tercera pestanya al mòbil; es munta el primer cop i es queda muntat.
- **`shrinkImage`** (`features/imageShrink.ts`): l'única funció per reduir imatges (foto del lloc, plànol de fons dels
  ambients, fotos per a l'assistent; `jpeg` = sempre JPEG sobre blanc).
- **`SceneHelpers`** (`StudioEnvironment`, `SceneAccess`) als visors 3D; **`RenderDialog`** a l'editor i als ambients;
  **`MoveGizmo`**, **`BoxFrame`**; **`ViewOptions`** / **`ViewTile`**.
- **`TreeRow`** · `TreeRowMenu` · `TreeSection` (`components/TreeRow.tsx`): fila d'arbre (sagnat, triada `wood.muted`,
  fletxa de plegar, menú ⋯, arrossegar), menú ⋯ i títol de grup amb el + (o un menú, `menu`). Estructura de l'editor i arbre
  dels Ambients.
- **Desfer/refer comú** (`features/history/`): `history.ts` (pur, test: límit, ajuntar per temps `coalesceMs` o per
  `group`, canvis en viu `commit: false` + `commitHistory` en deixar anar, refer que es buida) i `useHistory` (React:
  `value`, `set`, `commit`, `undo`, `redo`, `reset`, `state`/`restore`); `useUndoKeys` amb `undoKeyAction` (`undoKeys.ts`,
  test; `scope` = un diàleg amb desfer propi) i els botons `components/UndoRedo` (`LuUndo2` · `LuRedo2`). Editor de
  mobles, Ambients i editor de perfils. Un editor nou amb desfer fa servir aquest, no un de propi.
- **`NameDialog`** (`components/`): posar un nom (grup nou, canviar el nom, mòdul nou), amb un nom per defecte seleccionat.
- **`PickerDrawer`** (`components/PickerDrawer.tsx`: `PickerDrawer`, `PickerButton`, `PickerRow`): el calaix dels
  selectors (dreta a l'ordinador, de baix al mòbil, cercador a dalt). El fan servir el `MaterialSelect` i el
  **`HardwareSelect`** (tria d'un ferratge al moble, vegeu Preferències › Ferratges).
- **Plànols acotats** (`components/dims.ts` + `components/DimLine.tsx`): totes les cotes dels dibuixos 2D (pla del
  muntatge, generador, vistes DXF, peça d'exemple, col·locació). **`StepRuleRows`** (`components/StepRuleRows.tsx`): les
  regles de graons (frontisses per alçada, distància del tirador, còpies d'un col·locat per mida).
- **`MaterialSelect`** (`settings/MaterialSelect.tsx`) a tot arreu on es tria un material (amb **cercador** a dalt del calaix,
  pel nom i sense accents, que obre les categories amb resultats): un **botó** (fons suau, a tota
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
- **Un sol acordió** (`components/Fold.tsx`, `FoldGroup` + `FoldItem`, sobre `Accordion` de Chakra; context i tipus a
  `foldContext.ts`, estat de sessió a `sessionState.ts`): inspectors, Render, Foto, Exportar, galeries, calaix de materials,
  taulells i forats (`RunsForm`) i eines de la màquina. Res d'`Accordion`/`Collapsible` de Chakra ni de plegables propis fora
  d'aquí. `FoldItem`: `id`, `icon` (del catàleg, obligatòria a les seccions), `title`, `badge`/`badgePalette`, `count`,
  `description` (sempre), `summary` (tancat), `actions` (al costat de la capçalera, mai a dins), `header` (fila de taula).
  Variants: `section` (inspectors i Render: icona + títol + insígnia + fletxa, sense fons; `size="sm"` per a subseccions),
  `gallery` (`.gallery-accordion`), `nested` (`.inner-accordion`, categories), `card` (vora i resum: taulells, forats) i
  `row` (fila de taula desplegable: eines).
  - **Sol** (sense `FoldGroup`): **independent** (se'n poden tenir diverses obertes), **comença tancat** (llevat de
    `defaultOpen`, p. ex. els xocs amb l'obertura actual) i es recorda durant la sessió (`mobles:section:<id>`).
  - **`FoldGroup`**: un acordió compartit; `multiple={false}` = un obert alhora (taulells, forats, eines); estat controlat
    (`value`), de la sessió (`storageKey`, una llista: galeries) o intern; `forceOpen` = la cerca de les galeries.
  - **Totes les variants s'obren i es tanquen amb animació** (200 ms `ease`, com les galeries; res amb
    `prefers-reduced-motion`) amb el contingut propi `FoldContent` (no l'`ItemContent` de Chakra): una graella d'una fila
    que passa de `grid-template-rows: 0fr` a `1fr` (+ opacitat), **sense mesurar l'alçada**, així el contingut que arriba
    tard o canvia amb la secció oberta mai es queda a alçada 0 (el `Collapsible` de Chakra sí). Porta els atributs de
    l'acordió (`role="region"`, ids, `data-part="item-content"`, `data-state`); estructura `item-content` › `.fold-clip`
    › `ItemBody` (selectors de `layout.css`). El contingut es munta en obrir (`lazyMount`); `section`, `card` i `row` el
    desmunten quan s'acaba d'animar el tancament (`transitionend` o un temporitzador) i, oberts i quiets, no retallen
    (`overflow: visible`; només mentre s'anima); les galeries el conserven amagat (`visibility: hidden`). Comprovat
    recarregant amb seccions obertes, Peça → Talla amb seccions obertes i l'alçada fotograma a fotograma.
  - Les pàgines de Preferències no en fan servir (`SettingsGroup`, sempre obert); l'editor de materials sí (Aspecte ·
    Fabricació · Per defecte) i el de ferratges també (General · Importat del fabricant (només els importats) · Plànols i
    documents · Placa · Mides · Quantitat · Distància · Mecanitzats · als jocs, les seves seccions). El contingut és
    una graella d'una columna `minmax(0, 1fr)`: una taula ampla es desplaça a dins (`overflowX`), no eixampla la secció.
- **`PageHeader`** (`components/PageHeader`, Mobles · Ambients · Objectes · Preferències): títol gran i l'explicació
  (`actions` opcional, a sota del títol).
- **`SearchBar`** (`components/SearchBar`): **tots els cercadors** (galeries, `MasterDetail`, Materials, Ferratges, calaix
  del `MaterialSelect`) amb el «+» al costat (`add`: `wood`, text a l'ordinador i icona al mòbil, `iconOnly` per a columnes
  estretes) i `extra` per a més accions a la fila. **Primer els botons i després el cercador** (per decisió de l'usuari, a
  tot arreu igual: galeries, llistes de Preferències i Materials): «+» · `extra` · cercador, que s'estira (el menú del
  «+» s'obre cap a la dreta, `bottom-start`). **Seccions de les galeries sense marge** (`.gallery-accordion`, `layout.css`): barra d'eines i acordions de
  dins **a sang**; la resta amb `--gallery-px`. Res de marges negatius.

### Navegació i barres
- **Menú global sempre igual** (`App.tsx`, `GLOBAL_NAV`, com Figma o Linear): **Mobles · Ambients · Objectes** i, a baix de
  tot, Preferències (igual a la barra de baix del mòbil); l'apartat del document obert queda marcat (`section`). L'app s'obre
  a Mobles (el primer del menú) si no hi havia res obert. **Cada apartat recorda l'últim obert** (`mobles:last-object`, `mobles:last-moble`): clicar
  Objectes o Mobles hi torna si encara existeix; tornar a la llista («Mobles ›», la fletxa o clicar l'apartat del document
  obert) el deixa d'obrir. **Les accions d'un apartat van a la seva pàgina** (el botó principal, al costat del cercador), mai
  al menú.
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
  sols; d'un mòdul només els camps dolents; a l'arbre de zones, només el camp dolent; les unions amb `kind` —fronts,
  base, tapa…— es reparen camp a camp dins del seu tipus). El ferratge d'un front es llegeix **sencer o res**
  (`repairAtomically`): un `front.hardware` dolent (un paràmetre que no és un número, un `engine` d'una versió nova, un
  mecanitzat dolent) es treu sol, amb avís, i la porta, els calaixos o l'abatible es queden amb el del mòdul. `readComposition`
  (`db/compositionStore.ts`; la fa servir `compositionOf`) dona també `problems` i `unreadable`: sense cap mòdul, es queda
  sense (un moble pot tenir 0 mòduls); sense composició, la del mòdul de caixa (`params`); si no es pot reparar, caixa per defecte i **no es desa a sobre** (`updateProjectComposition` torna
  `false`; l'Editor no desa i avisa). Peces, Nesting i Exportar mostren l'error (`UnreadableAlert`, `useCompositionRead`) i
  no fan res, i el `.moble` no es desa (`projectToMoble` llança `UNREADABLE_COMPOSITION`). L'Editor avisa del que s'ha tret.
  Les parets dels ambients (`parseAmbient`) també: una obertura o un material dolents no treuen la paret.
- **Fitxer `.moble`** (`core/file/mobleFile.ts`, JSON versionat amb foto opcional; **v3 si porta ferratges col·locats a
  mà** (`usesHardwarePlacements`), **v2 si porta ferratges importats** (`usesImportedHardware`): una app d'abans el
  rebutja en lloc de treure'n `imported` o els col·locats; sense, v1 (`mobleVersionFor`); `parseMobleFile` fa la mateixa reparació i
  treu amb un avís el nesting, el calibratge de la foto (camp a camp) i les referències malmesos). Porta la càmera i els models
  de l'usuari que fa servir. El calibratge (`FileCalibrationSchema`) té els mateixos camps que `PhotoCalibration` (un test ho
  comprova en compilar). `updateProjectPhoto` no desa un calibratge d'una foto que ja no hi és.
- **El `.moble` no porta preferències** (per decisió de l'usuari): jocs per defecte, l'aspecte dels materials i la
  màquina són de **qui l'obre** (el moble s'hi adapta en silenci). Els ferratges sí que hi van, com a **còpia** a cada mòdul
  i front (`Module.hardware`, `front.hardware`): el moble es fabrica igual. Només s'avisa dels **materials** de la composició
  (`materialRefNames`, les claus d'`aliasMaterialRefs`) que no són a les preferències després dels àlies (`missingMaterials`,
  `missingMaterialsWarning` a `openMobleFile`: «Materials que no tens a Preferències: …; es veuran amb un color per defecte i
  al taller sortiran amb aquest nom. Afegeix-los a Preferències › Materials.»). Les referències que falten s'afegeixen.
- **Fitxer d'ambient** (`core/file/ambientFile.ts`, pur, test `ambientFile.test.ts`; I/O a `features/file/ambientIo.ts`;
  per decisió de l'usuari, «guardar un ambient com es fa als mobles i als objectes»). **Extensió `.moble`, com els mobles i
  els objectes** (per decisió de l'usuari: una sola extensió; el `format` de dins diu què és i qualsevol «Obrir fitxer» el
  porta al seu lloc; els `.ambient` desats abans es continuen obrint). JSON versionat (`format:
  "mobles-cnc-ambient"`, `version: 1`) amb `ambient` (`name` i `data` = l'`Ambient` sencer: parets i obertures, elements,
  grups, blocs, plànol de fons, materials, càmera i render a punt), `furniture` (un **`.moble` sencer** per cada moble i
  objecte enllaçat, `{ key, moble: MobleFile }`; els elements apunten a `key`, dos elements del mateix moble la
  comparteixen), `models` (GLB de l'usuari, **un sol cop** per id, no a cada moble) i `render` (la configuració del Render
  desada per a l'ambient, `SavedRender`). Es desa amb «Desar com a fitxer…» (`LuSave`) al ⋯ de la targeta d'Ambients i al
  ⋯ de la barra de l'ambient obert (`mobles:flush-save` abans), amb el diàleg comú del `.moble` (`SaveFileDialog.tsx`:
  `SaveAmbientFileDialog`; interruptor «Incloure les fotos dels mobles», **apagat**, mida en viu i avisos): un moble que
  ja no existeix o amb la composició il·legible no hi va (ni els seus elements) i el diàleg ho diu. `parseAmbientData`
  repara **part a part** com el `.moble`: cada moble passa per `parseMobleData` (la mateixa reparació; un moble d'una
  versió més nova rebutja el fitxer sencer), un moble il·legible es treu amb els seus elements, models i render malmesos
  fora amb avís, l'ambient amb `parseAmbient`; un `.moble` triat com a ambient: «és un moble, no un ambient». **Obrir-lo
  crea sempre un ambient nou i còpies noves dels seus mobles i objectes** (ids nous, enllaçats a l'ambient nou, no
  esborranys; per decisió de l'usuari, no es busquen els que ja tens), tot al **grup amb el nom de l'ambient** (com
  «Duplicar (per a un client)»: `remapMobleItems`); els models es tornen a crear amb el mateix id i les referències que
  falten s'afegeixen (les peces de `mobleIo.ts`: `restoreUserModels`, `createProjectFromMoble`, `addMissingReferences`), i
  s'avisa dels materials que no tens de l'ambient i dels mobles (`missingAmbientMaterials` → `missingMaterialsWarning`).
  **No porta**: preferències (com el `.moble`), la foto de les finestres del render (és global) ni el bloqueig de la càmera.
- **Obrir fitxer** (`features/file/openAnyFile.ts`, `openAnyFile`, i el botó `OpenFileButton`): les tres galeries (Mobles ·
  Objectes · Ambients) i el doble clic obren **qualsevol** fitxer de l'app pel seu `format` (`fileKind`) i **com el que
  és**: un `.moble` com a moble o objecte (segons la composició) i un `.ambient` com a ambient, sigui quina sigui la pàgina;
  si no és de la pàgina, el missatge ho diu (`openedNote`: «És un moble: s'ha obert a Mobles.»). Un sol `accept`
  (`.moble,.ambient,.json`).
- **Obrir un `.moble` o un `.ambient` amb doble clic** (app instal·lada, Chromium): `file_handlers` (`.moble`, `.ambient`)
  i `launch_handler` `focus-existing` al manifest; `useLaunchFiles` (`features/file/useLaunchFiles.ts`, a `App`) llegeix la
  `launchQueue` i fa el mateix que «Obrir fitxer» (`openAnyFile`; espera les preferències). Safari/iOS no ho suporta.

## PWA
- **Càrrega a demanda** (`App.tsx`, `React.lazy` + `Suspense`): Editor, Peces, Nesting, Exportar, Foto, Preferències i l'editor d'ambients es carreguen quan s'obren; el xat de l'assistent (`ChatPanel`) i el SDK de l'API de Claude (bloc `sdk`, ~220 KB) també, en obrir-lo (la barra de l'ambient és a part, `ambients/AmbientTopBar.tsx`). `advancedChunks` només posa al bloc de three el nucli (`three/build`, `@react-three`, `three-stdlib`): els carregadors i exportadors de `three/examples` van amb qui els fa servir. React va al seu bloc (`react`, prioritat més alta): si no, entrava al de three i tota l'app carregava three d'entrada. **Res d'entrada importa three**: les galeries carreguen el dibuix de les miniatures amb `import()` (`projects/thumbJobs.ts`, `ambients/ambientRender.ts`; `THUMB_VERSION` és a `viewer/thumbVersion.ts`), `measureGlb` l'importa en pujar un model i `mobleIo` fa `forgetModel` amb `import()`. JS d'entrada ~1,5 MB (430 KB gz), abans 2,5 MB. Els fallbacks JS de Draco/Basis no es precachegen. Les textures procedurals que es llegeixen (`getImageData`) fan servir `willReadFrequently`.
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
  El WASM d'OpenCascade (`assets/occt-import-js-*.wasm`, importar ferratges) tampoc: CacheFirst en fer-lo servir, a la
  seva memòria (`mobles-occt`, `src/pwaWasmCache.ts`; amb Draco i Basis a la mateixa de 4, en sortia). L'API i els fitxers de
  Poly Haven (importar models) no passen per cap memòria cau: sense connexió fallen amb `OfflineError` i la UI ho explica.

## Icones (catàleg fix, `react-icons/lu`)
Una icona = un significat a tota l'app. No en triïs d'altres per a aquestes accions; si en cal una de nova, afegeix-la aquí.
Botons només d'icona: `aria-label` + `Tooltip` en català. Accions principals: icona + text.

| Àmbit | Acció | Icona |
|---|---|---|
| Navegació | Mobles (el cub: un moble) · Ambients · Objectes | `LuBox` · `LuHouse` · `LuSofa` |
| Navegació | Editor · Peces · Nesting / taulers · Exportar | `LuDraftingCompass` · `LuList` · `LuLayoutGrid` · `LuDownload` |
| Navegació | Tornar (‹ a les barres) · Plegar/desplegar menú · Preferències | `LuChevronLeft` · `LuPanelLeftClose` / `LuPanelLeftOpen` · `LuSettings` |
| Tipus de moble («+ Nou moble» i targetes) | Moble · Cuina · Armari · Taula · Peces lliures (`lliure`, d'abans) · Objecte | `LuBox` · `LuCookingPot` · `LuContainer` · `LuTable` · `LuPuzzle` · `LuSofa` |
| Zones | Dividir en vertical (divisor vertical, zones esquerra/dreta) | `LuSquareSplitHorizontal` |
| Zones | Dividir en horitzontal (travesser, zones dalt/baix) | `LuSquareSplitVertical` |
| Zones | Divisió vertical · horitzontal (un compartiment porta la icona del seu contingut, igual a l'arbre, a la capçalera i a «Front»: `composition/zoneIcons.ts`) | `LuColumns2` · `LuRows2` |
| Zones | Eliminar divisió (la mida de cada zona és a la Divisió, sense icona pròpia) | `LuUngroup` |
| Contingut | Obert · Prestatges (i la secció «Prestatges i accessoris» del compartiment) · Porta · Calaixos · Barra de penjar | `LuSquareDashed` · `LuRows3` · `LuDoorClosed` · `LuArchive` · `LuShirt` |
| Contingut | Abatible · Reixeta · Front fix | `LuPanelBottom` · `LuGrid3X3` · `LuSquare` |
| Composició | Afegir · Duplicar · Eliminar | `LuPlus` · `LuCopy` · `LuTrash2` |
| Composició | Objecte de referència · Model 3D (`.glb`) · Menú del document | `LuScan` · `LuSprout` · `LuEllipsis` |
| Composició | Peces lliures, Encaixos (flat-pack) de la peça i del moble (peça, Efecte peça) · Peça/objecte que talla | `LuPuzzle` · `LuScissors` |
| Composició | Moure a l'esquerra · a la dreta (menú de l'arbre) | `LuArrowLeft` · `LuArrowRight` |
| Front | Una porta · Dues portes · Abatible avall · amunt · Ranures horitzontals · verticals (reixeta) | `LuDoorClosed` · `LuFlipHorizontal2` · `LuArrowDownToLine` · `LuArrowUpToLine` · `LuAlignJustify` · `LuColumns3` |
| Front | Recobrents (fronts) | `LuSquareStack` |
| Forma | Rectangle · Arrodonit · Oval (tauler de taula) · Efecte obstacle | `LuRectangleHorizontal` · `LuSquircle` · `LuCircle` · `LuShield` |
| Inspector | Mides · Caixa (base, fons, tapa, laterals, estil dels fronts i folgances) · Portes (del mòdul; com el Front de la porta) · Materials · Unió (l'espiga del mòdul; la de la categoria Unions) · Ferratges (inspector de la peça lliure, Preferències i visor; no al mòdul) · Front · Pare | `LuMoveDiagonal` · `LuFrame` · `LuDoorClosed` · `LuPalette` · `LuBolt` · `LuWrench` · `LuDoorClosed` · `LuArrowUp` |
| Inspector | Base: Directe a terra · Sòcol · Potes (la de la categoria Potes, no la Taula) · Sense base | `LuArrowDownToLine` · `LuPanelBottom` · `LuFootprints` · `LuSquareDashedBottom` |
| Inspector | Fons en ranura · Cargolat darrere · Encastat · Sense fons | `LuLayers2` · `LuDrill` · `LuInspectionPanel` · `LuSquareDashed` |
| Inspector | Resum del moble · Posició | `LuBox` · `LuMove` |
| Inspector | Grup (peces lliures) · Enganxada (a un mòdul, al terra / a la paret) · CNC de la peça (la de Màquina CNC) | `LuGroup` · `LuLink` · `LuFactory` |
| Forma | Forma a mida / perfil · Cilindre (la caixa, `LuBox`) | `LuSpline` · `LuCylinder` |
| Render | Qualitat · Càmera · Escena · Llums · Sol · Cel · Llum (materials que fan llum) · Imatge | `LuGauge` · `LuCamera` · `LuHouse` · `LuLightbulb` · `LuSun` · `LuCloudSun` · `LuLamp` · `LuImage` |
| Inspector | Anterior · Següent · Accions de la selecció (menú) | `LuChevronLeft` · `LuChevronRight` · `LuEllipsis` |
| Preferències | Tema (dia/nit/sistema) · Color principal | `LuSunMoon` (`LuSun` · `LuMoon` · `LuMonitor`) · `LuCheck` a la mostra triada |
| Ferratges | Confirmar (importat) · Tornar a la proposta · Afegir forat | `LuCheck` · `LuUndo2` · `LuPlus` |
| Ferratges | «Com va muntat»: 3D · Pla (com Plànol · 3D dels ambients) | `LuRotate3D` · `LuMap` |
| Preferències | Visualització · Ferratges · Calaixos (contingut) · Guies (categoria) · System 32 · Cassoleta · Imants | `LuScanEye` · `LuWrench` · `LuArchive` · `LuRailSymbol` · `LuCircleDot` · `LuCircleDashed` · `LuMagnet` |
| Ferratges (categories) | Frontisses · Plaques · Guies · Calaixos de doble paret (jocs) · Elevables i abatibles · Unions · Suports de prestatge · Potes · Taules · Portes corredisses i plegables · Tiradors · Pressió i imants · Perfils i marcs · Llums (jocs de llum) · Penjar · Altres | `LuCircleDashed` · `LuSquareDot` · `LuRailSymbol` · `LuPackageOpen` · `LuPanelBottom` · `LuBolt` · `LuCircleDot` · `LuFootprints` · `LuTable` · `LuDoorOpen` · `LuGripHorizontal` · `LuMagnet` · `LuMinus` · `LuLightbulb` · `LuAnchor` · `LuPackage` |
| Ferratges (joc) | Seccions de l'editor del joc: Del catàleg · Llargades i números · Regles de tria · Components · Peces de fusta · Mecanitzats del joc · Hipòtesis · Prebroca dels cargols (Preferències › Regles de mecanitzat) | `LuBookOpen` · `LuListOrdered` · `LuRoute` · `LuPackageOpen` · `LuLayers2` · `LuCircleDot` · `LuBookOpen` · `LuDrill` |
| Ferratges | Baixar el model 3D (.glb) d'un importat · Baixar un plànol de muntatge | `LuBoxes` · `LuFileDown` |
| Ferratges | Ferratges col·locats a mà (inspector de la peça lliure; el del mòdul no la té; la de «Ferratges» del visor) | `LuWrench` |
| Ferratges | Col·locat a mà (llista de l'inspector): Editar · Duplicar · Eliminar | `LuPencil` · `LuCopy` · `LuTrash2` |
| Ferratges | Seccions de l'editor: General · Importat del fabricant (només els ja importats) · Plànols i documents · Placa · Mides · Quantitat per alçada · Distància entre forats · Mecanitzats | `LuInfo` · `LuUpload` · `LuFileText` · `LuSquareDot` · `LuMoveDiagonal` · `LuListOrdered` · `LuRuler` · `LuCircleDot` |
| Preferències | Visor 3D (els materials per defecte als mòduls nous porten la de Materials, `LuPalette`) | `LuLampFloor` |
| Fitxer | Desar com a fitxer (`.moble`, també els ambients) · Obrir fitxer (Mobles, Objectes, Ambients) · Pujar un fitxer (preferències) | `LuSave` · `LuFolderOpen` · `LuUpload` |
| Models 3D | Triar fitxers… · Triar carpeta… (importar un model) · Afegir les textures a Materials | `LuFileUp` · `LuFolderOpen` · `LuPalette` |
| Editor | Estructura · Propietats · Opcions de vista | `LuListTree` · `LuSlidersHorizontal` · `LuSlidersVertical` |
| Assistent IA | Assistent (pestanya de l'Editor i pàgina de Preferències) · Clau de l'API · Provar la clau | `LuMessageSquare` · `LuKeyRound` · `LuPlugZap` |
| Assistent IA | Enviar · Aturar · Adjuntar una foto o un plànol · Nova conversa · Eina feta · Sense connexió | `LuSendHorizontal` · `LuCircleStop` · `LuImagePlus` · `LuMessageSquarePlus` · `LuWrench` · `LuWifiOff` |
| Editor | Pestanyes 3D · Alçat · Foto | `LuBox` · `LuLayoutPanelLeft` · `LuCamera` |
| Estat | Avisos de fusteria · Desfer · Refer | `LuTriangleAlert` · `LuUndo2` · `LuRedo2` |
| Foto | Foto · Referència · Distància · Rectangle | `LuCamera` · `LuCrosshair` · `LuMoveHorizontal` · `LuRectangleHorizontal` |
| Foto | Origen (0,0) · Treure/tancar · Eines | `LuLocateFixed` · `LuX` · `LuPencilLine` |
| Foto | Mida estimada · Mida real (cinta) · Línia del terra · Fondària | `LuEye` · `LuCircleCheck` · `LuArrowDownToLine` · `LuArrowUpFromLine` |
| Visor | Modes Per peça · Textura · Presentació | `LuShapes` · `LuTrees` · `LuSparkles` |
| Visor | Enquadrar · Forats · Explosionat / muntat · Ferratges · Render · Veure a casa (AR) | `LuVideo` · `LuCircleDot` · `LuExpand` / `LuShrink` · `LuWrench` · `LuAperture` · `LuView` |
| Visor | Ampliar / reduir 3D · Obertura portes · Opacitat de les peces · Imatge | `LuMaximize2` / `LuMinimize2` · `LuDoorOpen` · `LuBlend` · `LuImageDown` |
| Ambients | Seleccionar · Paret (ploma) · Habitació · Calibrar · Plànol de fons | `LuMousePointer2` · `LuPenTool` · `LuBrickWall` · `LuPencilRuler` · `LuImageUp` |
| Ambients | Finestra · Porta · Moure a un grup · Grup (carpeta) · Projectes | `LuAppWindow` · `LuDoorOpen` · `LuFolderInput` · `LuFolder` · `LuFolders` |
| Ambients | Moble · Objecte / bloc · Pestanyes Plànol · 3D · Girar · Peces (plànol) · Interior | `LuBox` · `LuSofa` · `LuMap` · `LuRotate3D` · `LuRotateCw` / `LuRotateCcw` · `LuLayers` · `LuEye` |
| Ambients | Càmera bloquejada / lliure · Càmera d'abans | `LuLock` / `LuLockOpen` · `LuUndoDot` |
| Selecció múltiple | Alinear a l'inici · al mig · al final (X i Z; Y amb les horitzontals) · Repartir | `LuAlignStartVertical` · `LuAlignCenterVertical` · `LuAlignEndVertical` (`LuAlignEndHorizontal` · `LuAlignCenterHorizontal` · `LuAlignStartHorizontal`) · `LuAlignHorizontalDistributeCenter` / `LuAlignVerticalDistributeCenter` |
| Arbre | Element visible / amagat · bloquejat / lliure (l'ull i el cadenat de cada fila) | `LuEye` / `LuEyeOff` · `LuLock` / `LuLockOpen` |
| Galeries | Historial · Catàleg · Col·leccions de mobles | `LuHistory` · `LuBookOpen` · `LuLibrary` |
| Exportar | DXF (CNC) · STEP 3D · CSV de nesting · CSV de peces · GLB · Avançat | `LuScissors` · `LuCuboid` · `LuLayoutGrid` · `LuFileDown` · `LuBoxes` · `LuSettings2` |
| Materials | Categories de la llista: Taulers · Fons · Simulació | `LuLayers3` · `LuLayers2` · `LuSprayCan` |
| Màquines | Màquina CNC (pàgina, grups del detall i export Maestro) · Per defecte · Triar carpeta… · Triar fitxers… | `LuFactory` · `LuStar` · `LuFolderOpen` · `LuFileUp` |
| Màquines | Regles de mecanitzat · Distribució dels taulers (girar peces) · Vista CAM | `LuRoute` · `LuRotateCw` · `LuMonitorCog` |
| Materials | Posar una foto / mapa (relleu, brillantor) · Carregar joc de textures… · Carpeta… | `LuImagePlus` · `LuFileUp` · `LuFolderOpen` |
| Materials | Seccions de l'editor: Aspecte · Fabricació · Per defecte als mòduls nous | `LuSwatchBook` · `LuFactory` · `LuStar` |
| Editor de formes | Selecció (node) · Arrodonir la punta · Com funciona (ajuda) | `LuMousePointer2` · `LuSquircle` · `LuCircleHelp` |

Les vistes Davant, Darrere, Esquerra, Dreta i Dalt van amb **text**, sense icona (no hi ha vista «3D»: és «Enquadrar»). Compte: a Lucide, `square-split-horizontal`
té la línia **vertical**. Per això és la de "dividir en vertical".


## Glossari (una paraula, una cosa)
Les etiquetes i les ajudes de la UI fan servir sempre aquestes paraules (auditoria de coherència D,
`docs/millores-v1/coherencia-editor.md`):

| Terme | Només per a |
|---|---|
| **Cos** | la caixa del mòdul (laterals, base, tapa, fons) i el seu material («Com el cos») |
| **Fons** | la peça del darrere del mòdul (el `trassera` del taller); **Fons del calaix**, la del calaix (fila del joc, avís `drawer-bottom`, material propi a Materials; el nom de peça `fons calaix` i l'etiqueta `Fons calaix n` no canvien: són els dels fitxers del taller) |
| **Fondària** | l'eix Z i la mida en Z (mai «Fons Z») |
| **Portes** | la secció del mòdul amb les portes de dalt a baix de tot el mòdul (Interior dividit; Cap · Una · Dues, `LuDoorClosed`); al Front d'una porta, la fila Una · Dues |
| **Front** | porta, front de calaix, abatible, reixeta, front fix; d'un compartiment sense dividir (les zones dividides no en tenen: les portes de tot el mòdul són a Mòdul › **Portes**) (l'estil i les folgances de tots els fronts del mòdul són a Mòdul › **Caixa**; el material, a Mòdul › **Materials**) |
| **Folgança** | separacions: front–cos, entre fronts, lateral i darrere de la guia, prestatge, fons, encaixos, peces de dins; **Folgances per defecte** a Preferències |
| **Joc** | només el joc paramètric del fabricant (`HardwareKit`, «joc de calaix», «Ferratges dels jocs») |
| **Ferratge** | qualsevol `HardwareItem`; **Ferratges**, la secció de l'inspector de la peça lliure (no la del mòdul), la biblioteca de Preferències i l'opció del visor (`LuWrench`) |
| **Acabats de l'escena** | terra i paret de la presentació (moble); als ambients, «Acabats» = terra, parets i sostre. **No hi ha secció «Acabats» al mòdul** (des del 2026-10-08: el que hi havia és a Caixa, Materials i Unió) |
| **Unió** | la secció del mòdul amb l'espiga de les unions de la caixa (`LuBolt`) |
| **Com el mòdul** / **Com el cos** / **Com a Preferències** | heretat; **Còpia pròpia**, la còpia d'un ferratge que ja no és a la biblioteca tal qual |
| **Accessoris** | barra de penjar, tira LED (ferratges del compartiment, a la secció «Prestatges i accessoris»); el marc de vitrina va amb la porta de vidre |
| **Cap (push)** | el tirador que no hi és: obertura per pressió |

## Com treballar
- **Regla d'or: coherència i cohesió.** Abans de fer res nou (component, opció, pantalla, interacció), **busca com està
  resolt el mateix a l'app** i fes-ho igual.
  - **Reutilitza o generalitza; no copiïs.** Si ja hi ha un component que fa la feina, s'hi afegeix el que falta (prop,
    variant) a `components/`. Si n'hi ha dos que fan el mateix, s'unifiquen abans d'afegir-ne un tercer.
  - **Un concepte, un component**: cercador + «+» = `SearchBar`, tria = `ChoiceChips`/`IconChoice`, interruptor = `Switch`,
    lliscador = `Slider`, material = `MaterialSelect`, ferratge = `HardwareSelect`, calaix de tria = `PickerDrawer`,
    cota = `layoutDims` + `DimLine`, camp = `FormRow`. Res d'elements nadius (`<input type="checkbox|range">`)
    fora de `components/ui`.
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
    Caixa i abans dels Materials). El que una opció de dalt fa irrellevant no
    surt (un compartiment tapat no ensenya el seu Front; sense fronts, ni estil ni folgances ni material dels fronts;
    sense laterals ni divisors, ni prestatges ni accessoris ni fronts; sense on unir el divisor, ni Dividir: `zoneSupport.ts`).
  - **Un sol lloc per decisió**: una tria surt un cop a cada pantalla. Els **per defecte** del mòdul (tirador i ferratges)
    no surten: es trien a cada compartiment («Com el mòdul» = l'heretat). Res del que la construcció no llegeix no surt, i
    al revés (`usedHardwareSlots`, `moduleRows`; res amagat compta).
  - Quan aparegui un cas nou, s'afegeix aquí.
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

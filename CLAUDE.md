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
- **polygon-clipping** (booleans de polígons) per als encaixos de les peces lliures.
- **three-bvh-csg** (+ `three-mesh-bvh`) per als booleans 3D de les peces que tallen de costat.

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
- Aspecte del moble sobre la foto (`cal.render`): **Línies** (SVG de cares projectades,
  per encaixar) o **Realista** (`photo/PhotoRender.tsx`: three.js amb la càmera calibrada
  convertida a matriu, materials reals, llum de Preferències › Visor 3D i ombres sobre
  plans invisibles de terra i paret). L'SVG de controls va sempre a sobre.
- AR: export USDZ + `<model-viewer>` amb AR Quick Look a l'iPhone. Res de WebXR.

## UI (Chakra v3 + react-icons)
- Mobile-first: la faig servir sobretot a l'iPhone. Mínim breakpoints `base` i `md`.
- **Menú principal en dos nivells** (`App.tsx`): a la llista de Mobles, només `Mobles` i
  `Preferències`. Amb un moble obert: les seves
  pàgines (`PROJECT_NAV`: Editor, Peces, Nesting, Exportar) i `Preferències` separat a
  baix. Pàgines noves d'un moble van a `PROJECT_NAV`; les generals, a baix.
- **Barra superior del moble obert** (`components/TopBar.tsx`), com Figma/Onshape/Notion:
  `Mobles › Nom del moble` a l'esquerra (nom editable; "Mobles" torna a la llista) i les
  accions del document a la dreta. Cada pàgina hi posa les seves amb `<TopBarActions>`
  (l'Editor: desar, desfer, refer). **Les pàgines no porten títol propi**: l'apartat ja es
  veu marcat al menú. Al mòbil, la mateixa barra amb fletxa enrere.
- **Plantilles com a les apps professionals**: es trien a **Mobles › Nou moble** (galeria:
  En blanc · les teves · les de l'app, amb miniatura `CompositionThumb`) i les teves es
  gestionen allà (menú ⋯: duplicar, desar com a fitxer, eliminar; nom editable). Es creen
  amb el **menú ⋯ de la barra superior** («Desar com a plantilla»). Una plantilla exportada
  és un `.moble` amb `kind: "plantilla"`; en obrir un `.moble` es pregunta «Obrir com a
  moble» o «Afegir a plantilles». **No** van a Preferències ni dins l'Editor.
- **Pàgines del moble, cadascuna amb un sol propòsit**:
  - **Peces**: taula (peces iguals agrupades) + **plànol de la peça seleccionada** al costat.
    Els plànols no van a Exportar.
  - **Exportar**: per destinació (Taller · CNC · Llista de tall · Model 3D), una acció
    principal per grup; les eines de depuració (JSON UnifiedData) plegades a «Avançat».
  - **AR («Veure a casa»)**: botó del visor 3D (`LuView`), no una exportació.
- **Editor en tres columnes, com Figma / Fusion 360** (`features/editor/EditorScreen.tsx`):
  - **Esquerra — Estructura** (`composition/StructureTree.tsx`): arbre moble › mòduls ›
    compartiments, i objectes de referència. Afegir/duplicar/moure/eliminar amb el menú ⋯.
  - **Objectes de referència al 3D** (`RefGhost` a `CabinetViewer`): seleccionat, s'arrossega
    en el pla de la paret (X·Y); Maj o vista de dalt, pel terra (X·Z); vistes laterals, Z·Y.
    Imant de 15 mm a les vores dels mòduls, dels altres objectes, del terra i de la paret (Alt:
    sense imant); etiqueta amb la posició mentre s'arrossega. Fletxes 1 mm (Maj 10), Re Pàg /
    Av Pàg per a Z. Es desa en deixar-lo anar (un sol pas de desfer).
  - **Mòduls al 3D**: nansa ↔ (`MoveHandle`) sobre el mòdul seleccionat; arrossegar-la el mou a
    la seva fila (`moveModuleBy`: els de la dreta es queden on eren) i, si és penjat, amunt i
    avall; amb Maj, tot el moble (`moveAllBy`). Imant a les vores dels mòduls i dels objectes.
    Nanses i botons «+» són malles 3D amb mida constant a la pantalla (`usePixelScale`), no
    `Html` de drei (els Html fallaven en muntar-se i desmuntar-se amb React 19). La nansa surt
    també en mode Presentació (els «+» no). A Posició, tres botons (`mountOf`): **A la paret**
    (a terra, arrambat; es mou de costat), **Penjat** (fila dels penjats; de costat i amunt/avall)
    i **Al terra** (lliure: `Module.wallGap` = separació de la paret; `modulePlacements` dona `z`,
    les peces es desplacen i la nansa arrossega sobre el terra, de costat i endavant/enrere,
    `moveModuleBy(…, dz)`). Taulell i sòcol correguts no tenen en compte `wallGap`. En passar a
    «Al terra» el mòdul agafa **X pròpia** (`Module.x`, `freeX`): surt de la fila, no empeny els
    altres ni els segueix (una illa davant de la cuina); a Posició, camp «De costat (X)». Els
    antics «Al terra» sense `x` continuen a la fila.
  - **Teclat a l'editor**: Ctrl/⌘ C · X · V · D (copiar, retallar, enganxar, duplicar) i Supr
    per al mòdul, l'objecte o el compartiment seleccionat (`editOps.ts`). El porta-retalls és
    a localStorage (`mobles:clipboard`): es pot enganxar en un altre moble.
  - **Càmera**: s'encuadra en obrir, canviar de vista, redimensionar o amb el botó «Encuadrar»
    (càmera de vídeo, `LuVideo`); editar no la mou. El botó surt **marcat** mentre la càmera és a
    l'encuadrament (`onFramedChange`): es desmarca en orbitar/fer zoom/desplaçar o si el moble canvia de mida. Opcions de vista: popover a l'ordinador, calaix de baix al mòbil.
  - **Enganxar objectes** (`RefObject.onFloor`, `onWall`, `anchorRef`): botons «Al terra» (y = 0,
    al 3D llisca pel terra) i «A la paret» (z = 0, penjat: al 3D es mou per la paret); tots dos
    alhora només de costat. El camp fixat queda desactivat; `anchorRef` s'aplica a l'inspector,
    a l'arrossegament i a les fletxes.
  - **Efecte dels objectes** (`RefObject.effect`, `shape`, `axis`): **Obstacle** (per defecte,
    avisa si xoca; el cilindre xoca amb la seva secció rodona, `refTouchesBox`) o **Talla**
    (`build/refCuts.ts`, `applyRefCuts`): forat passant a cada peça perpendicular a la seva
    direcció (z cap a la paret: fons i portes; y: base, tapa, prestatges; x: laterals). Caixa →
    forat rectangular; cilindre → rodó. Si arribaria a la vora (seria un rebaix) no es fa i
    avisa (`ref-cut`). Els que tallen només es veuen seleccionats (en violeta, a través del moble). Els **passacables**
    dels mòduls ja no tenen UI: es migren a objectes que tallen (`migrateCableHoles`, a
    `compositionOf` i a `buildComposition`). Al 3D, els forats del mòdul seleccionat es marquen
    en taronja a través de les portes (`CableMarks`).
  - **Perfil 2D** (`shape: "profile"`): corba de Bézier cúbica composta i tancada, extrudida
    en la direcció de l'objecte. Nodes `PNode` (`model/polygon.ts`): punt, manegadors `in`/`out`
    relatius, `t` = reflex (cantonada · angle · angle i llarg, com a Figma/C4D), i `b` (bulge)
    per als arcs de «Arrodonir». Els perfils antics `[x, y, bulge]` es llegeixen amb `toNodes`.
    Editor `composition/ProfileEditor.tsx`, com el mode vector de Figma: eines **Moure** (nodes
    i manegadors en rombe; Alt trenca el reflex; doble clic node ↔ corba), **Ploma** (clic =
    cantonada, clic i arrossegar = node amb manegadors simètrics, clicar el primer node o Retorn
    tanca, Esc descarta), **Corbar** (arrossegar el punt del mig d'un costat el corba, `bendEdge`;
    clic a un node commuta corba/cantonada) i **Esborrar**; clic al punt del mig afegeix un node
    sense canviar la forma (`splitEdge`, de Casteljau); radi de cantonada; imant a la quadrícula.
    Per tallar, les cúbiques es converteixen en arcs i rectes (`cubicToArcs`, error < 0,02 mm):
    DXF amb bulge (G2/G3) i STEP amb cares cilíndriques. Xocs i 3D amb el contorn mostrejat.
    Pendent: rebaixos de contorn.
  - **Centre — Visor** amb pestanyes `3D` · `Alçat` · `Foto`. Les opcions de visualització
    (forats, explosionat, AR, obertura, colors, imatge) són a la barra del visor, no al panell.
  - **Dreta — Propietats** del que hi ha seleccionat i **només d'això**: moble (resum i
    avisos) · mòdul (carcassa; fusteria plegada a «Avançat») · compartiment (`ZonePanel`) ·
    objecte (`RefInspector`) · a la pestanya Foto, el calibratge. Propietats a 340 px per defecte,
    amb vora arrossegable sense límit (`ResizeHandle`, nansa al mig) a l'arbre i a les propietats; si el panell és més estret que el contingut apareix el desplaçament horitzontal (com IntelliJ). Com el separador de
    l'app de Claude; amplades recordades. Visor amb mínim de 320 px; si fa menys de 640 px,
    pestanyes només amb icona, botons en columna a la dreta i la barra de vistes s'amaga
    (les vistes, a «Opcions de vista»).
  - **L'app ocupa just la finestra** (a l'ordinador): res fa desplaçar la pàgina sencera. A
    l'editor, el visor va de dalt a baix i l'arbre (280 px) i les propietats tenen cadascun
    la seva barra de desplaçament, fina i amb lloc reservat (`scrollbarGutter: stable`).
    Cada panell lateral es plega pel seu compte amb els botons de les cantonades del visor
    (`LuPanelLeftClose/Open` · `LuPanelRightClose/Open`); al mòbil, «Ampliar el visor».
  - **Materials** visibles a les propietats (no amagats): cos, **fronts** (`frontMaterial`,
    buit = el del cos; portes, fronts de calaix, abatibles, reixetes, fixos i trapes) i
    fons. Al moble, «Materials de tot el moble» aplica el canvi a tots els mòduls.
  - **Mode del visor**: tres botons junts a la barra del visor (`VIEW_MODES` a
    `EditorScreen`): **Per peça** (`LuShapes`: ràpid, colors per tipus de peça, paleta i
    llegenda a `viewer/roleColors.tsx`), **Textura** (`LuTrees`: ràpid, materials i veta) i
    **Presentació** (`LuSparkles`: ombres, sense perfils, graella ni «+»; terra i paret amb llum
    d'estudi, `viewer/PresentationRoom.tsx`, procedural). Per dins són la qualitat
    (`viewer/renderQuality.ts`: fast / presentation, també a Preferències › Visor 3D) més
    `mobles:viewer-role-colors-fast`. L'escena és a `viewer/presentationScene.ts`.
  - **Nom a la capçalera de l'inspector**: el nom del mòdul i de l'objecte es canvia clicant-lo
    a la capçalera (`Editable`, com a Figma), no a les seccions; el del moble, a la barra de dalt.
  - **Tipus de moble** (`Composition.kind`, `compositionKind`, `features/composition/kinds.tsx`):
    Moble, Cuina, Armari, Taula. Es tria a la galeria «Nou moble» (filtre per tipus; «En blanc»
    crea el del tipus) i a l'inspector del moble (secció Tipus). Taulell i sòcol correguts només
    surten i es construeixen a la Cuina; en canviar de tipus es guarden (no es fan) i tornen. Taula: `tableModule` (tauler + dos laterals de
    panell, sense base ni fons, cantonades a inglet); «Afegir mòdul» n'afegeix una. Plantilles
    amb `kind` (Consola, Taula de menjador). **Mòduls especials** per tipus (`core/model/modulePresets.ts`,
    `modulePresetsFor`) al menú «Afegir mòdul»: cuina (baixos calaixos/porta/fregadera/fogons/
    forn, columnes forn i rebost, alts porta/abatible), armari (prestatges, penjador amb
    maleter, calaixos i prestatges), taula (consola, menjador, centre, banc); al Moble, les
    plantilles d'un sol mòdul. Els antics: cuina si tenen runs, si no moble.
  - **Acabats** (Estructura del mòdul): **Cantonades** Normals / A inglet (`Carcass.joint`): la
    tapa arriba a fora dels laterals; la base també (`mitreBottom`) si és a baix de tot dels
    laterals (a terra, potes o penjat; amb sòcol no). Cantonades no surt si no hi ha res a unir
    (sense laterals, o sense tapa i amb sòcol o sense base). Si el mòdul només té calaixos i els
    fronts són recobrents, també **els fronts dels calaixos van a inglet** amb els laterals
    (`mitreFronts`): laterals fins a la cara dels fronts (+ gruix) amb el cantell de davant a 45° i
    fronts de fora a fora; el primer i l'últim calaix, també a inglet amb la tapa i la base (que
    arriben a la cara dels fronts); amb portes no (toparien en obrir). La caixa del calaix queda
    sempre dins de la llum. El tall a 45° és un post-procés (després del nesting, que talla el
    rectangle sencer). `mitreGeometry` fa el prisma amb
    qualsevol dels 4 cantells a 45°; `Panel.mitres` als cantells (sense cantell ni espigues,
    avís informatiu), capa DXF `MITRE_45`, «n∠45°» al llistat i al CSV, i al 3D/GLB la secció
    en trapezi (`mitreGeometry`). El STEP encara les dibuixa rectes. **Fronts** Recobrents /
    Encastats (`fronts.style`): encastats dins de la llum amb el joc a tot el voltant, a nivell
    amb el davant (`frontZ`), caixa del calaix un gruix més curta i avís si els prestatges no
    es retiren prou.
  - **Taulell i sòcol en acordió** (`RunsForm`, `Fold`): cada peça correguda és plegable amb
    un resum (de → fins a · gruix · forats); dins del taulell, cada forat també. Una oberta
    alhora; la nova s'obre sola.
  - **Parets buides** (`Carcass.hollow.thickness`, switch a Estructura): laterals, base i tapa
    sencera fets de pell de fora + pell de dins (`*-inner`, fa de paret per a l'interior: forats,
    guies, ranura del fons), llistons entre pells (rol `spacer`) i tira del davant (rol
    `facing`) del gruix aparent. `derive` dona `ws/wb/wt` (gruix de cada paret) i la llum
    interior; `frontTerritory` usa el gruix real de cada paret exterior. Sense espigues entre
    parets (s'encolen); calen ≥ 2·gruix + 6 mm (si no, avís i es fan massisses). Les
    cantonades són **sempre a inglet** (`hollowCorners`: sostre sencer; base si és a terra,
    baseY 0): pells de fora de fora a fora amb el cantell a 45°, pell de dins entre elles i
    tires del davant en marc amb el tall a 45° en el seu pla (`outline`, es fa al nesting).
  - **Prestatges gruixuts** (`zone.shelves.thickness`, «Gruixuts (buits)» a Prestatges):
    pell de baix i de dalt, tira al davant i llistons; el repartiment compta el gruix aparent.
    Queden bé sobretot sense porta. **A ras del davant (a sang)** (`zone.shelves.flush`): sense retranqueig, el
    cantell enrasat amb el davant de la caixa. Amb fronts encastats, només als compartiments
    oberts (sense front); si el compartiment té front, es retiren i avisa.
  - **Peces**: sense botó d'exportar (tot és a Exportar).
  - **Nesting i plànol de peça amb forma**: les peces amb `outline` es dibuixen amb el contorn
    real (el rectangle que ocupen, discontinu); el nesting encara reserva el rectangle.
  - **Peces lliures i flat-pack** (`Composition.parts`, `model/freePart.ts`, `build/freeParts.ts`):
    taulers solts que es col·loquen com els objectes (X/Y/Z, gizmo al 3D amb `RefGhost outline`,
    fletxes del teclat, arrossegar a l'arbre) però són peces de debò (rol `part`, un «mòdul»
    més per a les refs). Orientació `front` (pla X·Y) · `side` (Z·Y) · `flat` (X·Z, v cap al
    fons); `w × h` al seu pla, gruix, material, veta, forma amb l'editor de perfils (`shape`,
    escalada a w × h). **Encaixos automàtics** entre peces d'orientació diferent, per geometria:
    entra i hi acaba → pestanyes + mortalles (passants si la travessa, si no ranures cegues
    `tag: "mortise"`); s'encreuen → mitja fusta; totes dues hi acaben → dits; cantell contra cara
    → espigues. `Composition.joinery` (`DEFAULT_JOINERY`): joc (eixampla mortalles i osques), Ø
    fresa per als **dogbones** a les cantonades interiors, ample de pestanya. El contorn resultant
    es calcula amb `polygon-clipping` (forma − osques; forats interiors → talls `polygon`).
    `build.joints` els llista (inspector de la peça). **Només al tipus Flat-pack**: a la resta
    de mobles les peces lliures no fan encaixos i no surten les opcions d'encaix. Tipus de moble **Flat-pack** (`kind:
    "lliure"`): no es fan mòduls (es guarden), l'arbre només mostra peces i objectes.
    Plantilles «Prestatgeria d'encaix» i «Tamboret flat-pack» (`model/flatPack.ts`).
  - **Grups de peces lliures** (`FreePart.group`, `moveGroupBy`, `duplicateGroup`): menú … de la
    peça (grup nou, posar a un grup, treure) o camp Grup a General. A l'arbre, fila plegable del
    grup; seleccionat (`Selection` `group`), l'inspector mou tot el grup (X/Y/Z de la seva caixa),
    llista les peces i desagrupa. A l'arbre, **arrossegar** una peça sobre la fila d'un grup la hi posa
    (`movePartToGroup`, la fila es marca); deixar-la al costat d'una peça n'agafa el grup (`reorderPart`):
    així s'entra, se surt (al costat d'una peça solta, o a la zona «Treure del grup» que surt sota
    les peces mentre s'arrossega una d'un grup, `removePartFromGroup`) o es canvia de grup. Al 3D, caixa del grup amb el gizmo; el primer clic a una peça
    agrupada selecciona el grup i el segon, la peça (com Figma). Fletxes i Supr també al grup.
  - **Plantilles vitrina** (`SHOWCASE` a `templates.ts`, primer a la galeria): Consola ona sobre
    inox (tauler amb forma + potes d'inox sense nesting), Aparador sobre ferro (inglet, fronts
    encastats, prestatges gruixuts, passacables que talla, bastidor de ferro), Moble TV flotant
    (parets buides, prestatge gruixut a ras, reixeta, tele a la paret), Moble de bany amb pedra
    (penjat, calaixos encastats, taulell de pedra, desguàs), Cuina amb illa de pedra (illa al
    terra amb X pròpia, taulell de pedra enganxat a l'illa), Vestidor amb barres (portes de dalt
    a baix, barres d'inox, doble barra) i Escriptori flat-pack (laterals amb
    arc que travessen el tauler amb pestanyes). `showcase.test.ts` comprova que no fan avisos de
    xoc ni de talls.
  - **Peça lliure que talla** (`FreePart.effect = "cut"`, Efecte Peça/Talla a General): no és
    una peça; `partCutters` la converteix en objecte que talla (perfil = la seva forma, direcció =
    el gruix; a l'estirada la v es gira) i `applyRefCuts` fa el forat passant a les peces que
    travessa (també a les altres peces lliures). Al 3D, fantasma violeta amb el gizmo (id
    `part:<id>` als fantasmes); avisos `ref-cut` amb `partId`. Icona `LuScissors` a l'arbre.
    Amb la mateixa normal: forat passant. **De costat** (`sidewaysCut`): si la travessa de cara
    a cara amb secció recta, rectangle al pla de la peça (forat, o osca del contorn a les peces
    lliures i les que no són de CNC, amb `polygon-clipping`; avisa si la parteix); si no (un tub
    pel cantell d'un bloc), **booleà 3D**: `Panel.solidCuts` (prismes en coordenades locals) que
    el visor, l'AR i el render resten amb **three-bvh-csg** (`solidCutGeometry`); a les peces de
    CNC avisa que no es mecanitza. Els objectes de referència només foraden en la seva direcció.
    També talla les peces que no són de CNC (`extras`).
  - **Render per CPU** (`viewer/render/`, botó «Render» a Opcions de vista, com Cinema 4D):
    `extractScene` passa l'escena del visor a triangles + materials + textures (píxels) i
    `pathWorker` (un per nucli, BVH propi) fa path tracing progressiu: cel d'estudi, sol amb
    ombres suaus, difús, reflex segons la rugositat, metalls i vidre. `RenderDialog` acumula les
    passades (to ACES), s'atura/continua i desa el PNG. No depèn de la GPU. Opcions (columna de la
    dreta): **Qualitat** (resolució, rebots de llum, aturar-se a N passades), **Escena**
    (habitació de Presentació / només terra / cap: `userData.room` a `PresentationRoom`),
    **Llum** (`RenderOpts`: direcció i alçada del sol, intensitat, ombres dures–suaus, cel) —
    aquestes tornen a començar— i **Imatge** (exposició EV, contrast, saturació, fons estudi /
    blanc / transparent amb l'alfa de cobertura del worker), a l'instant.
  - **Peça enganxada a un mòdul** (`FreePart.module`, `resolveParts`, `partOffset`): a General,
    «Enganxada a»; x/y/z passen a ser relatives al mòdul i el segueixen (el taulell de pedra de
    l'illa). Tot el que dibuixa o construeix fa servir `resolveParts` (coordenades de la
    composició); en arrossegar-la es torna a relativa.
  - **Barra de penjar** (`Zone.rail`, switch a Prestatges): tub d'inox Ø25 a 50 mm del sostre del
    compartiment, de lateral a lateral; va a `ModuleBuild.extras` → «Elements sense nesting».
    Avís `rail` si el compartiment fa menys de 900 mm. Icona `LuShirt`.
  - **Front d'una zona dividida** (portes d'armari de dalt a baix amb penjador i maleter
    darrere): `buildParentFront`; les fulles de sota queden `covered` (sense front propi).
    Es tria a la zona dividida («Front de tota la zona») i, per al mòdul sencer, a l'inspector
    del mòdul («Front de tot el mòdul»): només portes o front fix.
  - **Materials que no són de CNC** (`MaterialPref.cnc = false`; ferro, inox, pedra, vidre
    afegits a la v2 de les preferències; acabats `metal` i `glass`): una peça lliure d'aquest
    material porta `nest: false` (es posa sol en triar-lo) i va a `build.extras`: es veu al 3D,
    surt a Peces › «Elements sense nesting» i no va al nesting ni als fitxers del taller, ni fa
    encaixos.
    A l'inspector de la peça, **Mides** és sempre Ample · Alt · Fondària (X · Y · Z; la del gruix
    depèn de l'orientació): de CNC, el gruix es tria entre els del tauler; si no és de CNC, les
    tres lliures i sense Veta ni interruptor d'encaixos.
  - **Llum com model-viewer** (`StudioEnvironment` a `CabinetViewer`): entorn d'estudi
    procedural (`RoomEnvironment` + PMREM, offline) com a `scene.environment` i to `Neutral`;
    l'hemisfèrica queda baixa. **Ray tracing descartat**: `three-gpu-pathtracer` (WebGL) necessita
    més de 16 unitats de textura i als Mac/iPhone (límit 16) les textures surten malament.
  - **Tiradors mecanitzats**: portes (costat contrari de les frontisses, a mitja alçada),
    calaixos (centrats) i abatibles (al cantell que obre) porten dos forats passants Ø5 a 128 /
    96 / 64 com a talls `circle` `tag: "handle"` (com els passacables, perquè el taller els
    llegeixi); el 3D no els buida (`visualPanel`) i el tirador es col·loca als forats. El nesting
    (`BoardDrawing`) ja dibuixa els forats de cara (plens a la cara A, buits a la B).
  - **Ferratges visuals** (`viewer/Hardware.tsx`, botó «Ferratges» a Opcions de vista,
    `mobles:viewer-hardware`): frontisses (cassoleta + braç a les cassoletes `hinge`), tirador de
    barra a portes (al costat contrari de les frontisses), calaixos i abatibles (centrat), i potes
    regulables dels mòduls amb base de potes. Només es dibuixen, no es fabriquen.
  - **Preferències amb acordions de segon nivell** (`components/SubFold.tsx`): cada material i
    cada objecte de referència és una fila plegable (resum: gruixos, acabat, cantell / mides);
    també «Per defecte als mòduls nous», Mides de tauler · Tall, Jocs (Fronts · Prestatges i fons),
    Ferratges (cada grup), Tema (Aparença · Color) i Visor 3D (Qualitat · Escena).
    Aquestes files van en **graella** (`FoldGrid`: tantes columnes de ≥ 340 px com hi càpiguen,
    una al mòbil; cadascuna s'obre sola). Al material, botó visible «Posar una foto de textura»
    (a més de l'Acabat «Foto (textura)»), amb miniatura, «Canviar la foto» i «Treure-la».
  - **Opcions que no toquen s'amaguen**: sense fons no surten el material i el gruix del fons
    ni la ranura del fons; Cantonades, només si hi ha tapa o base a unir amb els laterals.
  - **Forma del tauler**: `shapeOutline` escala per l'extensió real de la corba (mostrejada),
    no pels nodes: si no, les cúbiques sortien del rectangle del nesting.
  - **Compte amb `Field.Root`**: no hi posis dos interruptors a dins (el Field els dona el
    mateix id i els dos rètols activen el mateix): passava amb Laterals Esquerre/Dret.
  - **Post-processos** (`core/process/processes.ts`): `panelProcesses` dedueix el que toca a
    cada peça després del nesting, en ordre: 2a cara → Inglet 45° → Cantell → Forats de cantell →
    Encolar (`Panel.assembly`). L'app NO fa etiquetes (les fa el taller-cnc-nest): només ho
    anota. **2a cara** (`needsSecondFace`: forats o ranures a la cara B) → columna
    `SEGUNDO_NOMBRE_DE_FICHERO_DE_MECANIZADO` del CSV TopSolid amb `<ref>Volt` (com TopSolid;
    el taller en fa l'etiqueta «PROGRAMA 2a CARA» amb Code128). La resta surt a la llista de
    peces («Després del nesting») i al CSV de peces (Processos). El test d'anada i tornada ho
    comprova amb els parsers del taller (`~/Desktop/taller-cnc-nest`).
  - **Barra del visor**: fora només «Opcions de vista» (i amagar propietats); a dins, a dalt,
    accions ràpides només amb icona i el nom al tooltip (`viewQuick`, el text no hi cabia): els 3 modes, Encuadrar, Forats, Explosió i
    Veure a casa (AR); a sota, la vista, l'obertura i la imatge. Al mòbil, el visor amb els
    marges de la pàgina i sense marge a dalt.
  - **Versió** (com a rack): `__APP_VERSION__` = nombre de commits i `__APP_COMMIT__` (git en
    construir, `vite.config.ts`; sense git, `APP_VERSION` o «dev»), petita al costat del nom al
    menú i al manifest. El Dockerfile instal·la git i el `.git` no s'ignora.
  - **Textures reals** (`Finish.kind = "image"`): a Preferències › Materials, Acabat «Foto
    real»: es tria una foto (reduïda a 1024 px JPEG) i l'amplada real que mostra (mm);
    `photoTexture` (repetició en mirall perquè no es vegin costures).
  - **Tauler de taula** (`Carcass.tableTop`): la tapa per sobre dels laterals (més curts),
    voladís a tot el voltant i forma (rectangle, arrodonit, oval o a mida amb l'editor de
    perfil; `shape` en mm s'escala al tauler). `Panel.outline` (rectes i arcs): 3D/GLB
    extruït, DXF amb bulge, STEP prisma amb cares cilíndriques (`outlineSolid`; els
    mecanitzats d'aquestes peces només al DXF/CSV). Preset «Taula oval».
  - **Posició dels objectes**: els camps són «↔ De costat X», «↕ Alçada Y» i «⤢ Fons Z»
    (`AxisLabel`, icones de colors com les fletxes) i l'etiqueta d'arrossegar al 3D fa servir
    les mateixes fletxes. `NumberField.label` accepta un ReactNode.
  - **Gizmo de moviment** (`MoveGizmo`): l'objecte seleccionat porta tres fletxes al 3D
    (vermella X de costat, verda Y amunt, blava Z endavant), de mida constant a la pantalla i per
    sobre de tot; cada una arrossega només en la seva direcció (pla que conté l'eix i mira a
    la càmera), amb el mateix imant. S'amaguen les fixades (al terra: Y; a la paret: Z) i les
    que miren a la càmera en vistes ortogràfiques. Arrossegar el cos continua movent en el pla.
  - **Opcions amb icona** (`components/IconChoice.tsx`): poques opcions → botons d'icona amb
    el nom al tooltip i l'opció triada al costat del títol. Base, Fons, Tapa (mòdul), Patró de
    reixeta, Direcció dels objectes; Efecte i Forma dels objectes, portes (una/dues, frontisses),
    abatible i muntatge de la reixeta són segments amb icona i text.
  - **Arbre: arrossegar per ordenar** (`reorderModule`, `reorderRef`): mòduls dins de la
    seva fila i objectes; una línia marca on cau. El menu … manté «Moure amunt/avall».
  - **Inspector en seccions plegables independents** (`PanelSection` fora d'un
    `PanelGroup`): se'n poden tenir diverses obertes. **Totes comencen tancades** en obrir
    l'app (també les de Preferències i Exportar) i l'estat es recorda només durant la sessió
    (sessionStorage, `mobles:section:<id>`). Mòdul: Mides · Estructura · Materials ·
    Fusteria (avançat). Compartiment: accions com a icones a la capçalera de l'inspector (Pare · Duplicar ·
    Eliminar; a l'objecte, Desar a preferències · Eliminar) i
    Front · Prestatges · Mida · Dividir. Moble: Resum · Materials de tot el moble. Objecte:
    General · Mides · Posició. Avisos de fusteria: també secció. Les preferències sí que fan d'acordió (una oberta). Res de botons «Veure a l'alçat»: les
    pestanyes 3D · Alçat · Foto ja són a dalt del visor.
  - **Base del mòdul** (Estructura): a terra · sòcol · potes · sense base. Avís `hanging` si
    un penjat té el fons prim.
  - **Posició: dues files, com a les cuines** — *A terra* (baixos) i *Penjats a la paret*
    (alts, `base.kind = "wall"` amb l'alçada des del terra). Dins de cada fila, l'ordre és el
    de l'arbre (d'esquerra a dreta) i cada mòdul va al costat de l'anterior de la seva fila
    amb `gapBefore`. L'arbre agrupa per fila i «Moure» canvia l'ordre dins de la fila.
    Posició sempre amb `modulePlacements()` / `compositionWidth/Height`, mai a mà. Els
    ancoratges antics (`anchor`) es converteixen en carregar (`normalizeComposition`).
  - **Mòdul seleccionat al 3D i a la foto: translúcid** (per veure'n l'interior i els
    compartiments) amb contorn taronja; la resta del moble, sòlida. Compartiment
    seleccionat: contorn taronja amb vel. Al 3D, el primer clic selecciona el mòdul i el
    segon (amb el mòdul ja seleccionat) entra al compartiment tocat (`selectFrom3D`).
    Tornar a clicar el compartiment seleccionat puja al pare (fins al mòdul); clicar la
    carcassa (laterals, tapa, base) torna al mòdul.
  - **Alçat**: el mòdul en edició i, translúcids, una franja dels mòduls veïns (costats,
    a sobre i a sota) per orientar-se; clicar un veí hi passa (`neighbors` a `ElevationEditor`).
  - **Peces corregudes** (`comp.runs`, `core/build/runs.ts`): **taulell** (d'una peça sobre
    els baixos de la fila, amb voladís i forats d'encastar de placa, pica o a mida, que surten
    com a talls passants al DXF/STEP/CSV) i **sòcol corregut** (davant de les potes, de punta a
    punta, retranquejat). Es numeren com un mòdul més (n + 1) per a les refs del taller. Es
    configuren al moble, secció «Taulell i sòcol».
  - **Una sola selecció** (`Selection`), sincronitzada entre arbre, 3D i alçat. Controls
    nous: decideix a quin nivell pertanyen i posa'ls a l'inspector d'aquell nivell.
  - **Mòbil**: visor a dalt i, a sota, pestanyes `Estructura` · `Propietats` (triar a
    l'arbre porta a Propietats).
- **Seccions plegables** (`components/PanelSection.tsx` + `PanelGroup`): totes iguals
  (icona + títol + fletxa, sense fons), una oberta alhora; per a opcions avançades dins
  d'un inspector o a Preferències.
- **És una app, no una web**: el contingut ocupa **tota l'amplada** (sense `Container`
  amb `maxW` centrat). El 3D, la foto, l'alçat i el nesting s'estiren tant com la
  pantalla. Només es limita l'amplada dels panells de formulari (p. ex. 360–400 px) i
  dels textos llargs.
- **Inputs a 16px sempre** (`src/theme/inputs.css`, CSS sense capa: el globalCss de Chakra
  va a `@layer base` i les receptes `sm`/`xs` el rebaixaven) per evitar el zoom d'iOS.
- Tokens semàntics (`bg.subtle`, `fg.muted`...) i `colorPalette`, no colors crus.
- **Color principal = paleta `wood`** sempre (`colorPalette="wood"`, `wood.fg`...). L'usuari el canvia a
  Preferències → Tema (`theme/accent.ts` redirigeix les variables CSS de `wood`). No facis servir
  `blue`, `orange`... per al color principal. Dia/nit també és a Preferències, no al menú.
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
  Xarxa de seguretat global: tota `Field.Label` és d'una línia amb punts suspensius
  (`theme/system.ts`) i mostra el text sencer al passar-hi per sobre
  (`theme/truncatedTitles.ts`; per a altres textos, afegeix `data-truncate`).
- Camps numèrics de mides amb `NumberInput` i sufix "mm". En columnes estretes (< 130 px)
  s'amaga el sufix (no els botons + −) automàticament (container query a `NumberField`).
- Un selector (`select` o `SegmentGroup`) no pot desbordar el seu contenidor: si les
  opcions no hi caben (popovers, inspector), fes servir un `NativeSelect`. A l'inspector,
  cada `SegmentGroup` va sol a la seva fila i a tota l'amplada (mai dos de costat).

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
| Zones | Divisió vertical (zones de costat) · Divisió horitzontal (zones una sobre l'altra); un compartiment porta la icona del seu contingut (fila «Contingut»), igual a l'arbre, a la capçalera i a la secció «Front» (`composition/zoneIcon.tsx`) | `LuColumns2` · `LuRows2` |
| Zones | Eliminar divisió · Mida | `LuUngroup` · `LuRuler` |
| Contingut | Obert · Prestatges · Porta · Calaixos | `LuSquareDashed` · `LuRows3` · `LuDoorClosed` · `LuArchive` |
| Contingut | Abatible · Reixeta · Front fix | `LuPanelBottom` · `LuGrid3X3` · `LuSquare` |
| Composició | Afegir · Duplicar · Eliminar · Reordenar | `LuPlus` · `LuCopy` · `LuTrash2` · `LuGripVertical` |
| Composició | Objecte de referència · Radiador · TV | `LuScan` · `LuHeater` · `LuTv` |
| Composició | Plantilles · Desar com a plantilla · Menú del document | `LuLayoutTemplate` · `LuBookmark` · `LuEllipsis` |
| Panell | Mides exteriors · Taulers · Interior i front · Fusteria · Adaptar a la imatge | `LuMoveDiagonal` · `LuSquareStack` · `LuLayoutPanelLeft` · `LuHammer` · `LuCamera` |
| Panell | Composició (mòduls i objectes de referència) · Compartiments (alçat) | `LuLayoutDashboard` · `LuLayoutPanelLeft` |
| Inspector | Estructura (base, fons, tapa, laterals) · Front · Pare | `LuFrame` · `LuDoorClosed` · `LuArrowUp` |
| Inspector | Resum del moble · Posició | `LuBox` · `LuMove` |
| Inspector | Anterior · Següent · Accions de la selecció (menú) | `LuChevronLeft` · `LuChevronRight` · `LuEllipsis` |
| Preferències | Tema (dia/nit/sistema) · Color principal | `LuSunMoon` (`LuSun` · `LuMoon` · `LuMonitor`) · `LuCheck` a la mostra triada |
| Fitxer | Desar com a fitxer · Obrir fitxer | `LuSave` · `LuFolderOpen` |
| Editor | Estructura · Propietats · Opcions de vista · Alçat | `LuListTree` · `LuSlidersHorizontal` · `LuSlidersVertical` · `LuLayoutPanelLeft` |
| Estat | Avisos de fusteria · Desfer · Refer | `LuTriangleAlert` · `LuUndo2` · `LuRedo2` |
| Foto | Foto · Referència · Distància · Rectangle | `LuCamera` · `LuCrosshair` · `LuMoveHorizontal` · `LuRectangleHorizontal` |
| Foto | Origen (0,0) · Treure/tancar | `LuLocateFixed` · `LuX` |
| Foto | Mida estimada · Mida real (cinta) · Línia del terra · Fondària | `LuEye` · `LuCircleCheck` · `LuArrowDownToLine` · `LuArrowUpFromLine` |
| Visor | Forats · Explosionat / muntat · Ampliar / reduir 3D | `LuCircleDot` · `LuExpand` / `LuShrink` · `LuMaximize2` / `LuMinimize2` |
| Visor | Veure a casa (AR) | `LuView` |
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

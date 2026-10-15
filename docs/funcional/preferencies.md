# Preferències

> Tret del `CLAUDE.md` (2026-10-15) perquè no es carregui sencer a cada sessió. Llegeix-lo abans de tocar aquesta part.

### Preferències
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
  `HARDWARE_THUMB_VERSION` (ara 9: el recorregut del cable dels llums; abans 8: ferratges de sèrie en 3D, fusta translúcida, sense les espigues de la caixa fora del muntatge de l’espiga i les potes mirades des de la del davant). Un **«només 3D»** s'enquadra a la seva caixa
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
  Components · Peces de fusta · Mecanitzats del joc · Hipòtesis) i, als jocs de llum, les seves (`LightSections`, per
  decisió de l'usuari, 2026-10-14, com els calaixos: Del catàleg · Mecanitzat —amb com hi passa el cable— · Llargades
  d'una barra · Sistema elèctric —alimentadors, distribuïdor, interruptors, cables, tapa passacables— · Hipòtesis).
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
- **Versions i lectura** (`core/model/settings.ts`, `SETTINGS_VERSION`, ara 45 (el penjador ocult regulable i la regleta de paret dels mòduls penjats —llocs `hanger` i
`wallRail`, «Per defecte als mòduls nous»— i els sòcols d'alumini de 100 i 150, ferratges per metres, `V45_ITEMS`,
additiu: s'afegeixen per id i els llocs nous apunten als d'inici, `fixHardwareDefaults`); 44 (la Duomatic 105° per a marc estret i els pistons de gas Häfele, `V44_ITEMS`, additiu); 43 (la frontissa Duomatic Premium per a marc d'alumini, `V43_ITEMS`, additiu); 42 (els tiradors de vitrina Häfele, `V42_ITEMS`, additiu); 41 (a les vitrines, la frontissa —la Metallamat A, `V41_ITEMS`— i el tirador es trien com a les portes; els marcs Häfele, només perfil, es refan); 40 (els perfils de LED a «Llums»); 39 (la pota AXILO 78 de mobles, `V39_ITEMS`, additiu); 38 (la pota AXILO 78 amb la placa per dibuixar-la al 3D, refeta si és d'una versió anterior de l'item); 37 (la pota AXILO 78 com la munta el taller, refeta si encara és la de la v34); 36 (el material del que es veu d'un ferratge, `HardwareItem.material`: els marcs Häfele en «Alumini anoditzat plata», material nou `FRAME_MATERIALS`; el de l'app, negre); 35 (catàleg general Häfele, `V35_ITEMS`: marcs d'alumini amb la placa de la Metallamat A, 9 tiradors, 2 suports de prestatge i el perfil Loox d'11 mm per encastar amb la tira LED 3015, additiu); 34 (potes de sòcol Häfele AXILO 78, `V34_ITEMS`, additiu); 33 (el joc de la ranura per defecte a 0,8, `DEFAULT_GROOVE_CLEARANCE`); 32 (joc de l'ample de la ranura del fons, `gaps.grooveClearance` 0, additiu); 31 (jocs de llum Häfele Loox, additiu); 30 (la neteja de la 29 amb la regla sencera); 29 (fora els «només 3D»: tots els inicials del motor `model`, els importats sense `machining` i els inicials DTC que ja no són a la biblioteca); 28 (la resta del catàleg DTC 2026, additiu); 27 (catàleg DTC 2026: jocs i push latch, additiu); 26 (`assistant`: clau de l'API i model,
  additiu; **la clau no surt mai** a l'export, `settingsToJson`, ni al `.moble`, i importar unes preferències no la toca,
  `importSettingsJson`); 25: `gaps.innerClearance`, 1 mm, additiu; 24: jocs inicials amb les dades d'ara; 23: jocs paramètrics de calaix (DTC MAGIC-PRO); 22: generador de mecanitzats; 21: tiradors, potes i «només 3D» importats; 20: ferratges importats; 19: biblioteca de ferratges; sense versió, additius en llegir: els accessoris de la biblioteca (`fixHardwareDefaults` afegeix l'item d'inici de cada lloc que falta) i la regla `kitPilot`): les migracions depenen només de la versió
  desada, que **mai baixa** (`saveSettings` desa la més alta). **Desades per una versió més nova**: només lectura
  (`saveSettings` torna `false` amb `console.warn`; `loadSettings` avisa). **Lectura camp a camp** (`repairValue`,
  `core/model/repair.ts`): un valor dolent d'una secció només torna aquell valor a l'inicial (un tauler o una llargada de guia
  dolents es treuen); el missatge diu el nom de la pàgina. **Importar** (`importSettingsJson`): només se substitueixen les
  seccions que porta el fitxer (un sense `machines` no esborra les màquines).

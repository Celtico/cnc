# Model del moble

> Tret del `CLAUDE.md` (2026-10-15) perquè no es carregui sencer a cada sessió. Llegeix-lo abans de tocar aquesta part.

### Model del moble
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
- **Tipus** (`Module.type`, `moduleType`, `core/model/moduleType.ts`; per decisió de l'usuari, 2026-10-15: «canviem Posició
  per tipus de moble, i allà seleccionem electrodomèstic, i a dins la Caixa les opcions de l'electrodomèstic»): el primer del
  mòdul, **Baix · Penjat · Columna · Electrodomèstic** (`setModuleType`). Penjat és la base `wall`; Baix i Columna, el
  triat o, sense, per l'alçada (≥ 1200, columna; en canviar-ne, 770 o 2100 si la que té no hi escau); Electrodomèstic, el
  mòdul que **és** l'aparell (`isApplianceModule`) o el triat encara sense aparell. L'aparell es tria a Tipus
  (`setModuleAppliance`: qualsevol de la biblioteca; per decisió de l'usuari, «quan és baix o penjat no poden sortir
  electrodomèstics»: la placa i la campana també són Electrodomèstic i conserven l'Interior; un de penjat penja el mòdul;
  el nínxol de terra, sense laterals; l'amplada, la del nínxol si no hi entra) i les opcions del front de moble surten a
  la Caixa. Un mòdul dividit no pot ser Electrodomèstic (l'aparell, a cada compartiment). Test `model/moduleType.test.ts`.
- **On va: dues files, com a les cuines** — *A terra* (baixos) i *Penjats a la paret* (`base.kind = "wall"` amb l'alçada
  des del terra). Dins de cada fila l'ordre és el de l'arbre i cada mòdul va al costat de l'anterior amb `gapBefore`. Posició
  sempre amb `modulePlacements()` / `compositionWidth/Height`, mai a mà. Els `anchor` antics es converteixen en carregar
  (`normalizeComposition`). Tres muntatges (`mountOf`): **Arrambat a la paret**, **Penjat** i **Lliure al terra** (`Module.wallGap`
  = separació de la paret, i **X pròpia** `Module.x`/`freeX`: surt de la fila i no empeny els altres, p. ex. una illa; camp
  «De costat (X)»). Els antics «Al terra» sense `x` continuen a la fila. **Girat** (`Module.rot` 90 · 180 · 270, o el `turned` d'abans = 180; `moduleRot`; només lliure al terra; Mòdul › Posició «Fronts»: Endavant · A l'esquerra · A la dreta · Enrere; per decisió de l'usuari, 2026-10-13, enrere per fer una illa amb dos mòduls d'esquena, i 2026-10-16, a un costat per a l'extrem d'una illa): el mòdul es construeix igual i `buildComposition` el gira al voltant del centre de la caixa de les seves peces (`CompositionBuild.modules[].turn`; `moduleToWorld`, `moduleFromWorld` i `moduleBoxToWorld` per al clic, el ressaltat dels compartiments, el contorn i la maneta). A la planta, `moduleFootprint` (l'amplada en Z si és de 90° o 270°) fa els trams; el sòcol de cada tram va retirat de la cara dels fronts a cada costat on n'hi miren (`tramPlinth.ts`). Un girat 90° no fa l'entrada d'aire de l'electrodomèstic al sòcol; l'alçat el dibuixa de costat; l'obertura del 3D surt enrere (`opening.ts`, per l'`explodeDir`). Tests `build/turnedModule.test.ts`, `viewer/openingTurned.test.ts`. El taulell corregut no té en compte `wallGap`.
- **Carcassa** (inspector del mòdul, secció Caixa):
  - **Suport: un per a tot el moble** (`Composition.support`, `supportSchema.ts`, `floorSupport.ts`; per decisió de
    l'usuari, 2026-10-15: «és un sòcol per a tots els mòduls i no un per a cada un»; «el sòcol no pot anar per cada mòdul,
    és una peça global»): Moble › **Suport general** (`SupportForm`) tria **Directe a terra · Sòcol · Potes vistes**,
    l'alçada de les potes, la pota i el sòcol. `withSupport` (en obrir el moble, a cada canvi de l'Editor i a
    `buildComposition`) l'escriu a la base de cada mòdul de terra (`{ kind: "none" }` o `{ kind: "legs", height, hardware }`):
    al mòdul, el Suport és un text. Un mòdul **sense base** no pot anar sobre potes (s'hi cargolen): va directe a terra i
    no és del tram (un cobreradiador). Els mobles d'abans el prenen dels seus mòduls (`deriveSupport`: el suport més
    repetit; el sòcol de les potes de cada mòdul o el sòcol corregut, amb els costats dels extrems; el **sòcol de caixa**
    d'abans —laterals fins a terra— passa a potes de la mateixa alçada amb el mòdul més baix, a dalt queda on era, i
    retorns a ras dels laterals) i els sòcols correguts (`runs` de tipus `plinth`) es treuen. **Base** (la peça de baix,
    `Carcass.noBottom`; per decisió de l'usuari, 2026-10-15: «la base que es pugui treure, perquè igual no necessita la
    base»): **Sencera · Sense base**, com «Sense tapa» i «Sense fons»; amb potes la base hi és sempre. `hasBottom`
    (`zoneSupport.ts`) és l'única pregunta. Sense base, la **Llum a sota** no surt i els compartiments de baix compten la
    base que no hi és com a aguantada (`noBase`). Test `build/noBottom.test.ts`. Avís `hanging` si un penjat sense
    penjadors té el fons prim.
  - **Trams i el sòcol de cada tram** (`floorTrams`, `core/build/tramPlinth.ts`): un tram són els mòduls de terra que es
    toquen (de costat, ≤ 1 mm, o d'esquena, ≤ 50 mm: les dues files d'una illa; els penjats no). Amb «Sòcol», **una sola
    peça per costat de cada tram**, de punta a punta: al davant sempre, a «Retirada» de la cara dels fronts; als costats
    triats per a cada tram (`tramSides`, `support.trams` per l'id d'un mòdul del tram: Davant · + esquerre · + dret ·
    + laterals · Tot el voltant; per defecte només el davant, i un tram lliure al terra —una illa— tot el voltant), a
    «Retirada dels costats» de la cara del lateral o del darrere. De **fusta**: de terra fins a 5 mm sota la base (l'alçada
    del sòcol AXILO = H − 5), del material i gruix del cos del primer mòdul (o els triats), cantonades a tope o a inglet
    (`plinthPieces`, `Panel.mitres`, avís `mitre`); un tram més llarg que un tauler (2400) es fa **a trossos**, amb les
    juntes on es toquen dos mòduls. D'**alumini** (`plinthProfile`): cap peça de CNC, els perfils a `extras`, la comanda
    per metres amb un clip a cada pota i les cantoneres; avís si el perfil no hi cap sota la base o hi deixa més de 20 mm.
    Les peces són un «mòdul» més per a les refs (n + 1, com el taulell). L'**entrada d'aire** dels electrodomèstics
    (`ModuleBuild.ventInlets`) és un retall al sòcol del tram davant del compartiment. Avisos: el sòcol que toca el peu
    de la pota triada (`hardware`) i el mòdul del tram que no arriba a l'alçada dels baixos (`layout`: el taulell no
    quedaria pla; les columnes no compten). Tests `build/tramPlinth.test.ts`, `build/linearOrders.test.ts`. Amb potes, «Pota»:
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
  - **Penjadors** (mòdul penjat, v45; per decisió de l'usuari, 2026-10-15: «als mobles de paret falten els ferratges per
    penjar el moble» → **penjador regulable i regleta**, i «fem-ho tot el més estàndard possible per si surt un nou
    client» → **el de la fitxa del fabricant**; `MountingBuilder.buildHangers`, `build/module/mounting.ts`): a
    Mòdul › Caixa, sota «Suport» (penjat), **«Penjadors»** (`Base.hanger`: «Com el mòdul» = el lloc `hanger` del mòdul,
    un altre de la biblioteca o **«Cap»**) i, si n'hi ha, **«Regleta»** (`Base.rail`, lloc `wallRail`, també «Cap»: plaques
    soltes a mà). **Per defecte, tots els mòduls penjats en porten** (també els desats: sense camp = el del mòdul o el
    d'inici). El d'inici (`hanger-concealed`, v2) és l'estàndard de penjador ocult amb regleta, el **Libra H2** d'Italiana
    Ferramenta (Häfele 290.41.910), muntat **sota la tapa i darrere del fons**: a cada lateral, cara de dins, **4 × Ø10 × 13
    en columna a 32**, el primer a **37 sota la tapa** i l'eix a **5 darrere la cara de darrere del fons** (`underTop`,
    `fromTop`, `behindBack`); al fons, davant de cada penjador, la **ranura per regular-lo** des de dins (`Panel.cutouts`
    `slot` de **12 × 54,5**, a 34 sota la tapa i a 19,5 de la cara del lateral, tag `hanger`; s'hi posa la tapeta); **sense
    osca** al fons. Tot o res per penjador (fora de la peça: cap forat i avís `hardware`). El cos (39,4 × 142,2 × 15) i el
    ganxo es dibuixen (`extras` `hanger-left/right`, `-hook`, rol `hardware`); a la comanda, un per lateral (`order`). La
    **regleta** (ferratge per metres, motor `wallRail`: Libra B3, 33,5 × 5,6, barra de 2000) va contra la paret de lateral
    a lateral, a `railTop` (40) sota la tapa (només es dibuixa: a obra), i la comanda ajunta la dels penjats seguits (vegeu
    Ferratges per metres). El penjador i la regleta van entre la paret i el fons: cal que el fons en deixi `gap` (15 mm,
    el mínim del Libra H2; Häfele en dona 16–20): **el fons estàndard dels penjats és en ranura retirat 20**
    (`model/hungBack.ts`, `hungBack`: el fan els mòduls penjats nous —`defaultModule`, i amb ell plantilles, catàleg,
    col·leccions i mòduls de Preferències—, `applySettingsToModule` i penjar-ne un, `setModuleMount`; els mobles desats no
    es toquen). Si el fons no en deixa (cargolat, o en ranura a menys de 15), cap forat i un sol avís `hanging`. Amb
    penjadors, el fons prim ja no avisa (el pes va pels laterals). Les **còpies d'abans** (item v1 desat al mòdul, sense
    `behindBack`) es fan com abans (4 × Ø10 × 12 en quadre a 37 de dalt i del darrere, davant del fons, l'osca del fons
    `notchWidth` × `notchHeight`): els mobles desats amb la còpia no canvien. El **Camar 807** (el que se sol anomenar) és
    el dels **baixos penjats** amb plaques de paret 897 (4 × Ø10 en rectangle de 32 × 64), no el de regleta: no s'ha posat.
    `usedHardwareSlots`: `hanger` (un per lateral) i `wallRail`. Mides i fonts (amb pàgina) a
    [`ferratges-jocs.md`](../ferratges-jocs.md) › Ferratges per metres i penjadors i a `core/model/hangingHardware.ts`.
    Test `build/hangers.test.ts`.
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
      vies passades les 6 ranures, interruptor + cable, la **tapa passacables** 833.74.795 per amagar el cable dins del
      moble —el catàleg no dona cap forat al fons— i la nota dels cables d'extensió) a Peces › «Llums i instal·lació
      elèctrica» i al LLEGEIX-ME de Maestro. Preferències **v31** (additiu, `V31_ITEMS`); `hardwareParams` amaga «Entre
      llums» i «Rebaix» al perfil de l'app. Tests `build/lightKit.test.ts`.
    - **Recorregut dels cables** (per decisió de l'usuari, 2026-10-14: «fes el mecanitzat de tots els cables, i el que no
      és mecanitzat, un plànol»; «per dins de la fusta, no poden quedar per sobre»; `buildWiring`, `ModuleBuild.wiring`,
      `CompositionBuild.wirings`): l'**alimentador on no es veu** (a sobre de la tapa als penjats, a sota de la base amb
      potes o sòcol, al mig de l'amplada —o al primer lloc sense columna ni potes: 110 mm de les cantonades i de qualsevol columna que travessi la base, `keepOut`— i el cable arran del darrere, lluny de les plaques de les potes, o
      per davant d'una columna si n'hi ha pel camí; a terra sense aire, a dins sobre la base amb la sortida pel fons, ranura de 40 × 16 `cable-mains` per a
      l'endoll pla europeu); de cada làmpada al darrere **per dins del tauler** (forat de cantell des del cantell de
      darrere fins a la làmpada, pel mig del gruix, tag `cable-run`: post-procés «Forats de cantell», broca llarga; llavors el
      passant Ø8 de la làmpada cap a l'altra cara es treu —es veia des de sobre— i, amb menys de 4 mm de pell, no es fa; a la
      tapa d'un penjat o a la base d'un de potes no cal, surt per la cara amagada); **vertical per la cambra de darrere del fons** (per decisió de l'usuari, «per la trasera del moble»: fons en ranura o
      encastat retirat ≥ 8 mm; un passant al fons on surt del prestatge i un a la tapa o la base per sortir a la cara amagada;
      sense regletes a la vista) o, sense cambra, per dins a 25 del fons o de la columna (`rearLimits`) amb un passant a
      cada peça horitzontal i la tapa passacables, fins a la cara amagada, i per la cara amagada fins a l'alimentador (davant de les columnes). Llargada de cada cable (avís si
      passa del màxim del catàleg). **Plànol** a Peces › «Llums i instal·lació elèctrica» (`features/cutlist/WiringPlan.tsx`).
      **Al 3D i al render** (de només veure, rol `hardware`): l'alimentador, cada cable (Ø4, `hwRod`) i la tapa
      passacables als trams verticals (i, a dins, al de sobre la base). Tests a `build/lightKit.test.ts` i
      `build/columnWalls.test.ts`.
    - **Llum a sota del moble** (`Carcass.underLight`, Mòdul › Caixa «Llum a sota», després de la base; per decisió de
      l'usuari, 2026-10-14, com la cuina de casa: «a sota dels mobles hi posen leds»; només penjat o amb potes,
      `visibleModule`): la mateixa «Llum» (el perfil de l'app o un joc de llum, «Com el mòdul» o còpia pròpia) a la cara
      de sota de la base, que il·lumina el taulell: `buildUnderLight` → `buildLights(…, { y })` (forat o rebaix i passant
      del cable a la base, des del davant del mòdul) o la tira `led-under`.
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
    davant, `plateHoles`/`addPlate`, tota o res; els que cauen a la filera passen a ser de la placa, tag `plate`). **Tot es veu** (per decisió de l'usuari, 2026-10-14: «aquí igual s'ha de veure tot», «això s'ha de veure»): a cada frontissa col·locada, la cassoleta de la frontissa triada al darrere del perfil del costat de les frontisses (`Hole` tag `hinge` amb `edge` = el cantell de les frontisses al perfil, que és a `extras`: no va a la CNC; el STEP de CAD els treu) i `hardwareSolids` en dibuixa la cassoleta, el braç (s'obren amb la porta) i la placa al lateral (`fixedSolids`), com a les portes de fusta; el tirador (`glassPull`, el llarg del `pitch` + 25) i, a l'abatible de vidre, un braç a cada lateral (`glassHingeBody`, `glassArm`, `hwBox`: `extras` rol `hardware`, al 3D i al render; no són de CNC). **Tiradors de vitrina Häfele** (v42, `HAFELE_GLASS_PULLS`: 563.25.995 plata i 563.25.095 inox; motor `barHandle` sense forats, es claven al perfil) es trien al «Tirador». Test
    `build/hafeleCatalog.test.ts`.
  - **Ferratges de marc d'alumini** (`isFrameHardware`, `FRAME_HINGE_IDS`; per decisió de l'usuari, 2026-10-14: «les
    opcions no compatibles no han de sortir»): a una porta o abatible de vidre, a «Frontissa» i «Tirador» només surten les
    frontisses de perfil (Metallamat A, Duomatic per a marc) i els tiradors que es claven al perfil; a un front de fusta,
    mai (`HardwarePick glass`). **S'obren** (`movingGroups`, `opening.ts`): el marc, el vidre i el tirador giren junts
    sobre el perfil de les cassoletes (els pistons es queden al moble).
  - **Abatible de vidre** (`front.glass` d'un abatible, «Vitrina» › «Abatible de vidre amb marc»; per decisió de l'usuari,
    2026-10-14, com la porta de vidre): el marc triat (`front.frame`, fila «Marc») i el vidre a `extras` (`glassDoor` sense
    plaques de frontissa); el braç i el tirador es trien igual, però van al perfil (el braç amb l'adaptador Häfele
    563.25.960): cap abatible de tauler ni forats al tauler. **Frontisses al cantell de gir** (per decisió de l'usuari, com la
    vitrina de la cuina de casa: «connectat a la fusta»; `glassFlapHinges`): la frontissa del mòdul al perfil de dalt (obre
    amunt) o de baix, la quantitat per l'amplada a `endOffset` dels extrems, i la placa a la tapa (o a la base), a la cara
    que mira l'abatible: els forats de la placa (la de la frontissa o, la de l'app, dos de la filera System 32 a mig pas)
    a `plateSetback` del darrere del front; sense la peça, avís `hinge`. **Pistons de gas Häfele** (v44, `HAFELE_GAS_STRUTS`,
    373.78.901–909, p. FF 4.224, motor `flapArm` amb `strutG`/`strutLength`/`sideSetback`; es trien al «Braç»; `gasStrut`):
    el bracket d'armari a cada lateral (dos forats Ø5 × 12 a 32, a 37 del darrere del front i a G del cantell de gir, tot o
    res) i el dibuix com el del catàleg (`hwRod`, cilindres de només veure: bracket amb el pern, ròtules, cos Ø15,6, tija Ø6
    del recorregut i bracket de porta); també a l'abatible de fusta (i els forats del bracket
    de porta); només els que obren amunt. **Res de sistemes** (per decisió de l'usuari, 2026-10-14): una porta de vidre no
    porta la filera System 32 (`woodDoor` a `buildLeaf`/`buildParentFront`): només els forats de la placa.
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
- **Electrodomèstic del compartiment** (v46; per petició de l'usuari, 2026-10-15: «un moble sense res ha de poder portar
  una porta, això és per ficar el rentaplats o la nevera… posa els catàlegs com a ferratges electrodomèstics amb el seu
  mecanitzat i guarda la foto per fer la simulació i el render»; per decisió de l'usuari, el front es munta **com diu el
  fabricant**; `Zone.appliance`, `core/model/appliance.ts`, `core/build/module/appliances.ts`, dades a
  [`docs/electrodomestic/`](../electrodomestic/README.md)): un compartiment sense dividir i no tapat pot allotjar un
  **electrodomèstic** de la biblioteca (Preferències › Ferratges › **Electrodomèstics**, motor `appliance`, una còpia com
  tots els ferratges). `ZoneAppliance` = `hardware` (l'aparell) · `front` (sense = sí; `false` = sense front de moble) ·
  `hinge` (on obre: frigorífic i rentadora) · `plinth` (del terra al cantell de baix del front, als aparells de terra sense
  peça a sota; sense, 100, `DEFAULT_APPLIANCE_PLINTH`) · `handle` (el tirador del front, com als altres fronts) ·
  `panelMaterial` (v47; per petició de l'usuari, 2026-10-15: «si és panelable s'hauria de poder ficar el material que va
  panelat»: el material del front de moble; sense, el dels fronts del mòdul, com fins ara; només amb front de moble,
  `visibleAppliance`). L'aspecte de l'aparell (la foto i el material del cos) és de l'item (Preferències › Ferratges ›
  «Aspecte»).
  - **La caixa que demana** (per decisió de l'usuari, 2026-10-15: «la base i altres parts de fusta si l'electrodomèstic ho
    suporta, si no res; les opcions depenen de l'electrodomèstic seleccionat»; `core/model/applianceCarcass.ts`): un mòdul
    que **és** l'aparell (`isApplianceModule`) fixa parts de la caixa (`applianceCarcass`, de la pràctica estàndard dels
    fabricants) i `visibleModule` les construeix així (`applyApplianceCarcass`; les de l'usuari es conserven i tornen si es
    treu l'aparell): **rentaplats, rentadora i frigorífic sota taulell** (de terra amb front de moble) = només el nínxol:
    directe a terra (sense sòcol ni potes: el sòcol del front és a l'Electrodomèstic), sense base, sense tapa i sense fons;
    els laterals es trien (en triar l'aparell, cap: `applianceDefaults`). **Frigorífic de columna**: els dos laterals, base
    i tapa; fons i suport es trien. **Forn i microones**: els dos laterals i la base; al moble penjat, el microones sense
    fons (paret del darrere oberta, Bosch p60). La placa i la campana no fixen res. Test `build/noBottom.test.ts`.
  - **On es tria** (per decisió de l'usuari, 2026-10-15: «els electrodomèstics no haurien de sortir al mòdul principal i
    desaparèixer l'Interior, perquè ja és l'electrodomèstic?»; un sol lloc per decisió, només UI, la fabricació no canvia):
    el d'un mòdul **sense dividir** és el de l'arrel (`root.appliance`) i es tria a **Mòdul › Electrodomèstic**; si l'ocupa
    (`isApplianceModule`, `nicheAppliance`), el mòdul és l'aparell i l'arbre no ensenya l'«Interior». El d'un mòdul
    **dividit** (columna de forn i microones, frigorífic amb altell, placa sobre els calaixos d'un compartiment, campana al
    compartiment d'un moble penjat), al compartiment. `splitZone` / `unsplitZone` el passen al primer fill i tornen, com el
    contingut.
  - **Què ocupa** (`fillsNiche`): rentaplats, frigorífics, rentadores, forns i microones fan del compartiment el **nínxol**:
    no fa el seu Front, ni prestatges, ni accessoris, ni es divideix (res amagat compta: `visibleZone` els treu i es
    conserven). La **placa** (va al taulell: el retall a la peça de sobre) i la **campana** (va al moble penjat: el retall a
    la base) no l'ocupen: el compartiment conserva el seu contingut (els calaixos de sota la placa, la porta del moble).
  - **El mòdul sense res**: un mòdul sense laterals, sense base («Sense base»), sense tapa i sense fons és el nínxol entre
    els mòduls del costat (el rentaplats de la cuina). **El front de moble no necessita els quatre costats** (no és un
    Front del compartiment: es fixa a l'aparell); el frigorífic de porta lliscant, que penja de frontisses de moble, sí que
    vol un lateral o un divisor al costat de les frontisses (si no, avís i cap cassoleta).
  - El front de moble compta com un front a Mòdul › Caixa (estil i folgances) i a Materials (el material dels fronts:
    `hasBuiltFronts`, `frontOptionsUse`; amb el seu «Material del front», no: si no hi ha cap altre front, Materials ›
    «Fronts» no surt, `moduleRows`); el frigorífic de porta lliscant fa servir la frontissa i la filera System 32 del
    mòdul i tots el tirador (`usedHardwareSlots`). Com es construeix i es munta: [`fabricacio.md`](fabricacio.md) ›
    Electrodomèstics. Tests `build/appliances.test.ts`, `build/hiddenState.test.ts`.
  - Exemples: plantilla **«Cuina amb electrodomèstics»** (columnes del frigorífic combi i del forn amb microones, rentaplats
    en un mòdul sense res, placa sobre calaixos i grup filtrant al moble de la campana) i, sense UI com la resta,
    `modulePresets` «Rentaplats integrable 60», «Nevera integrable 178» i «Columna forn + microones»
    (`core/model/applianceModules.ts`).
- **Illes** (`Composition.islands`, `IslandSchema`, `core/build/islands.ts`; per decisió de l'usuari, 2026-10-13: «les
  opcions que diuen els professionals»: dues files de mòduls d'esquena cargolades, fronts enrasats, remats als costats):
  **sense UI des del 2026-10-13** (per decisió de l'usuari: «treu l'opció illa, això és més fàcil amb peces lliures»;
  treure ≠ esborrar: les que hi ha es conserven i es fabriquen igual; `IslandsForm` es queda sense ús). Era la secció
  «Illes» del moble (amb ≥ 2 mòduls). Davant · Darrere (tots dos
  «Lliure al terra»; «Afegir illa» els hi posa), «Pas de cables» (`gap`), Remat esquerre / dret, gruix (19) i material
  («Com els fronts»). El de darrere es gira 180° i es posa sol a la mateixa X, enganxat al darrere del de davant
  (`buildComposition`; on va no compta i el Tipus ho diu); avís `layout` si passaria per darrere de la paret. Els
  **panells de remat** (`islandEndPanels`, rol `side`, «remat e/d») són d'una sola peça de dalt a baix i del darrere al
  davant de les dues files, amb cantell als tres costats vistos; un «mòdul» més per a les refs (després de taulell i
  sòcol). Avís informatiu `island` (es cargolen entre elles, sense forats automàtics). Una illa amb un mòdul que no hi és
  o que no és lliure al terra no es fa. Pendent (part 2): un sol taulell i la base comuna. Test `build/islands.test.ts`.
  Les illes que es fan ara amb mòduls «Lliure al terra» són un tram: el sòcol del moble hi va a tot el voltant (per
  defecte; la plantilla «Cuina greige amb illa», `mag:greige-kitchen`, a inglet).
- **Peces corregudes** (`comp.runs`, `core/build/runs.ts`, `activeRuns`; **sense UI des del 2026-10-13**, per decisió de
  l'usuari: la secció «Taulell i sòcol» del moble ja no surt; treure ≠ esborrar: les que hi ha es conserven i es fabriquen
  igual, i `RunsForm` es queda sense ús; per decisió de l'usuari no es converteixen en peces lliures: es perdria el llarg, el voladís i els forats
  automàtics). Interruptor «Es fa» (`Run.off`): els d'un moble que no era cuina (abans es guardaven sense fer-se) es migren
  apagats en llegir (`migrateRuns`, a `normalizeComposition` i al `.moble`; els nous porten `off: false`); `RunsForm`: cada peça és un
  plegable (`FoldItem` variant `card`) amb un resum —de → fins a · gruix · forats—, dins del taulell cada forat també; una oberta alhora, la nova
  s'obre sola):
  **taulell** d'una peça sobre els baixos de la fila (voladís, forats d'encastar de placa, pica o a mida → talls passants).
  Es numera com un mòdul més (n + 1) per a les refs. No arriba a les illes (`freeX`) llevat que la peça sigui només de
  l'illa; un forat que travessa el contorn no es fa i s'avisa. Els **sòcols correguts** d'abans passen al sòcol de cada
  tram (`withSupport`): ja no es construeixen.
- **Ferratges per metres** (v45; per petició de l'usuari, 2026-10-15: «es tindran de poder ficar ferratges com si fossin
  mobles… gestionar tota l'app amb coherència»): **un sol concepte** per als perfils que es compren en barres (o per
  metres) i es tallen a mida. És un `HardwareItem` com els altres (biblioteca, Preferències › Ferratges, còpia al moble,
  «Com el mòdul» / «Cap», `eachHardware`) que porta `linear` (el clip i la cantonera que s'hi compren) i, als `params`
  (editables com tots), la secció `height` × `depth`, la barra `stock` (0 = per metres), `clipSpacing` i `clipEnd` (el
  sòcol, `clipSpacing` 0: un clip a cada pota de cada tram, `LinearPiece.clips`), i `linear.joint` (la unió lineal). **Una
  regla el posa** al moble, com la resta de motors: la regleta de paret (`wallRail`) al llarg de cada mòdul penjat amb
  penjadors; el sòcol d'alumini (`plinthProfile`) als costats triats del sòcol de cada tram.
  Es **dibuixa** (`extras`, rol `hardware`: no surt a «Elements sense nesting») i cada regla en deixa un **tros**
  (`LinearPiece`, `ModuleBuild.linear`). La **comanda** (`buildLinearOrders`, `core/build/linearOrders.ts`,
  `CompositionBuild.linearOrders`): per item, els trossos per tallar (les regletes de penjats seguits —mateix item,
  mateixa alçada, que es toquen— en fan un de sol), els metres, les **barres** que cal comprar (del tros més llarg al
  més curt, al primer que hi cap, 3 mm de serra; un tros més llarg que la barra, barres empalmades i una **unió lineal**
  per empalmament), els **clips** (els que diu la regla —el sòcol: dues potes per mòdul al tram de davant i dues a cada
  retorn— o un cada `clipSpacing` entre els dels extrems a `clipEnd`, dos per tros com a mínim) i les **cantoneres**. Un
  extrem del sòcol a la vista porta un retorn amb cantonera; contra la paret es talla a tope (cap tapa). Surt a Peces ›
  **«Ferratges per metres»** (`linearGroups`, la mateixa taula que les altres comandes), al **CSV de la llista de tall**
  (a sota, `linearCsvRows`) i a la fitxa «Ferratges» del mòdul (`ruleHardwareCounts`: penjadors, regleta i sòcol
  d'alumini amb els metres). Els **perfils LED** ja es tallen a mida per un altre camí (el perfil de l'app a «Elements
  sense nesting»; la barra Loox, a la comanda dels llums amb `cutLength`): no s'hi han passat (un ferratge nou per metres
  només cal que porti `linear` i la regla que el posa). Test `build/linearOrders.test.ts` (clips, barres, trossos).
- **Objectes de referència** (`RefObject`): caixa, cilindre o **perfil 2D**, per veure mides i, amb efecte:
  **Obstacle** (avisa si xoca; el cilindre amb la seva secció, `refTouchesBox`; sobre els mòduls d'una fila, «Fer-li lloc» l'hi posa entre ells, `model/refRow.ts`, vegeu Editor › Moure) o **Talla** (`build/refCuts.ts`,
  `applyRefCuts`): forat passant a cada peça perpendicular a la seva direcció (z: fons i portes; y: base, tapa, prestatges;
  x: laterals); si arriba a la vora (una **columna de la casa** a la cantonada o a la paret), **la peça es retalla amb la forma de l'objecte** (per decisió de l'usuari, 2026-10-14: «el moble s'ha d'adaptar a la columna»; `notch`, `polygon-clipping`: rectangle, cercle de 64 costats o el perfil; `Panel.outline`, que fan servir el 3D, el nesting —el rectangle—, el DXF, el STEP i el .xcs) i els forats i les ranures que queien a la part treta es treuen (res surt de les peces; una ranura retallada que encara és un rectangle es queda); si la partiria en trossos o se la menjaria, avís `ref-cut`. **De costat** (el fons i els laterals que la columna travessa pel seu pla), un objecte de referència només talla si la travessa de cara a cara amb secció recta (una columna quadrada; `sidewaysCut` `exactOnly`): forat o osca; un tub rodó de costat no fa res, com abans. La vora retallada no es canteja (queda contra la columna): si la columna se'n menja una franja sencera o la parteix, cada tros es fa a la seva mida (`trimTo`; el nesting no reserva la part que s'ha menjat) i el costat del tall perd el cantell (`cutEdges`); els trams del contorn que són el tall queden a `Panel.rawSides` i el 3D els dibuixa sense cantell (`shapedGeometry` reparteix els cantells en [1] amb cantell i [2] sense, segons `edges` als costats rectes i `rawSides`; `cutoutMaterials` = [cares, cantell, tauler vist]); una peça partida (un fons amb la columna al mig) fa **una peça per tros** (`notch` → `added`, ids `<peça>-2`…), amb els seus forats i ranures. Tests `build/refCuts.test.ts` i, als programes, `export/maestroNestXcs.test.ts`. **El moble es tanca al voltant de la columna** (per decisió de l'usuari: «ha de fer les ranures i les traseres que falten i moure la pota»; `core/build/columnWalls.ts`, a `buildComposition` després dels talls): una columna que és una caixa vertical (`axis: "y"`) i entra pel darrere d'un mòdul hi afegeix **fons nous** a les seves cares que queden dins (la del davant i les dels costats; `Fons columna n`, rol `back`, el tauler i el gruix del fons, a la retirada del fons, `backSetback`, de la columna) i, amb el fons en ranura, les **ranures** a la base i a la tapa (fondària i joc de la ranura de sempre); amb el fons cargolat o encastat, sense ranures. Només les que pugen de terra (`y` ≤ 1; una pica o una placa del taulell no compten). Una columna que no arriba a la tapa, que no toca el darrere o que travessa tot el mòdul no s'hi tanca (avís `ref-cut`, que diu què cal canviar); les rodones i de perfil, tampoc (de moment). **Calaixos**: els d'un tram per on entra la columna es fan més curts (per decisió de l'usuari: «les guies i els calaixos haurien de ser més curts»; `columnRearLimits` → `buildModule(m, { rearLimits })`, `Builder.rearAt`): la guia i la caixa (o la NL del joc) es trien amb la fondària que queda davant del fons nou de la columna, i no es retallen. **Potes**: amb la base retallada, una a cada cantonada que sobresurt del contorn i cap a l'osca, mai dues a menys de 110 mm (`LEG_MIN_GAP`: es trepitjarien; per decisió de l'usuari) (`legPoints`, `ViewerModule.legs.points`, `ModuleLegs points`); els forats d'una pota importada només es fan a les quatre de sempre (els de l'osca es treuen); les de l'app dibuixades (la AXILO 78) es tornen a posar a cada un d'aquests punts amb els seus forats i el mirall de la dreta (`relayLegs`, a `buildComposition` després de `columnWalls`; la placa sencera dins de la base o aquella pota no es fa, avís `hardware`). Test `build/columnWalls.test.ts`. Els **passacables** dels mòduls ja no
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
  - **Grups** (`FreePart.group`, `moveGroupBy`, `duplicateGroup`, `movePartToGroup`, `reorderPart`, `removePartFromGroup`). **Els mòduls també en fan** (`Module.group`, per decisió de l'usuari, 2026-10-14; el mateix espai de noms: `groupItems` dona mòduls, peces i models d'un grup): a l'arbre, plegables dins de la seva fila, menú ⋯ «Agrupar en un grup nou» · «Posar a» · «Treure del grup», arrossegar un mòdul sobre un grup, ⌘G; el grup es mou (els mòduls, per la seva fila), s'amaga, es bloqueja, **es copia i es duplica** (els mòduls de la còpia, a continuació a la seva fila; `clipOps.ts`) i s'esborra sencer; al 3D el primer clic tria el grup.
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

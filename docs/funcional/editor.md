# Editor i pàgines del moble

> Tret del `CLAUDE.md` (2026-10-15) perquè no es carregui sencer a cada sessió. Llegeix-lo abans de tocar aquesta part.
>
> Codi (des del 2026-10-15): `features/editor/EditorScreen.tsx` només munta l'Editor; la selecció és a `useEditorSelection`,
> la càmera a `useEditorCamera`, el teclat a `useEditorKeys`, les opcions del visor a `useViewerOptions`, les dades del 3D a
> `useSceneData`, l'assistent a `useEditorAssistant` i l'inspector a `EditorInspector` (+ `InspectorHeader`,
> `InspectorSections`, `InspectorAlerts`). On aquest text diu `EditorScreen.tsx`, mira aquests fitxers.

### Pàgines del moble
Pestanyes del moble obert (`PROJECT_NAV`): **Editor · Peces · Nesting · Exportar**, cadascuna amb un sol propòsit.
- **Peces**: taula (peces iguals agrupades) + **plànol de la peça seleccionada** al costat; sense botó d'exportar.
  Agrupació (`toCutList`, `groupKey`): rol, mides, gruix, material, veta, cantells i inglets normalitzats (`canonicalSides`:
  mirall esquerra/dreta, dalt/baix o girada 180° cauen a la mateixa fila), 2a cara, forats de cantell, encolar, push i, de
  qualsevol rol, contorn i talls (peces lliures: també forats i ranures). CSV de peces: cometes als números si la coma
  decimal és el separador i als textos amb `\r`. Al mòbil, una **targeta per peça** i la triada porta el plànol a dins.
  «Elements sense nesting» per a `build.extras` (sense els components dels jocs, rol `hardware`), **«Ferratges»** (per
  decisió de l'usuari, 2026-10-14: «han de ser peces reals»; `ModuleBuild.fittingOrders` → `build.fittingOrders`,
  `Builder.order`, `core/build/fittingOrders.ts` `fittingGroups`: per mòdul, les frontisses que es col·loquen —també
  les de vitrina i d'abatible de vidre—, els tiradors, el joc de pistons de gas, un per abatible, les potes i els
  **electrodomèstics** (v46: un per compartiment, amb la marca i la referència, «electrodomèstic: no es fabrica»), amb el
  número d'article; també al LLEGEIX-ME de Maestro) i **«Ferratges dels
  jocs»** (`build.hardwareKits`, `kitGroups`: la comanda dels calaixos de doble paret amb els números del catàleg i la
  fusta per calaix).
- **Nesting**: mides del tauler i, amb màquina, la línia «Separació X mm i marge Y mm de la màquina … (Preferències ›
  Màquines CNC)»; sense màquina, «Separació (fresa)» i «Marge tauler». Les peces amb `outline` es dibuixen amb el contorn
  real (el rectangle que ocupen, discontinu); el nesting reserva el rectangle. Marca de veta al tauler (`BoardDrawing`):
  horitzontal si `(grain === "x") === (angle === 0)`, vertical si no, cap sense veta. Forats de cara plens a la cara A, buits
  a la B.

### Editor
- **Tres columnes, com Figma / Fusion 360** (`features/editor/EditorScreen.tsx` sobre `Workspace`): Estructura (arbre) ·
  Visor · Propietats. Arbre de 280 px i propietats de 340 px per defecte, amb vora arrossegable (`PanelSplit`, el `Splitter` de Chakra, 48–900 px,
  nansa al mig, doble clic restaura; arrossegar-la fins a la vora o Retorn plega el panell; amplades recordades per editor); si el panell és més estret que el contingut, desplaçament horitzontal (com
  IntelliJ). Visor amb mínim de 320 px; si fa menys de 640 px, pestanyes només amb icona, i botons en columna. Cada panell lateral es plega amb els botons de les cantonades del visor
  (`LuPanelLeftClose/Open` · `LuPanelRightClose/Open`). L'app ocupa just la finestra; cada panell té la seva barra de
  desplaçament fina amb lloc reservat (`scrollbarGutter: stable`). **Mòbil**: visor a dalt i pestanyes `Estructura` ·
  `Propietats` (triar a l'arbre porta a Propietats); «Ampliar el visor».
- **Una sola selecció** (`Selection`), sincronitzada entre arbre, 3D i alçat. **Maj + clic** (per decisió de l'usuari, 2026-10-14, com Figma i el Finder): **a l'arbre, el tram** del darrer triat a aquest, del mateix tipus i en l'ordre de l'arbre (`treeOrder`, `rangeAnchor`; també als Ambients, per apartat, `sectionOrder`); Maj + clic a un que ja és triat el treu, només aquell; **⌘/Ctrl + clic** a l'arbre, i Maj o ⌘/Ctrl + clic al 3D i al plànol, afegeix o treu peces lliures, models 3D, objectes de referència i **mòduls** (els mòduls es mouen pel camí de la nansa, `moveModuleBy`; Material = el del cos, només taulers; Mides = les del cos; s'eliminen amb `removeModule`; també entren al Grup de tots) a una **selecció múltiple** (`{ kind: "multi", items }`, `MultiItem`, `toggleMulti`; es llegeix la tecla del `pointerdown`): una caixa amb el gizmo els mou tots junts (`CabinetViewer selectedSet`/`onMoveSet`, `moveMultiBy`), també les fletxes del teclat; Supr els elimina (`removeMulti`); l'inspector (`MultiInspector`; **un grup triat fa servir el mateix inspector** amb els seus elements, per decisió de l'usuari, 2026-10-14, també als Ambients amb el nom editable) diu la posició de tots, les **propietats comunes** (el valor si tots el tenen igual, si no «Diversos» i el que hi posis va a tots: Material —`setMultiMaterial`, a les peces com el seu inspector—; amb un sol tipus, Mides —Ample · Alt · Gruix o Fondària, `setMultiSize`— i, als models, el Gir, `setMultiRot`), **Alineació** (com Figma: per X, Y i Z, a l'inici, al mig o al final de la caixa de tots, `alignMulti`; amb tres o més, «Repartir» amb el mateix espai, `distributeMulti`; amb dos o més, «Espai entre ells» (mm, a dalt) i el darrer botó de cada fila els posa a aquest espai l'un de l'altre, `spaceMulti`; icones `LuAlign…`), el **Grup** de tots (Sense grup · els que hi ha · «+ Grup nou», com el d'una peça; `groupMulti`, `ungroupMulti`; dreceres ⌘G grup nou i ⇧⌘G fora del grup, també amb una peça, un model, un objecte de referència o un grup triats; **els objectes de referència també fan grups**, per decisió de l'usuari, 2026-10-16: `RefObject.group`, plegats a l'arbre com els models); **arrossegar a l'arbre** una fila triada arrossega tots els triats: sobre un grup hi entren, al costat d'un element s'hi posen i n'agafen el grup, i a «Treure del grup» en surten (`StructureTree` `drag.multi`), la llista (tocar-ne un el tria sol) i «Eliminar». Amb algun bloquejat, no es mouen. Controls nous: decideix a quin nivell pertanyen
  i posa'ls a l'inspector d'aquell nivell.
- **Estructura** (`composition/StructureTree.tsx`): moble › mòduls (agrupats per fila) › compartiments, peces lliures,
  objectes de referència i models 3D. L'arrel de cada mòdul surt com a **«Interior · …»** (`zoneLabel(z, { root })`; «Interior ·
  2 portes» si porta les portes de tot el mòdul, Mòdul › Portes; un altre front de l'arrel dividida no es fa i no hi surt) amb els compartiments a sota:
  seleccionar-la dona Divisió (les mides de les zones, «Afegir zona» · «Treure la divisió» i «Peces de dins» si n'hi ha);
  sense dividir, el seu Front. Pujar des d'un compartiment (clic al 3D, eliminar) passa per l'Interior abans del mòdul;
  Supr / ⌘X a l'Interior no fa res (avís: `deleteZone` buidaria tot el mòdul). **Un mòdul que és un electrodomèstic**
  (per decisió de l'usuari, 2026-10-15: «els electrodomèstics no haurien de sortir al mòdul principal i desaparèixer
  l'Interior, perquè ja és l'electrodomèstic?»; `isApplianceModule`: sense dividir i amb un aparell que l'ocupa —rentaplats,
  frigorífic, rentadora, forn, microones—) **no té «Interior»**: la fila del mòdul porta la icona `LuRefrigerator` en lloc
  de la fletxa, no es desplega i la pista diu el tipus («Rentaplats · 600 × 870»); triar l'arrel per un altre camí (3D,
  alçat, un avís, pujar al pare) tria el mòdul (`useEditorSelection`). Amb la placa o la campana, l'Interior hi és (conserva
  els calaixos o la porta). **Objectes de referència només als mobles i
  Models 3D només als objectes** (per decisió de l'usuari; treure ≠ esborrar: si el document ja en té, el grup surt sense +
  ni Duplicar, i enganxar-ne avisa). **Un + a cada grup** (Mòduls · Peces lliures · Objectes de referència · Models 3D; per
  decisió de l'usuari, així es veuen els tipus): demana el nom (`NameDialog`, «Mòdul 3», «Peça 2», «Objecte 1», seleccionat;
  `addElements.ts`) i crea l'element sense més opcions: **mòdul nou** (`emptyModule`, per decisió de l'usuari, 2026-10-15: «que sigui com aquest Mòdul 2»: un buc
  estàndard de 600 × 720 × 580 amb els dos laterals, tapa i fons en ranura, obert i sense prestatges, sobre el suport del moble; materials, gruixos, folgances i ferratges de Preferències; a la Taula, `tableModule`), peça de cara, caixa de 600 × 600 × 100. L'últim mòdul també s'elimina (queda el moble buit). Res de mòduls
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
  peça lliure, un model o un **mòdul** sobre la fila d'un grup l'hi posa; al costat d'un altre del seu tipus n'agafa el grup
  (també els mòduls, `reorderModule`, des del 2026-10-15: abans un mòdul deixat fora del grup s'hi quedava); la zona
  «Treure del grup» surt **just a sota del grup** mentre se n'arrossega un element (peces, models i mòduls; el mòdul queda
  solt al mateix lloc). També «Treure del grup» al menú ⋯ de cada element.
- **Avisos de fusteria** (`InspectorAlerts`, al peu de l'inspector; per decisió de l'usuari, 2026-10-17: «que es vegi on
  és el fallo i què cal tocar»): agrupats per mòdul, primer els que cal arreglar i després els informatius (`INFO`), i els
  repetits un sol cop amb «× n». Cada un porta **«Anar-hi · on s'arregla»** (`warningTarget.ts`): tria el compartiment, el
  mòdul, l'objecte o la peça; la càmera hi vola (`useEditorCamera.focusAlert` → `CameraRig cameraFly`, `framePose`); les
  peces de l'avís es marquen amb un contorn vermell i la resta es veu translúcida (`CabinetViewer alertPanels`) fins que
  es tria una altra cosa; i s'obre la secció on es corregeix (taula `FIX` per codi: p. ex. `back-groove` → Caixa › Fons,
  `drawer-bottom` → Materials, `shelf-span` → Opcions de l'interior), també les subseccions (`components/foldOpen.ts`
  `openFolds`: el `FoldItem` s'obre pel seu acordió, es mostra i s'il·lumina un moment, `data-flash`). Un avís del mòdul
  sense peça marca les del tipus de què parla (`ROLE_HINT`: el fons, els laterals…) o, si no, enquadra tot el mòdul.
  Els que no es poden arreglar sols porten **«Com es pot arreglar»** (`BuildWarning.options`: el text de cada opció i, si
  en té, un botó que porta on es fa, `FixPlaceKey` → `FIX_PLACES`): un penjador que una columna no deixa posar
  (escaire a la columna · moure el mòdul · fer-lo més estret), un tall que la CNC no fa (que travessi · a mà o amb CAM
  3D), un prestatge que es vinclarà (divisor · gruixuts · tauler de 30). El front d'un electrodomèstic més alt del que
  admet el fabricant ja no avisa: es fa del màxim, enrasat a dalt, amb el joc a sota (nota de l'aparell). També en porten
  l'aparell que no hi cap (mides · un altre aparell) i el mòdul d'un tram que no arriba a l'alçada dels del costat
  (l'alçada que cal, a Mides). L'electrodomèstic d'un mòdul sense dividir porta a Mòdul › Tipus. Un avís amb opcions es
  pot **acceptar** amb **«Ho faig a mà»** (`Composition.acceptedWarnings`, per la clau `warningKey`: codi, mòdul,
  compartiment, peça…): surt com a informació («Ho fas a mà») i ja no compta; «Desfer» el torna a comptar. El número de
  la secció compta només els que cal arreglar (ni els informatius ni els acceptats).
- **Propietats** del que hi ha seleccionat i **només d'això**, en seccions plegables amb **una sola oberta alhora** (per decisió de l'usuari, 2026-10-13, i a tota l'app des del 2026-10-14: `FoldGroup` a l'inspector, recordada a la sessió `mobles:inspector-open`; les subseccions `size="sm"` de dins, una oberta entre elles; vegeu UI):
  - Moble: Resum (i avisos de fusteria), **Suport general** (si hi ha mòduls de terra; `SupportForm`: el suport de tots
    els mòduls de terra —Directe a terra · Sòcol · Potes vistes—, l'alçada, la pota, la retirada, fusta o alumini, el
    material i, per a cada tram, on porta sòcol; vegeu Model › Suport), Encaixos (si alguna peça en fa),
    Materials de tot el moble (aplica a tots els mòduls), Acabats de l'escena (`Composition.scene`: `floor`, `wall` per a Presentació i miniatura; buit = «Com a
    Preferències»; `CabinetViewer sceneFinish`, `renderThumb(…, finish)`).
  - Mòdul: **Tipus** (`ModuleTypeSection`; per decisió de l'usuari, 2026-10-16: només **Moble · Electrodomèstic**,
    `setModuleKind`, i l'aparell de l'Electrodomèstic; la placa i la campana també es trien aquí) · **Posició**
    (`ModulePositionSection`, com abans del 2026-10-15: Fila —arrambat a la paret, penjat o lliure al terra—, l'alçada del
    penjat, separacions, girat, X; Baix o Columna surt de l'alçada) · Mides · **Caixa** · **Portes** (només amb l'Interior dividit) · **Unió** (si la caixa en fa) ·
    **Materials** (en aquest ordre per decisió de l'usuari, 2026-10-13). **Sense «Acabats»** (per decisió de l'usuari,
    2026-10-08: «això dels acabats no està bé»; abans una secció `mod-joinery`, `LuHammer`): cada fila és a la secció del
    que toca, **un sol lloc per decisió i només el que la construcció llegeix** (`moduleRows` a
    `core/model/usedHardware.ts`, `frontsInspector.test.ts`), en cascada:
    - **Caixa** (`mod-structure`, `LuFrame`; abans «Estructura», es confonia amb la pestanya de l'arbre; `CarcassForm`):
      **en subgrups plegables** (per decisió de l'usuari, 2026-10-16), cada un amb les seves opcions i una insígnia amb el
      que hi ha: **Base** (suport, penjadors, base, llum a sota) · **Fons** (fons, ranura o retirada) · **Tapa** (tapa,
      ranura d'aire, tauler de taula) · **Laterals** (laterals, parets, cantonades) · **Fronts** (estil, folgances,
      retranqueig dels prestatges); el que l'aparell fixa no surt.
      a dalt, si el mòdul és un electrodomèstic, **una nota** amb el que fixa l'aparell (`applianceCarcass`, «Rentaplats:
      directe a terra, sense base, sense tapa i sense fons. Ho demana l'aparell»; les files fixes no surten) i les opcions
      del front de moble (`ApplianceFields`: Front, Material del front, Obre, Sòcol, Tirador); al nínxol de terra, els
      laterals són «Laterals de remat» (una peça sola, sense Parets ni Estil dels fronts: `ApplianceCarcass.niche`).
      **Suport**: és una opció global (la de tots els mòduls de terra), i les globals no es repeteixen al mòdul (per
      decisió de l'usuari, 2026-10-16: «no repetir les opcions ni posar un missatge, sinó un botó que digui modificar
      opció global»): el text del que hi ha i el botó **Modificar opció global**, que obre el Moble › Suport general (suport,
      alçada, pota, retirada, sòcol i trams); penjat: «Penjat a la paret, a … mm del terra», es canvia a Posició i, sota, **Base** (Sencera · Sense base;
      amb potes no surt: s'hi cargolen). **Llum a sota**: penjat o amb potes vistes (amb sòcol quedaria amagada: no surt
      i no es fa). La resta, com sempre:
      penjat, «Penjadors» i «Regleta» amb «Com el mòdul» i «Cap» (`BaseFields.tsx`)—, fons i, just a sota, **Ranura del fons** (en ranura) o **Retirada
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
    - **Electrodomèstic** (`mod-appliance`, `LuRefrigerator`, la mateixa `ApplianceSection` del compartiment amb `module`;
      per decisió de l'usuari, 2026-10-15): només amb l'arrel **sense dividir**, **a dalt de la Caixa** (l'aparell decideix
      la caixa, no al revés: la Caixa només ofereix les parts de fusta que admet; triar-ne un de nou posa la seva caixa
      estàndard, `applianceDefaults`). Edita `root.appliance` (el model no canvia, sense migració): «Aparell», «Front de moble», «Material del front», «Obre», «Sòcol» i
      «Tirador» com al compartiment. Si l'aparell ocupa el mòdul, l'arbre no ensenya l'«Interior» (vegeu Estructura) i el
      Front, els Prestatges i Dividir de l'arrel no compten (es conserven: «Cap» els torna); el mòdul sense dividir no té
      seccions pròpies de fronts o prestatges que calgui amagar (l'estil i les folgances de la Caixa i el material dels
      Fronts surten perquè el front de moble compta com a front). Amb la **placa** o la **campana** (no ocupen el mòdul),
      l'«Interior» es queda amb el seu contingut (els calaixos, la porta) i l'aparell es tria aquí. **Regla: un sol lloc per
      decisió** — mòdul sense dividir: Mòdul › Electrodomèstic; mòdul dividit (columna de forn i microones, frigorífic amb
      altell): a cada compartiment. Dividir l'Interior d'un mòdul amb la placa la passa al primer compartiment (com el
      contingut, `splitZone`; «Treure la divisió» la torna).
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
    cap: no es duplica, no es retalla ni s'elimina, i ⌘D, ⌘X i Suprimir avisen sense tocar el porta-retalls) i
    **Electrodomèstic** (`LuRefrigerator`, `zone/ApplianceSection.tsx`, v46; **només als compartiments d'un mòdul
    dividit**: el de l'Interior d'un mòdul sense dividir és a Mòdul › Electrodomèstic; a dalt de tot, plegat si no n'hi ha: «Aparell»
    amb el `HardwarePick` dels Electrodomèstics —«Cap» o un de la biblioteca, amb la foto; l'ajuda diu les dades del
    catàleg— i, en cascada, «Front» (interruptor «Front de moble», si l'aparell en porta; l'ajuda diu com es munta), amb el
    front, «Material del front» (v47, `MaterialSelect` dels taulers, «Com els fronts» = el de Mòdul › Materials), «Obre»
    Esquerra · Dreta (frigorífic i rentadora), «Sòcol» (aparells de terra sense peça a sota) i «Tirador»; si l'aparell ocupa el
    compartiment —tots menys la placa i la campana— no surten el Front, els Prestatges ni Dividir, i l'arbre diu
    «Rentaplats», «Frigorífic»…; vegeu Model › Zones › Electrodomèstic) · Front ·
    **Opcions de l'interior** (`LuRows3`; abans «Prestatges i accessoris», reanomenada per decisió de l'usuari, 2026-10-16;
    surt sempre menys amb un front fix o amb calaixos; insígnia «3 · Barra · LED · 2 calaixos»:
    per grups plegables com les subseccions de la Caixa (per decisió de l'usuari, 2026-10-17: **Prestatges** `zone-shelves-shelves`, **Accessoris** `zone-shelves-accessories` i **Calaixos interiors** `zone-shelves-drawers`, cada un amb el seu resum): primer els prestatges —Prestatges (quants) · Regulables · Filera System 32 si li toca, vegeu Mòdul · A ras · Retranqueig (sense a ras; el propi o «com el mòdul», i amb un pistó d'abatible al lateral, prou retirats per no tocar-lo: avís `shelf-strut`) · Gruixuts—, a sota
    els accessoris —Penjar (Barra de penjar) i Llum (Tira LED), interruptor + `HardwarePick` «Com el mòdul»— i, darrere
    d'una porta (la seva o la d'una zona de més amunt), els **calaixos interiors** (`InnerDrawerRows`: Quantitat · Alçada
    de cada calaix · Guia o joc · Retirada del front, 25 per defecte de Preferències › Folgances · Suplement, el gruix del
    cos; vegeu Model › Calaixos interiors) · Dividir (Prestatges, Accessoris, Dividir i els tipus
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
- **Vistes** (per decisió de l'usuari, 2026-10-16): una barra de botons d'icona a baix del 3D, al mig (`VIEW_BUTTONS` a
  `ViewerToolbar`; el nom al tooltip): **3D** (el 3/4 d'abans «Enquadrar», `LuBox`) · Davant · Darrere · Esquerra · Dreta ·
  Dalt; la triada surt marcada mentre la càmera no es mou. L'únic lloc on es trien.
- **Barra del visor**: fora només «Opcions de vista» (i amagar propietats). Opcions de vista (`components/ViewOptions`:
  `ViewOptions` + `ViewTile`, popover a l'ordinador, calaix de baix al mòbil; es tanca en obrir el Render): a dalt els tres
  modes i les accions ràpides només amb icona i el nom al tooltip (`tile`/`viewTiles` a `ViewerToolbar`): Forats,
  Explosió, Ferratges, Render i Veure a casa (AR); a sota, l'obertura, l'**opacitat** i la imatge. **Opacitat** (`ViewerState.opacity`, `LuBlend`, 10–100 %; per decisió de l'usuari, 2026-10-14: «per veure tot el mecanitzat de les peces»): per sota del 100 % totes les peces es fan translúcides amb aquella opacitat (`CabinetViewer seeThrough` → `PanelMesh seeThrough` numèric, la mateixa `veil` de «Com va muntat»: sense escriure la profunditat) i els forats, les ranures i els talls es veuen sempre (com a l'Explosió; «Forats» surt marcat); els ferratges continuen opacs. El **Render la conserva** (per decisió de l'usuari: `veil` marca els materials `userData.seeThrough` i `sceneData` els passa amb la seva opacitat, com el vidre, en lloc de treure'ls com a fantasmes; les marques dels forats no hi surten, només els forats que travessen); l'AR i la miniatura no la fan servir; no es desa.
  **Explosió**: cada peça se separa 160 mm (`EXPLODE_MM`) per la seva `explodeDir` i hi van **els forats i les ranures
  sempre** (Forats surt marcat mentre dura) i tot el que hi va muntat: frontisses, tiradors, plaques, potes importades i
  col·locats a mà (`Panel.fittings`, dins del grup de la peça) i les potes de l'app amb la base (`ExplodeWith`, la mateixa
  animació, `useExplode`). El visor de tots els documents
  (moble, objecte i ambient) amb el mateix aire: 16 a dalt al mòbil i 16 al voltant a l'ordinador.
- **Mode del visor** (`VIEW_MODES`): **Per peça** (`LuShapes`: colors per tipus de peça, paleta `ROLE_GROUPS` a
  `viewer/roleColorMap.ts` i llegenda a `viewer/roleColors.tsx`; «Ferratges» = rol `hardware`, els components dels
  jocs) i
  **Presentació** (`LuSparkles`: ombres, sense perfils, graella ni «+»; terra i paret amb llum d'estudi,
  `viewer/PresentationRoom.tsx`, escena a `viewer/presentationScene.ts`). Per dins: la qualitat (`viewer/renderQuality.ts`:
  fast / presentation, també a Preferències › Visor 3D) més `mobles:viewer-role-colors-fast` (els objectes en tenen una de
  pròpia, `mobles:viewer-role-colors-object`, i s'obren amb la textura). **Sense «Textura»** (per decisió de l'usuari,
  2026-10-16): els colors per tipus es treuen a «Colors» de les opcions. Les pestanyes 3D · Alçat · Foto de dalt del visor,
  **només amb la icona** (el nom, al tooltip). Opcions de vista **sense «Descarregar imatge»** (es fa amb el Render) i
  **sense «Render»** a l'ordinador: és al menú de l'app, sempre a sobre de Preferències (`RenderStatusNavItem`; el moble o
  l'ambient obert hi diu com es comença, `useRenderLauncher`; des de l'Alçat, la Foto o el plànol, passa al 3D); al mòbil,
  sense menú lateral, el Render continua a Opcions de vista. La icona fa pampallugues suaus (opacitat) mentre calcula;
  «Desar PNG» mentre calcula l'atura. Amb ⌘ o Ctrl premut i el ratolí a sobre del 3D (moble i ambient), el cursor de moure
  (`usePanModifierCursor`): arrossegar amb la tecla desplaça la vista.
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
    per sobre de tot; cada una arrossega només en la seva direcció (pla que conté l'eix i mira a la càmera). Al mig, una
    **bola blanca per moure lliure** (per decisió de l'usuari, 2026-10-17; cursor `move`): al terra (`onFloor`) pel terra (X
    i Z), a la paret (`onWall`) per la paret (X i Y), si no pel pla de la pantalla (les direccions que es poden, menys la
    que mira a la càmera); el mateix imant per eix. Les nanses taronja dels mòduls no en porten. S'amaguen les
    fixades (al terra: Y; a la paret: Z) i la que mira a la càmera (`useFacingAxis`, |cos| > 0,97: vistes de costat o de dalt). `frontRaycast`: les fletxes es
    poden agafar encara que l'objecte sigui dins d'un altre, i el seu clic no tria el que hi ha davant. Per a objectes de
    referència (`RefGhost`), peces lliures, grups i models 3D. Imant de 15 mm a les vores dels mòduls, altres objectes, terra
    i paret (Alt: sense); etiqueta amb la posició mentre s'arrossega; es desa en deixar-lo anar (un pas de desfer).
    **Objecte de referència entre mòduls** (un rentaplats entre dos baixos; des del 2026-10-15): un obstacle deixat sobre
    els mòduls d'una fila (`refBlocksRow`) avisa amb l'acció **«Fer-li lloc»** (i el mateix botó a Objecte › Posició quan
    els trepitja): `makeRoomForRef` el posa just després del mòdul de l'esquerra (els que tenen el centre a l'esquerra del
    seu) i desplaça el de la dreta (i amb ell tota la resta de la fila: `gapBefore`) el que calgui perquè hi càpiga; si ja
    hi ha prou forat, només s'hi encabeix l'objecte. Es fa a cada fila on és (a terra i/o penjats, segons la seva alçada i
    fondària); les illes i els objectes que tallen no compten. És un pas: després els mòduls i l'objecte van per separat
    (no és automàtic perquè un obstacle també serveix per veure si xoca). Grups de
    peces: caixa del grup amb el gizmo; el primer clic selecciona el grup i el segon la peça.
  - **Mòduls**: nansa ↔ (`MoveHandle`; als penjats i als de terra lliures, **dues nanses**, ↔ i ↕, cada una mou en un
    sol eix, per decisió de l'usuari, 2026-10-16: «dos marcadors, un per la x i un per la y») uns píxels per sobre de l'aresta de dalt (en un mòdul alt que no hi cap, baixa fins a
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
  lliure ni dins d'una finestra o un diàleg ni amb un diàleg modal obert (amb l'editor de perfils obert, ⌘Z desfeia el moble
  del darrere); amb una finestra oberta (no són modals) i el focus a l'editor, sí. Les dreceres del teclat, igual
  (`lib/keyTarget.ts`).
- **Teclat**: Ctrl/⌘ C · X · V · D i Supr per al mòdul, l'objecte, el model, el compartiment, **el grup i la selecció
  múltiple** (`core/model/editOps.ts`, `clipOps.ts`; `features/editor/pasteClip.ts` `clipOf`/`pasteClip`, el mateix camí
  per al «Duplicar» de l'inspector del grup i de la selecció múltiple);
  per a un ferratge col·locat, Ctrl/⌘ D (duplicar) i Supr (sense porta-retalls). **Grups** (des del 2026-10-15; abans un
  grup triat no es copiava ni es duplicava i «Duplicar el grup» no copiava els mòduls): un grup triat es copia sencer
  (`copyGroup`, porta-retalls `items`) i s'enganxa o es duplica com un **grup nou** («G (còpia)», `insertItemsCopy`,
  `duplicateGroup`) amb els seus mòduls **a continuació a la seva fila** (després del mòdul triat, si n'hi ha), les peces
  enganxades a un mòdul del grup a la còpia del mòdul i la resta al costat. Duplicar un element d'un grup en fa la còpia
  al mateix grup; **enganxar** va al grup triat o al de l'element triat (mòdul, peça o model), i si no n'hi ha, solt
  (decisió: així ⌘C fora i ⌘V amb un grup triat el posa dins); la selecció múltiple es duplica amb cada element al seu
  grup. El que el moble no admet (mòduls a un de només peces, models fora dels objectes, objectes de referència als
  objectes) es queda fora i s'avisa. El
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
  funcionen igual. Una vista no es desa com a càmera. «3D» torna al 3/4 en perspectiva i només surt marcat amb el
  3/4. Sense cotes (són a l'Alçat).
- **Càmera**: s'enquadra en obrir o en triar una vista (la «3D» és el 3/4); editar no la mou, i **redimensionar el
  visor tampoc** (amagar o mostrar les Propietats o l'Estructura; per decisió de l'usuari, 2026-10-14; `CameraRig`: només
  els primers 1,5 s després de muntar-se, `SETTLE_MS`, mentre la disposició es col·loca). El botó
  surt **marcat** mentre la càmera és a l'enquadrament (`onFramedChange`). **Es recorda per moble** (`Composition.camera`,
  `CameraPose` a `core/model/camera.ts`: posició, punt mirat i fov; una de no vàlida es descarta): 1 s després d'orbitar,
  d'«Enquadrar» o de triar una vista es desa amb `saveProjectCamera`, **sense tocar `updatedAt` ni `edited`**; és **un pas
  del desfer** (per decisió de l'usuari, 2026-10-14: l'historial de l'editor és `{ comp, cam }`; ⌘Z / ⇧⌘Z hi tornen, el
  visor hi va amb `CabinetViewer cameraGoto` i es desa); el **zoom** va de 2 cm a 60 m (`MAX_DISTANCE`); `updateProjectComposition` conserva la desada. En obrir-lo `CabinetViewer initialCamera` hi torna; redimensionar no
  la treu fins que s'orbita, s'enquadra o es tria una vista. Va al `.moble`.
- **Editor de malla — Forma lliure** (`composition/MeshEditor.tsx`, `MeshEditorScene.tsx`; per decisió de l'usuari,
  2026-10-17: «un editor de malla com el de SolidWorks», l'xShape): el **+ d'Objectes de referència › «Per fresar una
  peça» › Forma lliure** (o «Relleu d'imatge…», que demana la imatge) en posa un que talla damunt de la peça estirada
  triada (`cutterOver`); o objecte de referència › Forma › **Forma lliure** i
  «Editar la forma lliure…» (una `FloatingWindow`). La **caixa de control** (punts i línies) i la superfície suau que en
  surt (Catmull-Clark, `meshShape.ts` `subdivide`; «Suau» 2 passades · «Molt suau» 3). Es toca un punt (amb Maj o ⌘, se
  n'hi afegeixen; tocar el buit els treu; una esfera invisible més grossa per tocar-los amb el dit) i es mou amb les
  fletxes o la bola del gizmo de sempre (`MoveGizmo`); **Simetria (X)** mou el punt de l'altra banda en mirall
  (`mirrorPairs`, `moveVertices`); **Tots** tria tots els punts; **Més detall** parteix la caixa (`refineCage`: més punts
  per modelar); **Extrudir** (amb tots els punts d'una o més cares triats) aixeca aquestes cares amb costats nous
  (`extrudeFaces`, cap a fora segons la normal) i deixa triats els punts nous per moure'ls; **Aresta viva** (per decisió
  de l'usuari, 2026-10-17: «cantons rectes») fa recte el cantell entre els punts triats, i un altre cop el torna suau
  (`toggleCrease`, `MeshCage.crease`: Catmull-Clark amb arestes marcades; es pinten en taronja); **Començar amb:** posa una
  forma de partida (`START_SHAPES`: Coixí —el cub suau de sempre—, Caixa —cantells vius—, Cilindre, Pica, Esglaons, Con,
  Esfera; els de revolució surten de `revolveCage`) en lloc de començar sempre amb l'ovalat; desfer/refer (⌘Z). Perquè
  no es pengi: «Més detall» fins a 500 punts (`MAX_CAGE_POINTS`) i la superfície suau fa menys passades si passaria de
  40.000 cares; els booleans 3D de les peces amb buidats es recorden (`shapedGeometry`, les últimes 32) i el pla d'un
  relleu també (`reliefPlan`: el programa de la peça i el del tauler en fan servir el mateix). Els punts i les línies
  són clars amb el tema de nit. En
  **Aplicar**, la caixa de l'objecte s'ajusta a la forma (`normalizeCage`). Si talla, la peça que toca s'hi **fresa des de
  la cara per on entra** (`refCuts.ts` `meshCut`: els triangles a coordenades de la peça i `rasterDepth`, graella de 2 mm;
  el que quedaria sota una part que sobresurt també es buida, la fresa ve de dalt): un buidat amb mapa (`Pocket.map`) que
  va al programa amb recorreguts 3D. El mapa és **amb signe** (negatiu = la superfície passa per sobre de la cara): la
  vora del buidat es talla on la superfície creua la cara, no a la graella, i surt llisa al 3D. Una forma que queda dins
  del gruix sense sortir per cap cara avisa; un buidat més fondo que la fresa més llarga de la màquina també avisa
  (`build/pocketReach.ts`: quants mm s'ha de pujar l'objecte o afegir una fresa més llarga), perquè el CAM no el faria.
- **Relleu d'imatge** (Forma › «Relleu d'imatge», `core/model/imageRelief.ts`, `composition/reliefImage.ts`; per decisió de
  l'usuari, 2026-10-17: «importar imatges en blanc i negre perquè s'adapti al relleu»): es tria una imatge (qualsevol que
  obri el navegador), es redueix a 240 px pel costat llarg i es passa a grisos (`RefObject.image`: els bytes en base64). La
  imatge va a la caixa de l'objecte vista des de dalt (amunt de la imatge = cap a la paret): el **negre** és el fons de la
  caixa (el més fons) i el **blanc** la part de dalt (sense buidar); «Blanc = el més fons» ho gira. La caixa pren les
  proporcions de la imatge i 10 mm d'alçada (la fondària del relleu): es posa amb la part de dalt a la cara de la peça. La
  peça es buida per sobre de la superfície (`meshCut` amb els triangles de la imatge, graella d'1 mm) i va al programa amb
  recorreguts 3D; el detall més fi que surt és el de la fresa (una esfèrica petita).
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
  demanda; es munta el primer cop i es queda muntat; sense historial desat). **A l'ordinador és una columna a la dreta** (per decisió de l'usuari: «encara que estigui obert, s'ha de poder navegar»): l'app s'estreny i es pot seguir treballant i navegant; al mòbil, el calaix a pantalla completa. **No es tanca sol** (ni clicant fora ni amb Esc); només la ✕ o tornar a tocar el botó «Assistent» del menú (per decisió de l'usuari, 2026-10-14). **Tancar-lo no esborra res**: en tornar-lo a obrir, la conversa hi és; només «Nova conversa» la buida, i abans pregunta «Començar una conversa nova?». Si l'usuari puja a llegir, el xat no el torna avall mentre arriba text (només si ja era al final). **L'amplada de la columna es canvia arrossegant-ne la vora esquerra** (per decisió de l'usuari, 2026-10-14: sense cap barra a la vista; la nansa només surt amb el ratolí a sobre, `SplitHandle` `quiet` del `PanelSplit` de l'app, `App.tsx`; 320–720 px, arrossegar-la cap a la dreta fins a la vora el tanca —com la ✕—, doble clic torna a 400, recordada a `mobles:assistant-width`). **Els fitxers es poden deixar anar a sobre del xat** (per decisió de l'usuari, 2026-10-14): fotos i plànols (≤ 1568 px JPEG), PDF (bloc `document`, ≤ 30 MB) i fitxers de text (dins del missatge, ≤ 200.000 caràcters), diversos alhora, també amb el clip (`assistant/attachments.ts`). **Ja no hi ha pestanya «Assistent» a
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
  «Lloc» de Mòdul › Tipus), `set_carcass` (el suport és el de tot el moble: `setSupport`), `split_zone`, `unsplit_zone`, `set_zone_size` (`setSplitSize`: l'última
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

# Millores v1 — UX/UI i coherència de l'app

Estudi de la Fase 1 (vegeu [`PROMPT-millore-v1.md`](../prompt/PROMPT-millore-v1.md), apartats 2, 3, 4, 5 i 7). Per a cada
punt: com funciona avui (fitxers i línies), què canviar, opcions, dependències, mida (S ≤ ½ dia · M ≈ 1–2 dies · L > 2 dies)
i pla. Les línies són les del codi en el moment de l'estudi.

Resum de l'ordre recomanat: **3 (acordió comú)** primer, perquè 6 (Render) i el «treure General» de peces/objectes en
depenen; després 1, 4, 5 (petits i independents), 2, 7 i 8. La regla d'or (9) s'afegeix al `CLAUDE.md` abans de començar.

---

## 1. Cursor

### Com és ara
- **No hi ha cap regla global de cursor**: `theme/system.ts` (`globalCss`, l. 4–52) i `theme/layout.css` no en diuen res.
  Per defecte el navegador posa la **I de text** a sobre de qualsevol text que no sigui un botó (etiquetes de `FormRow`,
  títols, insígnies, textos de les targetes) i la **fletxa** a sobre dels `<button>` nadius.
- Chakra v3 (3.37) només posa `pointer` als `Button`/`IconButton` (token `cursor.button`), `Tabs` i `Switch`; el
  `Menu.Item`, `Checkbox`, `Radio`, `Slider` i `SegmentGroup` van amb `default`, i l'`Accordion.ItemTrigger` sense cap.
- Per compensar-ho, **~20 llocs posen `cursor="pointer"` a mà**: `PanelSection.tsx:93`, `MasterDetail.tsx:86`,
  `TopBar.tsx:82`, `App.tsx:291, 481, 532`, `GalleryCard.tsx:36, 75`, `ProjectCard.tsx:86`, `CutListScreen.tsx:161`,
  `RunsForm.tsx:185`, `StructureTree.tsx:670`, `MachinesPane.tsx:486`, `SettingsScreen.tsx:439, 809, 836, 857`,
  `MaterialLibrary.tsx:54`, `MaterialSelect.tsx:108, 129, 170`, `MaterialsPane.tsx:144` i **els 9 `Accordion.ItemTrigger`**
  de les galeries (`AmbientsScreen.tsx:150, 178`, `CatalogSection.tsx:22, 35`, `NewMobleGallery.tsx:110, 120`,
  `Folders.tsx:169`, `CollectionsSection.tsx:166, 179`, `ObjectsGallery.tsx:41, 51`).
- **Incoherències concretes** (mateixa funció, cursor diferent):
  - Fila de l'arbre de l'Editor (`StructureTree.tsx:670`, `pointer`) ↔ fila d'«Elements» dels Ambients
    (`AmbientEditor.tsx:1292`, `HStack as="button"` sense cursor → fletxa).
  - Capa de selecció de les targetes en mode «Seleccionar» (`Folders.tsx:84`, `as="button"` sense cursor) ↔ la targeta
    normal (`GalleryCard.tsx:75`, `pointer`).
  - Llista d'operacions de la Vista CAM (`CamPreview.tsx:278`) sense cursor; els `SegmentGroup` (3D · Alçat · Foto,
    Plànol · 3D, `ViewBar`) sense cursor; els `Menu.Item` amb `default`.
- **SVG**: `PlanCanvas.tsx:408–555` (eines: `crosshair`, `move`, `ew-resize`, `grab`; pa: `grabbing`), `ProfileEditor.tsx:352–435`,
  `PhotoScreen.tsx:677–1069` (`grab`, `crosshair`, `move`), `ElevationEditor.tsx:106, 134` (`pointer`): ben resolts.
- **3D** (react-three-fiber): s'escriu a mà `document.body.style.cursor` a cada malla:
  `CabinetViewer.tsx:229` (peces → `pointer`), `:836` (models), `:994` (objectes/peces lliures, `RefGhost`), `:1265`
  (botons +), `:1416/1429` (nansa ↔ `grab`/`grabbing`), `MoveGizmo.tsx:62` (`grab`, **però no `grabbing` mentre
  s'arrossega**, al contrari que la nansa), `Ambient3D.tsx:651` (elements). Cada component té el seu `useEffect` de neteja
  (`CabinetViewer.tsx:822, 910`, `Ambient3D.tsx:527`, `MoveGizmo.tsx:33`). Orbitar amb el ratolí no canvia el cursor. Les
  peces posen `pointer` fins i tot quan el clic no fa res (Presentació, vistes).

### Què canviar — una sola regla
1. **Per defecte, fletxa** (és una app, no una web): `html { cursor: default }` a `globalCss`. Només els camps on s'escriu
   tenen la I: `input:not([type=checkbox]):not([type=radio]):not([type=range]), textarea, [contenteditable=true] { cursor: text }`.
   Això és exactament el que demana el germà: «una acció sense cursor definit → fletxa».
2. **Mà (`pointer`) = es pot clicar**: tot element que fa una acció en clicar. Al tema, no component per component:
   - tokens de Chakra: `cursor.menuitem`, `cursor.checkbox`, `cursor.radio`, `cursor.option` → `pointer`;
   - `globalCss`: `button:not(:disabled), [role=button], [role=tab], [role=treeitem], [role=menuitem], a[href], summary,
     label:has(> input:not([type=text]):not([type=number])), [data-scope=accordion][data-part=item-trigger],
     [data-scope=segment-group][data-part=item]` → `pointer`.
3. **No disponible**: `:disabled, [aria-disabled=true], [data-disabled]` → `not-allowed` (avui només `App.tsx:481, 532`).
4. **Manipulació directa** (es manté explícit on es fa): arrossegar = `grab`, mentre s'arrossega `grabbing`; dibuixar o
   triar un punt = `crosshair`; moure un element del plànol = `move`; vora = `col-resize`/`ew-resize`.
5. Es treuen els `cursor="pointer"` a mà de la llista d'amunt (queden coberts per la regla 2).

### 3D
- Helper comú `components/viewer/cursor.ts`: `useViewerCursor()` → `{ hover(kind | null), drag(kind | null) }` amb
  prioritat (arrossegar > passar per sobre) i neteja en desmuntar; escriu a `gl.domElement.style.cursor` (el canvas, no el
  `body`: així no queda cap `pointer` penjat a la resta de l'app si el component es desmunta a mig hover). Alternativa
  mínima: `useCursor` de `@react-three/drei` (ja hi és), però no fa la prioritat drag/hover.
- Regla al visor: fletxa sobre el buit; `pointer` sobre el que **es pot seleccionar en aquell mode** (si `onSelectModule`
  no hi és o la vista no permet triar, res); `grab`/`grabbing` a les fletxes del gizmo **i** a la nansa (avui el gizmo no
  fa `grabbing`); orbitar: `grabbing` mentre el botó és premut (`OrbitControls onStart/onEnd`, ja hi són a `CabinetViewer.tsx:716`).
- Llocs: `CabinetViewer.tsx` (5), `MoveGizmo.tsx`, `Ambient3D.tsx`.

**Dependències**: cap funcional. Revisar que el `title` de les etiquetes truncades (`theme/truncatedTitles.ts`) no depèn del
cursor. **Mida: S** (CSS + ~25 esborrats) **+ S** (3D). **Pla**: (a) `globalCss` + tokens; (b) esborrar els `cursor` redundants;
(c) `cursor.ts` i migrar els 8 llocs 3D; (d) prova visual a l'ordinador (al tàctil no hi ha cursor).

---

## 2. Vistes (Davant · Darrere · Esquerra · Dreta · Dalt)

### Com és ara
- `components/viewer/viewNames.ts:2–3`: `ViewName = "3d" | "front" | "back" | "left" | "right" | "top"`.
- **Dues UI per a la mateixa tria**: `ViewBar` (`features/editor/ViewerControls.tsx:9–40`: `SegmentGroup` a baix del visor
  a l'ordinador, `EditorScreen.tsx:1307–1312`, i un `Menu` desplegable al mòbil) i el `ChoiceChips` «Vista» dins d'Opcions
  de vista (`ViewerControls.tsx:66–68`, `EditorScreen.tsx:1367–1370`). Ordre `VIEWS` (l. 6): les cinc + «3D».
- Triar Davant/…/Dalt **canvia de mode**, no només la càmera (`CabinetViewer.tsx`): `ortho = view !== "3d"` (l. 248, 581)
  → `OrthographicCamera` (l. 715), `enableRotate={!ortho}` (l. 716: no es pot orbitar), fons de guies sense l'habitació de
  Presentació (l. 302, 309), sense els + (l. 447), **cotes** (`<Dimensions>`, l. 455–464; components `Dimensions`/`Dim`,
  l. 1059–1170, amb les tires LED `ZoneLight` de `EditorScreen.tsx:755, 1274`) i el gizmo amaga fletxes segons la vista
  (l. 976). Direccions a `VIEW_DIR` (l. 552–559). El fitxer de «Descarregar imatge» porta el nom de la vista
  (`EditorScreen.tsx:765`).
- Les cotes ja són a l'**Alçat** (pestanya del visor, `ElevationEditor`).

### Què canviar
Les cinc vistes passen a ser **accions de càmera**: col·loquen la càmera perspectiva en aquella direcció i enquadren (com
«Enquadrar», que ja fa el 3/4), i després es pot orbitar com sempre. Sense cotes, sense mode ortogràfic, sense canviar el
fons. «3D» desapareix com a vista: el seu paper és el d'«Enquadrar» (`LuVideo`).

**Es treu**: l'opció `"3d"` de `VIEWS` i `VIEW_LABELS`; la branca `ortho` de `CameraRig` i del visor
(`OrthographicCamera`, `enableRotate`, fons, + amagats); `Dimensions`, `Dim`, `DimSpec` i la prop `lights`/`ZoneLight`
(només serveix per a les cotes); el `Menu` del mòbil de `ViewBar` (és un desplegable: va contra la regla «Res de
desplegables»); el `ChoiceChips` «Vista» (es substitueix pels mateixos botons); el `viewer.view` de `ViewerState` i del nom
del PNG.

**Opcions**:
- **A (recomanada)**: perspectiva amb el fov normal. Simple, coherent amb el que demana («posicionar la càmera»).
- B: mantenir ortogràfica però sense cotes. Contradiu «només posicionar» (no es pot orbitar en ortogràfica) i manté tota
  la branca `ortho`.

**Dependències**: `CameraRig` (`fitTriggered`, «vista|fitKey»: passa a «dir|fitKey»), la càmera desada per moble
(`Composition.camera`: amb A una vista sí que es desa com qualsevol òrbita, avui les ortogràfiques no), `MoveGizmo` (l. 976:
amagar la fletxa que mira a la càmera s'ha de calcular amb la direcció de la càmera, no amb el nom de la vista), el botó
«Enquadrar» marcat (`onFramedChange`). Els Ambients no tenen vistes: el mateix component (`CameraPresets`) es podria posar
al 3D dels ambients més endavant. `CLAUDE.md` (Editor › barra del visor, Icones: «Les vistes … van amb text») s'actualitza.

**Mida: M**. **Pla**: (1) `CameraPresets` (botons de text en `segGroup`, sense estat triat, es fa servir a baix del visor i a
Opcions de vista); (2) `CabinetViewer` rep `camGoal: { dir, key }` en lloc de `view`; `CameraRig` fa servir sempre
`PerspectiveCamera`; (3) esborrar `Dimensions`/`ortho`/`lights`; (4) gizmo; (5) typecheck + prova manual de cada vista.

---

## 3. Acordions: un sol component

### Inventari (tots els plegables de `src/`)
| # | Implementació | On | Comportament |
|---|---|---|---|
| a | `Accordion` Chakra, `variant="enclosed"` + `.gallery-accordion` + `FoldTitle` (`projects/FoldTitle.tsx`) | `NewMobleGallery.tsx:108`, `ObjectsGallery.tsx:39`, `AmbientsScreen.tsx:148`, `MaterialsPane.tsx:141` | múltiple, `lazyMount`, obert per la cerca, estat a `useSessionList` (`galleryGrid.ts:10`); Materials amb **la seva pròpia** persistència (`MaterialsPane.tsx:30, 60, 73`) |
| b | `Accordion` Chakra, `variant="plain"` + `.inner-accordion` + `FoldTitle` sense icona | `CatalogSection.tsx:32`, `CollectionsSection.tsx:176`, `Folders.tsx:163` | igual, dins de (a) |
| c | `Accordion` Chakra, `variant="plain"` sense `FoldTitle` | `MaterialSelect.tsx:105` | categories del calaix de materials |
| d | **`PanelSection`** propi (`components/PanelSection.tsx:41–123`): `<button>` + `useState`, sense animació | 48 seccions: `EditorScreen.tsx` (13), `AmbientEditor.tsx` (10), `PartInspector.tsx` (7), `ZonePanel.tsx` (5), `PhotoScreen.tsx` (5), `RefInspector.tsx` (3), `ModelInspector.tsx` (3), `RenderDialog.tsx` (5, via `Sec`, l. 133), `ExportScreen.tsx` (1) | independents, `mobles:section:<id>` a `sessionStorage`; `badge`, `badgePalette`, `actions` (botons al costat que no pleguen), `defaultOpen` |
| e | **`PanelGroup`** (`PanelSection.tsx:18`) | `ExportScreen.tsx:424` («Avançat») | un sol obert |
| f | **`Fold`** propi (`RunsForm.tsx:161–212`) | taulells, sòcols i forats (`RunsForm.tsx:57, 111`) | un obert (`openId`, l. 24; `openCut`, l. 95), resum quan és tancat, paperera |
| g | `Collapsible` Chakra | `ExportScreen.tsx:283` «Després de la CNC» | botó ghost amb fletxa que gira |
| h | Fila de taula desplegable (`as="button"` + `useState`) | `MachinesPane.tsx:486` (eines) | una oberta, editor a sota |
| — | *No són acordions* (no es migren): `SettingsGroup` (sempre obert, per decisió), plegar/desplegar de l'arbre `StructureTree.tsx:719` i dels grups d'`AmbientEditor.tsx:351, 1286` (són arbres), menú lateral (`App.tsx:344`), panells del `Workspace` | | |

Hi ha, doncs, **sis sistemes** (a/b/c, d, e, f, g, h) per fer el mateix.

### Proposta: `components/Fold.tsx` (nom provisional `AppAccordion`) sobre `Accordion` de `@chakra-ui/react`
```tsx
<FoldGroup id="inspector-part" mode="multiple" persist="session" variant="section">  // Accordion.Root
  <FoldItem value="shape" icon={LuShapes} title="Forma" badge="Rectangle" actions={<IconButton…/>}>  // Item + Trigger + Content
    …
  </FoldItem>
</FoldGroup>
```
- `FoldGroup` = `Accordion.Root` amb `multiple` (inspectors, render, galeries) o `collapsible` d'un sol obert (`mode="single"`:
  Avançat d'Exportar, `RunsForm`, eines de la màquina); `lazyMount` + `unmountOnExit` per defecte (com el `PanelSection`
  d'ara, que només munta el contingut obert).
- Estat: `persist="session"` amb **una sola clau per grup** (`mobles:fold:<id>` → llista de valors) a partir de
  `useSessionList` (`galleryGrid.ts`, que es mou a `components/useSessionList.ts`); `defaultValue` per a les obertes d'inici;
  `forceOpen` (llista) per a la cerca de les galeries (avui `value={q ? found : open}`). Les claus són de sessió: no cal
  migració.
- `FoldItem`: `icon` (component de `react-icons/lu`, **obligatori a les seccions**, com demana el germà), `title`, `count`
  (galeries, l'actual `FoldTitle`), `badge` + `badgePalette`, `summary` (línia a sota quan és tancat, com `RunsForm`), `actions`
  (germans de l'`ItemTrigger`, mai a dins: un botó dins d'un botó no és vàlid).
- Variants (recepta pròpia a `theme/system.ts`, no CSS solt): `section` (inspectors i render: l'aspecte de `PanelSection`),
  `gallery` (`enclosed` + l'actual `.gallery-accordion`), `nested` (`plain` + `.inner-accordion`; també els subacordions del
  Render i el `MaterialSelect`), `card` (vora i fons suau, `RunsForm` i eines).
- **Padding**: l'`ItemContent` de Chakra porta `overflow: hidden` (recepta `accordion.js`): talla l'anell de focus i la vora
  esquerra dels controls → l'`ItemBody` porta `px="3px"` a totes les variants (vegeu el punt 6).
- `cursor` del trigger al tema (punt 1): fora els 9 `cursor="pointer"`.
- **Risc conegut**: el comentari de `PanelSection.tsx:38` diu que el `Collapsible` de Chakra mesurava l'alçada en obrir i es
  quedava a 0 si el contingut arribava després (portal). Les galeries ja fan servir `Accordion` amb `lazyMount` i contingut
  que arriba tard (miniatures) sense problemes; cal provar-ho als inspectors (`MaterialSelect`, calaixos, `NameDialog`) i, si
  torna a passar, la variant `section` desactiva l'animació d'alçada (`_open: { animationName: "fade-in" }`).

### Llocs a migrar
1. `PanelSection`/`PanelGroup` → `FoldGroup`/`FoldItem` a: `EditorScreen.tsx` 907–1134 (un grup per nivell: moble, mòdul,
   avisos), `ZonePanel.tsx` 115–399, `PartInspector.tsx` 95–369 (aquí també **es treu «General»** i les seves opcions
   passen a ítems propis Efecte · Orientació · Material · Forma · Grup · CNC · Enganxada, cadascun amb icona: tasca d'un
   altre estudi, però es fa amb aquest component), `RefInspector.tsx` 26–119 (igual, sense «General»), `ModelInspector.tsx`
   21–49, `AmbientEditor.tsx` 862–1402, `PhotoScreen.tsx` 864–975, `RenderDialog.tsx` 133–925, `ExportScreen.tsx` 424.
2. Galeries: `NewMobleGallery`, `ObjectsGallery`, `AmbientsScreen`, `MaterialsPane` (treu la seva persistència pròpia),
   `CatalogSection`, `CollectionsSection`, `Folders`; `FoldTitle.tsx` desapareix (passa a `FoldItem`).
3. `MaterialSelect.tsx:105` (variant `nested`).
4. `RunsForm.Fold` (variant `card`, `mode="single"`, `summary`, `actions` = paperera).
5. `ExportScreen.tsx:283` `Collapsible` → un `FoldItem`.
6. `MachinesPane.tsx:486` → `FoldGroup mode="single" variant="card"` (o, si a la taula no queda bé, documentar-ho com a
   excepció; recomanació: migrar-ho).
7. Esborrar `PanelSection.tsx`, `FoldTitle.tsx` i el CSS `.gallery-accordion`/`.inner-accordion` que passi a la recepta.

**Dependències**: tots els inspectors; `CLAUDE.md` (UI › «Seccions plegables», Galeries, Editor) s'ha de reescriure. Cap canvi al
`core/`. **Mida: L** (≈ 60 llocs, però mecànic). **Pla**: (1) component + recepta + prova en una pantalla (ModelInspector, 3
seccions); (2) inspectors de l'Editor; (3) Ambients, Foto, Render, Exportar; (4) galeries; (5) RunsForm, MachinesPane;
(6) esborrar els antics i actualitzar `CLAUDE.md`. Després de cada pas: typecheck, lint, build i repàs visual (ordinador i
iPhone: la capçalera de 48 px de `layout.css` per al tàctil s'ha de conservar).

---

## 4. Menú principal: Mobles · Ambients · Objectes, i el «+» al costat del cercador

### Com és ara
- `App.tsx:46–53`: `GLOBAL_NAV = [AMBIENTS_ENTRY, OBJECTS_ENTRY, PROJECTS_ENTRY]`, i `GLOBAL_NAV_MOBILE` = el mateix + Preferències
  (barra de baix, `App.tsx:470`). L'app s'obre a Ambients si no hi havia res obert (`App.tsx:85`).
- El botó principal és a la capçalera, a sota del títol (`components/PageHeader.tsx`): «Nou moble» + «Obrir fitxer»
  (`ProjectsScreen.tsx:89–103`), «Nou objecte» (`ObjectsScreen.tsx:36–44`), «Nou ambient» (`AmbientsScreen.tsx:135–143`).
- El cercador és un altre bloc a sota, **copiat tres vegades**: `NewMobleGallery.tsx:98–100`, `ObjectsGallery.tsx:36–38`,
  `AmbientsScreen.tsx:145–147`. Ja hi ha dos llocs amb **cercador + Afegir en una fila**, però diferents entre ells:
  `MasterDetail.tsx:126–135` (icona sola, `outline`) i `MaterialsPane.tsx:128–136` (`Afegir` amb text, `wood`).

### Què canviar
- `GLOBAL_NAV = [PROJECTS_ENTRY, AMBIENTS_ENTRY, OBJECTS_ENTRY]` (ordinador i mòbil surten del mateix array).
- Obrir per defecte: proposo **Mobles** (és el primer i el nucli de l'app, vegeu «Què és» al `CLAUDE.md`); confirmar-ho
  amb l'usuari, perquè ara és una decisió documentada («L'app s'obre a Ambients»).
- Component comú `components/SearchBar.tsx`: `<SearchBar value onChange placeholder ariaLabel add={{ label, onClick }}
  extra={…} />` = cercador (flex 1, `maxW` 420 + botó a l'ordinador) + botó **«+ Nou moble»** (`colorPalette="wood"`, a
  l'ordinador amb text, al mòbil només la icona amb `aria-label`) + `extra` (a Mobles, «Obrir fitxer» en `IconButton`
  `outline` amb `LuFolderOpen`). El fan servir les tres galeries, `MasterDetail` i `MaterialsPane` (un sol aspecte del «+»).
- `PageHeader` es queda amb títol i explicació (la prop `actions` passa a opcional).
- `NewMobleGallery` i `ObjectsGallery` també s'obren des dels Ambients (finestres «+ Moble»/«+ Objecte»,
  `AmbientEditor.tsx:770, 813`) **sense** botó Nou (per decisió de l'usuari): `add` opcional.

**Dependències**: `CLAUDE.md` (Navegació i barres, Galeries, taula d'icones «Navegació»). **Mida: S**. **Pla**: (1) ordre del
menú; (2) `SearchBar` + substituir els 5 cercadors; (3) treure `actions` de les tres `PageHeader`; (4) mòbil: comprovar que
el cercador i el + caben en 375 px.

---

## 5. Historial: «Esborrar l'historial» → «Esborrar»

- Botó: `features/projects/ClearHistory.tsx:47` (`<LuTrash2 /> Esborrar l'historial`), el mateix a Mobles, Objectes i
  Ambients (`ProjectsScreen.tsx:161`, `ObjectsScreen.tsx:95`, `AmbientsScreen.tsx:164`). Ja és dins de l'acordió
  «Historial», així que «Esborrar» s'entén; no xoca amb l'«Esborrar» del mode Seleccionar (`Folders.tsx:138`), que només
  surt en aquell mode.
- Canviar el text a **«Esborrar»** i posar `title="Esborrar l'historial"` (el tooltip conserva el context). El títol del diàleg
  (`ClearHistory.tsx:55`, «Esborrar l'historial?») es queda.
- Textos que hi fan referència: `ProjectsScreen.tsx:184`, `ObjectsScreen.tsx:122`, `AmbientsScreen.tsx:188` («…i «Esborrar
  l'historial» no el toca» → «…i «Esborrar» de l'Historial no el toca»); comentaris a `Folders.tsx:31`, `layout.css:50`;
  `CLAUDE.md` l. 926 i 969. **Mida: S**.

---

## 6. Finestra de Render

### Com és ara (`components/viewer/render/RenderDialog.tsx`)
- Columna d'opcions: `Stack w={{ md: "300px" }} … overflowY="auto" pr={1}` (l. 747), **sense marge a l'esquerra**. Les
  `FormRow` (`components/FormRow.tsx:14–21`) posen l'etiqueta a sobre quan el contenidor fa < 300 px: aquí en fa 296 → el
  control queda enganxat a la vora esquerra i l'`overflow` de la columna en talla l'anell de focus. Per això les caselles
  «es tallen» en triar-les.
- Les quatre caselles són **`<input type="checkbox">` nadius** (l. 801, 918, 928, 934; i els lliscadors `type="range"`
  del `Range`, l. 110–130): són les úniques de l'app; la resta fa servir `Switch` de Chakra (38 llocs) i `Slider` (3).
- Seccions (`Sec` = `PanelSection`, l. 133): **Qualitat** (Motor, Resolució, Rebots, Aturar-se a — l. 748–792), **Càmera**
  (Format, Verticals rectes ☐, Objectiu, Desenfocament — l. 795–815), **Escena** (Escena, Per les finestres — l. 818–858),
  **Llum** (l. 861–923): Ambient (Dia/Capvespre/Vespre), Sol · direcció, Sol · alçada, Sol · intensitat, Ombres, Cel (llum
  ambient), Cel (tipus/HDRI/fitxer), Gir del cel, Llums enceses ☐, Llums · intensitat, Llums · com es veuen;
  **Imatge** (l. 925–976): Exposició automàtica ☐, Reduir el soroll ☐, Corba de color, Vinyeta, Resplendor (+ llindar),
  Temperatura, Exposició, Contrast, Saturació, Fons; «Restablir» (l. 978).

### Què canviar
1. **3 px de padding**: `px="3px"` a la columna (l. 747; `pr={1}` → `ps="3px" pe={1}`) i, amb el punt 3, al cos de tots els
   acordions (l'`ItemContent` de Chakra fa `overflow: hidden`). Opció complementària: columna de 320 px perquè les files no
   passin a dues línies.
2. **Caselles → `Switch`** de Chakra com a la resta de l'app (mateixa mida `sm`, etiqueta a la `FormRow`). Lliscadors →
   `Slider` (mateix aspecte que «Obertura», `ViewerControls.tsx:78`); opcional, més feina.
3. **Llum amb subacordió** (variant `nested`, independents, tancats; l'Ambient queda a dalt perquè els canvia tots):
   - **Sol**: direcció, alçada, intensitat, ombres (dures → suaus). Insígnia: «45° · 1,0×».
   - **Cel**: Cel (Dia/Núvols/Interior/fitxer), Cel (llum ambient), Gir del cel. Insígnia: el nom del cel.
   - **Llum** (llums dels materials): Llums enceses, intensitat, com es veuen. Insígnia: «Enceses»/«Apagades».
   - Proposo dir la secció de fora **«Llums»** (com l'anomena el germà) per no repetir «Llum» a fora i a dins.

**Dependències**: punt 3 (component d'acordió i subacordió). La configuració desada (`renderPrefs.ts`) no canvia. **Mida: S**
(padding + Switch) **+ S** (subacordió, un cop hi hagi el component). **Pla**: padding ja; Switch; subacordió quan `FoldGroup`
existeixi; comprovar a l'iPhone (al mòbil les opcions van a sota de la imatge).

---

## 7. Ambients: selecció i resum com a la resta

### Com és ara
- Editor de mobles: l'arbre (`StructureTree.tsx:221`) comença amb **la fila del moble** (`Row` en negreta, `LuBox`) que el
  selecciona (`{ kind: "moble" }`), i l'inspector del moble obre amb **«Resum»** (`EditorScreen.tsx:907–922`: mòduls, mides,
  peces, forats, objectes, models).
- Editor d'ambients: la llista de l'esquerra només té el títol «Elements» + «+ Moble»/«+ Objecte» (`AmbientEditor.tsx:533–547`)
  i els elements/grups (`listRows`, l. 351–356, `ElementRow` l. 1265–1330). **Ni l'ambient ni les parets hi surten**:
  l'inspector de l'ambient (`AmbientInspector`, l. 1104: Parets noves · Acabats · Plànol de fons) només surt quan
  `sel === null`, és a dir, clicant al buit del plànol o del 3D (l. 628). Les parets només es trien al plànol. No hi ha
  resum de l'ambient.
- A més, **dues files d'arbre diferents** per a la mateixa cosa: `StructureTree.Row` (l. 632: `role="treeitem"`, sagnat
  14 px, triada `wood.muted`, `pointer`, arrossegar per ordenar, fletxa que substitueix la icona) i `AmbientEditor.ElementRow`
  (sagnat 16 px, triada `wood.subtle`, sense cursor, fletxa en un `IconButton` a part, mida a la dreta); i dues capçaleres de
  grup (`StructureTree.SectionTitle`, l. 779, «+» d'icona) ↔ `HStack` + `SectionLabel` amb botons de text.

### Què canviar
- Mateixa estructura que l'Editor: **arbre de l'ambient** = fila arrel amb el nom de l'ambient (`LuHouse`, negreta) que el
  selecciona → selecció explícita `{ kind: "ambient" }` (en lloc de `null`); grups **Parets** (`LuBrickWall`, una fila per
  paret amb la llargada; tria = la mateixa selecció `wall` del plànol) i **Elements** (com ara, amb + Moble / + Objecte).
  Clicar al buit continua deseleccionant (= ambient), com a l'Editor.
- L'inspector de l'ambient comença amb **«Resum»** (mateix `FoldItem` que el del moble): superfície (m²), nombre de parets,
  finestres i portes, mobles i objectes, mides de la caixa; després Parets noves · Acabats · Plànol de fons.
- Component comú `components/TreeRow.tsx` (+ `TreeSection` per al títol amb +) a partir de `StructureTree.Row`: el fan servir
  l'Estructura i els Ambients (i, si es vol, els `MasterDetail`). Els Ambients guanyen arrossegar per ordenar/agrupar, el
  mateix sagnat, color i cursor.
- Opció B (mínima): només afegir la fila arrel i el Resum, sense compartir la fila. No recomanada: deixa les dues còpies.

**Dependències**: `Selection` d'`AmbientEditor` (l. 145) i qui la llegeix (`PlanCanvas`, `Ambient3D`, teclat: Supr amb
l'ambient seleccionat no ha de fer res), `CLAUDE.md` (Ambients › Editor). **Mida: M**. **Pla**: (1) `TreeRow`/`TreeSection`
extrets sense canviar l'Editor; (2) llista dels Ambients amb `TreeRow`; (3) `{ kind: "ambient" }` i fila arrel; (4) grup
Parets; (5) Resum; (6) proves de teclat i de selecció plànol ↔ llista ↔ 3D.

---

## 8. Editor de materials: la bola més gran i fidel al render

### Com és ara
- `MaterialStage` (`features/settings/MaterialsPane.tsx:297–320`): a `lg`, la tira «A escala real» té `flex: 1` (ocupa la
  resta de la columna) i la bola `h="min(380px, 42dvh)"`; més estret, en fila: tira `flex 1`, bola `calc(50% - 6px)` al mòbil
  i 280 px a `md`. **La tira és sempre igual o més gran que la bola.**
- La bola (`MaterialBall.tsx`, `viewer/ballMaterial.ts`) fa servir `finishMaterial` → `MeshStandardMaterial` +
  `applyFinishFx` (`viewer/textures.ts:488–499`):
  - `glow` (llum que fa) → `emissive` amb intensitat `min(1, 0,35 + glow/10)`: es veu encesa, però no fa llum ni resplendor
    (no hi ha `Bloom`) i no té res a veure amb la intensitat del render;
  - **`coat` (Reflex) i `sheen` (Vellut) només van a `userData`** (els llegeix `extractScene`): la bola no els mostra;
  - `translucent` (Llum que passa) també només a `userData`;
  - **`ballKey` (`ballMaterial.ts:34–36`) no inclou `coat` ni `sheen`**: canviar «Reflex» o «Vellut» no refà ni el material.
- Els tres camps «Al render» (`MaterialsPane.tsx:533–553`) diuen a l'ajuda que «només per al render»; `glow` no té cap
  camp a l'editor (només el porten els materials de l'app: «Tira LED», «Pantalla de lli», «Bombeta», `core/model/settings.ts:401, 467–468`).

### Què canviar
1. **Mida**: invertir els pesos. `lg`: la bola `flex: 1` (a dalt, el protagonista) i la tira a sota amb `h="clamp(140px, 24dvh, 220px)"`;
   `md`: bola 360 px, tira la resta; mòbil: bola a tota l'amplada (quadrada) i la tira a sota, més baixa (3:1). Canvi només a
   `MaterialStage`. **Mida: S**.
2. **Que la bola digui la veritat** — opcions:
   - **A (recomanada, S–M)**: la bola fa servir `MeshPhysicalMaterial` (`ballMaterial` en fa la còpia): `clearcoat = coat`,
     `clearcoatRoughness = COAT_ROUGHNESS` (0,08, de `render/shading.ts`), `sheen = sheen` amb `sheenColor` del color de la
     tela, `transmission`/`thickness` aproximats per a `translucent`, i `emissive` amb la mateixa escala que el render
     (`emission` de `extractScene`) més un `Bloom` suau només a la bola. `ballKey` amb `coat`, `sheen` i `glow`.
     Aproximació, però el que es toca es veu.
   - **B (L)**: botó «Veure-la al render» a la bola: una passada del mateix path tracer (`extractScene` + motor CPU/GPU) sobre
     l'escena de la bola. Exacte, però pesat a l'iPhone (memòria) i més codi.
   - **C**: cap canvi a la bola i treure l'efecte de la previsualització amb un text clar («només al render»). No resol el que
     demana el germà.
3. Si el visor també ha de mostrar Reflex/Vellut (mode Presentació), l'opció A es pot moure a `applyFinishFx` per a tots;
   afecta el GLB/USDZ i la memòria (més uniformes): decidir-ho a part.

**Dependències**: `viewer/textures.ts` (`applyFinishFx`), `render/shading.ts` (constants compartides), test
`ballMaterial.test.ts` (afegir que `ballKey` canvia amb `coat`/`sheen`). **Mida total: M**. **Pla**: (1) mides; (2) `ballKey`
(error real, de seguida); (3) opció A; (4) comparar a ull la bola amb un render d'un ambient amb el mateix material
(lacat brillant, vellut, pantalla de lli).

---

## 9. Regla d'or: coherència i cohesió

### Text proposat per al `CLAUDE.md` (secció nova just abans de «UI», i enllaç des de «Com treballar»)
```md
## Regla d'or: coherència i cohesió
Abans de fer res nou (component, opció, pantalla, interacció), **busca com està resolt el mateix a l'app** i fes-ho igual.
- **Reutilitza o generalitza; no copiïs.** Si ja hi ha un component que fa la feina, s'hi afegeix el que falta (prop,
  variant) a `components/`. Si n'hi ha dos que fan el mateix, s'unifiquen abans d'afegir-ne un tercer.
- **Un concepte, un component**: acordió = `FoldGroup`/`FoldItem` (sobre `Accordion` de Chakra), cercador + «+» =
  `SearchBar`, fila d'arbre = `TreeRow`, tria = `ChoiceChips`/`IconChoice`, interruptor = `Switch`, lliscador = `Slider`,
  material = `MaterialSelect`, camp = `FormRow`. Res d'elements nadius (`<input type="checkbox|range">`) fora de `components/ui`.
- **El mateix gest fa el mateix a tot arreu**: seleccionar, cercar, afegir, esborrar, plegar i moure es fan igual a Mobles,
  Objectes, Ambients i Preferències (mateixa posició, icona del catàleg, text i cursor).
- **De punta a punta**: una opció nova es comprova a tots els llocs on té efecte (visor, miniatura, previsualització, render,
  GLB/USDZ, exports, `.moble`) abans de donar-la per feta. Si una previsualització no la pot mostrar, ho diu.
- **Cursor**: fletxa per defecte; mà només on un clic fa alguna cosa; `grab`/`grabbing` per arrossegar; `not-allowed`
  desactivat (regla al tema, no a cada component).
- Quan aparegui un cas nou, s'afegeix aquí.
```

### Altres duplicats trobats (i què fer-ne)
| Duplicat | On | Proposta | Mida |
|---|---|---|---|
| 6 sistemes de plegables | punt 3 | `FoldGroup`/`FoldItem` | L |
| 5 cercadors copiats, 3 estils de «+» | `NewMobleGallery.tsx:98`, `ObjectsGallery.tsx:36`, `AmbientsScreen.tsx:145`, `MasterDetail.tsx:128`, `MaterialsPane.tsx:131` (+ `MaterialSelect.tsx:86`) | `SearchBar` (punt 4) | S |
| 3 persistències d'estat obert | `useSessionList` (`galleryGrid.ts:10`), `MaterialsPane.tsx:30–75`, `PanelSection`/`PanelGroup` (`sessionStorage` directe), `useSessionString` (`settings/useSessionString.ts`) | un sol mòdul `components/sessionState.ts` (`useSessionList`, `useSessionString`, `useSessionFlag`) | S |
| 2 files d'arbre i 2 capçaleres de grup | `StructureTree.Row`/`SectionTitle` ↔ `AmbientEditor.ElementRow` + `HStack` | `TreeRow`/`TreeSection` (punt 7) | M |
| 2 UI per triar la vista | `ViewBar` (`SegmentGroup` + `Menu`) ↔ `ChoiceChips` «Vista» | `CameraPresets` (punt 2) | — |
| Caselles i lliscadors nadius | `RenderDialog.tsx:110–130, 801, 918, 928, 934`, `TextureEditor.tsx:51, 241` | `Switch` i `Slider` (o un `RangeRow` comú si el `Slider` és massa gros) | S |
| Controls segmentats de tres menes | `SegmentGroup` de Chakra (`Workspace.tsx`, `EditorScreen.tsx:1315`, `AmbientEditor.tsx`, `App.tsx`, `ViewerControls.tsx`) ↔ `segmented.ts` (`segGroup`/`segItem`, IconChoice, ViewTile, ChoiceChips) | les pestanyes del visor (3D · Alçat · Foto, Plànol · 3D) poden quedar amb `SegmentGroup` (són pestanyes), però amb l'aspecte de `segmented.ts`; documentar-ho | S |
| Inspector de grup duplicat | `PartInspector.tsx:361–369` (Posició del grup · Peces) ↔ `AmbientEditor.GroupInspector` (l. 1339–1402: Posició del grup · Elements) | `GroupInspector` comú (nom, posició, llista, accions) | M |
| `MaterialPick` = `FormRow` + `MaterialSelect hideLabel` | `AmbientEditor.tsx:852` (i patrons iguals a inspectors) | prop `row` al `MaterialSelect` o `MaterialRow` a `components/` | S |
| Botons «Afegir» | «+ Moble»/«+ Objecte» amb text (`AmbientEditor.tsx:539–545`) ↔ «+» d'icona a cada grup de l'arbre (`StructureTree.SectionTitle`) | el mateix que a l'Editor (`TreeSection`) | S (amb punt 7) |
| Neteja del cursor 3D a cada component | `CabinetViewer.tsx` ×3, `Ambient3D.tsx`, `MoveGizmo.tsx` | `cursor.ts` (punt 1) | S |
| Inconsistència d'afordança | `ElementRow` sense cursor, capa de selecció de `Folders.tsx:84` sense cursor | regla del punt 1 | — |

### Com evitar-ne de nous
- A la revisió de cada fase (Fase 6 del prompt), una passada «coherència»: buscar `useState` amb `open`/`fold`,
  `sessionStorage`, `InputGroup`, `type="checkbox"`, `cursor=` i `Accordion.Root` fora dels components comuns. Es pot posar
  com a test barat (`src/coherence.test.ts` que llegeix els `.tsx` i falla si troba `<input type="checkbox"` o
  `Accordion.Root` fora de `components/`), igual que els tests de catàleg ja vigilen les plantilles.

---

## Dependències entre punts
- 3 → 6 (subacordió de Llums, padding), 3 → «treure General» de Peces lliures i Objectes de referència (un altre estudi),
  3 → 7 (Resum amb `FoldItem`).
- 1 i 3 comparteixen la regla del cursor del trigger.
- 4 i 9 (`SearchBar`), 7 i 9 (`TreeRow`), 2 i 9 (`CameraPresets`).
- Tots: `CLAUDE.md` (UI, Galeries, Editor, Ambients, Icones) s'actualitza en el mateix canvi que el codi.

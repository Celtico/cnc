# Auditoria: el que Chakra UI v3 ja fa (2026-10-15)

Origen: «si Chakra ja ho té, no es reinventa la roda» (decisió de l'usuari, 2026-10-15). S'ha repassat `src/components/`,
`src/app/` i les peces compartides de `src/features/` buscant components i comportaments fets a mà que Chakra v3 (3.37,
`node_modules/@chakra-ui/react/dist/types/components/`) ja porta: `splitter`, `tabs`, `slider`, `breadcrumb`,
`tree-view`, `segment-group`, `radio-group`, `color-picker`, `file-upload`, `download-trigger`, `toggle`, `listbox`,
`scroll-area`, `empty-state`, `card`, `accordion`, `collapsible`, `editable`, `clipboard`…

La regla ja és al `CLAUDE.md` (UI › Regles i Com treballar) i a `docs/convencions.md` (UI: Chakra primer).

## Decisions

- **es canvia (fet)**: canviat en aquest commit.
- **es canvia (pendent)**: Chakra ho cobreix; es fa en un pas a part (motiu i risc a la fila).
- **es manté perquè …**: el de Chakra no pot fer el que cal; el motiu és concret.

| # | Fitxer | Què fa | Equivalent de Chakra | Cobreix el que cal? | Esforç · risc | Decisió |
|---|---|---|---|---|---|---|
| 1 | `components/ResizeHandle.tsx` (a `Workspace`, `GlobalAssistant`, `PhotoScreen`) | Vora arrossegable entre panells: px recordats, mínim/màxim, fletxes, doble clic restaura, només a l'ordinador | `Splitter` | Sí: mides en `px` (`minSize`/`maxSize`/`size`), `preserve-pixel-size` en canviar la finestra, plegar (`collapsible`), teclat (fletxes, Inici/Fi, Retorn plega), tàctil (`touch-action`), cursor `col-resize` a tota la pàgina mentre s'arrossega. El Splitter dona percentatges: l'embolcall els passa a px | M · M | **es canvia (fet)**: `components/PanelSplit.tsx` (+ `panelSplit.ts`, amb tests). Vegeu «ResizeHandle → Splitter» |
| 2 | `app/ProjectTabs.tsx` › `MobileProjectTabs` | Pestanyes del moble al mòbil fetes amb `button role="tab"` | `Tabs` (variant `line`, `fitted`) | Sí: rols, fletxes, la ratlla de la triada amb `colorPalette` | S · B | **es canvia (fet)**: `Tabs` amb `activationMode="manual"` (les fletxes mouen el focus; Retorn canvia de pàgina) |
| 3 | `features/settings/TextureEditor.tsx` | Dos `<input type="range">` nadius (mida de la mostra i els paràmetres) — trencava la regla «res d'elements nadius» | `Slider` | Sí: `onValueChangeEnd` per aplicar en deixar anar (generar la textura costa) | S · B | **es canvia (fet)**: `Slider.Root` com la resta de l'app |
| 4 | `components/TopBar.tsx` › `DocBar` | Molla de pa «Mobles › Nom» feta amb un botó i una fletxa | `Breadcrumb` | Sí (el nom és l'`Editable` de dins de l'últim element) | S · B | **es canvia (fet)** |
| 5 | `features/composition/StructureTree.tsx`, `features/ambients/editor/AmbientTree.tsx`, `components/TreeRow.tsx` | Arbre de l'estructura (`role="tree"`): plegar, triar (també amb Maj/⌘), arrossegar per reordenar o agrupar (abans/després/dins), ull i cadenat, menú ⋯, «+» als grups, files virtuals (Resum, parets) | `TreeView` | No del tot: el `TreeView` de 3.37 no té arrossegar per reordenar ni línies de destí; la selecció de l'arbre va lligada a la del visor 3D (`useEditorSelection`) i les files no són totes nodes d'una col·lecció | L · A | **es manté de moment** (risc alt). Pla: (1) l'arbre dels Ambients, que és més simple, sobre `TreeView` amb `createTreeCollection` i les files de `TreeRow` dins de `TreeView.Item`/`BranchControl`, mantenint l'arrossegar amb els esdeveniments nadius de `TreeRow`; (2) si va bé a l'iPhone i a l'ordinador, l'Estructura del moble. Risc: perdre la selecció múltiple sincronitzada amb el 3D i l'arrossegar a dins d'un grup |
| 6 | `components/FormRow.tsx` › `ChoiceChips` (+ `segmented.ts`) | Tria amb pastilles (`role="radiogroup"` amb botons) que **salten de línia** | `SegmentGroup` / `RadioGroup` | `SegmentGroup` no: no salta de línia (l'usuari va triar pastilles per això) i l'indicador lliscant no funciona en diverses files. `RadioGroup` sí (focus itinerant, fletxes, input amagat) | M · M (s'usa a tot arreu) | **es manté perquè `SegmentGroup` no salta de línia**. **Pendent**: fer el `ChoiceChips` sobre `RadioGroup.Root`/`Item` amb el mateix aspecte, per tenir les fletxes del teclat (ara cada pastilla és una parada de tabulador). `retap` s'ha de conservar |
| 7 | `components/IconChoice.tsx` | Tria entre poques icones (tipus de front…) amb el nom al tooltip | `SegmentGroup` o `RadioGroup` | Sí | S · B | **es canvia (pendent)**, en el mateix pas que el 6 (comparteixen `segmented.ts`) |
| 8 | `features/editor/ViewerControls.tsx` (vistes del visor, `role="group"` amb botons) | Control segmentat fet a mà | `SegmentGroup` | Sí | S · B | **es canvia (pendent)**: no s'ha tocat `features/editor` en aquest pas (hi treballen altres canvis) |
| 9 | `features/settings/screen/SceneFields.tsx` › `Swatches`, `AppearanceFields.tsx` › `AccentField` | Mostres de color rodones (`role="radio"`), el mateix codi dos cops | `RadioGroup` + `ColorSwatch` (o `ColorPicker.SwatchGroup`) | Sí | S · B | **es canvia (pendent)**: un sol component de mostres sobre `RadioGroup` + `ColorSwatch` |
| 10 | `TextureEditor.tsx` › `ColorField`, `MaterialsPane.tsx` (color i junta) | `<Input type="color">` nadiu | `ColorPicker` | Sí (àrea, lliscadors, hex, comptagotes, mostres) | M · M | **es canvia (pendent)**: dins d'un `Dialog` cal provar el portal del popover; a l'iPhone el selector del sistema funcionava bé, cal comprovar que el de Chakra s'hi fa servir còmodament |
| 11 | `features/file/OpenFileButton.tsx`, `settings/screen/SettingsHeader.tsx`, `photo/PhotoScreen.tsx`, `assistant/chatPanel/ChatComposer.tsx` | `<input type="file" hidden>` + botó | `FileUpload` (`HiddenInput`, `Trigger`) | Gairebé: el `FileUpload` es queda la llista de fitxers acceptats (aquí s'obren i prou) i filtra per l'`accept` (a l'iPhone `fileAccept` el treu perquè els `.moble` surten en gris). Cal veure que es pugui tornar a triar el mateix fitxer | S · M | **es canvia (pendent, cal provar a l'iPhone)**. El de `components/viewer/render/` no s'ha tocat (hi treballa un altre canvi) |
| 12 | `components/ImportDropZone.tsx` + `pickedFiles.ts`, `settings/TextureMapRows.tsx` | Zona per deixar anar fitxers **i carpetes** amb el camí relatiu, i dos selectors (carpeta / fitxers) | `FileUpload` (`Dropzone`, `directory`) | No: en deixar anar carpetes, el `FileUpload` (zag `getFileEntries`) ajunta els noms de les subcarpetes sense «/» (`${path}${entry.name}`), i els importadors de Maestro i dels jocs de textures necessiten el camí exacte; a més, una arrel de `FileUpload` és o carpeta o fitxers, no totes dues | — | **es manté perquè el camí relatiu de les subcarpetes surt malament** al `FileUpload` de 3.37 |
| 13 | `assistant/chatPanel/useChatAttachments.ts` | Deixar anar fitxers a sobre de tot el xat | `FileUpload.Dropzone` | La zona és tot el xat (missatges inclosos), no un requadre | — | **es manté** (la zona de deixar anar és el panell sencer) |
| 14 | `lib/download.ts` › `downloadBlob` (i `viewer/exportUsdz.ts`) | Descarregar un fitxer generat | `DownloadTrigger` | No: el `DownloadTrigger` és un botó; aquí es descarrega des de menús, després de generar en segon pla, des de les eines de l'assistent i des d'avisos | — | **es manté perquè cal descarregar sense un botó propi** |
| 15 | `components/Fold.tsx` | Acordió de tota l'app | `Accordion` | Ja és l'`Accordion`; l'animació pròpia (graella `0fr → 1fr`) és perquè el `Collapsible` mesurava l'alçada i quedava a 0 amb el contingut que arriba tard | — | **es manté** (ja és Chakra; motiu escrit al fitxer) |
| 16 | `components/MasterDetail.tsx` | Llista agrupada + detall (Materials, Ferratges, Màquines) | `Listbox` (només la llista) | La llista amb cercador, insígnies i grups es podria fer amb `Listbox` (fletxes i selecció); el detall i el «‹ Tornar» del mòbil no són de Chakra | M · M | **es manté de moment**; pendent provar `Listbox` per a les files (ara són botons) |
| 17 | `components/SettingsGroup.tsx` | Targeta de Preferències (capçalera amb icona i cos) | `Card` | Sí | S · B | **es canvia (pendent)**: `Card.Root`/`Header`/`Body`; cal mantenir les classes `settings-group-head/-body` que fa servir el CSS |
| 18 | `ViewTile`, `PickerRow` i altres `IconButton`/`Button` amb `aria-pressed` | Botó que queda premut | `Toggle` | Sí, però no hi afegeix res: el botó amb `aria-pressed` ja és el patró accessible i l'estat és de fora | — | **es manté** (no és un component fet a mà: és el `Button` de Chakra amb un atribut) |
| 19 | Missatges «Encara no n'hi ha cap.» de llistes (Materials, Ferratges, galeries) | Text d'una línia dins d'una llista buida | `EmptyState` | L'`EmptyState` és per a una pantalla buida (icona, títol, text); ja es fa servir a la Foto | — | **es manté** per a les línies de llista; pendent: les galeries buides (Mobles, Objectes, Ambients) amb `EmptyState` |
| 20 | Panells de l'espai de treball (desplaçament propi, barra fina) | Desplaçament natiu | `ScrollArea` | El desplaçament natiu de l'iPhone (inèrcia) i la capçalera `sticky` de Propietats funcionen; `ScrollArea` hi posaria una barra pròpia | — | **es manté** (natiu) |
| 21 | `components/SearchBar.tsx`, `PickerDrawer.tsx`, `ViewOptions.tsx`, `NameDialog.tsx`, `EditorDialog.tsx`, `StatBox.tsx`, `NumRow.tsx`, `TopBar.tsx` (nom), `PhotoScreen` (foto buida) | — | `InputGroup`, `Drawer`, `Popover`, `Dialog`, `Stat`, `NumberInput`, `Editable`, `EmptyState` | Ja són de Chakra | — | correcte |
| 22 | `DimLine`, `BoardDrawing`, `PanelDrawing`, `dims.ts`, el visor 3D | Dibuixos SVG i 3D | — | Chakra no en té | — | **es manté** (no hi ha equivalent) |

## ResizeHandle → Splitter (fet)

- **`PanelSplit`** (`components/PanelSplit.tsx`) configura `Splitter.Root`: `panels` amb `width` (px recordats), `min`,
  `max`, `hidden` i `onHide`; el panell sense `width` es queda la resta. La mida és controlada: els laterals en `px` i el
  flexible sense mida (`panelSplit.ts` › `splitterSizes`). El Splitter avisa en percentatges i `widthUpdates` els torna a px
  (amb l'amplada del grup) i només desa els panells de la vora que s'arrossega.
- **`SplitHandle`**: `Splitter.ResizeTrigger` amb l'aspecte de sempre (nansa curta al mig; en passar-hi per sobre, la vora
  de color `wood`), `quiet` (assistent), doble clic restaura l'amplada per defecte.
- **Mateixes claus**: `mobles:<id>-tree-width`, `mobles:<id>-inspector-width`, `mobles:photo-panel-width`,
  `mobles:assistant-width`, i els mateixos plegats (`mobles:<id>-tree-hidden`, `-props-hidden`). El valor desat vol dir el
  mateix que abans: l'espai entre columnes ara és farciment de dins del panell (el Splitter reparteix tota l'amplada entre els
  panells) i se suma i resta en passar-lo al Splitter.
- **Mínims i màxims**: Estructura i Propietats 48–900 px; Foto 280–560; Assistent 48–900.
- **Plegar**: els botons de les cantonades del visor, com abans. Nou (ho porta el Splitter): arrossegar la vora fins a menys
  de la meitat del mínim o prémer Retorn a la vora plega l'Estructura o les Propietats (es tornen a obrir amb el botó). A
  l'assistent no: tancar-lo és la ✕ (pot preguntar).
- **Mòbil** (per sota de `md`; la Foto, de `lg`): sense vores; els panells en columna amb la seva alçada (l'embolcall treu
  els estils en línia del Splitter amb `!important`) i cada pantalla tria què ensenya (`display`, `order`), com abans.
- **Teclat**: fletxes (1 % de l'amplada, 10 % amb Maj), Inici/Fi, Retorn plega/desplega (abans: 16/64 px).
- **No verificat a la UI** (no s'ha pogut obrir l'app): cal provar arrossegar a l'ordinador, el doble clic, plegar/desplegar,
  l'assistent obert amb l'editor, la Foto a `lg`, i que al mòbil i a l'iPad tot surti com abans.

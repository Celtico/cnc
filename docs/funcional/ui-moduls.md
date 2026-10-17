# UI: mòduls compartits, navegació i mides tàctils

> Tret del `CLAUDE.md` (2026-10-15) perquè no es carregui sencer a cada sessió. Llegeix-lo abans de tocar aquesta part.

#### Mòduls compartits (com les apps professionals)
Tots els editors fan servir les mateixes peces, no còpies; una funcionalitat nova d'un editor es fa al mòdul compartit:
- **`PanelSplit`** + `SplitHandle` (`components/`): panells amb vora arrossegable, sobre el **`Splitter` de Chakra** (només el
  configura: amplades en px recordades, mínim i màxim, plegar; al mòbil, en columna i sense vores). Al `Workspace`, a la Foto
  i a la columna de l'Assistent. Cap altra vora feta a mà.
- **`Workspace`** + `useWorkspace(id)` (`components/`): estructura · visor · propietats, vores arrossegables, plegar amb els
  botons de les cantonades, pestanyes Estructura · Propietats al mòbil, amplades recordades; a l'Editor i als Ambients.
  `extra` (l'Assistent de l'Editor i dels Ambients): un segon panell a la columna de la dreta, pestanyes Propietats · <extra> a dalt
  a l'ordinador i una tercera pestanya al mòbil; es munta el primer cop i es queda muntat.
- **`shrinkImage`** (`lib/imageShrink.ts`): l'única funció per reduir imatges (foto del lloc, plànol de fons dels
  ambients, fotos per a l'assistent; `jpeg` = sempre JPEG sobre blanc).
- **`SceneHelpers`** (`StudioEnvironment`, `SceneAccess`) als visors 3D; **`RenderDialog`** a l'editor i als ambients;
  **`MoveGizmo`**, **`BoxFrame`**; **`ViewOptions`** / **`ViewTile`**.
- **`TreeRow`** · `TreeRowMenu` · `TreeSection` (`components/TreeRow.tsx`): fila d'arbre (sagnat, triada `wood.muted`,
  fletxa de plegar, menú ⋯, arrossegar), menú ⋯ (`TreeRowMenu`, sobre `ActionsMenu`) i títol de grup amb el + (o un menú, `menu`). Estructura de l'editor i arbre
  dels Ambients.
- **Desfer/refer comú** (`features/history/`): `history.ts` (pur, test: límit, ajuntar per temps `coalesceMs` o per
  `group`, canvis en viu `commit: false` + `commitHistory` en deixar anar, refer que es buida) i `useHistory` (React:
  `value`, `set`, `commit`, `undo`, `redo`, `reset`, `state`/`restore`); `useUndoKeys` amb `undoKeyAction` (`undoKeys.ts`,
  test; `scope` = una finestra amb desfer propi: només les tecles de dins) i els botons `components/UndoRedo` (`LuUndo2` · `LuRedo2`). Editor de
  mobles, Ambients i editor de perfils. Un editor nou amb desfer fa servir aquest, no un de propi.
- **`NameDialog`** (`components/`): posar un nom (grup nou, canviar el nom, mòdul nou), amb un nom per defecte seleccionat.
- **`ConfirmDialog`** (`components/ConfirmDialog.tsx`): **la confirmació d'esborrar**, una de sola (`Dialog` `alertdialog`):
  «Esborrar «x»?», el que passa acabat en «No es pot desfer.» i el botó vermell (`confirmLabel`, per defecte «Esborrar»;
  «Eliminar» per a un element, p. ex. un objecte de referència de Preferències). Galeries (Mobles, Objectes, Ambients, amb
  l'avís ««x» esborrat» en acabar), grups i referències.
- **`IconAction`** (`components/IconAction.tsx`): `IconButton` + `Tooltip` d'un cop (`label` = `aria-label` i, sense `tip`,
  el text del tooltip). Un botó d'icona nou es fa amb aquest.
- **`ActionsMenu`** (`components/ActionsMenu.tsx`): **el menú ⋯** (targetes, files de l'arbre, inspectors, barres): botó
  `LuEllipsis` amb el tooltip «Accions» i `aria-label` «Accions de «x»» (mai «Opcions de»), i el `Menu` de Chakra.
- **`AxisLabel`** (`components/AxisLabel.tsx`, abans dins de `RefInspector`): rètol d'una posició amb icona i lletra de l'eix
  amb el color de les fletxes del 3D: «De costat (X)», «Alçada (Y)», «Fondària (Z)». Objectes, peces, models i ambients.
- **`CardMenu`** (`features/projects/CardMenu.tsx`): el ⋯ de les targetes de document (Mobles, Objectes, Ambients) sobre
  `ActionsMenu`: «Desar com a fitxer…» · «Duplicar» · «Moure a un grup…» · «Esborrar», el mateix text, icones i ordre (només
  les accions que es passen).
- **Esborrar · Eliminar · Treure** (per decisió de l'usuari): **Esborrar** un document sencer (moble, objecte, ambient,
  historial, esborrany); **Eliminar** un element de dins d'un document (peça, paret, obertura, mòdul, objecte de referència,
  element d'un ambient, triats); **Treure** el que continua existint en un altre lloc (treure del grup, un adjunt, un mapa de
  textura).
- **`FloatingWindow`** (`components/FloatingWindow.tsx`, mides a `windowRect.ts` amb test): **la finestra**, una de sola
  per a tot el que s'obre per triar o editar (per decisió de l'usuari, 2026-10-15: «tot el que s'obre, una finestra com la
  del Render»). Embolcall del `FloatingPanel` de Chakra (`useFloatingPanel` + `RootProvider`): títol i, al costat,
  `subtitle` (la categoria, el progrés del Render); minimitzar (només la barra) · maximitzar (o doble clic a la barra) ·
  restaurar · ✕ a l'ordinador; es mou per la barra i s'estira per les vores i les cantonades. **No és modal**: l'app de
  darrere es continua fent servir. **Mida i lloc recordats per `id`** al navegador (`mobles:window:<id>`; en obrir-la,
  s'encongeix i es mou fins que hi cap, `fitWindowRect`); el primer cop, segons `kind`: **`picker`** (tries) estreta (380 px,
  480 la dels ferratges) i alta, enganxada a la dreta com el calaix d'abans; **`editor`** (editors i visors) gran (fins a
  1200 × 820, o la mida que demana: desar com a fitxer 520 × 380) i al mig de la zona de treball, sense tapar el menú
  lateral. **Al mòbil, sempre a tota la pantalla** (maximitzada, sense moure-la ni els botons de mida) dins de la zona segura
  (`&[data-maximized]`, els quatre costats). **Capes**: per sobre de les barres de l'app (`banner` + la pila de Chakra,
  `--z-index`) i per sota dels menús, popovers, avisos (toasts), tooltips i diàlegs, que s'obren des de dins d'una finestra i
  hi han de quedar per sobre (una confirmació d'«Eliminar» oberta des de l'editor del material); **entre finestres, la que
  es toca o té el focus passa al davant** (el focus ho fa sol; en tocar-la sense focus a dins, se li dona: Safari no el
  dona als botons). Una finestra que s'obre **des d'un diàleg modal** (el substitut d'«Eliminar material») va per sobre del
  diàleg; el diàleg porta `trapFocus={false}`, `persistentElements={WINDOWS_PERSIST}` i
  `onEscapeKeyDown={keepDialogOnWindowEscape}` (`windowRect.ts`). **Esc tanca la del davant** (la que té el focus; amb
  `dirty`, un nom a mig escriure, només el desfà; `closeOnEscape={false}` mentre es dibuixa amb la ploma o importa). **Focus**
  en obrir-se: el primer camp on s'escriu (el cercador d'una tria), un selector (`initialFocus`, el nom d'un material nou) o
  la finestra (`false`: al mòbil no surt el teclat); en tancar-la, torna on era. `footer` (Cancel·lar · Aplicar, sempre a la
  vista), `split` (editors de Preferències: la mostra i el formulari de costat a l'ordinador gran) i `bodyProps`.
  - **Què és finestra**: Render (`RenderFrame`), els editors de materials i de
    ferratges de Preferències, «Afegir un material» (`MaterialLibrary`), «Editar la textura», «Forma de la secció»
    (`ProfileEditor`), «Importar un model 3D», «Desar … com a fitxer» (moble i ambient), Vista CAM i «Veure a casa» (AR).
  - **Què és `Dialog`** (modal, Chakra): les confirmacions («Esborrar «x»?» de `ConfirmDialog`, «Eliminar …?» de materials i ferratges, «Ja hi ha
    un render», «Començar una conversa nova?», esborrar l'historial, restaurar valors inicials) i les preguntes d'un sol camp
    que aturen el que s'estava fent (`NameDialog`, «… per a…» d'un ambient del catàleg, «Mida real» del plànol, «Moure a un
    grup»). Res més: un `Dialog` nou per editar o triar és una `FloatingWindow`.
  - **Calaixos de tria (no són finestra**, per decisió de l'usuari, 2026-10-15: «els drawers no eren finestres»): les tries de
    material i de ferratge (`PickerDrawer`), la fitxa d'una peça de les col·leccions i «Afegir un moble / objecte» d'un
    ambient (`AmbientPicker`): calaix lateral de Chakra (`Drawer`), modal.
  - **Altres que no són finestra**: «Opcions de vista» (`ViewOptions`: un popover enganxat al botó; al mòbil, un full de
    baix) i l'Assistent (columna a l'ordinador; al mòbil, un calaix no modal a pantalla completa).
  - **Tries lligades a la selecció**: com que no són modals, l'inspector de l'editor de mobles i el dels ambients es
    tornen a muntar quan canvia la selecció (`key`): les tries que s'hi havien obert es tanquen (si no, triar aniria a
    parar al que s'ha seleccionat després). Dins d'un editor de Preferències passa el mateix en canviar d'element (`key`).
  - **Teclat**: les dreceres de l'editor de mobles i dels ambients (Supr, fletxes, ⌘C/⌘V, Esc, desfer) no fan res amb el
    focus dins d'una finestra o amb un diàleg modal obert; amb una finestra oberta i el focus a la pàgina, sí
    (`lib/keyTarget.ts`, `undoKeys.ts`). L'editor de perfils només escolta les tecles de dins de la seva finestra.
- **`PickerDrawer`** (`components/PickerDrawer.tsx`: `PickerDrawer`, `PickerButton`, `PickerRow`): el calaix de tria dels
  selectors (a la dreta a l'ordinador, des de baix al mòbil; cercador a dalt amb el focus). El fan servir el
  `MaterialSelect` i el **`HardwareSelect`** (tria d'un ferratge al moble, vegeu Preferències › Ferratges).
- **Plànols acotats** (`components/dims.ts` + `components/DimLine.tsx`): totes les cotes dels dibuixos 2D (pla del
  muntatge, generador, vistes DXF, peça d'exemple, col·locació). **`StepRuleRows`** (`components/StepRuleRows.tsx`): les
  regles de graons (frontisses per alçada, distància del tirador, còpies d'un col·locat per mida).
- **`MaterialSelect`** (`settings/MaterialSelect.tsx`) a tot arreu on es tria un material (amb **cercador** a dalt de la finestra de tria,
  pel nom i sense accents, que obre les categories amb resultats): un **botó** (fons suau, a tota
  l'amplada, sense fletxa ni icona: no ha de semblar un desplegable) amb la mostra i el nom que obre la calaix de tria (`PickerDrawer`: a la dreta
  a l'ordinador, des de baix al mòbil) amb un acordió per categoria i les mostres (només de la categoria oberta); en tocar-ne una es
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
  `foldContext.ts`, estat de sessió a `sessionState.ts`): inspectors, Render, Foto, Exportar, galeries, finestra de tria de materials
  i eines de la màquina. Res d'`Accordion`/`Collapsible` de Chakra ni de plegables propis fora
  d'aquí. `FoldItem`: `id`, `icon` (del catàleg, obligatòria a les seccions), `title`, `badge`/`badgePalette`, `count`,
  `description` (sempre), `summary` (tancat), `actions` (al costat de la capçalera, mai a dins), `header` (fila de taula).
  Variants: `section` (inspectors i Render: icona + títol + insígnia + fletxa, sense fons; `size="sm"` per a subseccions),
  `gallery` (`.gallery-accordion`), `nested` (`.inner-accordion`, categories), `card` (vora i resum: taulells, forats) i
  `row` (fila de taula desplegable: eines).
  - **Una sola oberta alhora a tota l'app** (per decisió de l'usuari, 2026-10-14: «a tots els acordions el mateix»).
  - **Sol** (sense `FoldGroup`): **comença tancat** (llevat de `defaultOpen`, p. ex. els xocs amb l'obertura actual), es
    recorda durant la sessió (`mobles:section:<id>`) i, en obrir-lo, tanca els sols germans del mateix nivell (`SoloScope`:
    l'arrel o el contingut d'una mateixa secció; les subseccions no tanquen la seva secció).
  - **`FoldGroup`**: un acordió compartit; per defecte un obert alhora (`multiple` per a diversos); estat controlat
    (`value`), de la sessió (`storageKey`) o intern; `forceOpen` = la cerca de les galeries (n'obre les que calgui).
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

#### Navegació i barres
- **Menú global sempre igual** (`App.tsx`, `GLOBAL_NAV`, com Figma o Linear): **Mobles · Ambients · Objectes** i, a baix de
  tot, Preferències (igual a la barra de baix del mòbil); l'apartat del document obert queda marcat (`section`). L'app s'obre
  a Mobles (el primer del menú) si no hi havia res obert. **Cada apartat recorda l'últim obert** (`mobles:last-object`, `mobles:last-moble`): clicar
  Objectes o Mobles hi torna si encara existeix; tornar a la llista («Mobles ›», la fletxa o clicar l'apartat del document
  obert) el deixa d'obrir. **Les accions d'un apartat van a la seva pàgina** (el botó principal, al costat del cercador), mai
  al menú.
- **Barra superior del document** (`components/TopBar.tsx`, `DocBar` per a moble, objecte i ambient —`AmbientTopBar`—, com
  Figma/Onshape/Notion): `Mobles › Nom` a l'esquerra (nom editable) i les accions del document a la dreta, que cada pàgina hi
  posa amb `<TopBarActions>` (desar, desfer, refer). Les pàgines **no porten títol propi** ni capçaleres pròpies. Les pàgines
  d'un moble (`PROJECT_NAV`) són **pestanyes al mig de la barra** (`ProjectTabs`, un `SegmentGroup`, a la prop `tabs` del `TopBar`); al mòbil, en una
  **franja a sang sota la barra de dalt** (`MobileProjectTabs`, `Tabs` variant `line`, tots dos a `app/ProjectTabs.tsx`: icona a sobre i nom a sota, la triada amb el color principal i una ratlla): la barra
  de baix és **sempre el menú general** (com les apps de l'iPhone).
- **Mòbil sense títols repetits**: les pàgines d'inici porten el seu títol gran (com iOS) i no hi ha barra de dalt; només n'hi
  ha quan cal tornar enrere. **Un sol «‹ Tornar» a la vista** («‹ nom del moble», «‹ Preferències», «‹ Màquines CNC»;
  `useSessionString` es manté igual entre components amb la mateixa clau; `DETAIL_KEYS`). Les finestres (`FloatingWindow`,
  maximitzades al mòbil) respecten la zona segura als quatre costats amb `&[data-maximized]`; els calaixos a pantalla
  completa (l'Assistent al mòbil), la de dalt, també el botó de tancar.

#### Mides d'iOS a les pantalles tàctils
- `src/theme/layout.css`, `@media (pointer: coarse)` (CSS sense capa: guanya a les de Chakra): es canvien les variables dels
  tokens. Text `sm`/`md` 17, `xs` 13, `2xs` 11, `lg` 20, `xl` 22; controls (`sizes` 8–11) 40 / 44 / 44 / 48 (mínim tàctil
  d'Apple: 44); interlineat 1,3; camps on s'escriu a 17 (amb menys de 16, Safari fa zoom). `FormRow` centra l'etiqueta amb
  `--form-row-label-pt`. Barra de baix com la d'iOS (icona 24, nom 2xs). Al tàctil també: noms de les targetes (`.card-title`)
  a 15 en dues línies, capçaleres d'acordió de 48, opcions dels controls segmentats (`.seg-item`) de 44 × 44 i camps numèrics
  **sense les fletxetes + −** (es fa servir el teclat numèric, `inputMode`). A l'ordinador, les mides de Chakra (sm = 14).
- **La mateixa estructura a l'ordinador i al mòbil** (per decisió de l'usuari), com la Configuració d'iOS/macOS: files de
  formulari (`.form-row`) enganxades amb una línia fina, marges de les targetes de Preferències i de les seccions
  (`.settings-group-*`, `.form-section`: 20, al tàctil 16) i 32 entre grups (`.settings-stack`). **Només canvien les mides.**

# Objectes i galeries

> Tret del `CLAUDE.md` (2026-10-15) perquè no es carregui sencer a cada sessió. Llegeix-lo abans de tocar aquesta part.

### Objectes
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

### Galeries (Mobles · Ambients · Objectes)
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

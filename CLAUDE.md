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

## Mòduls compartits (com les apps professionals)
Tots els editors fan servir les mateixes peces, no còpies: **`Workspace`** + `useWorkspace(id)`
(`components/`: estructura · visor · propietats, vores arrossegables, plegar amb els botons de les
cantonades, pestanyes Estructura · Propietats al mòbil, amplades recordades per editor) a l'Editor
de mobles i objectes i als Ambients; **`SceneHelpers`** (`StudioEnvironment`, `SceneAccess`) als
visors 3D; el **`RenderDialog`** (render per CPU) a l'editor i als ambients; **`NewMobleGallery`**,
`TemplateCard`, `ProjectCard` i `GALLERY_COLS` a Mobles, Objectes i a les finestres dels ambients;
la **`GalleryCard`** (`projects/GalleryCard.tsx`: totes les targetes de les graelles, en el mateix ordre: miniatura · nom de dues línies · què és · descripció · etiquetes (color principal) i preu a baix · peu amb data i ⋯) a historials, grups i catàlegs; el **`NameDialog`** (`components/`) per posar un nom (grup nou, canviar el nom, mòdul nou), amb un nom per defecte ja seleccionat; el **`MaterialSelect`** (`settings/MaterialSelect.tsx`) a tot arreu on es tria un material: un **botó** (fons suau, a tota l'amplada, sense fletxa ni icona: no ha de semblar un desplegable) amb la mostra i el nom
que obre un calaix (a la dreta a l'ordinador, de baix al mòbil) amb un acordió per categoria i les mostres de la textura
(només les de la categoria oberta); en tocar-ne una es tria i es tanca. `emptyLabel` per a «Com el cos», «Com a
Preferències», «Tots els altres», «Cap (fantasma)». Una funcionalitat nova d'un
editor es fa al mòdul compartit perquè la tinguin tots.

## Objectes (per als ambients)
- Un objecte (sofà, làmpada, planta…) és un
  moble del tipus **`objecte`** (`partsOnlyKind`: només peces lliures, com el Flat-pack): s'edita
  amb el **mateix Editor** (peces amb forma, «Talla» per als forats, materials de preferències per
  categories), però **no es fabrica** (`buildComposition` en treu el nesting i els encaixos; al menú
  només hi ha l'Editor; la molla de pa diu «Objectes»). `OBJECT_TEMPLATES` (`ambient.ts`): els blocs
  d'abans (sofà, llit, nevera…) i cadira, làmpada de peu, planta, mirall i taula rodona amb peces
  rodones. **Objectes de revista** (`magObjects.ts`, `MAG_OBJECTS`, amb les formes de `objectShapes.ts`:
  `ellipse`, `roundRect` per als coixins, `leaf`, `wave` per als plecs de les cortines, `blob` per a
  capçades i pufs): sofàs amb coixins i en L, daybed, butaques, cadires, quadres, miralls, tele, cortines,
  llums de sostre, plantes (tropical, olivera, pi pinyoner, jardinera), catifes, taules… Tot és geometria
  (perfils extrudits), no física ni shaders: així el render per CPU ho veu igual que el visor. **Mides al mm**: les formes calculades
  donen decimals llargs; `tidyMm`/`tidyPart` (`freePart.ts`) arrodoneixen al mm els valors amb més d'un decimal
  (els de l'usuari, com 22,5, es queden) en crear l'objecte i en carregar-lo (`normalizeComposition`). Materials de
  simulació nous a la **v4** de les preferències (estucs, travertí, pedra de paret, vellut oliva, bouclé,
  tul, cuir, jute, kilim, fulles, escorça, ceràmica, llautó, mirall…; la migració afegeix els que falten).
  Pàgina `objects/ObjectsScreen` (`ObjectsGallery`: cercador, En blanc, els teus i
  plantilles). No surten a l'historial de Mobles (`isObject`). Als ambients, «Objecte» obre la
  galeria a pantalla completa; s'hi col·loquen com els mobles (enllaçats). Els blocs antics
  (`kind: "block"`) es continuen veient.

## Menú principal
- Ordre: **Ambients · Objectes · Mobles** (i Preferències a sota; igual a la barra de baix del mòbil).
  L'app s'obre a Ambients si no hi havia res obert.
- Cada apartat **recorda l'últim obert** (com Ambients): clicar Objectes o Mobles torna a l'últim
  objecte / moble obert (`mobles:last-object`, `mobles:last-moble`) si encara existeix; tornar a la llista
  («Mobles ›» o la fletxa) el deixa d'obrir.

## Ambients (plànol de la casa amb els mobles)
- Apartat propi al menú (el primer; al mòbil, a la barra de baix): els Mobles es dissenyen i es fabriquen; els Ambients són on es col·loquen.
- Model a `core/model/ambient.ts` (`Ambient`: `walls`, `items`, `plan`, materials del terra i de
  les parets), Dexie v4 (`ambients`, `data` validat amb `parseAmbient`). Plànol en mm, x a la
  dreta i y avall; al 3D X = x, Z = y. Els elements van pel **centre** de la petjada i giren al
  voltant del centre (graus, horari vist des de dalt); sense girar, el darrere mira amunt.
- **Mobles enllaçats** (`item.kind = "moble"`, `projectId`): és el mateix moble de la llista.
  A l'ambient només se'n toquen les **mides generals** (`resizeComposition`: escala amplades,
  separacions, alçades amb potes/sòcol/penjats, fondàries, mides fixes de zones i calaixos, peces
  lliures, objectes i models 3D; els gruixos no) i la posició; «Obrir a l'editor» per a l'interior.
  «Moble» obre una **finestra a pantalla completa** (`Drawer` full) amb la mateixa pàgina de
  Mobles (`NewMobleGallery`: historial, les teves, les de l'app i les de botiga, amb filtre i
  cercador); a l'historial, «Afegir»; una plantilla crea el moble a Mobles i el col·loca. Els
  mobles que ja són en un ambient porten la marca de l'ambient (`useAmbientMembership`,
  `ProjectCard`): a la pàgina Mobles i, destacada (✓ i vora), a la finestra de l'ambient obert.
- **Blocs** (`kind = "block"`, `BLOCK_PRESETS`, `blockComposition`): caixa, sofà, llit i taula fets
  de peces lliures sense nesting amb materials de simulació (i un segon material: matalàs,
  coixins). Tot (mobles i blocs) es dibuixa amb el mateix camí: build → peces → `buildScene`.
- **Editor** (`features/ambients/AmbientEditor.tsx`): plànol SVG (`PlanCanvas`) com Figma: roda o
  dos dits per desplaçar, Ctrl/⌘ + roda o pessigar per fer zoom, espai + arrossegar. Eines
  **Seleccionar** (V), **Paret** (P, ploma: clic a clic, angle a 15°, imant als extrems, clicar
  el primer punt tanca, Retorn/Esc/doble clic acaben), **Habitació** (H, rectangle → 4 parets),
  **Calibrar** (dos punts del plànol de fons i la mida real). Maj: sense angles; Alt: sense
  imant. Arrossegar una paret mou les enganxades; els extrems de la seleccionada s'arrosseguen.
  Els elements s'arramben a les cares de les parets (`snapToWalls`), R gira 90°, fletxes (Maj ×10),
  Supr, Ctrl/⌘ D, desfer/refer (Ctrl/⌘ Z). Es desa sol. **Plànol de fons**: imatge (2400 px,
  JPEG) escalada amb la calibració, opacitat i bloqueig.
- **Grups d'elements** (`AmbientItem.group`; `setItemGroup`, `moveItems`, `rotateItems`,
  `duplicateItems`, `removeItems`): la llista d'elements és com l'arbre de l'editor (grups plegables
  i menú ⋯ a cada fila: duplicar, grup nou, posar a un grup, treure del grup, obrir a l'editor,
  treure de l'ambient). Com Figma, el primer clic a un element agrupat (al plànol o al 3D) tria el
  grup i el segon l'element; Supr, Ctrl/⌘ D, R i les fletxes valen per a tot el grup; inspector del
  grup (nom, posició, girar, duplicar, desagrupar, eliminar).
- **Pestanyes Plànol · 3D** a dalt al mig del visor (com 3D · Alçat · Foto a l'editor) i les eines de dibuix en columna a l'esquerra del plànol.
- **Opcions de vista** (`components/ViewOptions`: `ViewOptions` + `ViewTile`, els mateixos botons que
  l'editor), a dalt a la dreta: al plànol encabir, graella, mides, noms, peces, imant, plànol de fons
  i render; al 3D enquadrar, casa de nines, ombres i render.
- **Plànol**: la roda fa zoom al punt del ratolí (com al 3D), pessigar també, arrossegar el fons
  desplaça; − / + i l'escala de pantalla (1:50…) a baix a la dreta; la barra d'eines flota a dalt.
- **Les tres pàgines (Mobles, Objectes, Ambients) fan igual**: títol amb el **botó principal a sota** (`PageHeader`)
  («Nou ambient» · «Nou objecte» · «Nou moble», `colorPalette="wood"`, com Importar/Exportar a
  Preferències; en blanc, `projects/blank.ts`), text descriptiu, cercador, **Historial** (els que ja
  tens) i acordions tancats (plantilles / catàleg). Les finestres «Afegir» dels ambients porten el mateix
  botó a la capçalera (`createAndAdd`).
- **Catàleg d'ambients** (`core/model/ambientTemplates.ts`, `AMBIENT_TEMPLATES`): habitacions «de
  revista» per fer renders per a la web (saló nòrdic, saló de noguera, menjador, cuina amb illa,
  dormitori, juvenil, despatx, rebedor, bany). Referències a plantilles (`store:<cat>:<nom>`,
  `app:<id>`, `object:<id>`), col·locades arrambades a una paret (N/S/E/O, `placeTemplateItem`) o
  lliures. `createAmbientFromTemplate` (`features/ambients/fromTemplate.ts`) crea cada moble i objecte
  (un per plantilla) i l'ambient enllaçat; `templatePreview` fa la miniatura.
- **«Catàleg», igual a les tres pàgines** (`projects/CatalogSection`, per decisió de l'usuari): l'última secció d'Ambients,
  Objectes i Mobles es diu **Catàleg** (icona `LuBookOpen`), amb una línia d'explicació i un acordió per categoria: escenes
  per habitació, objectes per tipus (`OBJECT_CATEGORIES` / `objectCategory` a `core/model/objectCategories.ts`: sofàs i
  seients, taules, llits, quadres/miralls/cortines, llums, plantes, catifes i tèxtils, electrodomèstics, blocs) i les
  plantilles per a botigues de mobles per categoria. La cerca obre les categories que coincideixen.
- **Catàleg per categories** (`AMBIENT_CATEGORIES`, `AmbientTemplate.category`: salons, cuines, menjadors,
  dormitoris, infantils, vestidors, rebedors, despatxos, banys, exteriors), un acordió per categoria; la
  cerca també busca la categoria i obre les que coincideixen.
- **Miniatures 3D a les targetes** (per decisió de l'usuari, en lloc dels dibuixos de línies): **sense cap 3D viu per
  targeta** (a l'iPhone farien tancar la pàgina). Mobles, objectes i plantilles: `components/viewer/thumbRenderer.ts`, un
  sol renderitzador fora de pantalla (s'allibera quan la cua és buida) que pinta les peces amb els materials reals sobre el
  terra i la paret de l'escena de Presentació, amb ombres, en un JPEG 2:1 de 480 px; cua d'una en una quan el navegador
  és lliure (`projects/projectThumbs.ts`). Es desa al projecte (`Project.thumb`, `thumbAt` = l'`updatedAt` que retrata,
  `thumbV` = `THUMB_VERSION`: si canvia, es refan); les de plantilles, només en memòria. Ambients: igual, fora de pantalla
  (`ambients/ambientThumbs.ts`): terra, parets (sense les de davant, com la casa de nines) i els mobles i objectes de debò,
  vist de dalt i de davant; els de l'usuari es desen (`AmbientRow.thumb`, `thumbAt`, `thumbV`) i els del catàleg, en
  memòria (amb les plantilles de les seves referències). Tot passa per la mateixa cua (`enqueueThumb`).
  Les dels ambients, **sense fons** (PNG transparent: al voltant de l'habitació es veu la targeta); les dels mobles, JPEG. `SnapshotThumb` (2:1, no retalla, sense fons); sense foto encara, el mateix requadre 2:1 buit (res de dibuixos de línies d'una altra mida: la graella no salta mentre es van fent). Cal `scene.updateMatrixWorld(true)` abans de
  mesurar la caixa (les peces porten la matriu feta).
- **Grups (carpetes)** a l'historial de Mobles, Objectes i Ambients
  (`Project.folder`, `AmbientRow.folder`, `UserTemplate.folder`; `setProjectsFolder`, `setAmbientsFolder`,
  `setUserTemplatesFolder`): menú ⋯ de cada targeta (desar com a fitxer, duplicar, **moure a un grup…**,
  esborrar; el mateix a totes) i `MoveToFolderDialog` (un grup existent, un de nou o treure'l). Es
  mostren amb `FolderedGrid` (`projects/Folders.tsx`): primer els grups plegables (⋯: canviar el nom,
  desagrupar) i després els que no en tenen; la cerca obre els grups amb resultats.
  **Historial i Projectes** (Mobles, Objectes i Ambients): primer l'**Historial** (el que és de pas, sense grup; la
  «graella de batalla») i a sota **Projectes** (el que es desa en un grup, p. ex. un per client; `FolderedGrid
  show="loose"|"folders"`). «Esborrar l'historial» no toca els Projectes. **Modificats** (`Project.edited`, posat per
  `updateProjectComposition`; `isEdited` per als antics): a l'historial porten l'etiqueta «Modificat» i, en esborrar
  l'historial, s'avisa que es perdrien els canvis i es pot «Esborrar només els no modificats». Els mobles d'una escena
  del catàleg van a l'Historial (o al grup del client, si se n'indica un).
  **Grups propis** (p. ex. un per client): **«Grup nou»** (nom i després es toquen les targetes que hi van) i
  «Seleccionar» a la fila d'eines de l'historial (`FolderedGrid selection`,
  amb `toolbar` per a «Esborrar l'historial») marca diverses targetes i les **mou totes a un grup** (un que ja hi
  és o un de nou) o les esborra (els mobles i objectes que són en un ambient es conserven).
  **Ambients per a clients**: una escena del catàleg **s'obre directament** i va a l'Historial (sense preguntar res;
  per decisió de l'usuari). Per fer-ne la d'un client, al menú ⋯ de l'ambient, «Duplicar (per a un client)…»
  (`duplicateAmbient`): es diu «escena · client», duplica els mobles i objectes enllaçats i ho posa tot al grup del
  client: dos clients amb la mateixa escena no comparteixen cap moble.
- **Esborrar l'historial** (`projects/ClearHistory.tsx`, el mateix a Mobles, Objectes i Ambients): a dalt de
  l'historial, amb confirmació. A Mobles i Objectes es conserven els que són en algun ambient; a Ambients
  s'esborren els ambients (els seus mobles es queden). Respecta la cerca.
- **Escenes amb plantes de debò** (`PLANT_SCENES`, les primeres del catàleg): Jardí amb xicranda, Terrassa entre avets, Saló de falgueres i Rebedor verd (models 3D, `F(id)` = `object:object-model-<id>`).
- **Escenes de revista** (`MAG_SCENES` a `ambientTemplates.ts`): 14 habitacions fetes
  a partir de fotos d'interiors (saló d'estuc, golfes, rebedor, pati amb cuina exterior, saló amb kilim,
  terrassa, cuines verd fosc / illa negra / greige / roure, menjador de pedra, vestidor, lliteres, menjador
  amb cortines). La plantilla pot dur `height`, `walls` (material per costat), `low` (ampits), `open`
  (costats sense paret) i `openings`; `templateWalls` en fa les parets. Mobles nous amb `mag:<id>`
  (`magFurniture.ts`, `MAG_FURNITURE`, fets amb `storeBuilders` del catàleg de botiga).
- **Finestres i portes**: eines **Finestra** (F) i **Porta** (D) del plànol: clic sobre una paret
  (`nearestWall`, `addOpening` amb `OPENING_DEFAULTS`, `clampOpening`); al plànol s'arrosseguen al llarg
  de la paret; a l'inspector de la paret, «Finestres i portes» (tipus, centre, ample, alt, ampit, fulles;
  + Finestra · Porta · Vidriera) i el material d'aquella paret.
- **Parets amb material propi i obertures** (`Wall.material`, `Wall.openings`: finestra amb ampit de pedra,
  porta amb fulla, vidriera de terra a sostre amb travessers): `wallOpenings`, `wallSegments` (trossos
  massissos al voltant dels forats) al 3D; al plànol, el forat amb el vidre o l'arc de la porta. El vidre
  porta `userData.glass` (el render per CPU el fa translúcid) i `baseOpacity` (la casa de nines el respecta).
- **Panells de l'editor d'ambients com els de l'editor**: l'inspector (element, bloc, paret, grup, ambient) en seccions plegables `PanelSection` (Posició, Mides generals, Bloc, Mides i material, Finestres i portes, Parets noves, Acabats, Plànol de fons, Elements); la llista de l'esquerra, amb el títol «Elements» i «+ Moble» · «+ Objecte» a la dreta (com els grups de l'arbre).
- **3D**: la mateixa navegació que l'editor (esmorteïment, roda, botó dret per desplaçar), clic per
  seleccionar (caixa taronja; Supr, Ctrl/⌘ D, R i fletxes com al plànol), «Enquadrar» i «Render». **L'element seleccionat es mou
  amb les fletxes del gizmo** (`MoveGizmo` compartit amb l'editor, X i Z; el cos no s'arrossega, per decisió de l'usuari;
  com al plànol: el primer clic tria el grup, quadrícula, imant a les parets amb un sol element només en la direcció de la
  fletxa, Alt sense imant, un sol pas de desfer). Ratolí a sobre: contorn prim (`BoxFrame`); seleccionat, gruixut. Les peces d'un element
  només es refan si en canvia la geometria o els materials (moure'l només en canvia la posició) i les que ja no es
  dibuixen s'alliberen. La càmera mira el punt de l'obertura (o d'«Enquadrar»), no segueix la caixa de l'ambient.
  **Interior** (Opcions de vista, `LuEye`, `eyePose`): entra a l'habitació, càmera anivellada a 1,35 m (verticals rectes) al costat de la
  paret de davant mirant la del fons, angular (fov 55; «Enquadrar» torna a 40), per als renders de revista.
  La pestanya Plànol · 3D es recorda (`AMBIENT_TAB_KEY`); els ambients creats del catàleg s'obren al 3D.
- **Fons del 3D dels ambients**: el visor és transparent i a l'editor hi ha el gris del plànol (`bg.subtle`); el render per CPU fa servir el clar de sempre (`scene.userData.renderBackground`, `sceneData.ts`).
- **3D** (`Ambient3D`): terra i parets amb `surfaceMaterial` (textura a mida real), mobles i blocs
  amb les textures del visor; les parets entre la càmera i l'habitació es fan transparents
  (casa de nines).

## Icona i pantalla d'inici de la PWA
- **Icones a sang**: quadrat sencer amb el fons `#1a202c`, **sense cantonades rodones ni
  transparència** (iOS i Android hi posen la màscara; si l'icona ja és arrodonida, les puntes
  surten blanques). Font: `public/icon.svg` → `pwa-192/512.png`, `apple-touch-icon.png` (180).
  `pwa-maskable-512.png` (`icon-maskable.svg`): la marca al 78 %, dins de la zona segura d'Android.
  El `favicon.svg` de la pestanya sí que és arrodonit (té transparència, no blanc).
- **Pantalles d'inici d'iOS** (`public/splash/`, `apple-touch-startup-image` a `index.html`): una
  per mida d'iPhone i iPad i per orientació (marca, «Mobles» i «Configurador de mobles per a
  CNC» en Inter). No es precachegen (`globIgnores`): les desa iOS en instal·lar l'app. Les PNG
  es generen des de l'SVG (no s'editen a mà).

## UI (Chakra v3 + react-icons)
- Mobile-first: la faig servir sobretot a l'iPhone. Mínim breakpoints `base` i `md`.
- **Menú global sempre igual** (`App.tsx`, `GLOBAL_NAV`, com Figma o Linear): Ambients · Objectes ·
  Mobles i, a baix de tot, Preferències; l'apartat del document obert queda marcat (`section`).
  **Les pàgines d'un moble** (`PROJECT_NAV`: Editor, Peces, Nesting, Exportar) són **pestanyes al mig
  de la seva barra superior** (`TopBar tabs`), no al menú; al mòbil, en una **franja a sang sota la barra de dalt**
  (`mobileProjectTabs`: de vora a vora, icona a sobre i nom a sota, la triada amb el color principal i una ratlla): la barra de baix és **sempre el menú general** (com les apps de l'iPhone), i així es
  pot saltar entre documents oberts (cada apartat recorda l'últim obert). **Les accions d'un apartat van a la seva capçalera** (p. ex. «Obrir
  fitxer» a Mobles), mai al menú. Clicar l'apartat del document obert torna a la llista.
- **Mòbil sense títols repetits**: les pàgines d'inici porten el seu títol gran (com iOS) i no hi ha
  barra de dalt; només n'hi ha quan cal tornar enrere (Preferències des d'un moble: «‹ nom del moble»).
  **Un sol «‹ Tornar» a la vista**: a la llista d'apartats «‹ nom del moble», dins d'un apartat «‹ Preferències»
  i amb un element obert «‹ Materials» (`useSessionString` es manté igual entre components amb la mateixa clau;
  `DETAIL_KEYS`).
  Els diàlegs i calaixos a pantalla completa respecten la zona segura (`env(safe-area-inset-top)`), també
  el botó de tancar.
- **Barra superior del moble obert** (`components/TopBar.tsx`), com Figma/Onshape/Notion:
  `Mobles › Nom del moble` a l'esquerra (nom editable; "Mobles" torna a la llista) i les
  accions del document a la dreta. Cada pàgina hi posa les seves amb `<TopBarActions>`
  (l'Editor: desar, desfer, refer). **Les pàgines no porten títol propi**: l'apartat ja es
  veu marcat al menú. Al mòbil, la mateixa barra amb fletxa enrere.
  **La mateixa barra per a tots els documents** (`DocBar`: moble, objecte i ambient —`AmbientTopBar`,
  «Ambients › nom», amb desfer/refer via `<TopBarActions>`); no hi ha capçaleres pròpies dins les pàgines.
- **Pàgina Mobles = inici, com Figma o Google Docs** (`projects/NewMobleGallery.tsx`, sense
  botó «Nou moble» ni diàleg): text descriptiu, **cercador** (sense filtre de tipus: el tipus també
  es busca), botó «Nou moble» a la capçalera i acordions **tots tancats**
  en obrir l'app (l'estat es recorda durant la sessió, `mobles:gallery`): **Historial**, **Projectes**
  i **Catàleg** (les plantilles per a botigues de mobles) (les «teves plantilles» i les «de l'app» ja no hi són: les teves
  es van convertir en mobles del grup «Les meves plantilles», `migrateUserTemplates`); el **cercador** (sense accents; obre
  les seccions i categories amb resultats) valen per a tots. Totes les graelles fan servir
  `GALLERY_COLS` (`projects/galleryGrid.ts`) i la mateixa targeta petita (les del historial, amb
  les accions a sota; les de botiga, en una sola graella per categoria amb el tipus a la targeta). Un `.moble`
  (també les plantilles exportades abans, `kind: "plantilla"`) **s'obre sempre com a moble**; el menú ⋯ de la barra
  superior ja no té «Desar com a plantilla».
- **Pàgines del moble, cadascuna amb un sol propòsit**:
  - **Peces**: taula (peces iguals agrupades) + **plànol de la peça seleccionada** al costat.
    Al mòbil, una **targeta per peça** (mides, material, veta, forats, cantells) i la triada porta el plànol a dins.
    Els plànols no van a Exportar.
  - **Exportar**: per destinació (STEP de TopSolid · CSV de TopSolid · CNC · Llista de tall · Model
    3D), una acció principal per grup; les eines de depuració (JSON UnifiedData) plegades a «Avançat».
  - **Un sol STEP** (`toStepCad` a `export/step.ts`, conjunts de `stepCadGroups`), per obrir el moble
    a TopSolid i continuar-lo treballant **i** per al taller (amb el `_res.csv`): conjunt arrel (el
    moble) › un subconjunt per mòdul («1. Baix»), «Taulell i sòcol» i les peces lliures (per grup) ›
    una peça per tauler amb el nom (`label`), el material i les mides a la descripció i el color del
    material (`STYLED_ITEM`, `finishRgb`); ingletes de debò (cara A retallada i cares a 45°; els
    buidats s'escurcen fins a l'inglet), booleans 3D (`solidCuts`), talls i forats de les peces amb
    forma i peces sense nesting. Validat amb OpenCascade (sòlids vàlids, volum positiu, sense
    autointerseccions) i amb els parsers del taller: `taller.roundtrip.test.ts` comprova que llegeix
    igual que el STEP pla `toStep` (mateixes peces, rols, forats, cantells i buidats). `toStep`
    queda per als tests i el JSON de depuració. Les peces amb base mirall s'escriuen amb els bucles
    girats. Si dos mecanitzats encara es creuen per dins, el STEP en deixa un fora i avisa.
  - **Forats que es trobarien per dins** (`build/holeClash.ts`, `resolveHoleClashes`, a
    `buildComposition`): System 32 a banda i banda d'un divisor → tots dos a (T − 1)/2 (1 mm de
    matèria al mig); espiga de cantell contra un forat de cara (guia) → l'espiga s'atura 1 mm abans
    (mínim 10 mm, si no avís `hole-clash`). Forats de guia de la caixa del calaix: no arriben a la
    ranura del fons.
  - **Fast Refresh**: un fitxer `.tsx` només exporta components; constants i utilitats a part
    (`composition/partOrient.ts`), si no Vite fa «hmr invalidate» i recarrega la pàgina.
    **El nom del `.ts` no pot coincidir amb el del `.tsx` si només canvien majúscules** (`MaterialLibrary.tsx` i
    `materialLibrary.ts`): al Mac (disc sense majúscules) `./MaterialLibrary` obre el `.ts` i l'app surt en blanc;
    per això les dades són a `libraryItems.ts`.
  - **AR («Veure a casa»)**: botó del visor 3D (`LuView`), no una exportació.
- **Editor en tres columnes, com Figma / Fusion 360** (`features/editor/EditorScreen.tsx`):
  - **Esquerra — Estructura** (`composition/StructureTree.tsx`): arbre moble › mòduls ›
    compartiments, i objectes de referència. Afegir/duplicar/moure/eliminar amb el menú ⋯.
    **Un + a cada grup** (Mòduls · Peces lliures · Objectes de referència; per decisió de l'usuari, així es veuen els tres
    tipus): demana el nom (`NameDialog`, per defecte «Mòdul 3», «Peça 2», «Objecte 1», seleccionat; `addElements.ts`) i
    crea l'element sense més opcions: caixa bàsica, peça de cara, caixa de 600 × 600 × 100. Res de mòduls especials,
    passacables fets ni plantilles al +: es configura a l'inspector.
  - **Models 3D** (`Composition.models`, `ModelObject` a `model/composition.ts`: `src` = id de `MODEL_ASSETS`
    (`model/models.ts`), cantonada x/y/z i caixa w/h/d en mm, `rot` en graus al voltant del vertical): malles `.glb`
    que **només es veuen** (no es fabriquen). Ara, falgueres de Poly Haven (CC0) a `public/models`, textura 1K WebP amb el
    retall de les fulles a l'alfa (`alphaTest`, només als materials que ja eren amb alfa: l'escorça opaca queda normal).
    `viewer/models3d.ts` les carrega un cop (`loadModel`, `preloadModels` → `true` si hi són tots, `onModelsLoaded`; una
    càrrega fallida no es torna a provar fins passat 60 s) i `modelInstance` fa la còpia col·locada (m; geometria i
    materials compartits, `userData.sharedModel`: no s'alliberen per element). `releaseModelGpu` els treu de la GPU en
    alliberar el renderitzador de miniatures i en tancar el visor de l'editor o el 3D dels ambients (si no, els
    escoltadors de `dispose` mantenen vius els renderitzadors morts). Les miniatures amb un model que no s'ha carregat no
    es fan ni es desen. Surten als ambients, a les miniatures, a la Presentació, al render, a l'AR i al GLB/USDZ
    d'Exportar. El gir (`rot`) compta a les caixes (`modelFootprint`: enquadrar, plànol dels ambients, contorn i imant
    de l'editor). A l'editor: grup **«Models 3D»**
    a l'arbre (+ demana el nom i el model amb `ChoiceChips`; surt al centre de les peces noves, a terra; ⋯ Duplicar ·
    Eliminar, `insertModelCopy`), clic al 3D per triar-lo (`ModelMesh` a `CabinetViewer`), seleccionat amb el contorn i el
    gizmo (`RefGhost outline`, es mou en viu), fletxes, Supr i Ctrl/⌘ C · V · D, i inspector `ModelInspector` (Model ·
    Mides amb «Mida original» · Posició amb el Gir a passos de 15°). Compten per enquadrar la càmera (`size` de l'editor).
    **Arbres** (Xicranda, Avet; Poly Haven, de debò 19 m: a `MODEL_ASSETS` amb mida de jardí): reduïts per al mòbil amb
    `scripts/polyhaven-tree-to-glb.py` (Blender com a mòdul, `pip install bpy`: escorça delmada o només les branques més
    grosses, una part dels grups de fulles una mica més grans, textures 512/1K WebP amb l'alfa) i comprimits amb meshopt
    (`npx gltfpack -c`; `GLTFLoader.setMeshoptDecoder`). Els `.glb` es precachegen (PWA, sense connexió). El render per
    CPU també retalla les fulles (`RenderMaterial.alphaCut`, `alphaAt` a `pathWorker`).
  - **Objectes de referència al 3D** (`RefGhost` a `CabinetViewer`): seleccionat, **es mou només amb les fletxes del
    gizmo** (`viewer/MoveGizmo`, `frontRaycast`: les fletxes es poden agafar encara que l'objecte sigui dins d'un altre o
    d'un moble, i el seu clic no tria el que hi ha al davant) (per decisió de l'usuari: el cos no s'arrossega, així sempre se sap cap on es mourà; també les peces lliures i
    els grups). **Ratolí a sobre** (`BoxFrame`): contorn del color de selecció, prim, per sobre de tot, als objectes i als
    mòduls (només amb ratolí); seleccionat, el contorn és gruixut (es veu també sobre un objecte sòlid i fosc).
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
  - **Càmera**: s'enquadra en obrir, canviar de vista, redimensionar o amb el botó «Enquadrar»
    (càmera de vídeo, `LuVideo`); editar no la mou. El botó surt **marcat** mentre la càmera és a
    l'enquadrament (`onFramedChange`): es desmarca en orbitar/fer zoom/desplaçar o si el moble canvia de mida. Opcions de vista: popover a l'ordinador, calaix de baix al mòbil.
  - **Enganxar objectes** (`RefObject.onFloor`, `onWall`, `anchorRef`): botons «Al terra» (y = 0,
    al 3D llisca pel terra) i «A la paret» (z = 0, penjat: al 3D es mou per la paret); tots dos
    alhora només de costat. El camp fixat queda desactivat; `anchorRef` s'aplica a l'inspector,
    a l'arrossegament i a les fletxes.
  - **Material dels objectes de referència** (`RefObject.material`, a General; no als que tallen): amb material es veuen
    sòlids (`surfaceMaterial`, amb ombres) i surten a la Presentació i al render per CPU; sense («Cap (fantasma)»), fantasma
    translúcid que el render no pinta.
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
    `mobles:viewer-role-colors-fast` (els **objectes** tenen la seva, `mobles:viewer-role-colors-object`, i
    s'obren amb la textura). L'escena és a `viewer/presentationScene.ts`. Terra i paret poden ser **materials de la biblioteca**
    (`PresentationScene.floorMaterial` / `wallMaterial`, `surfaceMaterial` a mida real; Preferències › Visor 3D) o les
    mostres ràpides de sempre.
  - **Acabats de l'escena del moble** (`Composition.scene`: `floor`, `wall`; inspector del moble, secció «Acabats de
    l'escena», com els Acabats dels ambients): terra i paret propis per al mode Presentació i la miniatura; buit = «Com a
    Preferències» (Preferències › Visor 3D, el per defecte). `CabinetViewer sceneFinish`, `renderThumb(…, finish)`.
  - **Nom a la capçalera de l'inspector**: el nom del mòdul i de l'objecte es canvia clicant-lo
    a la capçalera (`Editable`, com a Figma), no a les seccions; el del moble, a la barra de dalt.
  - **Tipus de moble** (`Composition.kind`, `compositionKind`, `features/composition/kinds.ts`):
    Moble, Cuina, Armari, Taula. Es tria a la pàgina Mobles (filtre per tipus; «En blanc»
    crea el del tipus) i a l'inspector del moble (secció Tipus). Taulell i sòcol correguts només
    surten i es construeixen a la Cuina; en canviar de tipus es guarden (no es fan) i tornen. Taula: `tableModule` (tauler + dos laterals de
    panell, sense base ni fons, cantonades a inglet); «Afegir mòdul» n'afegeix una. Plantilles
    amb `kind` (Consola, Taula de menjador). **El + de Mòduls** (arbre) afegeix una caixa bàsica; **sense mòduls especials** (per decisió de l'usuari: la caixa es configura a l'inspector). Queden al codi, sense UI, els de `core/model/modulePresets.ts`
    (`modulePresetsFor`): cuina (baixos calaixos/porta/fregadera/fogons/
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
    en trapezi (`mitreGeometry`). El STEP les fa a 45°. **Fronts** Recobrents /
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
  - **Plantilles vitrina** (`SHOWCASE` a `templates.ts`, primer a la galeria): Aparador sobre ferro (inglet, fronts
    encastats, prestatges gruixuts, passacables que talla, bastidor de ferro), Moble TV flotant
    (parets buides, prestatge gruixut a ras, reixeta, tele a la paret), Moble de bany amb pedra
    (penjat, calaixos encastats, taulell de pedra, desguàs), Cuina amb illa de pedra (illa al
    terra amb X pròpia, taulell de pedra enganxat a l'illa), Vestidor amb barres (portes de dalt
    a baix, barres d'inox, doble barra) i Escriptori flat-pack (laterals amb
    arc que travessen el tauler amb pestanyes). Després, les **inspirades en fotos d'interiors**
    (`INSPIRED_TEMPLATES` a `inspiredTemplates.ts`): Moble TV llarg amb prestatges flotants,
    Llibreria amb baixos negres, Lliteres encastades (parets buides, barana, escala de graons
    gruixuts, matalassos de referència), Consola de noguera a inglet (potes en U de peces lliures),
    Moble penjat de noguera, Tauleta cub i Cuina de roure amb illa de calaixos (pedra tallada per
    la pica i la placa). `showcase.test.ts` comprova que no fan avisos de xoc ni de talls.
    Tretes de la galeria (per decisió de l'usuari): Consola ona, Moble TV 3 portes i Moble TV
    menjador; aquest últim es queda com a `TV_LIVING_ROOM` per als tests i la vista prèvia de
    l'escena a Preferències.
  - **Plantilles en acordions** (`NewMobleGallery`, `Accordion` de Chakra amb `lazyMount`):
    «Plantilles de l'app» i, a sota, **«Plantilles per a botigues de mobles»**
    (`model/storeCatalog.ts`, `STORE_CATALOG` / `STORE_TEMPLATES`, a partir de
    [`cad-mobles-cataleg.md`](cad-mobles-cataleg.md)): 10 categories (Saló, Menjador, **Cuina** —no és
    al catàleg, afegida amb `kitchen()`: lineal, amb illa, kitchenette, illa sola, columnes i racó de
    cafè; taulell de fusta corregut amb els forats de pica i placa o de pedra tallada, sòcol corregut,
    alts alineats amb forat per a la campana, columnes de 2100 i illa amb X pròpia—, Dormitori, Juvenil,
    Despatx, Entrada, Emmagatzematge, Bany, Exterior) › tipus de moble › 3 dissenys (nom comercial,
    estil, mides, materials, ús, colors, públic i `Template.price` orientatiu). Cada categoria és un
    acordió que només munta les miniatures en obrir-lo (198 plantilles); cercador sense accents (obre
    les categories que coincideixen) i el filtre per tipus també hi val. Fora del catàleg: sofàs,
    butaques, cadires, miralls, gandules i carros (no són mobles de tauler). Els mobles només de peces
    lliures (llits, capçals, taules de pedra) són del tipus Flat-pack (l'app necessita un mòdul, que no
    es fa). Aparadors sobre potes de peces lliures: caixa «penjada» a l'alçada de les potes (no surten
    també les regulables). Colors dels lacats nous per nom a `textures.ts` (antracita, verd oliva,
    terracota, blau fosc, greige). `storeCatalog.test.ts`: totes es construeixen sense avisos de
    disseny (portes massa amples, prestatges que vinclen, guies que no caben, barres curtes, xocs).
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
    **Interiors com les fotos de revista**: als ambients, cel de dia (`daySky`: zenit blau, horitzó clar,
    halo del sol; `scene.userData.daylight`) i sol tres vegades més fort que el cel; les habitacions
    tancades porten **sostre** (`userData.renderOnly = "ceiling"`, es veu quan la càmera és a dins, al visor
    i al render) i llavors la llum entra per les finestres: els vidres són **portals** (`userData.portal`,
    `RenderScene.portals`: llum del cel mostrejada a través seu) i no fan ombra (el sol hi passa). A la
    imatge: **reducció de soroll** (`denoise.ts`, À-Trous guiat per l'albedo i la normal de la primera
    superfície, en un worker a part, cada cop menys sovint), **exposició automàtica** (mitjana geomètrica)
    i temperatura (càlid per defecte als ambients). Càmera: **format** (visor, 3:2, 4:5, 16:9, 1:1) i
    desenfocament (lent fina, enfoca el centre). **Cel HDRI** opcional: es carrega un `.hdr` (`hdr.ts`,
    RGBE; p. ex. de Poly Haven) i es pot girar; sense, el cel de dia. Límit de 12 per mostra (sense ateses).
    Opcions del render en seccions plegables (`PanelSection`, com els inspectors: Qualitat, Càmera,
    Escena, Llum, Imatge, amb el resum a la insígnia); al mòbil, pantalla completa amb la imatge a dalt.
    **Sostre**: opció de vista «Sostre» (`mobles:ambient-ceiling`) i material a Acabats
    (`Ambient.ceilingMaterial`); al visor té una mica de llum pròpia (emissive) perquè des de sota no quedi fosc.
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
  - **Materials per categories** (`MaterialPref.category`, `materialCategory`, `withCategory`,
    `MATERIAL_CATEGORIES`): **Taulers** · **Fons** · **Metall, pedra i vidre** · **Simulació**. Als
    antics es dedueix de `forBacks` / `cnc`. A Preferències es llisten per categoria (camp Categoria
    en lloc dels interruptors «Per a fons» i «Es talla a la CNC») i els selectors fan `optgroup`.
    Els de **simulació** (`SIM_MATERIALS`, v3 de les preferències: teixits, vellut, cuir, parquet,
    rajoles, microciment, pintures, electrodomèstics) només es veuen: `cnc: false`, no surten als
    selectors del cos ni del taulell. Acabats nous `fabric` (trama) i `tiles` (rajola amb junta i
    mida), procedurals (`patternTexture`). Els materials que no són de CNC pinten els cantells amb
    el mateix material (no «tauler vist»).
  - **Preferències com Configuració de macOS / Figma** (`SettingsPages` + `Pane` a `SettingsScreen`):
    a l'esquerra la llista d'apartats per categories (`SETTINGS_GROUPS`: **Fabricació** — Materials, Taulers i
    nesting, Ferratges, Jocs, Etiquetes —, **Foto i visor 3D** — Objectes de referència, Visor 3D — i **App** —
    Visualització, Tema; no és un acordió, com la Configuració de macOS) i a la dreta la pàgina triada (icona, títol,
    explicació i «Restaurar valors inicials»); dins, **una sola columna de 760 px** (`FoldGrid` = pila; res de
    graelles de targetes, que deixaven forats) de **grups sempre oberts** (`components/SettingsGroup`:
    targeta amb capçalera, marges amples (px 6) i 24 px entre targetes, icones alineades a dalt amb el títol; res no s'obre de cop).
    **Tots els camps de l'app són files etiqueta · control** (Preferències, inspectors del moble, de peces, objectes i
    ambients, diàlegs de render, textura, plantilla, foto i nesting): `components/FormRow` — `FormRow` amb l'etiqueta
    a l'esquerra (min(150 px, 36 %)) i el control amb `maxW` i l'ajuda a sota; és una **consulta de contenidor**:
    si el lloc fa menys de 300 px (mòbil, panell estret), l'etiqueta va a sobre. `NumRow` (a `components/NumRow`,
    amb `ariaLabel` al camp) per als números, 180 px; `IconChoice hideLabel` i `MaterialSelect hideLabel` dins un
    `FormRow`; «Afegir» de `MasterDetail` només amb icona; `FormSection` per a seccions dins una targeta (el títol petit en majúscules és `components/SectionLabel`, el mateix als grups de les llistes i a Opcions de vista); `ChoiceChips` per a opcions que han de saltar de línia,
    com el sòcol i la llum del Visor 3D, en lloc d'un control segmentat que es desborda). Materials i objectes de
    referència fan **llista i detall** (`components/MasterDetail`: llista agrupada amb mostra; cercador, botons
    de categoria i «Afegir» en una fila; desplaçament propi; `head` = el títol de la pàgina a dalt de la llista,
    perquè el detall comenci a dalt de tot, a l'altura del menú —`PaneHeadContext` a les pàgines `wide`—;
    `footer` = sota el detall). Materials: «Per defecte als mòduls nous» **sota el detall** (Tauler i Fons amb
    el gruix triat d'entre els del material, `DefaultPick`); a la llista, miniatura amb la textura (`MaterialThumb`) i
    resum «Acabat · gruixos · cantell» (sense l'explicació de la categoria, que és al detall). El detall és una
    targeta amb la **mostra a escala real a tota l'amplada** (`MaterialHero`, mesura l'amplada i sempre són
    600 mm; `materialPreview.ts`), el nom gran editable amb Duplicar/Eliminar i dues seccions de files
    etiqueta · control (`FormSection`/`FormRow`): **Aspecte** (Acabat, Color/Espècie/Foto, Rajola, Textura:
    «Editar la textura» i «Posar una foto») i **Fabricació** (Gruixos com a etiquetes `ThicknessChips`,
    Cantell, Veta, Categoria amb la seva explicació); controls de 280 px com a molt; un material nou té nom únic
    («Material nou 2»), va a la categoria filtrada i deixa el nom seleccionat.
  - **Objectes de referència inicials** (`BUILTIN_REFERENCES`): genèrics (A4, rajoles, portes, **una sola tele** de 55″,
    radiador, endoll; per decisió de l'usuari, no una llista de teles). Les teles antigues (Sony de les proves del principi) es treuen de les
    preferències desades (`RETIRED_REFERENCES`, `isRetired`: també les còpies desades amb el nom «TV Sony KD-55XD8505…»).
  - **Biblioteca de materials** (`settings/libraryItems.ts`, `MATERIAL_LIBRARY`; diàleg `MaterialLibrary`):
    «Afegir» obre una graella de materials fets amb la mostra (fustes i lacats, pedres, metalls, vidres,
    teixits, terres i parets), cadascun amb la categoria, els gruixos i el cantell; «En blanc» per començar
    de zero. `libraryItems.test.ts` comprova que tots són vàlids.
  - **Textures procedurals editables** (`settings/TextureEditor.tsx`, botó «Editar la textura» sota la
    mostra): mostra gran a escala real (amb zoom) i els paràmetres del generador; s'aplica en acceptar
    i els controls lliscants generen en deixar-los anar. **Fusta** (`Finish.wood.gen`, `WoodGenSchema`,
    `WOOD_PRESETS` + `WOOD_EXTRA_PRESETS`: roure, noguera, freixe, cirerer, wengué, pi, roure fumat, faig,
    roure blanquejat): colors de fons i de veta, densitat, ondulació, contrast de fibres, franges de to,
    vetes de catedral, porus, gra fi, mida de la repetició i «Nova variació» (llavor). **Teixit**: fils,
    irregularitat, mida. **Rajola**: junta (mm), variació de to, quadrícula o trencajunts (la textura és de
    2 × 2 peces). **Pedra** (acabat `stone`, `style`: marbre amb vetes, granit de tres colors, travertí amb
    franges i porus, formigó amb núvols i porus; gra, polit, mida, llavor; soroll periòdic sense costures).
    **Metall** (`surface`: polit, raspallat o martellejat, textures `brushed`/`hammered`; rugositat, intensitat,
    colors habituals). **Vidre** (opacitat i glaçat). **Color llis i lacat** (brillant = `roughness`). Tots els
    acabats menys la foto es poden editar (`isEditable`). Tot és `textures.ts` (canvas; `woodTexture(species, gen)`,
    `patternTexture(kind, color, grout, opts)`), amb memòria de les últimes 48 textures. Al mòbil, navegació en profunditat: apartats › pàgina › element, amb «‹ Tornar».
    L'apartat i l'element triats es recorden durant la sessió (`useSessionString`). Al material, botó
    visible «Posar una foto de textura» (a més de l'Acabat «Foto (textura)»), amb miniatura, «Canviar la
    foto» i «Treure-la».
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
    accions ràpides només amb icona i el nom al tooltip (`viewQuick`, el text no hi cabia): els 3 modes, Enquadrar, Forats, Explosió i
    Veure a casa (AR); a sota, la vista, l'obertura i la imatge. El visor de tots els documents (moble,
    objecte i ambient) amb el mateix aire: 16 a dalt al mòbil i 16 al voltant a l'ordinador.
  - **Versió** (com a rack): `__APP_VERSION__` = nombre de commits i `__APP_COMMIT__` (git en
    construir, `vite.config.ts`; sense git, `APP_VERSION` o «dev»), petita al costat del nom al
    menú i al manifest. El Dockerfile instal·la git i el `.git` no s'ignora.
  - **Textures reals** (`Finish.kind = "image"`): a Preferències › Materials, Acabat «Foto
    real»: es tria una foto (reduïda a 1024 px JPEG) i l'amplada real que mostra (mm);
    `photoTexture`: en mirall (una foto qualsevol, sense costures) o, amb «Sense costures (seamless)»
    (`Finish.seamless`), repetició normal. `Finish.aspect` (alçada ÷ amplada, es mesura en triar-la
    o, a les antigues, en obrir la targeta) fa que l'alçada real sigui `tileMm × aspect`: abans
    s'estirava si la foto no era quadrada. `faceTexture` creua les repeticions quan la veta va en v
    (three escala després de girar).
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
    que miren a la càmera en vistes ortogràfiques. El cos no s'arrossega.
  - **Opcions amb icona** (`components/IconChoice.tsx`): poques opcions → botons d'icona amb
    el nom al tooltip i l'opció triada al costat del títol (o a sota, amb `hideLabel`). **Estil discret i comú**
    (`components/segmented.ts`, `segGroup` + `segItem(on)`): control segmentat petit (botons xs, fons suau, la triada
    amb fons clar, ombra i icona del color principal), **sense ocupar tota l'amplada** i sense botons plens de
    color; el fan servir IconChoice, el tipus de front, la «Fila» del mòdul (també només icona), `ChoiceChips`, les rajoles d'Opcions de
    vista (`ViewTile`), Forma (taula i peça), «Al terra / A la paret» dels objectes i les eines de la Foto. **Els avisos
    (toaster) sempre porten ✕** per tancar-los (`components/ui/toaster.tsx`). Base, Fons, Tapa (mòdul), Patró de
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
  - **Mòdul seleccionat al 3D: sòlid amb contorn taronja** (com Figma o SketchUp; per decisió de l'usuari: translúcid
    semblava que canviés de color). Només es fa **translúcid amb un compartiment triat**, per veure'l a dins. Compartiment
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
- **Memòria a l'iPhone** (`components/viewer/deviceLimits.ts`, `LOW_MEMORY` = pantalla tàctil): Safari dona poca
  memòria per pàgina i, si se supera, iOS la tanca i la recarrega. Per això, a les pantalles tàctils, Presentació fa
  l'ombra a 2048 (no 4096) i fins a 2×, les memòries de textures (`remember` a `textures.ts`, també les fotos) en
  guarden 12 i alliberen (`dispose`) les que en surten, i el render per CPU fa com a molt 2 processos.
- **Controls segmentats en mode fosc** (`theme/system.ts`): l'indicador de l'opció triada és gris clar (per
  defecte era del mateix negre que el fons i no es veia quina estava triada).
- **Mides d'iOS a les pantalles tàctils** (`src/theme/layout.css`, `@media (pointer: coarse)`, CSS sense capa: guanya a les
  capes de Chakra): es canvien les variables dels tokens, així tota l'app les agafa. Text `sm`/`md` 17 (cos d'iOS), `xs` 13,
  `2xs` 11, `lg` 20, `xl` 22; controls (`sizes` 8–11) 40 / 44 / 44 / 48 (mínim tàctil d'Apple: 44); interlineat 1,3; els
  camps on s'escriu a 17 (amb menys de 16, Safari fa zoom). `FormRow` centra l'etiqueta amb `--form-row-label-pt`. A
  l'ordinador, les mides normals de Chakra (sm = 14, botons de 32–36). Barra de baix com la d'iOS (icona 24, nom 2xs).
  **La mateixa estructura a l'ordinador i al mòbil** (per decisió de l'usuari; `layout.css`, amb classes dels mòduls
  comuns), com la Configuració d'iOS/macOS: files de formulari (`.form-row`) enganxades amb una línia fina entre elles,
  marges de les targetes de Preferències i de les seccions (`.settings-group-*`, `.form-section`: 20, al tàctil 16) i 32
  entre grups (`.settings-stack`). **Només canvien les mides** (ratolí: les de Chakra; dit: les d'iOS). Al tàctil, a més,
  els noms de les targetes de les graelles (`.card-title`) a 15 en dues línies i les capçaleres d'acordió de 48.
  Al tàctil, també: les opcions dels controls segmentats (`.seg-item`) de 44 × 44 i els camps numèrics **sense les
  fletxetes + −** (23 × 21, massa petites per al dit; es fa servir el teclat numèric, `inputMode`).
  **Res de Ionic** (per decisió: refer la UI no compensa i no encaixa amb les eines d'escriptori).
- **Capçalera de les pàgines d'inici** (`components/PageHeader`, Ambients · Objectes · Mobles · Preferències): títol gran,
  les accions **a sota del títol** (a l'ordinador i al mòbil igual) i l'explicació. Dins dels acordions, la fila d'eines
  («Grup nou», «Seleccionar», «Esborrar l'historial») va **a l'esquerra**.
  **Seccions de les galeries sense marge** (`.gallery-accordion`, layout.css: contingut i `itemBody` amb padding 0): la barra
  d'eines i els acordions de dins (grups, categories del catàleg) van **a sang**; la resta porta el marge de la secció amb
  `--gallery-px` (graelles, textos, capçaleres de dins). Res de marges negatius.
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
  s'amaga el sufix (no els botons + −) automàticament (container query a `NumberField`). Mentre s'escriu, el text
  es queda encara que no sigui un número («», «-»), però `onChange` només rep números; en sortir es torna l'últim
  valor vàlid. Amb `allowEmpty` (mides que poden quedar buides) rep `NaN`. L'Editor només desa composicions que
  passen `CompositionSchema`.
- **Res de desplegables** (per decisió de l'usuari, tot unificat): cada tria entre opcions és un `ChoiceChips`
  (`components/FormRow`, botons segmentats que salten de línia, no desborden mai; els noms llargs es tallen amb «…» i
  el sencer al `title`; tornar a tocar la triada no fa res, si no és amb `retap`, p. ex. la forma del tauler): vistes, formes, tipus, mòduls,
  gruixos, grups, resolucions… Les explicacions que portaven les opcions van a l'ajuda (`help`) de la fila. Els
  materials, amb el `MaterialSelect` (calaix). Cap `NativeSelect` fora de `components/ui`.

## Desar
- **Tot el que es desa sol fa servir `useDebouncedSave`** (`features/useDebouncedSave.ts`): Editor, Foto, Nesting,
  Ambients i Preferències. Desa amb retard, compara amb **l'últim valor desat** (no amb el que torna Dexie: cada
  desada en tornava un objecte nou i es desava sense parar) i desa el pendent en sortir de la pàgina, en amagar l'app
  i amb `mobles:flush-save`. Obrir una cosa no la desa (no puja amunt de la llista ni surt «Modificat»).

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
| Navegació | Mobles (el cub: un moble) · Editor · Peces · Nesting · Exportar | `LuBox` · `LuDraftingCompass` · `LuList` · `LuLayoutGrid` · `LuDownload` |
| Navegació | Tornar (‹ a les barres) · Plegar/desplegar menú · Preferències | `LuChevronLeft` · `LuPanelLeftClose` / `LuPanelLeftOpen` · `LuSettings` |
| Zones | Dividir en vertical (divisor vertical, zones esquerra/dreta) | `LuSquareSplitHorizontal` |
| Zones | Dividir en horitzontal (travesser, zones dalt/baix) | `LuSquareSplitVertical` |
| Zones | Divisió vertical (zones de costat) · Divisió horitzontal (zones una sobre l'altra); un compartiment porta la icona del seu contingut (fila «Contingut»), igual a l'arbre, a la capçalera i a la secció «Front» (`composition/zoneIcon.tsx`) | `LuColumns2` · `LuRows2` |
| Zones | Eliminar divisió · Mida | `LuUngroup` · `LuRuler` |
| Contingut | Obert · Prestatges · Porta · Calaixos | `LuSquareDashed` · `LuRows3` · `LuDoorClosed` · `LuArchive` |
| Contingut | Abatible · Reixeta · Front fix | `LuPanelBottom` · `LuGrid3X3` · `LuSquare` |
| Composició | Afegir · Duplicar · Eliminar · Reordenar | `LuPlus` · `LuCopy` · `LuTrash2` · `LuGripVertical` |
| Composició | Objecte de referència · Radiador · TV | `LuScan` · `LuHeater` · `LuTv` |
| Composició | Model 3D (`.glb`: plantes…) | `LuSprout` |
| Composició | Plantilles · Menú del document | `LuLayoutTemplate` · `LuEllipsis` |
| Composició | Moure a l'esquerra · a la dreta (menú de l'arbre) | `LuArrowLeft` · `LuArrowRight` |
| Front | Una porta · Dues portes · Abatible avall · amunt · Ranures horitzontals (reixeta) | `LuDoorClosed` · `LuFlipHorizontal2` · `LuArrowDownToLine` · `LuArrowUpToLine` · `LuAlignJustify` |
| Forma | Rectangle · Arrodonit · Oval (tauler de taula) · Efecte peça · Efecte obstacle · Talla | `LuRectangleHorizontal` · `LuSquircle` · `LuCircle` · `LuPuzzle` · `LuShield` · `LuScissors` |
| Panell | Mides exteriors · Taulers · Interior i front · Fusteria · Adaptar a la imatge | `LuMoveDiagonal` · `LuSquareStack` · `LuLayoutPanelLeft` · `LuHammer` · `LuCamera` |
| Panell | Composició (mòduls i objectes de referència) · Compartiments (alçat) | `LuLayoutDashboard` · `LuLayoutPanelLeft` |
| Inspector | Estructura (base, fons, tapa, laterals) · Front · Pare | `LuFrame` · `LuDoorClosed` · `LuArrowUp` |
| Inspector | Resum del moble · Posició | `LuBox` · `LuMove` |
| Inspector | Anterior · Següent · Accions de la selecció (menú) | `LuChevronLeft` · `LuChevronRight` · `LuEllipsis` |
| Preferències | Tema (dia/nit/sistema) · Color principal | `LuSunMoon` (`LuSun` · `LuMoon` · `LuMonitor`) · `LuCheck` a la mostra triada |
| Preferències | Visualització · Calaixos · System 32 · Cassoleta · Imants (Ferratges) | `LuScanEye` · `LuArchive` · `LuCircleDot` · `LuCircleDashed` · `LuMagnet` |
| Fitxer | Desar com a fitxer · Obrir fitxer | `LuSave` · `LuFolderOpen` |
| Editor | Estructura · Propietats · Opcions de vista · Alçat | `LuListTree` · `LuSlidersHorizontal` · `LuSlidersVertical` · `LuLayoutPanelLeft` |
| Estat | Avisos de fusteria · Desfer · Refer | `LuTriangleAlert` · `LuUndo2` · `LuRedo2` |
| Foto | Foto · Referència · Distància · Rectangle | `LuCamera` · `LuCrosshair` · `LuMoveHorizontal` · `LuRectangleHorizontal` |
| Foto | Origen (0,0) · Treure/tancar · Eines | `LuLocateFixed` · `LuX` · `LuPencilLine` |
| Foto | Mida estimada · Mida real (cinta) · Línia del terra · Fondària | `LuEye` · `LuCircleCheck` · `LuArrowDownToLine` · `LuArrowUpFromLine` |
| Visor | Forats · Explosionat / muntat · Ampliar / reduir 3D · Ferratges (rajola) | `LuCircleDot` · `LuExpand` / `LuShrink` · `LuMaximize2` / `LuMinimize2` · `LuWrench` |
| Visor | Veure a casa (AR) | `LuView` |
| Visor | Vista 3D · Obertura portes · Materials · Per tipus de peça · Imatge | `LuRotate3D` · `LuDoorOpen` · `LuPalette` · `LuLayers` · `LuImageDown` |
| Ambients | Ambients · Seleccionar · Paret (ploma) · Habitació · Calibrar · Plànol de fons | `LuHouse` · `LuMousePointer2` · `LuPenTool` · `LuBrickWall` · `LuPencilRuler` · `LuImageUp` |
| Ambients | Finestra · Porta · Moure a un grup · Grup (carpeta) | `LuAppWindow` · `LuDoorOpen` · `LuFolderInput` · `LuFolder` |
| Ambients | Afegir moble · Bloc · Plànol · 3D · Girar | `LuBox` · `LuSofa` · `LuMap` · `LuRotate3D` · `LuRotateCw` / `LuRotateCcw` |
| Exportar | DXF (CNC) · STEP 3D · CSV de nesting · CSV de peces · GLB · Avançat | `LuScissors` · `LuCuboid` · `LuLayoutGrid` · `LuFileDown` · `LuBoxes` · `LuSettings2` |

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

# Ambients

> Tret del `CLAUDE.md` (2026-10-15) perquè no es carregui sencer a cada sessió. Llegeix-lo abans de tocar aquesta part.

### Ambients (plànol de la casa amb els mobles)
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
  files queden marcades). **Selecció múltiple** (Maj + clic a l'arbre, al plànol o al 3D, com a l'editor; `Selection` `{ kind: "multi", ids }`, `selIds`; **també les parets**, `selWallIds`: a l'arbre i al plànol, es mouen —arrossegant-ne una de triada, fletxes, «De costat (X)» / «Fondària (Z)»—, s'agrupen i s'eliminen amb els elements; `moveWalls`; les parets poden ser de grups, `Wall.group`, el mateix espai de noms que els elements, `groupWallIds`, `setWallGroup`, plegables dins de «Parets»): moure (arrossegar, fletxes, «De costat (X)» i «Fondària (Z)» del centre), girar, **Alineació** al plànol («De costat (X)» i «Fondària (Z)»: inici, mig, final; «Repartir» amb tres o més i amb un «Espai entre ells»; `alignItems`, `distributeItems` amb la petjada de cada element) i el **Grup** de tots i **Triats** (`LuListChecks`: la llista dels triats i els botons Duplicar · Eliminar, com a l'editor) (`MultiInspector` dels Ambients; ⌘G grup nou, ⇧⌘G fora del grup, com a l'editor). **Arrossegar per ordenar** (per decisió de l'usuari, 2026-10-14, com les peces lliures de
  l'editor; `reorderItems`, `moveItemToGroup` a `core/model/ambient.ts`): un element deixat al costat d'un altre n'agafa
  el grup, sobre la fila d'un grup hi entra, la fila del grup arrossega el grup sencer i, mentre s'arrossega un element d'un
  grup, surt la zona «Treure del grup». Un moble buit (sense mòduls ni peces, `isEmptyGeometry`) diu «Buit» a l'arbre, al plànol és el
  requadre discontinu de 600 × 600 (com un esborrat) i l'inspector diu que s'ha de fer a l'editor (sense Mides generals). Inspector (element, bloc,
  paret, grup, ambient) en `FoldItem`; l'element i la paret porten a la capçalera el menú ⋯ com a l'Editor (`ActionsMenu`,
  tooltip «Accions», `aria-label` «Accions de «x»»: Duplicar · Eliminar a l'element, Eliminar a la paret); la posició de
  l'element és «De costat (X)» i «Fondària (Z)» (el centre al plànol) i «Alçada (Y)» (des del terra), amb `AxisLabel`, i les
  mides «Amplada» · «Alçada» · «Fondària»; el de l'ambient comença amb **Resum** (com el del moble: parets, m² de terra de
  les habitacions tancades —`floorArea`, als eixos—, caixa, mobles, objectes, finestres, portes, vidrieres, grups i un
  avís amb «Eliminar-los de l'ambient» si en falta algun; `ambientSummary` a `core/model/ambient.ts`), després Parets noves,
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
  lloc; grups com «Duplicar». Els mobles enganxats són el mateix moble enllaçat (com «Duplicar»). Es desa sol. «Enquadrar» deixa l'habitació fora de les eines i barres (`PLAN_INSETS`); noms i mides
  només si hi caben. **Plànol de fons**: imatge (2400 px JPEG) escalada amb la calibració, opacitat i bloqueig. La vista del
  plànol no es recorda.
- **Finestres i portes** (`Wall.openings`: finestra amb ampit de pedra, porta amb fulla, vidriera amb travessers):
  `nearestWall`, `addOpening` amb `OPENING_DEFAULTS`, `clampOpening` (no trepitja les que hi ha: forat lliure més proper o
  avís); es queden al seu lloc en moure extrems o escurçar la paret (`setWallEnds`); s'arrosseguen al llarg de la paret;
  inspector de la paret: tipus, «Centre (des de l'inici)», «Amplada», «Alçada», «Ampit (del terra)», fulles i material propi (`Wall.material`). 3D: `wallOpenings`,
  `wallSegments`; el vidre porta `userData.glass` i `baseOpacity`.
- **Grups d'elements** (`AmbientItem.group`; `setItemGroup`, `moveItems`, `rotateItems`, `duplicateItems`, `removeItems`):
  la llista és com l'arbre de l'editor (grups plegables, menú ⋯ «Accions de «x»»: Duplicar · Grup nou · Posar a «grup» · Treure del grup ·
  Obrir a l'editor · Eliminar; el d'un grup: Duplicar el grup · Desagrupar · Eliminar el grup). El primer clic a un element agrupat (plànol o 3D) tria el grup i el segon l'element; Supr,
  Ctrl/⌘ D, R i fletxes valen per a tot el grup (duplicar un sol element el deixa al grup; el grup sencer en fa un de nou);
  inspector del grup.
- **Opcions de vista** (les mateixes `ViewOptions`/`ViewTile`): al plànol enquadrar, graella, mides, noms, peces, imant, plànol
  de fons i render; al 3D enquadrar, interior, casa de nines, sostre, ombres i render.
- **3D** (`Ambient3D`): terra i parets amb `surfaceMaterial` (textura a mida real); les parets entre la càmera i l'habitació es
  fan transparents (casa de nines). La mateixa navegació que l'editor; clic per seleccionar (caixa taronja; Supr, Ctrl/⌘ D, R
  i fletxes); **es mou amb les fletxes del gizmo** (`MoveGizmo`, X i Z, i la bola del mig lliure pel terra, X i Z alhora; quadrícula, imant a les parets només en la direcció
  de la fletxa amb un sol element, Alt sense imant, un pas de desfer). **La verda (Y) mou l'alçada** («Alçada (Y)», mai
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
  Alçada (sense valor, la paret més alta), Material («Formigó» per defecte) i **Claraboies** («De costat (X)» i «Fondària (Z)», el centre al plànol, «Amplada» en X
  i «Fondària» en Y; les que no caben a un pla, a 50 mm de les vores, no es fan). Cobreix la caixa de les parets amb el
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
- **«Desar com a fitxer…»** (`.moble`, vegeu Desar i fitxers › Fitxer d'ambient): menú ⋯ de la targeta i ⋯ de la barra de l'ambient obert.
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

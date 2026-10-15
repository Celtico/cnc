# Visor 3D i render

> Tret del `CLAUDE.md` (2026-10-15) perquè no es carregui sencer a cada sessió. Llegeix-lo abans de tocar aquesta part.

### Visor 3D i render
- **Llum com model-viewer** (`StudioEnvironment` a `SceneHelpers`): entorn d'estudi procedural (`RoomEnvironment` + PMREM,
  sense connexió) com a `scene.environment` i to `Neutral`; hemisfèrica baixa. **`three-gpu-pathtracer` descartat**: (WebGL)
  necessita més de 16 unitats de textura i als Mac/iPhone (límit 16) sortien malament.
- **Només pinten quan cal** (`frameloop="demand"` a `CabinetViewer`, `Ambient3D` i `PhotoRender`): controls, animacions
  (obrir, explosionar, enquadrar: demanen `invalidate` fins que arriben; el primer pas després d'estar quiets compta 1/60 s,
  `animStep`), canvis de React i fotos que arriben (`TextureRefresh`). L'enquadrament no passa de la distància màxima dels
  controls. Cada peça (`PanelMesh`, `memo`) només es refà si canvia la seva signatura visual (`panelVisualKey`) o la
  col·locació; els callbacks reben la peça. Forats: una malla instanciada per peça. Ombra de contacte pròpia
  (`viewer/ContactShadow.tsx`: la de drei deixava render targets a la GPU; l'escala va a passos de ¼ d'octava). Alliberar un
  material allibera les seves textures (`disposeMaterial`; `userData.shared` no); `disposeTree` a `textures.ts`.
- **Memòria a l'iPhone** (`components/viewer/deviceLimits.ts`, `LOW_MEMORY` = pantalla tàctil; si se supera, iOS tanca i
  recarrega la pàgina): Presentació fa l'ombra a 2048 i fins a 2×, el parquet procedural de 1024 (`floorTextures.ts`, només
  si es fa servir), les memòries de textures (`remember`) en guarden 12 i alliberen les que en surten **sense clons vius**
  (`tileClone`), i el render fa com a molt 1600 px («Alta» i «Màxima» desactivades amb l'explicació) i, per CPU, com a molt
  2 processos (`cpuThreads`, menys fils com més gran és la imatge).
- **Ferratges visuals** (`viewer/Hardware.tsx`, «Ferratges» a Opcions de vista, `mobles:viewer-hardware`): tirador de
  barra, potes regulables i el **dibuix 3D dels ferratges de sèrie** (per decisió de l'usuari, 2026-10-08: «els ferratges
  que teníem de sèrie fes el dibuix 3D»; `core/build/hardwareSolids.ts`, pur: caixes i cilindres en coordenades de la
  peça, posats amb els forats i els accessoris que fa el motor; `builtinHardwareGroup` a `viewer/hardwareShapes.ts` els
  fa malles amb geometries unitàries i materials niquelat / acer / gris fosc / plàstic / faig / alumini compartits):
  **frontissa** (com la de cassoleta de debò, per decisió de l'usuari, 2026-10-14: cassoleta amb la vora, l'ala amb els
  dos cargols, el coll corbat i el braç arrodonit amb el cargol de regulació, amb el front; la placa en creu, cos i ales; la **placa**, fixa al lateral: `fixedSolids`
  la calcula des del front i la torna per la peça a la cara de la qual toca —lateral, divisor, tapa o base— en les seves
  coordenades, així en obrir només es mou el que va collat a la part mòbil, per decisió de l'usuari, 2026-10-13; el
  visor, «Com va muntat» i les miniatures la passen amb els `pins`),
  **suport de prestatge** als forats System 32 just sota un prestatge (`shelfPins`), **espiga** de faig des del forat de
  cara (un cop per espiga), **guia** (cos al lateral des de 34 mm davant del primer forat, corredora a la caixa),
  **braç d'abatible** (placa i braç), **imant** (catxet al cantell, placa d'acer a la cara), **push** (cos del Tip-On a la
  vora que obre, **fix al moble** com la placa: al lateral de la vora que obre o a la peça de darrere del front), **barra** (suports dels extrems) i **tira LED** (perfil d'alumini). **Surten al render** (per decisió de l'usuari,
  2026-10-14: «la foto ha de ser hiperrealista, ha de sortir tot»; abans eren `editorOnly`) i, en obrir el Render,
  «Ferratges» s'encén; als ambients també (`buildScene` amb `hardware`, i les potes genèriques amb `genericLegsGroup`); a
  l'AR i a les exportacions GLB/USDZ, no. Només es dibuixen. Els **importats** (`PanelFittings`, `Panel.fittings`, `kind`
  hinge/plate/handle/leg): el GLB de la frontissa a cada cassoleta, el de la placa al lateral, el del tirador a la cara de
  fora del front (sense la barra genèrica) i el de la pota a cada cantonada de la base (sense les genèriques,
  `ViewerModule.legs.fitted`) (`loadModel` dels `hwa-…`, taula Dexie `hardwareAssets`,
  v6), al marc del ferratge (u = v × n, `fittingMatrix`); sense el model, la caixa. No surten al render, l'AR ni les
  exportacions (sí a les miniatures de Preferències › Ferratges). El marc, el dibuix dels de sèrie
  (`builtinHardwareGroup`) i les marques dels forats (`holeMarkMatrices`) són a `viewer/hardwareShapes.ts`: visor,
  «Com va muntat» i miniatures.
  Els col·locats a mà es trien al 3D (`PanelFittings selected/onSelect`, vegeu Editor › Ferratges col·locats al 3D). El GLB
  d'un importat ja és al seu **marc de muntatge** (`imported.mountFrame`, §11 de `docs/ferratges-import.md`): a la
  cassoleta hi entra tal com es veuria col·locat.
  `PanelMesh proposedTags`: els forats amb aquestes etiquetes, en taronja (els proposats d'un importat sense confirmar al
  muntatge de Preferències › Ferratges); `PanelMesh pins` (suports de prestatge) i `seeThrough` (fusta translúcida a
  0,4 sense escriure la profunditat, al muntatge); `MovingPanel` s'exporta per al mateix muntatge.
- **Electrodomèstics** (v46): l'aparell és una caixa de la seva mida (`extras`, rol `hardware`, del material del cos:
  el de l'item o el de la família, `applianceBodyMaterial`) amb la **foto del catàleg** (o la pròpia, data URL) a la cara
  vista (`Panel.photo`, a la cara +z o, a la placa, +y). Per petició de l'usuari (2026-10-15: la foto sortia estirada i amb
  el marc blanc), `panelMaterials` hi posa `photoFaceTexture` (`viewer/photoFace.ts`): una textura de la mida de la cara
  amb el color del cos i la foto **sencera i centrada** a sobre (`containRect`), amb el fons transparent (les fotos de
  `public/appliances/*.webp` ja no el porten; a la memòria del service worker en fer-les servir, `mobles-appliances-v2`);
  fins que la foto arriba (`photoTexture`, la mateixa memòria i `photoTexturesIdle`) o si falla, la cara és del color del
  cos. Sense front de moble, la cara queda enrasada amb els fronts del mòdul i res al davant (un aparell tapat per les
  portes del mòdul no es fa: `visibleZone`). La mateixa peça al visor, a les miniatures, al render i al GLB/USDZ. Amb front de moble, l'aparell queda darrere
  (el front del rentaplats s'obre com un abatible, el del frigorífic i la rentadora com una porta: `opening.ts`).
- **Components dels jocs de calaix** (`extras` amb rol `hardware`, `kitSolidPanels`): peces de caixa normals, **massisses**
  (`panelMaterials`: totes les cares amb l'acabat del material, mai el color del tauler vist als cantells) i pintades pel
  nom del material amb `resolveFinish` (paraula clau si no és a Materials: «Acer fosc» → gris fosc metàl·lic, «Blanc
  seda» / «Gris mat» → blanc / gris mat; `materialIssues` no avisa d'aquests noms). En obrir un calaix (`opening.ts`,
  `movingGroups`), surten els `drawer-<k>-…` (laterals de doble paret, corredora de la guia, suports, darrere, barra) i el
  **cos de la guia** (`kitfix-<k>-kit-slide-…`, acer fosc) es queda fix al lateral del moble: es veu de seguida què és fix
  i què es mou. La NL de l'obertura surt del gruix del cos fix.
- **Textura desplaçada per peça** (`viewer/textureOffset.ts`, test): cada cara de cada peça (`Panel.id` + cara) té un
  desplaçament determinista (hash FNV-1a) i, a l'atzar, un gir de 180°, a la matriu UV (`faceTexture(…, off)`), que llegeixen
  el visor, el render (`sceneData`, també la base tangent) i el GLB/USDZ. Canviar el hash canvia la veta de tots els mobles.
- **Models 3D** (`viewer/models3d.ts`): `loadModel` un cop, `preloadModels` (→ `true` si hi són tots), `onModelsLoaded`; una
  càrrega fallida no es torna a provar fins passat 60 s. `modelInstance` fa la còpia col·locada (geometria i materials
  compartits, `userData.sharedModel`); `releaseModelGpu` els treu de la GPU en alliberar el renderitzador de miniatures i en
  tancar els visors. Les miniatures amb un model no carregat no es fan. Surten als ambients, miniatures, Presentació,
  render, AR i GLB/USDZ.
  - De l'app: falgueres de Poly Haven (CC0) a `public/models`, textura 1K WebP amb el retall a l'alfa (`alphaTest`, només als
    materials amb alfa). **Arbres** (Xicranda, Avet, de debò 19 m) reduïts amb `scripts/polyhaven-tree-to-glb.py` (Blender com
    a mòdul, `pip install bpy`) i comprimits amb meshopt (`npx gltfpack -c`; `GLTFLoader.setMeshoptDecoder`). Es
    precachegen. **Herba (2 × 2 m)** (`grass-patch`, `models/grass_patch.glb`, 40.000 triangles, 0,75 MB): ~120 mates
    de `grass_medium_01` escampades (`scripts/polyhaven-grass.py`, `mode: "patch"`); al Showroom, fora de la vidriera. El render per CPU també retalla les fulles (`RenderMaterial.alphaCut`, `alphaAt`).
  - **De l'usuari** (sense llista de models al + —només l'explicació del format i «Triar un fitxer .glb…»—, per decisió de l'usuari: les plantes de l'app són al catàleg d'Objectes;
    a l'inspector, «Model» diu el nom i «Canviar» n'importa un altre; `composition/ModelUpload.tsx`): taula Dexie **v5**
    `models` (`UserModel`: id `user-…`, nom, `blob`, mida en mm); `db/userModels.ts` (`addUserModelBuffer` valida amb
    `GLTFLoader` + meshopt i mesura; sempre es desa un `.glb`; avís si fa més de 15 MB).
  - **Importar** (`composition/ModelImportDialog.tsx`, finestra amb el progrés, el resultat i les alternatives si falla;
    `composition/modelImport.ts`; pur a `core/assets/modelFiles.ts` i `core/assets/polyHaven.ts` amb tests): fitxers,
    carpeta o `.zip` (`expandPicked`). El model del conjunt (`pickMainModel`: glb › gltf › fbx › blend › usd): `.glb` tal
    qual; `.gltf` + `.bin` + textures amb `GLTFLoader` i un `LoadingManager` que serveix el conjunt amb URL de blob
    (`resolveUri`/`findFile`: `%20`, `../`, camins absoluts, pel nom si la carpeta no hi és; el que falta no va a la xarxa) i
    `GLTFExporter` → un `.glb` (l'ARM de Poly Haven és el `occlusionRoughnessMetallic` estàndard); `.fbx` amb `FBXLoader`
    (`UnitScaleFactor` → metres, Phong → estàndard, textures EXR descodificades). **`.blend`/`.usd` no es poden llegir al
    navegador**: si el nom és de Poly Haven (`<id>_<res>.blend`, `parsePolyHavenName`), es baixa **el mateix model en glTF**
    de l'API (CORS obert, `features/file/polyHavenApi.ts`; `/files/<id>` → `planPolyHavenDownload`: la mateixa resolució,
    com a molt 2k; les textures del zip amb el mateix nom —també el `nor_gl`/`rough` en EXR, passats a PNG— no es tornen a
    baixar) amb el progrés en MB; sense connexió o si no és de Poly Haven, error amb les alternatives (baixar-lo en glTF,
    Blender, `scripts/polyhaven-tree-to-glb.py`). Un zip de **textura** de Poly Haven (`/info` `type` 1) o sense model:
    «No és un model 3D» i les textures a Materials. Després, `addUserModelBuffer` (optimitzar, mesurar, desar). El nom, el
    de l'API si es pot. **«Afegir les textures a Materials»** (`settings/textureMaterials.ts`, `materialsFromTextures`): un
    material de **Simulació** per joc (`groupTextureSets`/`textureSetKey`: el nom del fitxer sense el mapa ni la resolució),
    acabat de foto amb relleu i brillantor (`withTextureSet`, `pbrSetMaterial`, nom únic `uniqueMaterialName`), mida real
    a la finestra (per defecte, la de Poly Haven o la caixa del model). **S'optimitzen en pujar-los**
    (`viewer/optimizeGlb.ts`, a demanda; parts pures i test a `optimizeGlbPlan.ts`): pressupost de **100.000 triangles**; les
    malles opaques es delmen (`MeshoptSimplifier` després de `mergeVertices`, primer amb `LockBorder`, ≥ 25 % del pressupost)
    i les d'alfa no (se'n treuen grups solts i els que queden ≤ 1,5× més grans); textures de més de **1024 px** reduïdes i
    WebP si el navegador en sap codificar (si no, JPEG/PNG). Si ja compleix, no millora o falla, es desa l'original. Avís amb
    `formatReport`. `useModelAssets` = `MODEL_ASSETS` + els de l'usuari; `forgetModel` en pujar-ne o esborrar-ne;
    `removeUserModel` sense UI. El `.moble` porta els que fa servir (base64) i en obrir-lo es tornen a crear amb el mateix id.
- **Render** (`viewer/render/`, `RenderDialog`, «Render» a Opcions de vista, també als ambients; com Cinema 4D): path
  tracing progressiu amb **dos motors que donen la mateixa imatge** (`ChoiceChips` GPU · CPU, per defecte GPU si n'hi ha,
  `mobles:render-engine`): **GPU** (WebGPU, `gpuTracer.ts` + `gpuTracer.wgsl.ts`) i **CPU** (`cpuEngine.ts`: un `pathWorker`
  per nucli). Sense WebGPU, GPU desactivada amb el motiu; si la GPU falla, CPU amb un avís.
  - **La configuració es desa per document** (per decisió de l'usuari; `RenderDialog saveKey`: `ambient:<id>`, `moble:<id>`;
    `renderPrefs.ts`, `localStorage` `mobles:render:<clau>`): opcions, imatge, ambient de llum, resolució, límit, escena,
    format i cel (no un .hdr propi). En obrir-lo mana sobre la de l'escena (`renderPreset`) i la de defecte; `mergeSaved`
    només agafa els valors del mateix tipus. No es desa en obrir (`skipSave`). El motor ja es desava (`mobles:render-engine`).
  - **Comença aturat**: obrir el panell mostra la imatge del visor (`SceneGetter.snapshot`) i «Començar»; després, les
    opcions de qualitat, motor, escena i llum tornen a començar; aturar/continuar, límit de passades, passades per segon.
    **Tancar-lo no el perd** (per decisió de l'usuari, 2026-10-14): un render començat continua calculant amb el panell tancat
    (l'escena és la de quan es va començar: es pot seguir treballant) i, en tornar-lo a obrir, hi és, amb «De nou» (torna a llegir l'escena: el moble pot haver canviat); **el Render és de tota l'app** (per decisió
    de l'usuari, «si canvio d'apartat, que no s'aturi»; `renderStore.ts` `openRender`, `RenderHost.tsx` a `App`, un
    `RenderDialog` per document, `key` = `saveKey`): canviar d'apartat no l'atura i, en tornar al mateix moble o ambient i
    obrir el Render, hi és.
  - **Panell flotant** (per decisió de l'usuari, 2026-10-15: «el render podria anar amb el FloatingPanel» de Chakra;
    `RenderFrame.tsx` sobre la finestra comuna `components/FloatingWindow.tsx`, la de totes les tries i editors, vegeu
    [ui-moduls](ui-moduls.md)): no és modal, es pot continuar treballant mentre
    calcula. A l'ordinador s'obre gran i al mig, es mou per la barra de títol («Render · nom» i el progrés), s'estira per
    les vores i les cantonades, es **minimitza** (només la barra, amb el progrés; el render continua), es maximitza (o doble
    clic a la barra) i es restaura; Esc o ✕ el tanquen (el render continua). Al **mòbil** (`base`), sempre maximitzat a tota
    la pantalla dins de la zona segura, sense moure'l ni minimitzar-lo: ✕ i es torna a obrir amb la píndola. Per sobre de
    les barres de l'app; entre finestres, la que es toca passa al davant; els menús, avisos i diàlegs (confirmacions, «Ja
    hi ha un render») hi queden per sobre. La imatge i les opcions van de costat quan
    el **panell** fa ≥ 720 px d'ample (container query `render`, `renderLayout.ts`), no segons la finestra.
  - **Indicador del render en marxa** (per decisió de l'usuari: «l'app ho ha de mostrar en algun lloc»;
    `app/RenderStatusNav.tsx`): mentre hi ha un render començat (calculant, aturat o acabat), el menú lateral porta
    «Render · nom» amb l'estat i el progrés (`Calculant · 12 / 256 passades · 34 s`; plegat, al tooltip), marcat si el panell
    es veu; al mòbil, una píndola sobre la barra de baix quan el panell és tancat. Tocar-los torna a mostrar el panell
    (restaurat si era minimitzat). El panell publica com va amb `usePublishRenderStatus` (un magatzem a part, perquè no
    redibuixi tota l'app cada segon).
  - **Render d'un altre document** (moble o ambient; `saveKey` diferent): si el d'ara **calcula** o té una **imatge sense
    desar** (passades que no s'han desat en PNG: «Desar PNG» la marca desada fins que en calculi més o torni a començar), es
    pregunta (`RenderConflictDialog`): «Continuar el que corre» (el mostra), «Aturar-lo i començar el nou» (el d'abans es
    perd: el panell es desmunta i el motor s'allibera) o «Cancel·lar». Si està aturat i desat, o sense començar, es fa el nou
    sense preguntar. Des del mateix document, només es mostra. Tests a `renderStore.test.ts`.
  - `extractScene` passa l'escena a triangles + materials + textures; tots dos motors fan servir el **mateix BVH** (`bvh.ts`,
    SAH per calaixos, 8 paraules per node), llums (`lights.ts`) i constants (`shading.ts`). Contracte (`engine.ts`): sumes RGBA
    + AOV (albedo i normal) i nombre de mostres; el diàleg divideix, filtra el soroll, fa el to i desa el PNG.
  - **GPU sense textures de GPU**: tot en buffers d'emmagatzematge (`gpuScene.ts`; textures RGBA8 en un buffer de u32 amb
    bilineal fet a mà, reduïdes a la meitat si no hi caben): així no hi ha el límit de 16 unitats de textura. Respecta
    `maxStorageBufferBindingSize`/`maxBufferSize` (si no hi cap, CPU). Tandes de files de ~10–30 ms (més mostres per passada
    si va de pressa) perquè la pàgina no s'encalli; llegeix el resultat a cada passada sencera (cada cop menys sovint si costa).
  - **Vernís i vellut** (per decisió de l'usuari, com els lacats i els vellut dels catàlegs): `RenderMaterial.coat`
    (capa transparent: GGX nítid `COAT_ROUGHNESS` 0,08, F0 0,04; la base rep `1 − coat·F(n·v)`; es tria en rebotar amb
    `PC = coat·min(0,5; 0,15 + F)` i la densitat és la mescla) i `sheen` (Disney: `sheen·(1 − l·h)⁵`, del color de la tela
    cap al blanc), als dos motors (`COAT`, `CA2`, `CFV`, `PC`, `SH`; a la GPU, `g.zw` del material). Dels materials:
    `MaterialPref.coat` / `sheen` (0–1, «Al render» a l'editor de materials: «Reflex», «Vellut» i «Llum que passa» =
    `translucent`); sense valor, el de l'app
    (`core/model/materialFx.ts`: teles i vellut per id, cuir, parquet, rajoles, ceràmica, pantalla; pedra polida → vernís),
    així les preferències d'abans també en tenen. Lacats brillants nous (`GLOSS_MATERIALS`, v15): «Lacat negre brillant»
    i «Lacat blanc brillant» (taulers, vernís 1).
    Més materials (`RIFT_MATERIALS`, v16): «Roure de fil» i «Noguera de fil» (veta recta, sense flama), «Vidre ambre»,
    «Ceràmica sorra», «Marbre blanc» i «Marbre negre» (pedra polida). v17: «Revestiment de roure de fil»
    (`CLADDING_MATERIALS`; la xapa de foto del «Revestiment de roure» feia flames a la paret) i «Pantalla de lli» amb
    `glow` `LAMPSHADE_GLOW` (2,2; abans 4, sortia blanca cremada; només si encara tenia el 4).
  - **Vista per les finestres** (per decisió de l'usuari): panorames de foto (`backdrops.ts`): Jardí i Mar són fotos
    360° de Poly Haven (CC0, `public/backdrop/*-2k.jpg`, de les JPG tonemapejades de symmetrical_garden_02 i
    simons_town_rocks; a la memòria cau del SW en fer-les servir) i «La meva foto» (`saveBackdropPhoto`, Cache Storage
    `mobles-backdrop-v1`; una foto normal es fa panorama amb `photoPanorama`: 70° davant, mirall als costats, alfa 0 per
    sobre; una 2:1 tal qual). `aimBackdrop` gira el panorama perquè `hero` quedi on mira la càmera. «El cel (HDRI)»: res
    (un .hdr propi es veu tal qual per les finestres i també fa llum; en carregar-ne un es tria sol). `RenderOpts.view`
    l'afegeix com a textura i `RenderScene.backdrop` n'és l'índex (GPU: `P.emit.z` = índex + 1). Només el veuen els raigs
    de càmera directes (`vertex < 0`) que no toquen res: no fa llum; es multiplica per la llum del cel a l'horitzó ×
    `BACKDROP_GAIN` (2). Els models 3D d'arbres (Xicranda, Avet) es poden posar fora (plantilla: `outside: true`).
    Terra de fora (`Ambient3D`): una habitació tancada (3+ parets) amb algun element que surt més de 300 mm de les parets té el terra
    de dins fins a l'eix de les parets (on és el vidre: el parquet no surt per la finestra) i fora un pla 4 mm més avall amb `Ambient.outsideFloorMaterial` (Acabats › «Terra
    de fora»; sense, «Gespa», `sim-lawn`, v17). **v18**: la «Gespa» és una foto (`LAWN_FINISH`,
    `public/textures/grass_lawn/`, 2 × 2 m sense junta) feta amb Blender a partir de les mates d'herba de Poly Haven
    `grass_medium_01` que va passar l'usuari (`scripts/polyhaven-grass.py`, `mode: "tex"`: vista de dalt amb Cycles; relleu i
    brillantor de la lluminositat); la de tela de la v17 hi passa sola, una de retocada no.
  - **Materials**: difús + GGX amb Fresnel, metalls, vidre fi (no fa ombra), retall per l'alfa. **Arestes arrodonides** (2 mm,
    `BEVEL_RADIUS`, `userData.bevel`, `bevelNormal`). **Veta amb relleu** (`userData.grain`). **Normals llises**
    (`RenderScene.normals`, `smoothNormal`; GPU: `encodeNormal`); la geomètrica es queda per desplaçar rajos; cantells corbs
    llisos (`creaseNormals` a `cutoutGeometry`, < 30°). **Mapes PBR** (`normalMap`/`roughMap`, `tangentFrame`/`perturbNormal`).
    **Llums que fan llum** (`MaterialPref.glow` → `RenderMaterial.emission`, mostra directa dels emissors, `emitters.ts`;
    «Llums enceses» + intensitat; la llum que es **veu** d'un emissor amb textura va multiplicada per la textura respecte de
    la seva mitjana, `emK`, als dos motors: a la pantalla de lli es veu la tela en lloc d'una taca blanca; la que fa llum,
    la mitjana; **«Llums · com es veuen»** (`RenderOpts.lampView`, 0,35 per defecte, `LightSetup.lampView`, GPU `P.lamp.z`):
    multiplica només la llum dels emissors que veu la càmera directament (`vertex < 0`), no la que fan a l'habitació:
    la pantalla es veu de tela i no una taca blanca encara que l'exposició automàtica pugi). **Translucidesa** (`MaterialPref.translucent`).
  - **Llum**: sol amb mida (ombres suaus; el reflex s'eixampla amb la mida) i halo ample al cel de dia; cel amb mostra directa
    a cada rebot i MIS: cel llis, **HDRI per importància** (`envSampling.ts`) i, als
    interiors, per les finestres (portals). **Sense ateses**: la indirecta té un màxim relatiu a la llum de l'escena
    (`sceneKey`, la mateixa als dos motors; ×20 indirecta, ×400 directa) i després d'un rebot difús els reflexos són més rugosos
    (`PATH_ROUGHNESS`).
  - **Interiors com les fotos de revista** (ambients): cel de dia (`daySky`, `scene.userData.daylight`) i sol tres vegades més
    fort; les habitacions tancades porten **sostre** (`userData.renderOnly = "ceiling"`, es veu quan la càmera és a dins, al visor i al render;
    **només si hi ha alguna finestra**: sense, l'habitació sortia negra) i els vidres són **portals** (`userData.portal`). Exposició automàtica (mitjana geomètrica de les superfícies al gris del
    18 %, fins a ×40; per defecte als ambients) i temperatura càlida per defecte.
  - **Càmera de fotògraf** (`photoCamera` a `sceneData.ts`, s'aplica a la càmera del visor en començar el render):
    **Verticals rectes** (per defecte; `RenderOpts.straight`): càmera anivellada i descentrament de la lent
    (`RenderCamera.shift`, `ly = nyp·scale + shift`; a la GPU va a `cam3.w`) perquè el centre de la imatge sigui on
    mirava; mirant de més de 60° no es fa. L'enfocament fa servir el raig del centre amb el descentrament. **Objectiu**
    (`focal`: Visor · 24 · 35 · 50 mm, equivalent de 35 mm amb el costat llarg de 36 mm). Tests a `render.test.ts`.
  - **Ambient de llum** (`MOODS`, a Llum): Dia · Capvespre (sol baix, poc cel, llums ×1,5, més càlid) · Vespre (sense
    sol, cel 0,05, llums ×2,5): canvien la llum i l'exposició; al capvespre i al vespre l'exposició automàtica deixa la
    llum mitjana més fosca (`Look.key` 0,1 / 0,06 en lloc de 0,18) i amb més contrast. El fons (raigs que no toquen res)
    es multiplica per la llum del cel als dos motors (al vespre, fosc). Obrir el Render des de l'editor treu els colors
    per rol del mode Ràpid (si no, el render sortia amb els colors de les peces).
  - **Opcions** en seccions plegables (`FoldItem`: Qualitat, Càmera, Escena, Llums, Imatge, amb el resum a la insígnia; a
    Llums, l'Ambient a dalt i les subseccions `size="sm"` **Sol** · **Cel** · **Llum** (la dels materials que fan llum); la
    columna porta 3 px a l'esquerra perquè el desplaçament no talli els controls, i els interruptors són el `Switch` de l'app):
    motor, resolució, rebots, aturar a N passades; format (visor, 3:2, 4:5, 16:9, 1:1) i desenfocament (lent fina, enfoca el centre); escena (habitació de
    Presentació / només terra / cap, `userData.room`); sol, intensitat, ombres, **Cel** (`render/skies.ts`: «Dia» procedural,
    «Núvols» i «Interior» HDRI de Poly Haven reduïts a 1K a `public/hdr/` (el cel que es veu es llegeix **bilineal** als dos motors, `envSky`: amb el píxel més proper sortia a quadres per les finestres; la mostra per importància continua per píxel), precachejats, o un `.hdr` propi, `hdr.ts`, que es pot
    girar; el de defecte a Preferències › Visor 3D › «Cel del render»: mobles «Interior», ambients «Núvols»); **Imatge, a
    l'instant**: exposició EV, contrast, saturació, «Corba de color» AgX (per defecte) · ACES (`tonemap.ts`), vinyeta (0,2),
    resplendor (**apagada per defecte**, per decisió de l'usuari: l'aura dels leds es veia postissa), fons estudi / blanc /
    transparent. La finestra ocupa **tota la pantalla** a totes les mides (zona segura als quatre costats); al mòbil, la
    imatge a dalt i les opcions a sota.
  - **Reduir el soroll**: Open Image Denoise (`oidn.ts`, `oidn-web`, WebGPU) si hi ha WebGPU i
    `public/oidn/rt_hdr_alb_nrm.tza` és un fitxer de pesos de debò (> 10 KB i no un punter de Git LFS: `isWeightsFile`); si
    no, o si falla, À-Trous (`denoise.ts`, guiat per l'albedo i la normal, en un worker, cada cop menys sovint). Els pesos (1,8 MB) van amb l'app però no es precachegen. Al costat
    de l'opció surt quin filtre es fa servir («Intel OIDN» / «bàsic»).
  - Tests: `render/render.test.ts` (BVH contra força bruta, CDF de l'HDRI, bevel, empaquetat, normals llises).

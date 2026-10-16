# Icones

> Tret del `CLAUDE.md` (2026-10-15) perquè no es carregui sencer a cada sessió. Llegeix-lo abans de tocar aquesta part.

### Icones (catàleg fix, `react-icons/lu`)
Una icona = un significat a tota l'app. No en triïs d'altres per a aquestes accions; si en cal una de nova, afegeix-la aquí.
Botons només d'icona: `aria-label` + `Tooltip` en català. Accions principals: icona + text.

| Àmbit | Acció | Icona |
|---|---|---|
| Navegació | Mobles (el cub: un moble) · Ambients · Objectes | `LuBox` · `LuHouse` · `LuSofa` |
| Navegació | Editor · Peces · Nesting / taulers · Exportar | `LuDraftingCompass` · `LuList` · `LuLayoutGrid` · `LuDownload` |
| Navegació | Tornar (‹ a les barres) · Plegar/desplegar menú · Preferències | `LuChevronLeft` · `LuPanelLeftClose` / `LuPanelLeftOpen` · `LuSettings` |
| Tipus de moble («+ Nou moble» i targetes) | Moble · Cuina · Armari · Taula · Peces lliures (`lliure`, d'abans) · Objecte | `LuBox` · `LuCookingPot` · `LuContainer` · `LuTable` · `LuPuzzle` · `LuSofa` |
| Zones | Dividir en vertical (divisor vertical, zones esquerra/dreta) | `LuSquareSplitHorizontal` |
| Zones | Dividir en horitzontal (travesser, zones dalt/baix) | `LuSquareSplitVertical` |
| Zones | Divisió vertical · horitzontal (un compartiment porta la icona del seu contingut, igual a l'arbre, a la capçalera i a «Front»: `composition/zoneIcons.ts`) | `LuColumns2` · `LuRows2` |
| Zones | Eliminar divisió (la mida de cada zona és a la Divisió, sense icona pròpia) | `LuUngroup` |
| Contingut | Obert · Prestatges (i la secció «Opcions de l'interior» del compartiment) · Porta · Calaixos · Barra de penjar | `LuSquareDashed` · `LuRows3` · `LuDoorClosed` · `LuArchive` · `LuShirt` |
| Contingut | Abatible · Reixeta · Front fix | `LuPanelBottom` · `LuGrid3X3` · `LuSquare` |
| Composició | Afegir · Duplicar · Eliminar | `LuPlus` · `LuCopy` · `LuTrash2` |
| Composició | Objecte de referència · Model 3D (`.glb`) · Menú del document | `LuScan` · `LuSprout` · `LuEllipsis` |
| Composició | Peces lliures, Encaixos (flat-pack) de la peça i del moble (peça, Efecte peça) · Peça/objecte que talla | `LuPuzzle` · `LuScissors` |
| Composició | Moure a l'esquerra · a la dreta (menú de l'arbre) | `LuArrowLeft` · `LuArrowRight` |
| Front | Una porta · Dues portes · Abatible avall · amunt · Ranures horitzontals · verticals (reixeta) | `LuDoorClosed` · `LuFlipHorizontal2` · `LuArrowDownToLine` · `LuArrowUpToLine` · `LuAlignJustify` · `LuColumns3` |
| Front | Recobrents (fronts) | `LuSquareStack` |
| Forma | Rectangle · Arrodonit · Oval (tauler de taula) · Efecte obstacle | `LuRectangleHorizontal` · `LuSquircle` · `LuCircle` · `LuShield` |
| Inspector | Mides · Caixa (base, fons, tapa, laterals, estil dels fronts i folgances) · Portes (del mòdul; com el Front de la porta) · Materials · Unió (l'espiga del mòdul; la de la categoria Unions) · Ferratges (inspector de la peça lliure, Preferències i visor; no al mòdul) · Front · Pare | `LuMoveDiagonal` · `LuFrame` · `LuDoorClosed` · `LuPalette` · `LuBolt` · `LuWrench` · `LuDoorClosed` · `LuArrowUp` |
| Inspector | Base: Directe a terra · Sòcol · Potes (la de la categoria Potes, no la Taula) · Sense base | `LuArrowDownToLine` · `LuPanelBottom` · `LuFootprints` · `LuSquareDashedBottom` |
| Inspector | Fons en ranura · Cargolat darrere · Encastat · Sense fons | `LuLayers2` · `LuDrill` · `LuInspectionPanel` · `LuSquareDashed` |
| Inspector | Resum del moble · Suport general · Tipus del mòdul · Posició | `LuBox` · `LuPanelBottom` · el del tipus (`LuBox` moble, `LuRefrigerator` electrodomèstic) · `LuMove` |
| Inspector | Grup (peces lliures) · Enganxada (a un mòdul, al terra / a la paret) · CNC de la peça (la de Màquina CNC) | `LuGroup` · `LuLink` · `LuFactory` |
| Forma | Forma a mida / perfil · Cilindre (la caixa, `LuBox`) | `LuSpline` · `LuCylinder` |
| Render | Qualitat · Càmera · Escena · Llums · Sol · Cel · Llum (materials que fan llum) · Imatge | `LuGauge` · `LuCamera` · `LuHouse` · `LuLightbulb` · `LuSun` · `LuCloudSun` · `LuLamp` · `LuImage` |
| Inspector | Anterior · Següent · Accions de la selecció (menú) | `LuChevronLeft` · `LuChevronRight` · `LuEllipsis` |
| Preferències | Tema (dia/nit/sistema) · Color principal | `LuSunMoon` (`LuSun` · `LuMoon` · `LuMonitor`) · `LuCheck` a la mostra triada |
| Ferratges | Confirmar (importat) · Tornar a la proposta · Afegir forat | `LuCheck` · `LuUndo2` · `LuPlus` |
| Ferratges | «Com va muntat»: 3D · Pla (com Plànol · 3D dels ambients) | `LuRotate3D` · `LuMap` |
| Preferències | Visualització · Ferratges · Calaixos (contingut) · Guies (categoria) · System 32 · Cassoleta · Imants | `LuScanEye` · `LuWrench` · `LuArchive` · `LuRailSymbol` · `LuCircleDot` · `LuCircleDashed` · `LuMagnet` |
| Ferratges (categories) | Frontisses · Plaques · Guies · Calaixos de doble paret (jocs) · Elevables i abatibles · Unions · Suports de prestatge · Potes · Taules · Portes corredisses i plegables · Tiradors · Pressió i imants · Perfils i marcs · Llums (jocs de llum) · Penjar · Electrodomèstics (també la secció «Electrodomèstic» del compartiment) · Altres | `LuCircleDashed` · `LuSquareDot` · `LuRailSymbol` · `LuPackageOpen` · `LuPanelBottom` · `LuBolt` · `LuCircleDot` · `LuFootprints` · `LuTable` · `LuDoorOpen` · `LuGripHorizontal` · `LuMagnet` · `LuMinus` · `LuLightbulb` · `LuAnchor` · `LuRefrigerator` · `LuPackage` |
| Ferratges (joc de llum) | Seccions de l'editor d'un joc de llum (`LightSections`): Del catàleg · Mecanitzat · Llargades (barres) · Sistema elèctric · Hipòtesis | `LuBookOpen` · `LuCircleDot` · `LuListOrdered` · `LuPackageOpen` · `LuBookOpen` |
| Ferratges (joc) | Seccions de l'editor del joc: Del catàleg · Llargades i números · Regles de tria · Components · Peces de fusta · Mecanitzats del joc · Hipòtesis · Prebroca dels cargols (Preferències › Regles de mecanitzat) | `LuBookOpen` · `LuListOrdered` · `LuRoute` · `LuPackageOpen` · `LuLayers2` · `LuCircleDot` · `LuBookOpen` · `LuDrill` |
| Ferratges | Baixar el model 3D (.glb) d'un importat · Baixar un plànol de muntatge | `LuBoxes` · `LuFileDown` |
| Ferratges | Ferratges col·locats a mà (inspector de la peça lliure; el del mòdul no la té; la de «Ferratges» del visor) | `LuWrench` |
| Ferratges | Col·locat a mà (llista de l'inspector): Editar · Duplicar · Eliminar | `LuPencil` · `LuCopy` · `LuTrash2` |
| Ferratges | Seccions de l'editor: General · Importat del fabricant (només els ja importats) · Plànols i documents · Placa · Mides · Quantitat per alçada · Distància entre forats · Mecanitzats | `LuInfo` · `LuUpload` · `LuFileText` · `LuSquareDot` · `LuMoveDiagonal` · `LuListOrdered` · `LuRuler` · `LuCircleDot` |
| Preferències | Visor 3D (els materials per defecte als mòduls nous porten la de Materials, `LuPalette`) | `LuLampFloor` |
| Fitxer | Desar com a fitxer (`.moble`, també els ambients) · Obrir fitxer (Mobles, Objectes, Ambients) · Pujar un fitxer (preferències) | `LuSave` · `LuFolderOpen` · `LuUpload` |
| Models 3D | Triar fitxers… · Triar carpeta… (importar un model) · Afegir les textures a Materials | `LuFileUp` · `LuFolderOpen` · `LuPalette` |
| Editor | Estructura · Propietats · Opcions de vista | `LuListTree` · `LuSlidersHorizontal` · `LuSlidersVertical` |
| Assistent IA | Assistent (pestanya de l'Editor i pàgina de Preferències) · Clau de l'API · Provar la clau | `LuMessageSquare` · `LuKeyRound` · `LuPlugZap` |
| Assistent IA | Enviar · Aturar · Adjuntar una foto o un plànol · Nova conversa · Eina feta · Sense connexió | `LuSendHorizontal` · `LuCircleStop` · `LuImagePlus` · `LuMessageSquarePlus` · `LuWrench` · `LuWifiOff` |
| Editor | Pestanyes 3D · Alçat · Foto | `LuBox` · `LuLayoutPanelLeft` · `LuCamera` |
| Estat | Avisos de fusteria · Desfer · Refer | `LuTriangleAlert` · `LuUndo2` · `LuRedo2` |
| Foto | Foto · Referència · Distància · Rectangle | `LuCamera` · `LuCrosshair` · `LuMoveHorizontal` · `LuRectangleHorizontal` |
| Foto | Origen (0,0) · Treure/tancar · Eines | `LuLocateFixed` · `LuX` · `LuPencilLine` |
| Foto | Mida estimada · Mida real (cinta) · Línia del terra · Fondària | `LuEye` · `LuCircleCheck` · `LuArrowDownToLine` · `LuArrowUpFromLine` |
| Visor | Modes Per peça · Presentació | `LuShapes` · `LuSparkles` |
| Visor | Enquadrar · Forats · Explosionat / muntat · Ferratges · Render · Veure a casa (AR) | `LuVideo` · `LuCircleDot` · `LuExpand` / `LuShrink` · `LuWrench` · `LuAperture` · `LuView` |
| Visor | Ampliar / reduir 3D · Obertura portes · Opacitat de les peces | `LuMaximize2` / `LuMinimize2` · `LuDoorOpen` · `LuBlend` |
| Ambients | Seleccionar · Paret (ploma) · Habitació · Calibrar · Plànol de fons | `LuMousePointer2` · `LuPenTool` · `LuBrickWall` · `LuPencilRuler` · `LuImageUp` |
| Ambients | Finestra · Porta · Moure a un grup · Grup (carpeta) · Projectes | `LuAppWindow` · `LuDoorOpen` · `LuFolderInput` · `LuFolder` · `LuFolders` |
| Ambients | Moble · Objecte / bloc · Pestanyes Plànol · 3D · Girar · Peces (plànol) · Interior | `LuBox` · `LuSofa` · `LuMap` · `LuRotate3D` · `LuRotateCw` / `LuRotateCcw` · `LuLayers` · `LuEye` |
| Ambients | Càmera bloquejada / lliure · Càmera d'abans | `LuLock` / `LuLockOpen` · `LuUndoDot` |
| Selecció múltiple | Alinear a l'inici · al mig · al final (X i Z; Y amb les horitzontals) · Repartir | `LuAlignStartVertical` · `LuAlignCenterVertical` · `LuAlignEndVertical` (`LuAlignEndHorizontal` · `LuAlignCenterHorizontal` · `LuAlignStartHorizontal`) · `LuAlignHorizontalDistributeCenter` / `LuAlignVerticalDistributeCenter` |
| Arbre | Element visible / amagat · bloquejat / lliure (l'ull i el cadenat de cada fila) | `LuEye` / `LuEyeOff` · `LuLock` / `LuLockOpen` |
| Galeries | Historial · Catàleg · Col·leccions de mobles | `LuHistory` · `LuBookOpen` · `LuLibrary` |
| Exportar | DXF (CNC) · STEP 3D · CSV de nesting · CSV de peces · GLB · Avançat | `LuScissors` · `LuCuboid` · `LuLayoutGrid` · `LuFileDown` · `LuBoxes` · `LuSettings2` |
| Materials | Categories de la llista: Taulers · Fons · Simulació | `LuLayers3` · `LuLayers2` · `LuSprayCan` |
| Màquines | Màquina CNC (pàgina, grups del detall i export Maestro) · Per defecte · Triar carpeta… · Triar fitxers… | `LuFactory` · `LuStar` · `LuFolderOpen` · `LuFileUp` |
| Màquines | Regles de mecanitzat · Distribució dels taulers (girar peces) · Vista CAM | `LuRoute` · `LuRotateCw` · `LuMonitorCog` |
| Materials | Posar una foto / mapa (relleu, brillantor) · Carregar joc de textures… · Carpeta… | `LuImagePlus` · `LuFileUp` · `LuFolderOpen` |
| Materials | Seccions de l'editor: Aspecte · Fabricació · Per defecte als mòduls nous | `LuSwatchBook` · `LuFactory` · `LuStar` |
| Editor de formes | Selecció (node) · Arrodonir la punta · Com funciona (ajuda) | `LuMousePointer2` · `LuSquircle` · `LuCircleHelp` |

Les vistes Davant, Darrere, Esquerra, Dreta i Dalt van amb **text**, sense icona (no hi ha vista «3D»: és «Enquadrar»). Compte: a Lucide, `square-split-horizontal`
té la línia **vertical**. Per això és la de "dividir en vertical".

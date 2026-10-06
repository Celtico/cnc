# Ferratges: estudi i proposta (millores v1, §8–10)

## Estat (2026-10-06)

- **F1 · Motor i migració: fet.** `core/model/hardware.ts` (esquemes zod, `HARDWARE_SLOTS`, valors inicials amb els números
  d'abans, `libraryFromLegacy`, `kitFromLegacy`, `migrateModuleHardware`, `fixHardwareDefaults`, `hardwareRefIds`,
  `replaceHardwareRefs`), `core/model/expr.ts` (avaluador sense `eval`), `core/build/hardware.ts` (`applyHardware`,
  `resolveOps`, `drillSpec`, `cupSpec`…`handleSpec`, `slotSpec`, `resolveKit`). Tots els ferratges de §1 que fan forats
  (cassoleta, System 32, espiga, guia, braç d'abatible, imant, tirador) passen pel motor; preferències **v19** (no v18:
  vegeu README) i mòduls en llegir. **Proves d'or idèntiques** (sense `UPDATE_GOLDEN`). Diferències amb aquest estudi:
  - Cap item s'ha quedat al camí vell. Però **la col·locació és del constructor** (`buildModule`: on van les cassoletes a la
    filera, els forats de guia, les espigues de cada unió, els imants de la reixeta): l'item en dona els números (`params`,
    `count`, `pitch`, `lengths`) i els forats (`ops`: Ø, fondària, tag; al tirador, a la cassoleta i a l'abatible també la
    posició relativa). L'`Anchor` genèric (§4) i el `HardwareInstance` són per als ferratges manuals (F4).
  - El model no porta `groove`/`pocket`, `envelope`, `asset`, `bom` ni `requires` (F3–F4).
  - La guia i el braç d'abatible tenen els seus números (`frontOffset`, `offset`); abans feien servir `system32.edgeOffset`
    i `hinge.cupOffset` del mòdul (la migració els copia: res no canvia de lloc).
  - Cada front només pot triar el seu ferratge principal (porta → frontissa, calaixos → guia, abatible → braç), com a còpia
    a `front.hardware`; el mòdul té una còpia de cada lloc (`Module.hardware`, a Fusteria es pot canviar).
- **F2 · Preferències › Ferratges: fet** (graella per categories, editor a pantalla completa amb el dibuix del patró i un
  detall acotat, paràmetres, per defecte, eliminar amb substitut, selector a la porta, calaixos, abatible i Fusteria).
  Pendent de F2: editar els mecanitzats (taula d'operacions; ara només lectura), exportar/importar ferratges sols (ara van
  amb les preferències) i l'avís «hi ha una versió nova» quan la biblioteca canvia (`version` no es puja en editar).
- **Pendents: F3** (nivells de visualització Cap · Forats · Volum · 3D, volums i xocs `hardware-clash`, GLB per item),
  **F4** (ferratges manuals, unions de 2 peces, minifix, confirmat, suport de prestatge, potes, placa de frontissa, perfil
  LED, push com a item, llista de ferratges a Exportar) i **F5** (importar DXF, BXF, STEP).

> Estudi de l'àrea **Ferratges** de [`PROMPT-millore-v1.md`](../prompt/PROMPT-millore-v1.md) (§8 proveïdors, §9 gestió,
> §10 visualització). Document de disseny: **no toca codi**. Les mides de ferratges concrets que no surten del codi actual
> van marcades **[a confirmar]** (regla del `CLAUDE.md`: si no és clar, preguntar, no inventar).

## 0. Resum i decisió

1. **Biblioteca de ferratges com a dades**, no com a codi: cada ferratge és un `HardwareItem` (mecanitzats paramètrics en
   coordenades de peça + regles d'ancoratge i de quantitat + volum simplificat + model 3D opcional). El codi només porta el
   **motor** que l'aplica i els valors inicials (com ja passa amb materials i màquines).
2. **On**: una pàgina pròpia **Preferències › Ferratges** (ja existeix amb aquest nom, però és un formulari de números)
   convertida en **graella + editor a pantalla completa**, el mateix patró que Materials. **No** una quarta galeria al menú
   global: els ferratges no són documents que es dissenyen, són recursos del taller com els materials i les màquines.
3. **Aplicar-los**: dos camins que acaben al mateix motor. (a) **Per regla** (el de sempre: la porta posa frontisses, el
   calaix posa guies, el fons encastat posa espigues) però la regla diu **quin ferratge de la biblioteca** fa servir;
   (b) **manual** («Afegir ferratge» a l'inspector d'una peça o d'un compartiment → triar ferratge → triar peça(es) →
   posició amb ancoratges → mecanitzats automàtics). El (a) és el 90 % de la feina i ja funciona; el (b) és nou.
4. **Visualització en tres nivells** (Forats · Volum · 3D) amb el 3D carregat a demanda (GLB per `HardwareItem`, instanciat).
5. **Importació realista** en una PWA sense backend: **GLB** (ja suportat per als models 3D) per al 3D, **DXF 2D** de
   patrons de forats (Hettich els dona així) per proposar els mecanitzats, i **edició manual**. STEP al navegador només com a
   fase llunyana (cal un WASM d'OpenCascade, dependència fora del stack). **BXF de Blum** (XML) és l'únic format «de
   fabricant» amb forats de debò, però és per a programari partner: només s'estudia, no es promet.
6. Pla en 5 fases (§6): primer **migrar el que ja hi ha** (frontisses, System 32, espigues, guies, imants, abatibles,
   tiradors) a la biblioteca **sense canviar cap forat** (proves d'or idèntiques), després UI, nivells de visualització,
   manuals i importació.

## 1. Què hi ha ara a l'app

| Ferratge | On és | Mecanitzat que fa (tag del `Hole`/`Cutout`) |
|---|---|---|
| Frontissa (cassoleta) | `buildModule.addCups`, `Hardware.hinge` (Ø35 · P13 · 22,5) | Ø35 cara A a la porta (`hinge`); quantitat `hingeCount` 2/3/4/5 fins a 900/1600/2100; s'enganxa al **mig de dos forats** System 32; separació ≥ Ø + 10 |
| Placa de frontissa | (cap) | **No es fa**. Es confia que la filera System 32 la sosté. El programa real del taller (TopSolid) sí que fa Ø2 × 5,15 a parells de 32 mm a 37 mm del cantell (`docs/maestro-xcs.md` §9, «pilots de base de frontissa») |
| System 32 | `system32Ys`, `Hardware.system32` (37 · 32 · Ø5 · P12) | fileres als laterals i divisors (`system32`), regulables i plaques |
| Espigues | `dowelJoint`, `dowelsAlong`, `threeAlong`, `Hardware.dowel` | cara + cantell (`dowel`), mai mitja unió, `holeClash` |
| Guies de calaix | `buildModule` (calaixos), `Hardware.drawer` | Ø5 P12 al lateral del moble i Ø4 P10 a la caixa, a `zFront − 37` i −256 (`slide`); llargades de guia, jocs |
| Abatible | `buildFlap` | Ø8 P12 (`flap`) a `cupOffset` |
| Imants | `Hardware.magnet` (Ø10 · P5 · 60) | reixetes i trapes (`magnet`) |
| Tirador | `handle()` | 2 × Ø5 passants a 128/96/64 (`Cutout circle`, `handle`) |
| Push (Tip-On) | `Panel.push` | cap forat; post-procés i avís |
| Barra, LED, porta de vidre | `extras` | no de CNC; «Elements sense nesting» |
| Visual | `components/viewer/Hardware.tsx` | dibuixa cassoleta + braç **a partir dels forats `hinge`**, tirador de barra a partir dels `handle`, potes |

Observacions:
- Els paràmetres són a `Settings.hardware` i **cada mòdul en guarda una còpia** (`applySettingsToModule` →
  `Module.hardware`). És a dir, un `.moble` ja porta els números dels ferratges del mòdul (el `CLAUDE.md` diu que el
  `.moble` no porta preferències: per als ferratges no és del tot així; la còpia és bona, fa el moble reproduïble).
- **No hi ha** minifix/excèntriques, confirmats, suports de prestatge, potes amb forat, perfils d'alumini ni LED amb ranura
  (pregunta oberta al taller), frontisses per a marc d'alumini (pregunta oberta).
- Els exports ja ho saben fer tot amb `holes` / `grooves` / `cutouts`: DXF per capes `DRILL_D{Ø}_P{prof}`, `.xcs` amb broca
  pel Ø, STEP amb forats, CSV del taller. **Un ferratge nou no necessita cap canvi als exports** si es redueix a aquestes
  primitives. Aquesta és la clau del disseny.

## 2. Com ho fan els altres (§8)

### Hettich
- **Hettich Plan** (configurador de carcasses) **ja no existeix**: Hettich diu que «cada cop més clients fan servir el seu
  propi CAD» i aposta per donar dades als CAD dels altres ([hettich plan](https://www.hettich.com/en-au/services/hettich-plan)).
- **Hettich CAD**: 2D/3D en DWG/DXF de descàrrega directa, «més de 50 formats» per correu, **patrons de forats en DXF 2D
  per a la CNC**, seccions 2D i carcasses 3D; integració amb ~30 CAD (AutoCAD, SolidWorks, SketchUp…) per «determinar els
  punts de forat del muntatge» i comprovar xocs ([Hettich CAD](https://web.hettich.com/en-ro/planning/hettich-cad),
  [planning](https://web.hettich.com/en-dk/planning)).
- Idea per a nosaltres: **el patró de forats com a DXF 2D** és el format més útil i fàcil (cercles en un pla amb capes):
  el podem llegir al navegador i convertir en `MachiningOp`.

### Blum
- **Product configurator** (web, sense instal·lar): entra mides del moble i **gruix del material**, tria el sistema
  (frontisses, guies, elevables, caixes…) i dona llista de peces (PDF/Excel), plànols i **CAD 2D/3D** en formats
  estàndard; desa configuracions a «My Library» ([configurador](https://blum.com/product-configurator)).
- **Product database**: dades de cada producte, CAD «en tots els formats habituals», plànols de muntatge
  ([product database](https://www.blum.com/us/en/services/e-services/productdatabase/)). Cal compte E-SERVICES.
- **CAD/CAM data service**: 3D, **dibuixos 2D de producció per a les posicions dels forats**, situacions de muntatge
  (espai que ocupen) i **macros CAM** per a la CNC en formats WOP de diversos fabricants de màquines
  ([CAD/CAM data service](https://www.blum.com/id/en/services/industrial-production/cad-cam-dataservice/)).
- **BXF (Blum Exchange Format)**: XML amb «el ferratge, informació de muntatge, **patrons de forats, posicions dels forats**»;
  cal que el programari destí tingui la interfície. **DYNALOG** connecta la planificació amb CAD/CAM (interfícies pròpies
  per a AutoCAD i SolidWorks; la resta, dels partners) ([FAQ](https://www.blum.com/gb/en/services/faq/)). SWOOD és partner
  ([Blum · SWOOD](https://www.blum.com/gb/en/services/industrial-production/cad-cam-interface/software-partners/swood/)).
- Idees: (1) **mateixa separació que nosaltres** entre «3D per veure» i «2D de forats per fabricar»; (2) el configurador
  demana **gruix del material** i mides i en surt el ferratge i els forats → és exactament una regla paramètrica; (3) la
  «situació de muntatge» (espai que ocupa) = el nostre **volum simplificat**.

### SWOOD (EFICAD, sobre SolidWorks)
- **Connectors**: biblioteca feta de peces/conjunts de SolidWorks (espigues, lamellos, **excèntriques**, tenons…); es
  detecten les superfícies de contacte entre taulers i, **amb un script, es reparteixen segons la llargada del cantell**;
  SWOOD «talla automàticament els forats necessaris» als taulers ([Javelin](https://www.javelin-tech.com/blog/2023/02/swood-design-basics/),
  [fitxa SolidWorks](https://files.solidworks.com/partners/pdfs/swood-design_vf1856.pdf)).
- **SWOODBox**: subconjunts paramètrics (calaixos, frontisses, prestatges, divisors, passacables) que s'arrosseguen a un
  buit, es redimensionen i **recalculen la quantitat** de components amb la mida nova.
- Biblioteques de **Blum, Hettich, Grass, Lamello** incloses ([fòrum myCAD](https://forum.mycad.visiativ.com/t/y-a-t-il-des-catalogues-de-quincaillerie-dans-solid-works-swood/100684)).
  Els connectors es comparteixen entre instal·lacions amb un fitxer propi, `Assemblages.efiass`
  ([Solid Solutions](https://images.solidsolutions.co.uk/blog/2024/10/how-to-import-connectors-in-swood-design-with-connector-library-exchange)).
- Export: llistes de tall, **llista de ferratges**, programes, plànols (XLS, PDF, CSV, XML…).
- Idees: **connector = mecanitzats + regla de repartiment per llargada**; **box = conjunt paramètric amb quantitats
  per mida** (el nostre calaix ja ho és); **llista de ferratges** a l'export.

### SolidWorks (Design Library / smart components)
- Un **smart component** es fa en un conjunt amb una peça «maniquí», el component i les **operacions en context** (talls);
  «Make Smart Component» els lliga. En inserir-lo, demana **cares de referència** de la peça nova i hi recrea els talls
  («Insert Smart Features»), redimensionats per aquelles referències
  ([engineersrule](https://www.engineersrule.com/?p=3250), [CATI](https://www.cati.com/blog/work-smarter-not-harder-using-smart-components-solidworks/)).
- Traducció: **el ferratge porta els seus talls definits respecte a referències** (cara, cantell, origen); aplicar-lo =
  resoldre les referències a la peça concreta. És el nostre `anchor` (§4).

### Conclusions de l'estudi
- Ningú no mecanitza des del STEP: **els forats viatgen com a dades** (BXF, macros CAM, DXF de forats, features de SolidWorks).
  El 3D és per veure i per xocs. Coincideix amb el nostre `CLAUDE.md` («El STEP no serveix per mecanitzar»).
- Totes separen **tres representacions**: producte 3D, espai de muntatge (volum) i patró de forats 2D. → els nostres tres nivells.
- La part «intel·ligent» és sempre una **regla paramètrica** (quantitat per mida, distàncies a cantells, gruix del tauler),
  no la geometria.

## 3. Respostes a les preguntes del §9–10

### 3.1 On es gestionen?
**Preferències › Ferratges** (grup Fabricació, on ja és), redissenyada com Materials:
- Graella de `GalleryCard` per **categoria** (acordió, com Materials), cercador, «Afegir» (biblioteca inicial · en blanc ·
  importar). Targeta: miniatura (render del GLB o, sense, dibuix 2D dels forats), nom, fabricant/ref, «n forats · Ø…».
- **Editor a pantalla completa** (`MaterialEditorDialog` com a model): a l'esquerra la **vista** (2D del patró sobre una
  peça d'exemple + 3D si n'hi ha), a la dreta el formulari: General (nom, categoria, fabricant, ref, preu) · Mecanitzats
  (taula d'operacions) · Col·locació (ancoratge, quantitat) · Volum · Model 3D.
- Els **paràmetres d'ofici** que ara són a la pàgina (jocs del calaix, llargades de guia) es queden com a camps del
  ferratge corresponent (la guia porta les seves llargades i jocs).
- Per què no una galeria pròpia: el menú global és per a documents (Ambients · Objectes · Mobles). Els ferratges són com
  materials i màquines: **recursos del taller** que els mobles referencien. Una galeria nova trencaria la regla de
  coherència del §7.

### 3.2 Representació: 3D, 2D o les dues?
**Les dues**, amb papers diferents (com Blum i Hettich):
- **2D (sempre)**: el patró de mecanitzats a la cara/cantell de la peça. És **la veritat de fabricació**, surt del model de
  dades (no d'un fitxer) i es dibuixa amb el mateix SVG que el plànol de peça de la pàgina Peces.
- **3D (opcional)**: GLB per veure, xocs i render. Sense GLB, el **volum simplificat** (caixes/cilindres paramètrics) fa de 3D.

### 3.3 Aplicació al moble
- **Per regla (automàtic, el de sempre)**: el contingut del compartiment (porta, calaix, abatible, prestatge regulable,
  fons encastat…) té una **ranura de ferratge** («Frontissa», «Guia», «Unió del fons») amb un valor per defecte de
  Preferències i canviable a l'inspector (`ChoiceChips` amb els de la categoria). Res de clicar peces: la regla ja sap
  quines peces toca (porta + lateral, caixa + lateral). És el model del **SWOODBox** i del configurador de Blum.
- **Manual (nou)**: per a ferratges que no pertanyen a cap contingut (un suport de penjar, un minifix en un flat-pack, un
  passacables de ferratge, unes potes concretes):
  1. A l'inspector de la peça (o des del + d'un grup nou «Ferratges» a l'arbre): «Afegir ferratge» → calaix amb la biblioteca.
  2. **Peça(es)**: la seleccionada; si el ferratge és d'**unió** (2 peces), l'app proposa la peça que hi toca (contacte
     cantell-cara, com ja fa `dowelJoint`) i l'usuari la confirma.
  3. **Posició**: per ancoratge (cantell de referència + distància, al mig, a N repartits, a la filera System 32 més
     propera), no per arrossegament lliure: així és paramètric i segueix les mides.
  4. **Mecanitzats automàtics**: es generen al `build` (no es desen a la peça): canviar la mida del moble els recalcula.
- Les dues vies produeixen el mateix `HardwareInstance` (§4) i passen pel mateix motor.

### 3.4 Categories
Proposta (camp `category`, llista tancada com `MATERIAL_CATEGORIES`, icona Lucide de la taula d'icones):

| id | Nom | Exemples | Peces |
|---|---|---|---|
| `hinge` | Frontisses | cassoleta Ø35, frontissa d'angle, de vidre, per a marc d'alumini | porta + lateral |
| `plate` | Plaques de frontissa | placa en creu/recta a System 32 | lateral |
| `slide` | Guies | de boles, ocultes amb sincronització | caixa + lateral |
| `lift` | Elevables i abatibles | compàs, braç d'abatible | front + lateral |
| `connector` | Unions | espiga, minifix/excèntrica, confirmat, lamello, clip d'unió | 2 peces |
| `shelf-support` | Suports de prestatge | punt Ø5 System 32, suport amagat | lateral (+ prestatge) |
| `leg` | Potes i sòcols | pota regulable, clip de sòcol | base |
| `handle` | Tiradors | barra 128/96/64, pom, gola, tirador de cantell | front |
| `push` | Obertura per pressió | Tip-On, imant | front + cos |
| `profile` | Perfils | perfil LED, gola d'alumini, marc d'alumini | ranura a peça |
| `wall` | Penjar | penjador regulable, regleta | lateral / fons |
| `misc` | Altres | passacables, ventilació, rail | qualsevol |

«Ferratges per a vidre» i «d'alumini» no són categories sinó **etiquetes** (`tags: ["vidre"]`): una frontissa de vidre és
una frontissa. Així el selector de la porta les troba totes.

### 3.5 Importació
| Font | Al navegador? | Què n'obtenim | Proposta |
|---|---|---|---|
| **GLB/glTF** | Sí (ja: `GLTFLoader`, `optimizeGlb`) | 3D per veure | **Fase 3.** El mateix pujador que els models 3D; s'alinea a l'origen del ferratge |
| **DXF 2D de forats** (Hettich) | Sí (lector propi, com el del Maestro; només `CIRCLE`/`LWPOLYLINE`/capes) | posicions i Ø; fondària de la capa o a mà | **Fase 4.** Proposa `MachiningOp` que l'usuari valida |
| **STEP** (tots els fabricants) | Només amb OpenCascade WASM (~10 MB, `occt-import-js`); **dependència nova → preguntar** | 3D (malla); els forats no (són geometria) | **Futur.** Recomanació: passar-lo a GLB amb Blender/FreeCAD (com ja expliquem amb els models, `MODEL_FORMAT_HELP`) |
| **BXF** (Blum, XML) | Tècnicament sí (XML) | forats i muntatge | **Només estudi**: format de partners, sense especificació pública que hàgim vist; no es promet |
| **Macros CAM / WOP** | No | — | No (són de cada màquina; nosaltres generem l'MSL) |
| **JSON propi** | Sí | tot | **Fase 2**: exportar/importar ferratges com les preferències (un fitxer per compartir entre màquines o amb el taller) |

**Llicències**: el CAD de Blum i Hettich es descarrega amb compte per a ús en planificació. **L'app no n'ha de portar cap
de sèrie** (ni GLB ni dades copiades): la biblioteca inicial porta ferratges **genèrics** amb mides de la convenció del
taller i **noms genèrics** («Frontissa cassoleta Ø35», no «Blum CLIP top»); el fabricant i la ref són camps que omple
l'usuari. Els fitxers que l'usuari importa es queden a Dexie (privats, com els seus models 3D).

### 3.6 Tres nivells de visualització (§10)
Nou control a Opcions de vista substituint l'interruptor «Ferratges» (`LuWrench`): `ChoiceChips` **Cap · Forats · Volum · 3D**
(`mobles:viewer-hardware`, el valor d'ara `true` → «Volum»).

| Nivell | Què es pinta | Cost | Com |
|---|---|---|---|
| **Forats** | només mecanitzats (forats, ranures, buidats) a les peces | el d'ara | ja existeix (`InstancedMesh` de forats per peça, modes `Forats`) |
| **Volum** | caixes/cilindres del `envelope` de cada instància | ~1 draw call per tipus | `InstancedMesh` per `HardwareItem.id`; material gris translúcid o metall; serveix per a **xocs** (la mateixa geometria que `refTouchesBox`) |
| **3D** | GLB de cada ferratge | alt, a demanda | `loadModel` lazy per `item.asset` (els d'ara: `models3d.ts`); **instàncies** (`modelInstance` comparteix geometria i materials); fins que carrega, es veu el volum; LOD: per sota de N píxels de pantalla (`usePixelScale`), volum |

Regles: miniatures, nesting i export **mai** carreguen GLB de ferratges; Presentació i Render sí (si hi ha model); AR/GLB
de sortida porten el nivell triat (per defecte Volum). A l'iPhone (`LOW_MEMORY`), pressupost de triangles per ferratge
més baix (`optimizeGlb` amb 5.000 en lloc de 100.000: una frontissa en té prou).

Els **xocs** (§10: «interferències») es comproven sempre amb el volum, no amb el GLB: avís `hardware-clash` (ferratge
contra peça, ferratge contra ferratge: cassoleta contra placa, guia contra prestatge fix…). Com `overlap` i `holeClash`.

## 4. Model de dades

Tot a `core/model/hardware.ts` (zod, sense React ni three). Coordenades **de peça** (u, v, z) amb la convenció del
`CLAUDE.md` (u costat llarg, cara A a z = T, cantells 1 dalt · 2 dreta · 3 baix · 4 esquerra).

```ts
/** Expressió paramètrica: un número o una fórmula curta sobre variables conegudes. */
type Expr = number | string // "T/2", "L-37", "cupOffset", "min(22.5, W/4)" — avaluador propi, sense eval()

/** Variables que l'avaluador coneix: T (gruix), L, W (de la peça), H (alçada de porta/zona),
 *  i els `params` del ferratge (cupOffset, pitch…). */

type MachiningOp =
  | { kind: "drill"; face: "A" | "B"; u: Expr; v: Expr; d: Expr; depth: Expr; tag?: string }
  | { kind: "edgeDrill"; edge: 1 | 2 | 3 | 4; along: Expr; d: Expr; depth: Expr; z?: Expr /* per defecte T/2 */ }
  | { kind: "groove"; face: "A" | "B"; u: Expr; v: Expr; w: Expr; h: Expr; depth: Expr }
  | { kind: "pocket"; face: "A" | "B"; outline: [Expr, Expr][]; depth: Expr } // buidat cec (cassoleta rectangular, Tip-On)
  | { kind: "through"; cut: "circle" | "slot" | "rect"; u: Expr; v: Expr; w: Expr; h?: Expr } // → Cutout

/** A quina peça va cada grup d'operacions (un ferratge d'unió en toca dues). */
interface HardwareTarget {
  key: string             // "door", "side", "a", "b"
  label: string           // «Porta», «Lateral»
  roles?: PanelRole[]     // peces permeses (door/flap; side/divider…)
  ops: MachiningOp[]      // en coordenades d'AQUESTA peça, relatives al punt d'ancoratge
}

/** On cau cada còpia del ferratge sobre la peça principal. */
interface Anchor {
  edge: 1 | 2 | 3 | 4 | "center"      // cantell de referència (el de la frontissa, el de davant)
  offset: Expr                          // distància al cantell (22,5 de la cassoleta, 37 de la filera)
  along: AlongRule                      // on al llarg del cantell
  snap?: "system32-mid" | "system32" | "none" // a la filera del lateral (el que fa `addCups` ara)
  mirror?: boolean                      // frontissa esquerra/dreta
}

type AlongRule =
  | { kind: "fixed"; at: Expr[] }                           // [100, "H-100"]
  | { kind: "spread"; count: CountRule; endOffset: Expr }   // repartides entre extrems
  | { kind: "pitch"; pitch: Expr; edgeOffset: Expr }        // System 32
  | { kind: "pairs"; offset: Expr; diameter: Expr }         // = dowelsAlong

/** Quantitat segons la mida: la taula de `hingeCount` com a dades. */
interface CountRule { by: "H" | "L" | "W" | "edge"; steps: { upTo: number; n: number }[]; else: number }

/** Volum simplificat (nivell «Volum» i xocs), en coordenades del ferratge (origen = ancoratge). */
type EnvelopePart = { kind: "box"; min: [Expr, Expr, Expr]; max: [Expr, Expr, Expr] }
                  | { kind: "cyl"; at: [Expr, Expr, Expr]; d: Expr; h: Expr; axis: "u" | "v" | "z" }

interface HardwareItem {
  id: string                       // "hinge-cup35" (inicials) o "user-…"
  name: string                     // «Frontissa cassoleta Ø35»
  category: HardwareCategory       // §3.4
  tags?: string[]                  // "vidre", "alumini", "sense molla"
  maker?: string; ref?: string; price?: number; url?: string
  params: Record<string, number>   // cupDiameter: 35, cupDepth: 13, cupOffset: 22.5…  (UI: NumRow per paràmetre)
  requires?: { thickness?: [number, number]; minWidth?: Expr; minHeight?: Expr } // si no, avís i no es fa
  anchor: Anchor
  targets: HardwareTarget[]        // 1 (cassoleta, tirador) o 2 (espiga, minifix, guia, placa+porta)
  envelope: EnvelopePart[]
  asset?: { modelId: string; offset?: [number, number, number]; rot?: [number, number, number] } // GLB de Dexie
  bom?: { unit: "u" | "m"; perInstance: number } // llista de ferratges a l'export
  extra?: { material: string }     // si genera un element sense nesting (barra, perfil LED)
  version: number                  // per saber si una instància és d'una versió anterior
}

/** Ferratge posat en un moble (dins la composició, va al .moble). */
interface HardwareInstance {
  id: string
  item: string                     // HardwareItem.id
  snapshot: HardwareItem           // còpia en aplicar-lo (com Module.hardware ara): el .moble és reproduïble
  panels: Record<string, string>   // target.key → Panel.id (manuals) o «slot» (per regla)
  anchor?: Partial<Anchor>         // sobreescriptures de l'usuari (manuals)
  params?: Record<string, number>  // sobreescriptures puntuals
}
```

Decisions del model:
- **Fórmules com a cadenes amb un avaluador propi** (`core/model/expr.ts`: + − × ÷, parèntesis, `min`/`max`, variables;
  sense `eval`, testejat). Una alternativa sense fórmules (només números i «des del cantell N») es queda curta per a
  `H − 100` o `T / 2`.
- **`snapshot`** a la instància: el mateix criteri que `Module.hardware` d'ara. Si la biblioteca canvia (`version` més
  alta), l'inspector diu «Hi ha una versió nova del ferratge» amb «Actualitzar». Obrir un `.moble` amb un ferratge que no
  tens: es fa servir el snapshot i es proposa «Afegir a Preferències» (com els materials que falten).
- **Tag**: cada `drill` porta `tag = item.category` (o el seu): els exports, `holeClash`, el visor i les proves d'or ja
  treballen amb tags (`hinge`, `system32`, `dowel`, `slide`…). Es mantenen els d'ara a la migració.

### 4.1 Motor i encaix al pipeline
```
Composition ──► buildModule (regles: porta → slot «hinge» → HardwareItem triat)
                     │                         └─ manuals: comp.hardware[] (HardwareInstance)
                     ▼
            core/build/hardware.ts  applyHardware(item, ctx) → { holes, grooves, cutouts, extras, envelopes, warnings, bom }
                     │   1. resol l'ancoratge (cantell, offset, along, snap a la filera de `rowYs`)
                     │   2. CountRule → posicions; requires → avisos `hinge`/`hardware`
                     │   3. per target: ops → Hole/Groove/Cutout en coordenades de la seva peça
                     │      (2 peces: punts al moble i `toLocal`, com `dowelJoint`: mai mitja unió)
                     ▼
            Panel.holes / grooves / cutouts  ──► holeClash · golden · DXF · .xcs · STEP · CSV (SENSE CANVIS)
            build.hardware: { instance, panelIds, envelopes (món), bom }  ──► visor (Volum/3D), xocs, llista
```
- `applyHardware` és **pur** i és l'única porta: `addCups`, el bloc de guies, `dowelJoint` i `buildFlap` passen a cridar-lo
  amb l'item per defecte. Els helpers d'ara (`addFaceHole`, `addEdgeHole`, `dowelJoint`, `system32Ys`, `snap`) **es
  reutilitzen** dins del motor: no es reescriuen.
- Nou al resultat del build: `CompositionBuild.hardware` (instàncies resoltes amb els volums al món i la llista). El visor
  deixa d'endevinar els ferratges pels forats (`Hardware.tsx` ara mira `tag === "hinge"`).
- **Exports**: res a canviar per als mecanitzats. Nou i petit: **llista de ferratges** (CSV i secció al LLEGEIX-ME
  d'Exportar, com fa SWOOD; agrupada per item, quantitat, ref, fabricant). El STEP «només per a CAD» podria portar els
  volums com a sòlids (interruptor com `step-extras`), mai al del taller.
- **Res amagat compta**: el slot de ferratge d'un contingut amagat no genera res (`visibleModule`), i entra a
  `hiddenState.test.ts`.

### 4.2 Migració del que ja hi ha (sense canviar cap forat)
Valors inicials a `DEFAULT_HARDWARE_LIBRARY`; els números surten d'avui (`DEFAULT_CABINET`, `DEFAULT_HARDWARE`, `buildModule`):

| Item inicial | Ara | Com queda |
|---|---|---|
| `hinge-cup35` «Frontissa cassoleta Ø35» | `addCups` + `hingeCount` + `hardware.hinge` | `params {cupDiameter 35, cupDepth 13, cupOffset 22.5}`; target `door`: `drill A u=0 v=cupOffset d=cupDiameter depth=cupDepth tag "hinge"`; anchor `edge` del costat de la frontissa, `snap "system32-mid"`, `along spread` amb `CountRule by H [900→2, 1600→3, 2100→4] else 5`, `endOffset 100`; `requires.minWidth "cupOffset+cupDiameter/2+3"`; separació mínima Ø + 10 com a `minGap` del motor |
| `plate-s32` «Placa de frontissa (System 32)» | (cap; només la filera) | **nou, apagat per defecte**: target `side` amb 2 forats a parells de 32 a 37 mm. Mides **[a confirmar]** amb el germà (el programa real fa Ø2 × 5,15) |
| `system32` «Filera System 32» | `system32Ys` + `hardware.system32` | `along pitch 32 edgeOffset 37`, `drill Ø5 P12 tag "system32"`; la lògica de trams, `max(retirada + 37, …)` i divisors (T − 1)/2 es queda al constructor: és geometria del moble, no del ferratge |
| `dowel-8` «Espiga Ø8» | `dowelJoint` + `hardware.dowel` | 2 targets (`butt` edgeDrill, `through` drill), `along pairs`/`threeAlong`; «mai mitja unió» dins del motor |
| `slide-ball` «Guia de boles» | bloc de calaixos + `hardware.drawer` | targets `side` (Ø5 P12) i `box` (Ø4 P10) a `zFront−37` i −256; `params` amb llargades, jocs i gruixos de la caixa (són de la guia) |
| `flap-arm` «Braç d'abatible» | `buildFlap` (Ø8 P12) | target `flap` |
| `magnet-10` «Imant Ø10» | `hardware.magnet` | target `front`, `along fixed [cornerOffset, "L-cornerOffset"]` |
| `handle-bar` «Tirador de barra» | `handle()` | `through circle` × 2 amb `params.pitch` 128/96/64 (tria la més gran que hi cap) i `envelope` de la barra; el `BarHandle` del visor passa a ser el 3D/volum del ferratge |
| `push-tipon` «Push (Tip-On)» | `Panel.push` | sense ops (de moment), `bom` i post-procés |
| `rail-25`, `led-16x8`, `glass-frame` | `extras` | `extra.material`; el LED tindrà `groove` quan el taller doni la ranura (pregunta §1 del prompt) |

Migració de dades (preferències **v18**, additiva): `Settings.hardware` → `Settings.hardwareLibrary` (items inicials amb
els números de l'usuari) + `Settings.hardwareDefaults` (`{ hinge: "hinge-cup35", slide: "slide-ball", … }`). Els mòduls:
`Module.hardware` es llegeix com a sempre i `normalizeComposition` el converteix en snapshots dels items per defecte.
**Criteri d'acceptació**: `pnpm test` sense `UPDATE_GOLDEN` → les proves d'or (`__golden__/*.json`, inclòs
`exports.json`) **no canvien ni un byte**. Si canvien, la migració està malament.

## 5. Riscos i dependències amb altres àrees
- **Proves d'or i `holeClash`**: tota la fase 1 es valida amb elles; és la xarxa de seguretat.
- **Preguntes al taller** que bloquegen ferratges concrets: ranura del perfil LED, frontisses de marc d'alumini, pilots de
  la placa (Ø2 × 5,15?), minifix (Ø de la caixa, distància al cantell, fondària per a 16/19 **[a confirmar]**).
- **UX/Coherència**: el selector de ferratge ha de ser `ChoiceChips`/calaix com `MaterialSelect` (res de desplegables);
  l'editor, el mateix patró de pantalla completa que Materials.
- **3D/Render**: el nivell 3D afegeix GLB a l'escena; cal `releaseModelGpu` com als models i comptar-los a la memòria de l'iPhone.
- **Import/export**: la llista de ferratges és nova a Exportar; el `.moble` porta snapshots (mida petita: JSON). Els GLB
  d'usuari de ferratges, com els models (base64) només si es fan servir.
- **Nesting**: cap impacte (els ferratges no són peces; els `extra` ja van a «Elements sense nesting»).

## 6. Pla per fases

| Fase | Què | Mida | Depèn de |
|---|---|---|---|
| **F1 · Motor i migració** | `core/model/hardware.ts` (zod), `expr.ts` (avaluador + tests), `core/build/hardware.ts` `applyHardware`; `addCups`, guies, espigues, abatible, imants i tirador hi passen; preferències v18; `normalizeComposition` dels mòduls. **Proves d'or idèntiques** | **L** (≈ 1–1,5 setmanes) | — |
| **F2 · Preferències › Ferratges** | graella per categories + editor a pantalla completa (dibuix 2D del patró sobre peça d'exemple, taula d'operacions, ancoratge, quantitat, volum); «Per defecte» per slot; exportar/importar JSON; slot de ferratge a l'inspector de porta/calaix/abatible (`ChoiceChips`) | **M–L** | F1 |
| **F3 · Visualització** | `CompositionBuild.hardware`; Opcions de vista Cap · Forats · Volum · 3D; volums instanciats; GLB per item a demanda (pujador de models reutilitzat, pressupost baix); avís `hardware-clash`; `Hardware.tsx` llegeix instàncies, no tags | **M** | F1 (F2 per pujar GLB) |
| **F4 · Ferratges manuals i nous** | «Afegir ferratge» a peça/compartiment + grup a l'arbre; unions de 2 peces (detecció de contacte reutilitzant la de les espigues); items nous: minifix, confirmat, suport de prestatge, potes, placa de frontissa, perfil LED amb ranura (quan el taller respongui); llista de ferratges a Exportar | **L** | F1, F2; respostes del taller |
| **F5 · Importació** | lector DXF de patrons (cercles/capes → `drill` proposats, l'usuari valida fondàries); estudi BXF; STEP→GLB només si s'accepta la dependència WASM (preguntar) | **M** (DXF) / **?** (STEP) | F2 |

Ordre recomanat: **F1 → F2 → F3 → F4 → F5**. F3 pot anar en paral·lel a F2 (agents diferents) un cop F1 és a dins. F1 és
imprescindible (el «substituir TopSolid» necessita ferratges com a dades: el programa real ja fa forats de placa que
nosaltres no fem); F2 i F4 importants; F3 millora d'usabilitat/rendiment; F5 futura.

### Tests de cada fase
- F1: golden sense diff; tests unitaris d'`expr`, `CountRule` (= `hingeCount`), ancoratges amb snap System 32, unions de 2
  peces sense mitja unió; `hiddenState.test.ts` amb el slot de ferratge.
- F2: preferències v17 → v18 idempotent; `repairValue` d'un item dolent només treu aquell item.
- F3: volums al món = transformació de la peça (test pur al `core/`); `hardware-clash` amb casos (cassoleta vs placa).
- F4: un minifix a un flat-pack fa forats a les dues peces o a cap; llista de ferratges = suma d'instàncies.
- F5: DXF de mostra → mateixos forats que l'item fet a mà.

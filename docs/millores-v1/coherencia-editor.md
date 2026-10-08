# Millores v1 — Auditoria de coherència: editor del moble i sistema de ferratges

> **Estat (2026-10-07)**: implementat en sis commits, en aquest ordre: **A1 + A2 + F1** (llocs resolts a demanda, còpies
> dels llocs senceres o res, una sola `usedHardwareSlots`); **E1** (`Zone.fronts`, `switchFront`, `setFront` no toca els
> prestatges); **B** (motors `rail`, `ledProfile`, `glassFrame`; `Zone.rail/led = { hardware? }`; secció «Accessoris»;
> imant de la reixeta, marc de vitrina i pota pel mateix `HardwarePick`; push = «Cap (push)» del tirador, una sola font
> amb el tancament del joc —correcció de fabricació a la prova d'or `kit-dtc-ht11`: els dos fronts push-open perden els
> forats del tirador—; comptes de «Ferratges» amb barres, perfils LED i marcs); **C1–C4** (Estil i Tirador a Interior ›
> Fronts i calaixos, «Com el mòdul» / «Còpia pròpia», `UI_PATHS` a avisos i ajudes); **D** (Fons / Fons del calaix /
> Fondària / Folgança, fila «Fons del calaix» a Materials, icones diferents per a Ferratges, Potes i Guies; els noms de
> peça dels fitxers del taller no canvien); **F2–F5** (taula per `applySettingsToModule`, comptes del que s'ha construït
> —jocs, braços, potes—, `Settings.kitPilot` com a única font, «Com a Preferències» a les folgances). Sense fer: A3 (text
> ja corregit; material propi fet), A4 (avisos per compartiment), C5 (el retranqueig es queda a Fronts i calaixos amb el
> nom sencer), D2 («Caixa» → «Cos»), D3 (moure espiga i System 32 de Fusteria a Ferratges), E3, F6, F7.

Auditoria independent (lectura del codi a `main` c07b9e0 + sondes Vitest fora del repo, `/tmp/claude-0/audit/`). Per a
cada troballa: **on** (fitxer:línia), **què** és incoherent, **quina regla** del `CLAUDE.md` trenca i **l'arranjament
més petit**. Ordenades per impacte dins de cada bloc; al final, el rànquing global i la proposta d'estructura dels
inspectors. Les línies són les del codi en el moment de l'estudi.

Regles que es fan servir com a vara de mesurar (totes del `CLAUDE.md`):
- **R1 «Res amagat compta»** (Fabricació): el que la UI amaga es *conserva*, però `buildModule` construeix des de
  `visibleModule`; dos mòduls que es veuen iguals fan les mateixes peces **i els mateixos avisos**.
- **R2 «Avisos ≠ post-processos»** / «avisos només amb problemes de debò»: un avís ha de venir d'alguna cosa que el mòdul
  construeix *ara*.
- **R3 «Mai mig ferratge»**: un item que no serveix → el d'inici i avís; un ferratge es llegeix sencer o res.
- **R4 Regla d'or «coherència i cohesió»**: un concepte, un component; una dada, una font; el mateix gest fa el mateix.
- **R5 Editor › Propietats**: «Controls nous: decideix a quin nivell pertanyen i posa'ls a l'inspector d'aquell nivell»;
  «L'inspector del mòdul és de la caixa; el de l'Interior, dels fronts i calaixos».
- **R6 Ferratges com a dades**: tot ferratge és un `HardwareItem` amb motor, a la biblioteca, amb una còpia al moble.

---

## A. Avisos que no lliguen amb l'estat actual

### A1. Els set llocs de ferratge del mòdul es validen sempre, també els que el mòdul no fa servir  **[alt]**
- **On**: `src/core/build/buildModule.ts:297-305` (`constructor` → `resolveKit(kit, …)`), `src/core/build/hardware.ts:285-295`
  (`resolveKit` resol `hinge, system32, dowel, slide, flap, magnet, handle` d'entrada) i `:264-282` (`slotSpec`: si
  `fn(item)` llança, `onError(...)` → avís `hardware` «<lloc>: «X» no és del tipus que toca. Es fa servir el d'inici»).
- **Què passa**: l'avís surt encara que cap peça faci servir aquell lloc. Sonda: un mòdul **només amb calaixos** amb una
  espiga posada al lloc «Frontissa» → `hardware: Frontissa: «Espiga Ø8» no és del tipus que toca…`. És exactament la
  captura del propietari: Interior passat a **Abatible** i encara surt «Guia de calaix: «DTC MAGIC-PRO HT14 F (238)» no és
  del tipus que toca» (vegeu A2 per què l'item del lloc «guia» ha deixat de ser un joc vàlid).
- **Regla**: R1 (la UI amaga aquests llocs: `JoineryForm`/`FrontsForm` només ensenyen `usedHardwareSlots`, però el
  constructor sí que els llegeix) i R2.
- **Arranjament**: resoldre cada lloc **a demanda** (`this.kit[slot]` mandrós, o `resolveKit` només dels llocs de
  `usedHardwareSlots(visibleModule(m))`, `core/model/usedHardware.ts`), o bé a `visibleModule` posar l'item d'inici als llocs
  que el mòdul no fa servir (com es fa amb la resta de camps amagats) i afegir el cas a `hiddenState.test.ts`.

### A2. La còpia del joc al lloc «Guia de calaix» del mòdul no es llegeix «sencera o res»: pot quedar sense `kit` i llavors és «del tipus que no toca»  **[alt]**
- **On**: `src/core/model/composition.ts:36` (`FrontHardwareSchema = repairAtomically(…)`: el ferratge d'un **front**
  és atòmic) ↔ `src/core/model/hardware.ts:295-303` (`ModuleHardwareKitSchema`: els items dels **llocs del mòdul** són
  `HardwareItemSchema` normals, reparats camp a camp per `repairValue`, `core/model/repair.ts:61-73`, que treu els
  opcionals invàlids: «invàlid: tret»). `isDrawerKit` (`hardware.ts:576`) exigeix `engine === "drawerKit" && !!item.kit`.
- **Què passa**: un `kit` que no passa `HardwareKitSchema` (còpia d'una versió anterior del joc, fitxer `.moble` d'abans de
  la v24, dada tocada) es **treu** de la còpia del mòdul; l'item queda amb nom de joc, `engine: "drawerKit"` i sense `kit`
  → `slotSpec("slide")` ja no el deixa passar i el motor `slideSpec` diu «no és del tipus que toca». Sonda: amb el `kit`
  tret el missatge és literalment el de la captura; amb el `kit` sencer no surt cap avís (ni amb abatible).
- **Regla**: R3 (al front sí, al mòdul no: una mateixa dada —còpia d'un item— es repara de dues maneres) i R4.
- **Arranjament**: `ModuleHardwareKitSchema` amb els set camps `repairAtomically(HardwareItemSchema)` i el `fallback`
  = l'item d'inici del lloc (`DEFAULT_MODULE_HARDWARE[slot]`), amb avís de reparació; i que el missatge d'un item
  `drawerKit` sense `kit` digui «joc de calaix malmès», no «no és del tipus que toca».

### A3. «Fons de 16 mm en ranura…» surt quan el mòdul té fons de 16 en ranura, sigui quin sigui el contingut: correcte com a avís, però la UI del joc hi empeny  **[mitjà]**
- **On**: `buildModule.ts:361-367` (`back-groove`, condició `c.back === "groove" && d.tb > d.t − 6`); `ZonePanel.tsx:298-302`
  (fila «Fons» del joc: «el joc demana 16 mm… El material és el del fons del moble (o el del cos si fa 16 mm)»);
  `buildModule.ts:1763-1765` (`drawer-bottom`: «comprova que aquest material es ven en 16 mm»).
- **Què passa**: l'avís és coherent amb l'estat (el fons del **moble** és de 16). Però el text del joc i l'avís
  `drawer-bottom` diuen a l'usuari que el fons del calaix surt del «fons del moble»; la reacció natural és posar el fons
  del moble a 16 → `back-groove`. El gruix del fons del calaix (`TB`) i el del fons del mòdul són dues coses amb la mateixa
  paraula (vegeu D1) i la UI les lliga.
- **Regla**: R4 (una dada, una font) i D1.
- **Arranjament**: el material del fons dels calaixos ha de ser un camp propi (`Carcass.drawerBottomMaterial`, o
  del joc: «Fons del calaix» a Fronts i calaixos) amb un `MaterialSelect` de `backChoices` filtrat pel gruix que demana
  la guia o el joc; `drawer-bottom` i la fila «Fons» del joc deixen de parlar del «fons del moble».

### A4. Avisos d'una zona que ja no existeix o que ha canviat de contingut: el `zoneId` no es comprova  **[baix]**
- **On**: `EditorScreen.tsx:813-815` (amb un compartiment triat es mostren **tots** els avisos del mòdul, no els de la
  zona) i `:1224-1233` («Anar-hi» amb `w.zoneId`).
- **Què passa**: no és un error de dades (els avisos es recalculen a cada build), però la secció «Avisos de fusteria» de
  l'inspector d'un compartiment ensenya avisos d'altres compartiments sense dir de quin són; amb A1 això es llegeix com
  «l'avís és d'aquí».
- **Arranjament**: a l'inspector d'un compartiment, primer els de `w.zoneId === zone.id` (amb el títol «D'aquest
  compartiment») i la resta plegats «Del mòdul»; o el nom del compartiment davant del missatge, com es fa amb el mòdul.

### A5. Revisió codi per codi (res més que depengui d'estat amagat)
Tots els altres codis es generen des de peces construïdes o de `visibleModule`: `back-groove`/`back-inset` (només amb
aquell tipus de fons), `inset` (només `d.inset`), `hollow`, `mitre` (`jointApplies`), `rail`/`shelves`/`shelf-span`
(`visibleZone` treu `shelves/rail/led` amb calaixos o dividit), `drawer-*`, `hinge`/`handle`/`push` (al posar la peça),
`no-side`, `layout`, `grille-open-ratio`, `material-heat`, `cable-hole`, `ref-cut`, `collision`/`overlap`, `hole-clash`,
`same-size`, `invalid-part`, `hanging`, `unknown-material`/`thickness-not-listed` (fora del build). **L'única font que
no respecta R1 és `hardware` via `resolveKit` (A1/A2)** i, de retruc, el ferratge d'un front que el front ja no és
(`front.hardware` d'un abatible que abans era calaix: sonda → «Braç d'abatible: «DTC…» no és del tipus que toca»; avui
no passa perquè `defaultFront` llença el front sencer, vegeu E1, però passarà si E1 es resol conservant `hardware`).
L'avís `push` (`:1199`) surt un cop per mòdul encara que la secció triada sigui un compartiment sense front: acceptable,
és del mòdul.

---

## B. Ferratges amagats com a interruptors de fusta

Regla R6: «tot ferratge és un `HardwareItem` amb motor». Avui hi ha **set** ferratges que no ho són, repartits per quatre
seccions amb quatre controls diferents (`Switch`, `ChoiceChips`, `IconChoice`, `HardwareSelect`):

| # | Ferratge | On és avui | Control | Dada | Compta a «Ferratges»? | Mecanitzat |
|---|---|---|---|---|---|---|
| B1 | **Barra de penjar** | Interior/compartiment › **Prestatges** › «Penjador» (`ZonePanel.tsx:230-239`) | `Switch` | `Zone.rail: boolean` | No (`ruleHardwareCounts` no la compta) | Cap (ni els suports) |
| B2 | **Tira LED** (perfil 16 × 8) | **Prestatges** › «Llum» (`ZonePanel.tsx:240-249`) | `Switch` | `Zone.led: boolean` | No | Pendent (ranura del perfil) |
| B3 | **Push (Tip-On)** | Mòdul › **Caixa** › «Tiradors: Barra / Sense (push)» (`CarcassForm.tsx:177-187`) | `ChoiceChips` | `fronts.handles: "bar" \| "none"` | Sí («Push (Tip-On)», per `Panel.push`) | Cap (l'avís `push` diu quin ferratge cal) |
| B4 | **Imants de la reixeta** | Front › Reixeta › «Muntatge: Imants / Frontisses» (`ZonePanel.tsx:447-458`) | `ChoiceChips` | `front.mount` | Sí (forats `magnet`) | Sí (`magnetSpec`) — el ferratge existeix, però es tria com a «muntatge», i a l'Interior com a «Imant» |
| B5 | **Marc d'alumini + vidre** (vitrina) | Front › Porta › «Vitrina» (`ZonePanel.tsx:381-387`) | `Switch` | `front.glass: boolean` | No (ni perfils ni frontisses de marc) | Cap (frontisses de marc pendents) |
| B6 | **Potes** | Mòdul › **Caixa** › Base «Potes» + «Pota» (`CarcassForm.tsx:47-62, 71-75, 415-432`) | `IconChoice` + `HardwareSelect` | `Base.hardware` | Sí («Potes», 4 fixes) | Sí si és importada; les genèriques, res |
| B7 | **Passacables** | Ja no té UI (`migrateCableHoles` → objectes que tallen) | — | `CarcassExtras.cableHoles` (obsolet) | — | — (categoria «Altres» els esmenta a `hardware.ts:85`) |

A més, la biblioteca **ja té les categories buides** per a B1 i B2/B5: «Penjar» (`wall`, `hardware.ts:84`) i «Perfils i
marcs» (`profile`, `:83`: «Perfils d'alumini i de LED, marcs d'alumini per a portes de vidre»), però cap motor les sap
col·locar; els items que s'hi importen són «només 3D» i es col·loquen a mà. Això és el que el propietari assenyala: **la
barra i la LED són ferratges i viuen al sistema de fusta** (Prestatges), mentre la biblioteca té la casella buida.

**Arranjament (per blocs petits, en aquest ordre)**:
1. **Motors nous** `rail` i `ledProfile` a `HARDWARE_ENGINES` i dos llocs més a `HARDWARE_SLOTS` (`rail`: «Barra de
   penjar», categoria `wall`; `led`: «Perfil LED», categoria `profile`), amb un item inicial cadascun (tub Ø25 a 50 del
   sostre; perfil 16 × 8 a 20 del davant) i els seus `params` (Ø, distància al sostre; secció del perfil, retirada) i
   `targets` (suports de la barra al lateral: 2 forats; ranura del perfil al prestatge: pendent del germà, `ops` buits
   fins llavors). `buildRail`/`buildLed` llegeixen els números de l'item (com `cupSpec`): les peces d'`extras` no canvien.
2. **Dada**: `Zone.rail?: boolean` → `Zone.rail?: { hardware?: HardwareItem }` i igual per `led` (migració en llegir,
   `true` → `{}` = el del mòdul; els dos booleans continuen acceptats). `visibleZone` i `hiddenState.test.ts` igual.
3. **UI**: les dues files surten de **Prestatges** i van a una secció pròpia del compartiment, **«Accessoris»**
   (`LuShirt`/`LuLamp`), amb `HardwarePick` (el mateix control que la frontissa) i «El del mòdul»; a l'Interior › Fronts i
   calaixos, els per defecte com els altres llocs. «Prestatges» torna a ser només fusta: Quantitat · Regulables · A ras ·
   Gruixuts.
4. **Comptes**: `ruleHardwareCounts` afegeix «Barres de penjar» (1 per compartiment) i «Perfils LED» (n, amb el llarg) a
   partir d'`extras` (ids `rail-`/`led-`), i els suports.
5. **B3** es resol a C2 (push = opció del tirador, no de la caixa). **B5**: `front.glass` → `front.frame?: HardwareItem`
   (motor `glassFrame`, categoria `profile`) quan el taller digui les frontisses; fins llavors, almenys que compti a
   «Ferratges» («Marc de vidre: 1»). **B4**: a la reixeta, la fila «Muntatge» només tria imants o frontisses i el ferratge
   concret (quin imant) es tria amb `HardwarePick` a sota, com a les portes (avui només es pot canviar a l'Interior).
   **B6**: moure «Pota» de Caixa a «Fronts i calaixos»… no: la pota és de la caixa; es queda, però amb el mateix
   `HardwarePick` (avui és un `HardwareSelect` cru amb `emptyLabel="Genèriques"`, l'única tria de ferratge del moble que
   no passa per `HardwarePick`). **B7**: treure l'esment dels passacables de la categoria «Altres» o fer-lo real.

---

## C. Coses que es trien des de dos llocs; precedència i etiquetes

### C1. Fronts: Recobrents/Encastats i Tiradors Barra/Sense són a **Caixa** del mòdul; Joc front–cos i els ferratges dels fronts a **Interior › Fronts i calaixos**  **[alt]**
- **On**: `CarcassForm.tsx:165-187` (secció `structure` = «Caixa»: «Fronts» i «Tiradors»), `CarcassForm.tsx:331-345`
  (`FrontsForm` a l'Interior: Joc front–cos · Joc entre fronts · Retranqueig prest. · frontissa/guia/braç/imant/tirador).
- **Què**: `module.fronts` s'edita des de dos inspectors: `style` i `handles` al mòdul, `outerGap` i `betweenGap` a
  l'Interior. L'usuari tria «Sense (push)» a Caixa i la fila «Tirador» desapareix de tots els fronts a l'Interior sense
  que res ho digui allà. El `CLAUDE.md` (Editor › Propietats) diu «L'inspector del mòdul és de la caixa; el de
  l'Interior, dels fronts i calaixos».
- **Regla**: R5, R4.
- **Arranjament**: moure les files «Fronts» (estil) i «Tiradors» a `FrontsForm` (Interior › Fronts i calaixos), al
  costat de «Tirador». La icona `LuSquareStack` (Recobrents) ja és del grup «Front» al catàleg d'icones.

### C2. Push: tres dades que diuen el mateix i no es miren  **[alt]**
- **On**: `fronts.handles === "none"` (`buildModule.ts:1179-1200`: cap forat + avís `push` «als calaixos, guies amb
  push»), `Front.kit.closing: "push" | "pushSoft"` del joc (`ZonePanel.tsx:287-289`, text «push-open (sense tirador…)»),
  i «Tirador» de cada front (`HardwarePick slot="handle"`).
- **Què**: cap reconciliació (`drawerKit.ts` no llegeix `handles`; `buildModule` no llegeix `closing`): es pot tenir
  **push-open al joc i forats de tirador al front**, o «Sense (push)» al mòdul amb el joc «Suau» i l'avís que demana
  «guies amb push» mentre el joc que hi ha és el que ho decideix.
- **Regla**: R4 (una dada, una font), R6.
- **Arranjament**: el «Tirador» d'un front pot ser **«Cap (push)»** (una opció més del `HardwarePick` del tirador, com
  «Genèriques» a la pota): `front.handle = { kind: "none" }`/`null` → `Panel.push`. `fronts.handles` passa a ser només
  el **per defecte** del mòdul (a Fronts i calaixos). Amb un joc amb `closing` push, el tirador per defecte del calaix
  és «Cap (push)» i el `KitFields` ho diu; si l'usuari posa un tirador igualment, avís `push` concret del calaix.

### C3. Etiquetes de precedència: «la del mòdul» sempre en femení i en tres formes  **[mitjà]**
- **On**: `HardwarePick.tsx:18` (`" · la del mòdul"` a l'ajuda), `HardwareSelect.tsx:58` (`" · la del mòdul"` al botó),
  `HardwareSelect.tsx:160` («El del mòdul» / «El del mòdul (joc de calaix)» a la fila del calaix), `HardwareSelect.tsx:58`
  («(del moble)») i la insígnia «Del moble» (`:113`).
- **Què**: la captura ho ensenya: «Braç d'abatible · la d…», «Ø8 × 12 · la del mòdul», «Tirador de barra · la …». El
  braç i el tirador són masculins; la fila del calaix diu «El del mòdul». «Del moble» (còpia pròpia) i «del mòdul»
  (heretat) són dos conceptes amb la mateixa preposició.
- **Arranjament**: a `HARDWARE_SLOTS` un camp `gender: "m" | "f"` (o millor, una etiqueta neutra per a tots: **«Com el
  mòdul»**, igual que «Com el cos» del material del fons, `CarcassForm.tsx:259,263`), i «Còpia pròpia» en lloc de «Del
  moble». Un sol helper `inheritedLabel(slot)` fet servir pel botó, l'ajuda i la fila.

### C4. Fusteria vs Fronts i calaixos: la partició és correcta però els textos antics apunten al lloc d'abans  **[mitjà]**
- **On**: `buildModule.ts:359` («retira'ls almenys … (Fusteria › Retranqueig dels prestatges)» → ara és a Interior ›
  Fronts i calaixos, `CarcassForm.tsx:338`); `HardwarePlacements.tsx:163` («es canvien a Fusteria i al Front de cada porta…»
  → frontissa/guia/braç/tirador ja no són a Fusteria); `HardwarePick.tsx:7-8` (comentari: «a la Fusteria del mòdul, el de
  tot el mòdul»); `ZonePanel.tsx:348` (comentari: «el del mòdul (Fusteria)»); `ZonePanel.tsx:396` (ajuda dels calaixos:
  «Caixa amb guia genèrica de la llargada més gran que hi cap» també quan la guia és un joc: la captura 1 ho mostra).
- **Arranjament**: una constant amb el camí de cada secció (`SECTION_PATHS.frontsAndDrawers = "Interior › Fronts i
  calaixos"`) i fer-la servir als avisos i les ajudes; l'ajuda dels calaixos condicionada a `isDrawerKit`.

### C5. «Retranqueig prest.» (`carcass.shelfSetback`) és de la carcassa però s'edita a l'Interior  **[baix]**
- **On**: `CarcassForm.tsx:338` (dins `FrontsForm`), dada a `Carcass`. Preferències › **Jocs per defecte** (`SettingsScreen.tsx:336`)
  en diu «Separacions dels fronts, prestatges i fons».
- **Què**: és la contrapartida de C1: una dada de la caixa editada a l'Interior. Té sentit funcional (el retranqueig
  importa amb fronts encastats), però trenca «cada dada a l'inspector del seu nivell».
- **Arranjament**: deixar-lo a Fronts i calaixos (és on es nota) però anomenar-lo igual que a Preferències
  («Retranqueig dels prestatges») i, a Preferències, que el grup es digui «Jocs i retranqueigs» (vegeu D4 sobre «Joc»).

### C6. Prebroca dels cargols: regla del taller a Preferències ↔ paràmetre «Mides» de cada joc  **[baix]**
- **On**: `hardware.ts:919-939` (`kitPilot` llegeix **el primer joc**; `setKitPilot` escriu a **tots**), `HardwarePane.tsx:1233`
  i `KitSections` («duplicar-lo per canviar la prebroca a Mides»).
- **Què**: dos llocs escriuen el mateix `params.pilotDiameter`; la preferència només reflecteix el primer joc; les còpies
  als mòduls fets no canvien (es diu a la nota, però la secció es diu «Regla del taller»).
- **Arranjament**: una sola font: `Settings.kitPilot` (regla) llegida pel constructor (`planKit` rep `pilot` de les
  preferències via `buildComposition`, com `materialIssues` rep els materials) i el camp de «Mides» del joc desapareix; o,
  si es vol per joc, treure la regla de Preferències. Avui el text promet una cosa i el model en fa una altra.

---

## D. Noms: un glossari

### D1. «Fons»: cinc coses  **[alt]**
| Avui | Què és | On |
|---|---|---|
| **Fons** (Caixa) | tipus de fons del mòdul: ranura · cargolat · encastat · sense | `CarcassForm.tsx:78-92` |
| **Fons** (Materials) · «Gruix del fons» | material i gruix del fons del mòdul | `CarcassForm.tsx:262-271` |
| **Fons** (fila del joc) | gruix del fons **del calaix** que demana el joc (16) | `ZonePanel.tsx:298-302` |
| **Fons** (categoria de Materials) | taulers prims per a fons | `materialOps.ts` `backChoices`, Materials › «Fons» |
| «Fons dels calaixos» / «Fons calaix n» / `drawerBottom` | la peça del calaix | avisos `drawer-bottom`, `buildModule.ts:1689,1800` |
| «Fons Z» (eix) | fondària | `AxisLabel`, Posició |

**Proposta**: la peça del mòdul → **«Fons»** (es queda: és el nom del taller, `trassera`). La del calaix → **sempre
«Fons del calaix»** (fila del joc, avís, peça: «Fons del calaix 1»). La categoria de Materials → **«Fons i prims»** o
«Taulers prims». L'eix Z → **«Fondària (Z)»** (la paraula que ja fan servir Mides i les peces lliures).

### D2. «Caixa»: tres coses
Secció **Caixa** del mòdul (`EditorScreen.tsx:1163`, abans «Estructura») ↔ **caixa del calaix** (`drawer-box`, «Caixa del
calaix massa baixa», `ZonePanel.tsx:396` «Caixa amb guia genèrica») ↔ **caixa** = `bbox` d'un ferratge importat («la
caixa», `HardwareSelect` «caixa sense model»). **Proposta**: la secció del mòdul → **«Cos»** (ja és el nom del material:
«Cos», «Com el cos», `c.material`), la del calaix → «Caixa del calaix» sempre sencer, la del ferratge → «Volum».

### D3. «Ferratges» i «Fusteria»
- **Ferratges** (inspector del mòdul, `LuWrench`) = col·locats a mà + comptes de les regles; **no s'hi tria cap
  ferratge**. Els ferratges es trien a **Fusteria (avançat)** (espiga, System 32) i a **Fronts i calaixos** (la resta) i al
  Front de cada zona. **Ferratges** (Preferències, `LuHammer`) = biblioteca. **Ferratges** (visor) = veure'ls.
- `LuHammer` és alhora «Fusteria» (inspector) i «Ferratges» (Preferències) (`CLAUDE.md` l. 1730 ho reconeix).
- **Proposta**: inspector del mòdul: **«Ferratges»** = *tot* el que té a veure amb ferratges del mòdul: a dalt els **per
  defecte** (els `HardwarePick` de tots els llocs usats: espiga, System 32, frontissa, guia/joc, braç, imant, tirador,
  pota), a sota «De les regles» (comptes) i «Col·locats a mà». «Fusteria (avançat)» es queda només amb les mides de
  fusteria (ranura/retirada del fons). Icones: Ferratges `LuWrench` a tot arreu (inspector, Preferències, visor);
  Fusteria `LuHammer` només a l'inspector.

### D4. «Joc»: tres coses
**Joc** = separació (Joc front–cos, Joc entre fronts, Joc lateral de la guia, «Jocs per defecte» de Preferències, `joinery.clearance` «Joc») ↔
**Joc** = kit paramètric («joc de calaix», fila «Joc» de `KitFields`, «Ferratges dels jocs» a Peces, categoria «Calaixos de
doble paret (jocs)», `HardwareKit`) ↔ **Joc de textures** (Materials). **Proposta**: la separació → **«Folgança»** o
mantenir «Joc» només per a la separació i dir al kit **«Conjunt»** («Conjunt de calaix DTC…», «Ferratges dels
conjunts», fila «Conjunt»). Com que el `CLAUDE.md` ja ha fixat «joc» per al kit a tot el nucli (`HardwareKit`,
`drawerKit`, `KitOrder`), el canvi barat és a la UI: separacions → **«Folgança front–cos»**, «Folgança entre fronts»,
Preferències «Folgances per defecte».

### D5. «Guia de calaix» que conté un joc
Lloc `slide` amb etiqueta fixa «Guia de calaix» (`HARDWARE_SLOTS`, `hardware.ts:279`) tant si hi ha una guia com un joc
sencer (captura 1: «Guia de calaix: DTC MAGIC-PRO HT…»). **Proposta**: etiqueta del lloc segons l'item: `slotLabel(slot,
item)` → «Guia de calaix» / «Joc de calaix» (o «Calaix (guia o joc)» com a nom del lloc a Fronts i calaixos); l'avís
`hardware` fa servir la mateixa funció.

### D6. «Prestatges» com a secció que no és de prestatges
«Regulables» quan n = 0 (fileres System 32 sense cap prestatge: és un ferratge, el System 32), «Penjador», «Llum». Amb B
resolt, Prestatges = Quantitat · Regulables · A ras · Gruixuts. La fila «Regulació» (`ZonePanel.tsx:188`) → «Regulables» a
la insígnia.

### D7. Icones amb més d'un significat (catàleg `CLAUDE.md` l. 1697-1760 + codi)
| Icona | Significats |
|---|---|
| `LuDoorClosed` | contingut Porta · secció Front · «Fronts i calaixos» (Interior) · Mòdul «Front» · «Una porta» |
| `LuArchive` | contingut Calaixos · categoria Guies · Preferències «Calaixos» · `RULE_ICONS.slide` |
| `LuLayers2` | Fons en ranura · categoria Materials «Fons» · «Peces de fusta» del joc |
| `LuCircleDot` | Forats (visor) · System 32 · Suports de prestatge · Mecanitzats · «Mecanitzats del joc» |
| `LuHammer` | Fusteria (inspector) · Ferratges (Preferències) |
| `LuWrench` | Ferratges (inspector) · Ferratges (visor) · Col·locació |
| `LuTable` | Base «Potes» (`CarcassForm.tsx:54`) · categoria «Taules» · tipus de moble Taula; les potes a la biblioteca són `LuFootprints` |
| `LuRows3` | Prestatges · «Calaixos» (Preferències, l. 1730) |
| `LuSquareDashed` | Obert · Sense fons · Sense tapa · Sense base? (no: `LuSquareDashedBottom`) |
**Proposta mínima**: Potes = `LuFootprints` també a la Caixa; «Fronts i calaixos» = `LuSquareStack` (ja és «Recobrents»,
i és l'únic lloc que parla de tots els fronts); Fusteria/Ferratges segons D3.

### D8. Glossari proposat (una paraula, una cosa)
| Terme | Només per a |
|---|---|
| **Cos** | la caixa del mòdul (laterals, base, tapa, fons) i el seu material |
| **Fons** | la peça del darrere del mòdul; **Fons del calaix** la del calaix |
| **Fondària** | l'eix Z |
| **Front** | porta, front de calaix, abatible, reixeta, front fix; **Fronts i calaixos** la secció de l'Interior |
| **Folgança** | separacions (front–cos, entre fronts, lateral de la guia, encaixos) |
| **Joc** (o Conjunt) | kit paramètric del fabricant |
| **Ferratge** | qualsevol `HardwareItem`; **Ferratges** la secció/biblioteca/visor |
| **Fusteria** | mides d'unió de fusta (ranura, retirada, retranqueig) |
| **Com el mòdul / Com el cos** | heretat; **Còpia pròpia** la còpia que ja no és a la biblioteca |
| **Accessoris** | barra, LED, marc de vidre (ferratges de compartiment) |

---

## E. Què es conserva en canviar el contingut

### E1. Canviar de contingut llença el front sencer: res no es conserva, i la UI no ho diu  **[alt]**
- **On**: `ZonePanel.tsx:47-60` (`defaultFront(kind)`), `:520` (`onChange(setFront(root, zone.id, k === "none" ? null :
  defaultFront(k)))`), `core/model/zoneOps.ts:141-153` (`setFront`: treu `front` i, als calaixos, **també `shelves`**).
- **Sonda** (drawers amb 4 alçades, joc HT14, `kit: push/metal` → flap → drawers): torna `{kind: "drawers", n: 3,
  heights: [auto ×3]}`: es perden **n, alçades, guia/joc, opcions del joc i el tirador**; i `shelves` (2 regulables) es
  perd només de passar per calaixos (`rail` i `led` sí que es conserven: inconsistent entre ells).
- **Regla**: R1 (el `CLAUDE.md` promet «el que s'amaga es conserva; tornar a encendre l'opció recupera els valors»; els
  comentaris de `visibleZone`, `composition.ts:820-823`, ho donen per fet amb `shelves/rail/led`, però `setFront` els
  esborra) i R4 (el mateix gest —canviar una opció— fa coses diferents: Fons «Sense» conserva material i gruix; Contingut
  «Abatible» no conserva res).
- **Arranjament petit**: `Zone.fronts?: Partial<Record<Front["kind"], Front>>` (l'últim valor de cada tipus), `setFront`
  desa l'anterior a `fronts[old.kind]` i en canviar a `k` agafa `fronts[k] ?? defaultFront(k)`; `setFront` no toca
  `shelves` (ja ho fa `visibleZone` per construir). Afegir el cas a `hiddenState.test.ts`. Comú als tres: `hardware`
  i `handle` (si el nou tipus accepta el mateix lloc, es conserva: porta ↔ reixeta amb frontisses; calaix → abatible, no:
  llocs diferents, i aquí sí que cal **treure** `front.hardware` per no caure a A5).

### E2. Joc → guia normal i tornar: `Front.kit` es conserva (bé), però sense dir-ho
`visibleZone` (`composition.ts:829-830`) treu `kit` per construir i la dada es queda: coherent amb R1. Només falta que,
amb una guia normal i `front.kit` present, la fila «Guia» digui «(les opcions del joc es recorden)» — o res; és el cas bo.

### E3. Fons «Encastat» amb fons prim canvia material i gruix sense avisar
`CarcassForm.tsx:90`: passar a Encastat amb `backThickness < 15` posa «Com el cos» (material i gruix). És un canvi de
dades per una tria d'opció: l'únic lloc on triar un tipus canvia un altre camp. **Arranjament**: deixar-ho (decisió de
l'usuari al `CLAUDE.md`) però dir-ho a l'ajuda de la fila «Fons» i, millor, fer-ho **amb avís** `back-inset` en lloc de
canviar la dada (R1: el valor d'abans es recupera en tornar a Ranura, i amb el canvi silenciós no).

---

## F. Altres troballes

### F1. Dues funcions `usedHardwareSlots` amb dues semàntiques  **[mitjà]**
- `core/model/usedHardware.ts:14` (del **model**, via `visibleModule`: `Map<slot, {count, what}>`, el que diu el seu
  comentari que ensenya l'inspector) i `core/build/hardwareSummary.ts:61` (de les **peces construïdes**: `Set<string>`).
  L'inspector fa servir la segona (`EditorScreen.tsx:1068,1170`); la primera **no la fa servir ningú** (només es
  defineix). Diuen coses diferents: un mòdul amb un calaix amb un joc que no hi cap no té cap forat `slide` ni lateral de
  calaix → la segona diu «no fa servir guia» i la fila «Guia de calaix» **desapareix de Fronts i calaixos** justament
  quan cal canviar el joc; la primera diria «slide: 1 calaix». Regla R4 («si n'hi ha dos que fan el mateix, s'unifiquen»).
- **Arranjament**: quedar-se la del model (declarativa, no depèn del resultat) per a la UI i A1; esborrar l'altra o
  deixar-la només per al test de les peces.

### F2. Defaults diferents segons el camí de creació  **[mitjà]**
- `EditorScreen.tsx:1259`: `kind === "taula" ? tableModule(id, n) : applySettingsToModule(settings, defaultModule(id, n))`.
  La taula **no** passa per `applySettingsToModule` (`settings.ts:946-963`): material/gruix de `DEFAULT_CABINET` i
  ferratges `DEFAULT_MODULE_HARDWARE`, no els de Preferències («Per defecte als mòduls nous» no s'hi aplica).
- **Arranjament**: `applySettingsToModule(settings, tableModule(id, n))` (i el mateix a `blankMoble` si cal).

### F3. Comptes de «Ferratges» que no quadren amb el 3D/Peces  **[mitjà]**
- `hardwareSummary.ts:20-58`: «Guies de calaix» = laterals/2 + fons de calaix sense lateral (joc). Amb un joc que **no hi
  cap** (`plan` nul) no hi ha fons → 0 guies, però el 3D/Peces tampoc en té: coherent. Però:
  - un calaix amb joc **sí** que porta components a `extras` (guies, laterals metàl·lics) que es veuen al 3D amb el color
    «Ferratges» i surten a Peces › «Ferratges dels jocs», i a la secció «Ferratges» del mòdul només surt «Guies de calaix: n
    parells»: cap esment del joc ni dels seus números. **Arranjament**: una fila «Jocs de calaix: n (DTC MAGIC-PRO HT10 N ·
    NL 500)» de `build.hardwareKits`.
  - «Braços d'abatible» compta `flap × 2` fixos; «Potes» 4 fixes (`EditorScreen.tsx:1172,1181`), encara que `buildLegs`
    pot no fer forats (pota sense confirmar). Barra, LED, marc de vidre: 0 (B).
  - El visor «Ferratges» (`Hardware.tsx`) dibuixa frontisses, tirador i potes; **no** dibuixa imants, braços ni espigues
    que sí que compten; i els components del joc es dibuixen sempre (són `extras`), amb «Ferratges» apagat també.

### F4. Textos d'ajuda que contradiuen el comportament  **[baix]**
- `ZonePanel.tsx:396` (ajuda «Calaixos»): «Caixa amb guia genèrica…» amb un joc (captura 1).
- `ZonePanel.tsx:304` (fila «Joc»): «Els components i els números són a Peces › «Ferratges dels jocs»» — i a la secció
  «Ferratges» del mòdul no hi són (F3).
- `CarcassForm.tsx:177` «Tiradors: Sense tirador: obertura per pressió (push); cal el ferratge a cada front» — i el
  ferratge push no existeix a la biblioteca (categoria «Obertura per pressió i imants» només té l'imant).
- `CarcassForm.tsx:320` (Fusteria): «Els dels fronts i calaixos són a l'«Interior»» — bé; però `HardwarePlacements.tsx:163`
  diu el contrari (C4).
- `SettingsScreen.tsx:301` (Preferències › Ferratges, descripció): «Frontisses, guies, espigues, imants i tiradors» — ni
  jocs, ni potes, ni plaques, ni importats.

### F5. Preferències ↔ editor
- Preferències › **Jocs per defecte** (folgances) i Preferències › **Ferratges** › «Prebroca» (C6) són «regles del
  taller» que només afecten mòduls nous; a l'editor res no diu quin valor és «el de Preferències» (a Materials sí:
  «Com a Preferències» a Acabats de l'escena). **Arranjament**: a Fronts i calaixos, badge «Com a Preferències» quan
  `outerGap/betweenGap/shelfSetback` coincideixen amb `settings.gaps`, i «Restaurar» per fila.
- «Per defecte als mòduls nous» del ferratge (`HardwarePane.tsx:1065`) parla de «mòduls nous»; a Materials el mateix
  concepte és «★ Tauler per defecte». Dues frases per al mateix (`DefaultPick` vs `Switch`).

### F6. Inspectors amb estructures diferents per al mateix concepte  **[baix]**
- **Materials**: al mòdul és una secció (`mod-materials`); a la peça lliure, «Material» amb Veta a dins; a l'objecte,
  «Material» (fantasma); al moble, «Materials de tot el moble». Bé, però el **fons** no té «Com el cos» a la peça lliure ni
  a Materials de tot el moble (`MaterialsForm mixed`), i «Fronts» (material) hi és.
- **Posició**: al mòdul «Posició» (fila, alçada, separació); a la peça i l'objecte «Posició» (X·Y·Z) + «Enganxada». La
  del mòdul barreja **muntatge** (arrambat/penjat/lliure) i posició. Nom proposat: «Muntatge i posició».
- **Accions**: compartiment amb menú ⋯ a la capçalera; mòdul amb nom editable; peça amb `PartActions`; objecte amb
  «Desar a preferències · Eliminar»; ferratge col·locat amb Pare · Duplicar · Eliminar. Cinc capçaleres diferents.

### F7. Dades mortes o sense sortida
- `CarcassExtras.cableHoles` (`composition.ts:228-232`): sense UI, es migra; el tipus continua obligatori al mòdul
  (`extras: { cableHoles: [] }` a cada `defaultModule`). Marcar-lo opcional/obsolet com `anchor`.
- `Module.hardware` conté **set còpies senceres** d'items (amb `kit` sencer, ~kB) per mòdul, també dels llocs que el mòdul
  no fa servir mai: és la causa estructural d'A1/A2. Alternativa: `Module.hardware: Partial<ModuleHardware>` (només els
  llocs triats expressament; la resta, el de Preferències en construir… no: trencaria «el moble no canvia si la biblioteca
  canvia»); o bé conservar les set còpies però **validar-les només quan es fan servir** (A1).

---

## Rànquing per impacte

| # | Troballa | Impacte | Mida |
|---|---|---|---|
| 1 | A1 + A2: llocs no usats validats sempre; còpia del joc al mòdul no atòmica → avís fals de «tipus que no toca» | alt (la captura del propietari; confiança en els avisos) | S |
| 2 | E1: canviar de contingut ho llença tot (n, alçades, joc, tirador, prestatges) | alt (pèrdua de feina; contradiu R1) | M |
| 3 | B1/B2: barra i LED com a interruptors de Prestatges, fora del sistema de ferratges | alt (el que diu l'usuari; R6) | M–L |
| 4 | C1 + C2: estil de fronts i push a Caixa; push en tres dades que no es miren | alt (R5, forats de tirador en calaixos push-open) | M |
| 5 | D1 + A3: «Fons» del moble ↔ «Fons del calaix»; la UI del joc empeny a posar el fons del moble a 16 | alt | S (textos) + M (material propi del fons del calaix) |
| 6 | D3: «Ferratges» (inspector) no tria ferratges; es trien a Fusteria i Fronts i calaixos | mitjà | M |
| 7 | F1: dues `usedHardwareSlots`; la de la UI amaga la fila «Guia» quan el joc no cap | mitjà | S |
| 8 | C3: «la del mòdul» (gènere, tres formes), «Del moble» | mitjà | S |
| 9 | C4 + F4: ajudes i avisos que apunten a seccions d'abans | mitjà | S |
| 10 | F2: la taula no passa per Preferències | mitjà | S |
| 11 | F3: comptes de «Ferratges» sense els jocs ni B | mitjà | S |
| 12 | D4/D5/D7: «Joc», «Guia de calaix» amb un joc, icones repetides | baix | S |
| 13 | C5/C6/F5: retranqueig, prebroca, «Com a Preferències» | baix | S |
| 14 | A4, E3, F6, F7 | baix | S |

---

## Estructura proposada dels inspectors

Un sol principi: **cada dada a l'inspector del seu nivell**, i a cada nivell **les mateixes seccions en el mateix ordre**
(Què és · Mides · Materials · Ferratges · Avançat), amb `FoldItem` i insígnia amb el valor triat.

| Nivell | Secció | Contingut (controls) | Dada | Avui és a |
|---|---|---|---|---|
| **Mòdul** (cos) | Mides | Amplada · Alçada · Fondària | `carcass.w/h/d` | Mides ✔ |
| | Muntatge i posició | Fila (arrambat/penjat/lliure) · alçada · separació · X | `base.kind=wall`, `wallGap`, `x`, `gapBefore` | Posició ✔ (nom) |
| | **Cos** | Base (+ alçada, retranqueig, **Pota** amb `HardwarePick`) · Fons (tipus) · Tapa (+ ranura d'aire, tauler de taula) · Parets buides · Cantonades · Laterals | `carcass.base/back/top/hollow/joint/sides` | Caixa (−Fronts −Tiradors) |
| | Materials | Cos + gruix · Fons + gruix («Com el cos») · **Fons del calaix** (nou) | `material/thickness/backMaterial/backThickness/drawerBottomMaterial` | Materials (+1 fila; «Fronts» passa a l'Interior) |
| | **Ferratges** | **Per defecte del cos**: Espiga · Filera System 32 · Pota (`HardwarePick`, només els usats) · De les regles (comptes, inclosos jocs, barres, LED) · Col·locats a mà | `module.hardware.dowel/system32`, `base.hardware`, `hardwarePlacements` | Fusteria (espiga, S32) + Ferratges |
| | Fusteria (avançat) | Ranura del fons · Retirada del fons · Folgança del fons | `backSetback/backInsetSetback/backClearance/grooveDepth` | Fusteria ✔ (−ferratges) |
| **Interior** (arrel) | Front de tot el mòdul | Contingut (Obert · Porta · Front fix si dividit; tots si no) + camps del front | `root.front` | Front ✔ |
| | **Fronts i calaixos** | Estil Recobrents/Encastats · Material dels fronts · Folgança front–cos · Folgança entre fronts · Retranqueig dels prestatges · **Tirador per defecte** (`HardwarePick` amb «Cap (push)») · Frontissa · Guia o joc de calaix · Braç · Imant (només els usats) | `fronts.style/outerGap/betweenGap`, `frontMaterial`, `shelfSetback`, `fronts.handles`→tirador, `module.hardware.hinge/slide/flap/magnet/handle` | Fronts i calaixos + Caixa (Fronts, Tiradors) + Materials (Fronts) |
| | Prestatges / Accessoris / Mida / Dividir | com el compartiment (si l'arrel no és dividida) | | ✔ |
| **Compartiment** | Front | Contingut · camps del tipus · **Ferratge** del front (`HardwarePick`, «Com el mòdul») · **Tirador** («Com el mòdul» · «Cap (push)») · opcions del joc (Tancament · Darrere · Acabat · fitxa del conjunt) | `zone.front` (+ `fronts[kind]` recordats) | Front ✔ (+Cap (push)) |
| | Prestatges | Quantitat · Regulables · A ras · Gruixuts (+ gruix) | `zone.shelves` | Prestatges (−Penjador −Llum) |
| | **Accessoris** (nova) | Barra de penjar (`HardwarePick`, «Com el mòdul») · Perfil LED (`HardwarePick`) · (Marc de vidre quan sigui ferratge) | `zone.rail/led` → `{hardware?}` | Prestatges (interruptors) |
| | Amplada/Alçada · Dividir | com ara | `split.sizes` | ✔ |
| **Peça lliure** | Efecte · Orientació · Mides · Material (+Veta) · Forma · CNC · Encaixos · Grup · Enganxada · Posició · **Ferratges** (col·locats a mà) | com ara; «Ferratges» amb la mateixa capçalera que el mòdul («Col·locats a mà», sense regles) | | ✔ |
| **Tots** | Avisos de fusteria | primer els d'aquest nivell (zona/peça), després «Del mòdul» plegats | `warnings` | A4 |

Capçalera igual a tots els nivells: icona del nivell · nom (editable on toca) · menú ⋯ amb Pare · Duplicar · Eliminar
(les accions que no toquen, desactivades i no absents), i la insígnia de cada secció amb el valor triat («Com el mòdul»
quan és heretat).

---

## G. Interior › Fronts i calaixos: un sol lloc per decisió i opcions en cascada (2026-10-08)

Per decisió de l'usuari: «les opcions de tirador i guia es repeteixen del que hi ha al front, és molt confús; amb el
front fix no hauria de sortir cap opció de l'interior; les opcions de més avall s'adapten a les de més amunt».

- **Per defecte dels compartiments.** A l'Interior sense divisió, el Front de la mateixa pantalla ja ensenya Tirador,
  Frontissa i Guia: «Fronts i calaixos» ja no els repeteix. Els per defecte del mòdul surten a sota, amb el títol «Per
  defecte dels compartiments», **només si algun altre compartiment els hereta** («Com el mòdul»; `inheritedSlots`), amb
  qui els fa servir a l'ajuda («Com el mòdul» a: portes, calaixos (4)). Amagats, es conserven.
- **Només el que es llegeix** (`frontsSection` / `frontOptionsUse`): Estil i Folgança front–cos amb algun front que es fa
  (també un front fix, que no té cap ferratge), Folgança entre fronts amb dues portes, dos calaixos o un front recobrent
  al costat d'un divisor, Retranqueig amb prestatges que es retiren o LED. Sense res, la secció no surt. Sense fronts,
  l'estil no compta (`visibleModule`) i Materials › Fronts no surt.
- **Fronts tapats** pel front de tota la zona: no es fan (ja era així al constructor), però `usedHardwareSlots` els
  comptava i els calaixos tapats amagaven els prestatges. Ara no compten (`walkBuiltZones`) i el compartiment ensenya
  «Front · Tapat».
- **Inglet ⇒ espigues**: el constructor ja no en posava a la tapa i la base a inglet (lamel·les o Clamex); la Fusteria
  ensenyava l'Espiga igualment. `carcassDowels` diu on n'hi ha (tapa/base a topar, fons encastat, divisions).
- **Cascada**: Caixa › Laterals abans de Parets i Cantonades; l'imant de la reixeta després de Trapa; a l'Interior sense
  divisió, «Fronts i calaixos» després de Prestatges i Accessoris. Regla a `CLAUDE.md` › Regla d'or.
- **Proves d'or**: cap peça canvia; només fora 19 avisos `inset` que no tocaven (fronts encastats en mòduls sense cap
  front, i «retira els prestatges» sense prestatges que es retirin). Tests `build/frontsInspector.test.ts` i
  `build/hiddenState.test.ts` (fronts tapats, estil, folgances, retranqueig i material dels fronts amagats).
- **Pendent de decidir**: prestatges i accessoris darrere d'un front fix (no s'hi arriba); «A ras del davant» amb fronts
  encastats en un compartiment amb front (avui surt i avisa).

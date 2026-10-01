# Col·leccions de mobles — biblioteca de referències

Biblioteca per estudiar llenguatges de disseny, proporcions, materials i composicions que han d'inspirar una
col·lecció pròpia de mobiliari contemporani d'alta gamma. A l'app és la secció **«Col·leccions de mobles»** de la
pàgina Mobles (després del Catàleg) i, als Ambients, les categories **«Col·lecció · …»** del catàleg.

- Codi: `src/core/model/collections.ts` (`FURNITURE_COLLECTIONS`, `COLLECTION_PIECES`), escenes a
  `ambientTemplates.ts` (`COLLECTION_SCENES`, referències `col:<id>`), UI a `features/projects/CollectionsSection.tsx`.
- Totes les peces són **paramètriques** (constructors del catàleg de botiga: mòduls, zones i peces lliures) i es
  poden obrir a l'editor, canviar de mida i fabricar. `collections.test.ts` comprova que es construeixen sense avisos
  de disseny.
- No són còpies de productes: són interpretacions del **llenguatge** de cada referència amb les eines de l'app. Els
  noms (Llosa, Monòlit, Mòdul 330…) són propis.
- Fonts: carpeta `~/Desktop/referencies` (185 fotos, enllaços, fitxes tècniques de Porro i catàlegs de Poliform i
  Living Divani). Cada fitxa porta, quan n'hi ha, els fitxers de foto de referència.

## Fitxa d'estudi (per peça)

Referència (dissenyador o marca) · tipus de moble · llenguatge formal · geometria predominant · proporcions ·
materials · acabats · combinació de materials · tractament de les superfícies · relació entre gruixos i volums ·
ferratges visibles o no · sensació visual · relació amb l'espai arquitectònic · graus d'1 a 5 (minimalisme,
sofisticació, calidesa, funcionalitat) · elements que fan percebre qualitat. A la col·lecció comercial, a més:
família, mides de la família i acabats possibles.

## 1. Minimalisme arquitectònic

**Referències**: John Pawson (amb Dinesen, Nikari, Viccarbe, Salvatori, Passoni, Obumex), Vincent Van Duysen
(Molteni&C), De La Espada, Nikari, Molteni&C, David Thulstrup (Dinesen).

**Què s'hi observa a les fotos**

- **Plans, no barres.** Les taules de Pawson × Dinesen són tres o quatre taulers que es toquen: un tauler prim que vola
  sobre potes de tauler, amb una ànima central. El banc és una caixa oberta pels caps; el tamboret, un cub buidat.
- **El gruix és honest i constant.** Un sol gruix per a tota la peça (30 en tauló ample) o parets buides que fan
  llegir el moble com a massís (Obumex, Twin).
- **Sòcol en ombra.** Daybeds, taules baixes i llits són una llosa sobre un sòcol molt enretirat: la peça flota i la
  línia de llum/ombra en fa el dibuix.
- **Volums que s'interpenetren** (Obumex Kitchen System II): un bloc de calaixos, una llosa i un pla vertical que es
  creuen. Composició asimètrica i molt controlada.
- **El buit forma part de la peça**: nínxols en lloc de prestatges (Thulstrup), caixes obertes, el marc de Nikari Frame.
- **Ferratges que desapareixen**: cap tirador; obertura per pressió o per la junta; frontisses ocultes.
- **Materials pocs i nobles**: roure i avet Douglas de tauló ample amb oli invisible, noguera, travertí i pedra
  calcària apomassats, lli. Un sol material per peça, com a molt dos (pedra + fusta).
- **Mobiliari com a arquitectura**: bancs que continuen la paret, armaris que són paret, llibreries que són un volum.
- **Proporcions lentes**: horitzontals (bancs de 1:4 a 1:7), voladissos d'un sisè de la llargada, alçades de seient.

**Peces** (25): taules de menjador «Llosa» i «Pla», banc «Caixa», auxiliar «Cub obert», daybed «Plataforma», taules
de centre «Llosa baixa» i «Marc», aparadors «Monòlit» i «Estria», moble TV «Banc de paret», llibreria «Nínxol»,
escriptoris «Taulell volat», «Volada» i «Fil», llit «Capçal mur», tauleta «Calaix volat», armaris «Paret», «Columna» i
«Cambra», consola «Llosa i pedra», cadira «Bloc», auxiliar «Bloc de pedra», banc «Sòcol llibreria», sistema de paret
«Estrat» i illa de cuina «Bloc i llosa».

**Ambients**: Saló arquitectònic · Menjador refectori · Menjador de plans · Cuina monòlit · Dormitori de calma · Suite de
roure · Estudi d'arquitecte · Rebedor de pedra.

## 2. Minimalisme comercial

**Referències**: Poliform (Day, Night, Kitchen), Minotti, B&B Italia, MDF Italia, Living Divani, Porro, Molteni&C,
De La Espada; i, per veure com es tradueix a gamma mitjana, MIRSA, Gunni & Trentino, La Maison i SKLUM.

**Què s'hi observa**

- **El sistema mana.** Porro System (Lissoni) surt d'una retícula: amplades de **330 · 495 · 660 · 990 · 1320**,
  alçades de 330 en 330 (360 … 3000, amb 30 de base) i fondàries **230 · 346 · 474 · 602**. Tot encaixa amb tot.
- **Famílies**: la mateixa línia en aparador, consola, tauleta, moble TV… amb varietat de mides i d'acabats.
- **Combinació de materials** per pujar la percepció de valor: lacat mat + tapa de marbre o travertí + peu de metall
  prim (Gallery Low Cupboard: 2480 / 3000 × 1154 × 471, LED i fons de mirall); fusta tenyida a 45° (Twin:
  2520 × 495 × 550, dos volums en U, un de ple i un d'obert).
- **Poliform**: paleta fosca (lacats bronze/antracita, noguera, vidre fumat), sistemes de paret amb nínxols
  il·luminats, aparadors llargs i baixos, vestidors amb illa de calaixos, armaris de dalt a baix amb tirador vertical.
- **Funcionalitat a la vista** però endreçada: interiors equipats, passacables, calaixos amb separadors.
- **Integració**: les peces han de funcionar en salons, menjadors, dormitoris i despatxos diferents.

**Famílies i peces** (25)

| Família | Llenguatge | Peces |
|---|---|---|
| **Mòdul 330** | Retícula de Porro System | Llibreria de paret, moble TV, paret de TV, aparador sobre potes, prestatgeria de doble cara |
| **Galeria** | Lacat + travertí + ferro (Gallery) | Aparador alt, consola, tauleta de nit, moble TV |
| **Doble U** | Volums en U a 45° (Twin) | Aparador baix, taula de centre, moble TV penjat, tauleta de nit |
| **Línia** | Noguera, lacat greige, cuir (Poliform/Minotti) | Taula de menjador, taula rodona, cadira, banc, escriptori, llit, calaixera, armari, vitrina, auxiliar, aparador estriat, illa de vestidor |

**Ambients**: Saló Mòdul 330 · Saló Doble U · Saló Galeria · Menjador Línia · Dormitori Línia · Despatx Línia · Rebedor Galeria.

## Límits de l'app (i com s'han resolt)

- **Gruixos de CNC (10 · 12 · 16 · 19 · 30)**: els gruixos grans (40–50) són parets o prestatges buits; les lloses de
  pedra i les potes de fusta massissa són peces sense nesting.
- **Prestatges de més de 800 mm de llum** a 19 vinclen: els mòduls de 990 porten prestatges buits de 50.
- **Portes de més de 2200 mm**: els armaris de paret fan 2300 (amb sòcol) en lloc d'anar a sostre.
- **Tiradors**: els fronts sense tirador són `push` (sense forats de tirador; avís del ferratge). Totes les peces que a la
  fitxa diuen «push» o «tirador ocult» ho són de debò; la gola encara no es modela.
- **Tapisseria, cuir i lli**: peces de simulació (no es fabriquen).
- **Fotos**: no s'incrusten a l'app (són de les marques); la fitxa diu quin fitxer de la carpeta `referencies` mirar.

## Revisió visual (miniatures i editor en Presentació)

- **Defectes trobats**: tiradors de barra a la vista en peces que la fitxa descriu push o amb «tirador ocult» (tota la
  família Mòdul 330, Galeria, «Línia sis» i «Línia vitrina»); l'armari «Paret» tenia un cos de calaixos i portes
  curtes al mig que trencava la paret contínua; el cos central de «Galeria alt» (dos calaixos i un nínxol amb prestatge)
  semblava un moble de botiga. Pendent: la família Doble U surt molt clara (el freixe de la referència és tenyit; caldria
  un material «freixe tenyit» a les preferències) i «Nínxol» dobla la paret de 50 entre columnes (100 als muntants).
- **Corregit**: fronts push a tots aquests (la família Mòdul 330 sencera, Galeria i Línia de calaixos); «Paret» = tres
  cossos de dalt a baix (penjador · prestatges · doble barra) amb sis portes iguals; «Galeria alt» = quatre portes i
  tres calaixos al centre, tot push.
- **Peces noves**: «Estrat» (llosa de calaixos penjada de parets de 50 i dos prestatges volats de 30 desplaçats: contrast
  de gruixos), «Bloc i llosa» (illa: bloc de noguera de parets buides travessat per una llosa de roure a 750 sobre un
  sol pla), «Fil» (escriptori de pòrtic amb un calaix de 170 enretirat a l'ombra), «Cambra» (paret d'armaris amb un
  nínxol de tocador al cos central, prestatge de 50 a ras), «Galeria TV» (lacat, travertí i patins) i «Línia illa»
  (illa de vestidor de dotze calaixos push amb tapa de vidre).
- **Ambients nous**: Cuina monòlit, Suite de roure (arquitectònic) i Saló Galeria (comercial); «Línia illa» al
  Dormitori Línia.

## Següents passos per a una col·lecció pròpia

1. Triar 2–3 peces de cada col·lecció com a punt de partida i fixar-ne la retícula (p. ex. 330) i els gruixos.
2. Decidir la paleta de materials de la casa (roure oliat + un lacat + una pedra) i els acabats.
3. Definir com s'obre sense tirador (push, gola o junta) i provar-ho al taller.
4. Fer la família completa (saló, menjador, dormitori, despatx) a partir de les peces escollides.

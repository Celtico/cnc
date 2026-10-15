# Millores v1 — estudi conjunt i prioritats

Origen: `docs/prompt/PROMPT-millore-v1.md`. Cada àrea té el seu estudi (com funciona ara, què canviar, dependències, pla):

| Document | Àrea | Seccions del prompt |
|---|---|---|
| [ui-coherencia.md](ui-coherencia.md) | Cursor, vistes, acordions, menú, historial, render, selecció d'ambients, bola de material, regla d'or | §2, §3, §4, §5, §7 |
| [mobles-peces.md](mobles-peces.md) | Inspectors sense «General», Tipus, Flat-pack, objectes de referència / models 3D, Front al pare | §3 |
| [editor-formes.md](editor-formes.md) | Ploma (formes i plànol), corbes, Maj, desfer/refer, DXF/EPS/SVG | §5, §6 |
| [ambients-fitxer.md](ambients-fitxer.md) | Desar ambients com a fitxer `.ambient` | §5 |
| [cnc-mecanitzats.md](cnc-mecanitzats.md) | Preguntes per al germà + canvis de codi que no depenen de la resposta | §1 |
| [ferratges.md](ferratges.md) | Estudi Hettich / Blum / SWOOD, model de dades, visualització en 3 nivells | §8, §9, §10 |
| [chakra-auditoria.md](chakra-auditoria.md) | Components i comportaments fets a mà que Chakra v3 ja porta (Splitter, Tabs, Slider…): decisió per a cadascun | regla «no es reinventa la roda» |

## Fase 3 — revisió conjunta

### Peces comunes que surten a més d'un estudi (fer-les una vegada)

1. **Un sol acordió** (`components/Fold.tsx`, sobre `Accordion` de Chakra). En depenen: inspectors sense «General», render (Sol · Cel · Llum), Preferències, panells de l'editor. Avui n'hi ha sis sistemes (`PanelSection` a 48 llocs, `RunsForm.Fold`, `Collapsible`, fila desplegable de Màquines…). Risc conegut: el `Collapsible` de Chakra quedava a alçada 0 amb contingut que arriba tard → el component comú ha de fer servir `lazyMount` + alçada automàtica i provar-se als inspectors.
2. **Desfer/refer genèric**. Ara n'hi ha dos de diferents (`EditorScreen`, `AmbientEditor`) i l'editor de formes no en té. Un sol hook d'historial serveix per als tres.
3. **Cercador amb «+»** (`SearchBar`). Hi ha cinc cercadors copiats; el menú nou demana el «+» al costat del cercador.
4. **Fila d'arbre + Resum**. L'editor de mobles té nom del moble + Resum; Ambients no. La mateixa fila/arbre per a tots dos (selecció coherent).
5. **Nucli 2D compartit** (traç, zoom/desplaçament, ploma, imant). Formes de peça i plànol d'ambients comparteixen el nucli, no el component sencer.
6. **Ferratges a Preferències** com a graella + editor (igual que Materials). La ranura LED i la frontissa de marc d'alumini del §1 hi van a dins, no com a casos especials.

### Contradiccions i coses a corregir

- `SETTINGS_VERSION` ja és **18** al codi; el `CLAUDE.md` diu 17. La migració dels ferratges serà la **19** (l'estudi de ferratges diu 18 per error). **Fet**: ferratges F1–F2 amb la v19 (estat a `ferratges.md`).
- La tecla **Maj** vol dir coses diferents a cada editor (imant d'1 mm a les formes, angle lliure al plànol). El prompt demana Maj = segment recte. Cal una taula única de tecles.
- El `CLAUDE.md` diu que els **ambients són decoratius** i que no hi dediquem temps mentre la fabricació tingui coses pendents. Les millores d'ambients van després de les de fabricació.
- **Treure ≠ esborrar**: «Objectes de referència» i «Models 3D» es treuen del menú d'afegir, però si un moble ja en té continuen sortint (no es perden dades). El front de tot el mòdul és un cas real (tots els armaris del catàleg el fan servir): es treu de l'inspector del mòdul i passa a l'«Interior».
- **Flat-pack** no pot activar els encaixos a totes les peces de cop (canviaria els fitxers del taller). Camp nou que s'activa expressament; els Flat-pack existents el porten activat en carregar.
- Error trobat: `ballKey` no inclou Reflex ni Vellut → la bola del material no es refà en canviar-los. I ⌘Z amb l'editor de formes obert desfà el moble del darrere.

### Decisions preses per defecte (es poden canviar)

- L'app s'obre a **Mobles** (primer element del menú nou).
- Taulell i sòcol: es poden posar a qualsevol moble (no es converteixen automàticament en peces lliures, perquè es perdria el càlcul automàtic de llargades i forats).
- Importar: **SVG i DXF** primer; EPS només els traços simples (Illustrator/Inkscape) i com a fase opcional.
- Ambients a fitxer: referència + còpia de cada moble; en obrir, si un moble falta es pot restaurar des del fitxer.
- Valors de CNC (marge, BOM, pell, sentit de tall): passen a preferències **amb el valor d'ara per defecte** fins que el germà confirmi. Les proves d'or no canvien.

## Fase 4 — prioritats

### 1. Imprescindibles (coherència base i fabricació)
- Acordió únic + migració (S–M per lloc, M en total).
- Inspectors de peça lliure i objecte de referència sense «General».
- Treure Front del mòdul pare → «Interior».
- Treure «Objectes de referència» (Objectes) i «Models 3D» (Mobles) del menú d'afegir.
- Enviar les preguntes al germà (`cnc-mecanitzats.md` §a) i convertir els valors de CNC en preferències.

### 2. Importants
- Treure «Tipus» i passar Flat-pack a opció de les peces lliures (fase 1).
- Vistes: només Davant · Darrere · Esquerra · Dreta · Dalt, sense cotes.
- Menú Mobles · Ambients · Objectes i «+» al cercador.
- Ferratges F1 (motor + migració) i F2 (Preferències).

### 3. Usabilitat
- Cursor (regla única), Historial «Esborrar», render (padding i Sol · Cel · Llum), bola de material més gran i fidel.
- Desfer/refer comú; Maj = recte; zoom a l'editor de formes.
- Ambients: fila amb el nom + Resum a l'esquerra.

### 4. Rendiment
- Ferratges: tres nivells de visualització (forats / volum / 3D) amb instàncies i càrrega mandrosa.

### 5. Futures
- Importar DXF/SVG (EPS opcional); corbes a la ploma del plànol.
- `.ambient` com a fitxer.
- Ferratges F4–F5 (manuals, minifix, placa de frontissa, LED, importació).
- Peces amb forats interiors importats.

## Fase 5 — blocs d'implementació (en paral·lel quan no hi ha dependències)

| Bloc | Contingut | Depèn de |
|---|---|---|
| A | Acordió únic + migració + inspectors sense General + render (padding, Sol · Cel · Llum) | — |
| B | Menú, cercador amb «+», Historial, cursor, bola de material | — |
| C | Vistes, Front al pare → Interior, treure Objectes de referència / Models 3D, ⌘Z de l'editor de formes | — |
| D | Tipus i Flat-pack | C |
| E | Preferències de CNC (valors actuals per defecte) | — |
| F | Ferratges F1–F2 | E |
| G | Desfer comú, Maj, zoom, DXF/SVG | A |
| H | `.ambient` | B (fila d'ambient) |

## Preguntes obertes per al Cel
1. Què ha de fer la tecla Maj a la ploma (recte) i on va l'imant d'1 mm (Alt?).
2. EPS: cal de debò o n'hi ha prou amb SVG + DXF?
3. Les «primeres opcions Moble/Cuina/Armari/Taula»: les vols al botó «Nou moble»?
4. `.ambient`: portar els materials propis amb foto dins el fitxer? La foto de les finestres, per ambient?

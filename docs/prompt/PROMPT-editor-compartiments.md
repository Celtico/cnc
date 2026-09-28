# Prompt — Editor de compartiments (disseny lliure de mobles)

Copia-ho a Claude Code dins de `~/Desktop/cnc`.

---

Llegeix el `CLAUDE.md` i la skill `chakra-ui-builder` abans de començar.

## Objectiu
Vull poder dissenyar **qualsevol moble de cos des de zero, des de la UI**, sense demanar
tipus nous cada vegada, a l'estil de Polyboard o Cabinet Vision:
partir d'una caixa → dividir-la en compartiments → donar contingut a cada compartiment.

La prova que està acabat: **fer, només amb la UI, el moble de TV de casa** (moble baix
amb 3 portes i prestatges + cobreradiador alt al costat). Detall al final.

## 1. Model (`core/model/`, amb zod)

```
Project
 └─ Composition            mòduls col·locats d'esquerra a dreta (x en mm)
     └─ Module             una caixa (carcassa) + l'arbre de zones del seu interior
         ├─ Carcass        mides, material, gruixos, base, fons, tapa, laterals
         └─ Zone (arbre)   { split? | content? }
              ├─ split:   { dir: "v" | "h", children: Zone[], sizes: (mm | "auto")[] }
              └─ content: open | shelves | door | drawers | flap | grille | panel
```

**Carcass**
- `width`, `height`, `depth`, `material`, `thickness`, `backThickness`.
- `base`: `plinth` (sòcol, alçada i retranqueig) · `legs` (sense peces; alçada per al 3D)
  · `none` (la base toca a terra) · `open` (sense base; p. ex. cobreradiador).
- `back`: `groove` (encastat) · `screwed` (sobreposat) · `none`.
- `top`: `full` · `ventSlot` (tapa escurçada que deixa una ranura d'aire al darrere,
  amplada configurable) · `grille` (tapa amb reixeta) · `none`.
- `sides`: esquerre i dret, cadascun present o absent (per enganxar mòduls o fer
  prestatgeries sense lateral).
- Unió de laterals: els laterals abracen base i tapa (com ara). Opció de tapa sobreposada.

**Zones**
- **Divisió vertical** → genera **divisors verticals** de tota la fondària, entre la peça
  de sota i la de sobre de la zona, units amb espigues.
- **Divisió horitzontal** → genera **travessers o prestatges fixos** units amb espigues.
- `sizes` en mm o `auto` (reparteix l'espai que sobra a parts iguals). Les mides són
  **llums interiors**; el gruix dels divisors es resta automàticament.

**Continguts (fulles de l'arbre)**
- `open`: res.
- `shelves`: `n`, `adjustable` (System 32 als panells verticals del costat) o fixos.
- `door`: `single` (frontissa a l'esquerra o a la dreta) o `double`. Nombre de
  frontisses segons l'alçada: ≤ 900 → 2, ≤ 1600 → 3, més → 4. Cassoletes i
  plaques de muntatge als laterals.
- `drawers`: `n` calaixos amb alçades de front (`auto` o mm). Construcció de la caixa:
  laterals, darrere, fons en ranura, front. Guia **genèrica paramètrica** (joc lateral
  per costat, llargades disponibles, p. ex. 250–550 cada 50) i tria automàtica de la
  llargada més gran que hi càpiga. Forats de les guies als laterals del moble.
- `flap`: porta abatible cap avall o cap amunt (sense ferratge específic; només forats
  genèrics configurables).
- `grille`: front de **reixeta CNC** (ranures verticals, horitzontals o forats al
  tresbolillo; amplada, separació, marges). Mostra el **% d'àrea oberta** i avisa si
  baixa del 40%. Muntatge `removable` (imants) o `hinged`. Opcional: **trapa petita**
  en una posició concreta (p. ex. davant d'una clau de radiador).
- `panel`: front fix (tapa un buit sense obrir).

**Fronts**: tipus `overlay` (tapant) per defecte, amb jocs configurables a nivell de mòdul
(joc exterior, joc entre fronts). Un compartiment amb porta o calaixos tapa la seva
zona sencera.

## 2. Motor de regles (`core/build/`)
`buildModule(module) → Panel[]` i `buildComposition(comp) → Panel[]`, purs i testejats.
Fa servir les convencions del `CLAUDE.md` (mm, u/v, cantells 1–4, System 32, noms de
peça del taller: `lat d`, `lat e`, `base`, `sostre`, `divisor`, `prestatge`,
`trassera`, `porta`, `frontal calaix`, `lateral calaix`...). Refs úniques
`A.<mòdul>.<tipus>.<n>`.

**Avisos de fusteria** (no bloquegen; es mostren a la UI):
- porta de més de 600 mm d'amplada o de 2.200 mm d'alçada;
- prestatge de 19 mm amb una llum de més de 800 mm (es vinclarà);
- calaix sense guia que hi càpiga;
- reixeta per sota del 40% d'obertura;
- mòduls que se solapen o que surten de l'espai disponible.

## 3. Objectes de referència
A la composició s'hi poden afegir **objectes fantasma**, que no generen peces: caixes
amb nom i mides (p. ex. `Radiador 650×1100×110`, `TV 1231×717`), posició x/y/z, i
dibuixades translúcides al 3D. Serveixen per comprovar que tot hi cap: el radiador
dins del cobreradiador, la tele sobre el moble. Avís si un objecte xoca amb una peça.

## 4. UI (Chakra v3 + react-icons/lu, mobile-first)
- **Alçat frontal 2D (SVG)** del mòdul seleccionat: és l'editor principal.
  - Toca una zona → menú (bottom sheet al mòbil, popover a l'escriptori):
    **Dividir en vertical**, **Dividir en horitzontal**, **Contingut** (open,
    prestatges, porta, calaixos, abatible, reixeta, fix), **Mida** (mm o auto),
    **Eliminar divisió**.
  - Mides acotades sobre el dibuix (llums interiors).
- **Composició**: franja amb els mòduls d'esquerra a dreta; afegir, duplicar,
  eliminar, reordenar, i separació entre mòduls. Objectes de referència a la mateixa llista.
- **Carcassa** del mòdul seleccionat: formulari (base, fons, tapa, laterals...).
- **3D** amb tota la composició; clic sobre un mòdul o una zona el selecciona també a
  l'alçat. Mantén els botons actuals (forats, explosionat, ampliar el 3D) i les
  pestanyes `3D` · `Foto` (la foto també mostra tota la composició).
- **Afegir mòduls des del 3D**: el mòdul seleccionat es ressalta i té un botó **+** a
  cada costat (esquerra i dreta, icona `LuPlus`, amb `aria-label` "Afegir mòdul a
  l'esquerra/dreta"). En prémer-lo, s'hi enganxa un mòdul nou amb la mateixa alçada i
  fondària i una amplada per defecte (o es tria una plantilla). El selector de mòduls
  del panell i el 3D van sincronitzats.
- **Panell esquerre**: fes servir l'acordió que ja existeix (`PanelSection` +
  `PanelGroup`, una secció oberta alhora). Seccions: Composició · Mòdul seleccionat
  (carcassa) · Compartiments (alçat) · Fusteria · Adaptar mides a la imatge.
- **Avisos** en una llista visible, amb enllaç a la zona afectada.
- **Plantilles**: "Guardar com a plantilla" i "Nou des de plantilla". Plantilles
  inicials: armari 2 portes, calaixera 4 calaixos, prestatgeria oberta, moble TV
  3 portes, cobreradiador.
- Llista de peces, nesting i exports: de tota la composició, sense canvis de format.

## 5. Migració
Els projectes existents (mòdul de caixa amb paràmetres) es converteixen en una
composició d'un mòdul amb el mateix resultat. Test: **mateixes peces, mides i forats**
abans i després.

## 6. Tests
- Migració idèntica (vegeu dalt).
- Dividir en vertical un mòdul de 1.800 en 3 zones `auto` → 2 divisors, 3 llums iguals.
- Porta de 720 d'alçada → 2 frontisses; de 1.700 → 4.
- Calaixera: la guia triada és la llarga més gran que cap; els fronts sumen l'alçada
  amb els jocs.
- Reixeta: % d'obertura correcte en un cas conegut; cap ranura surt dels marges.
- Refs úniques a tota la composició.

## 7. Prova d'acceptació: el moble de TV de casa
Muntar-lo **només amb la UI** i guardar-lo com a projecte "Moble TV menjador":
- **Mòdul 1 · moble TV**: 1.850 × 480 × 420, base `plinth` (60 mm, retranqueig 30),
  fons `screwed`, tapa `full`. Divisió vertical en 3 zones `auto`, cadascuna amb porta
  `single` i 1 prestatge regulable. Passacables Ø60 al fons, a la zona central.
- **Mòdul 2 · cobreradiador**: 790 × 1.390 × 420, base `open`, fons `none`, tapa
  `ventSlot` (60 mm). Una sola zona amb contingut `grille` (`removable`, ranures
  verticals, ≥ 40% d'obertura) i trapa davant de la clau del radiador.
  Separació de 50 mm respecte al mòdul 1.
- **Objectes de referència**: `Radiador 650 × 1100 × 110` a 175 mm del terra, dins
  del mòdul 2; `TV 1231 × 717` sobre el mòdul 1, centrada.
- Avís de material a la UI per al mòdul 2: MDF lacat o cantells amb cola PUR (la calor
  del radiador desenganxa els cantells amb cola EVA).
Aquestes mides són **provisionals**, estimades a partir d'una foto. L'usuari les
ajustarà amb les mesures reals.

## Com vull que treballis
1. Pla curt amb el model, els fitxers i les decisions. Espera que te'l validi.
2. Per passos: model + migració → motor de regles (divisions, prestatges, portes) →
   calaixos → reixeta i carcasses especials → objectes de referència → UI de l'alçat
   → composició i plantilles → prova d'acceptació.
3. `pnpm typecheck && pnpm test && pnpm build` al final de cada pas.
4. Si un detall de fusteria no és clar (ferratges, jocs, construcció del calaix),
   pregunta'm; no te l'inventis.

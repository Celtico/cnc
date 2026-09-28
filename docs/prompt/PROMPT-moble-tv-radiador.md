# Prompt — Composició de mòduls + cobreradiador (moble TV)

> ⚠️ **SUBSTITUÏT** per `PROMPT-editor-compartiments.md`, que inclou aquest moble com a prova d'acceptació. Es conserva com a referència del disseny del cobreradiador.

Copia-ho a Claude Code dins de `~/Desktop/cnc`.

---

Llegeix el `CLAUDE.md` i la skill `chakra-ui-builder` abans de començar.

## Objectiu
Vull fer un moble real per a casa: un **moble de TV baix** i, al costat, un
**cobreradiador** més alt que tapa un radiador d'alumini. Tot dissenyat com una sola
**composició** de mòduls. Ara l'app només fa un mòdul de caixa, i cal ampliar-la.

```
 ┌───────────────────────────────────┐┌──────────────┐ ← tapa del cobreradiador
 │                                   ││ ░░░░░░░░░░░░ │   (ranura de sortida d'aire
 │                                   ││ ░ reixeta  ░ │    al darrere)
 ├─────────┬─────────┬─────────┐     ││ ░  CNC     ░ │
 │  porta  │  porta  │  porta  │     ││ ░░░░░░░░░░░░ │
 │ (prest.)│ (prest.)│ (prest.)│     ││              │ ← sense base: entrada d'aire
 └─────────┴─────────┴─────────┘     └┘──────────────┘
   Mòdul TV (baix)                      Cobreradiador (alt)
```

## 1. Model: composició
- Un projecte passa a tenir `modules: Module[]`, col·locats d'esquerra a dreta
  (`x` en mm des de l'esquerra de la composició). Cada mòdul té `type` i els seus
  paràmetres.
- Tipus: `cabinet` (l'existent) i `radiatorCover` (nou).
- **Migració Dexie**: els projectes que ja existeixen passen a una composició d'un sol
  `cabinet` sense perdre res.
- Refs de peça per mòdul: `A.<nº mòdul>.<tipus>.<n>` (ja preparat per a `taller-cnc-nest`).

## 2. Mòdul `cabinet`: afegits per al moble de TV
- `doors` fins a 4, repartides a parts iguals. Un prestatge interior per compartiment.
- **Passacables**: forats Ø60 al fons o a la tapa (posició configurable), com a
  mecanitzat passant.
- **Ventilació** per a router o consola: ranures al fons, opcional.
- **Sòcol o potes**: sòcol retranquejat (alçada i retranqueig configurables) o sense
  sòcol (potes, no s'hi fan peces).

## 3. Mòdul `radiatorCover` (nou)
Paràmetres, en mm:
- Radiador: `radWidth`, `radHeight`, `radDepth` (amb el capçal termostàtic inclòs),
  `radFloorGap` (del terra a la base del radiador), `valveSide` (esquerra o dreta).
- Jocs: `sideGap` (per defecte 50 per costat), `topGap` (100 per sobre),
  `frontGap` (30 davant).
- Mides resultants: amplada = radWidth + 2·sideGap + 2·gruix; alçada = radHeight +
  radFloorGap + topGap + gruix; fondària = radDepth + frontGap + gruix.
  Permet també forçar l'amplada i l'alçada a mà.

Construcció:
- **Sense base i sense fons**. Laterals, tapa i front. Travesser superior al front i
  travesser inferior opcional. Fixació a paret amb escaires (només informatiu a la
  llista).
- **Tapa**: ranura de sortida d'aire al darrere, tocant a la paret (per defecte 60 mm
  lliures), o bé reixeta a la tapa. Una de les dues ha d'existir sempre.
- **Front amb reixeta**, desmuntable per accedir a la clau termostàtica i al purgador:
  - `frontMode`: `removable` (imants; genera els forats dels imants) o `hinged`
    (porta amb frontisses del costat oposat a la clau).
  - Opcional: una **trapa petita** davant de la clau (`valveSide`), perquè no calgui
    treure tot el front per regular.
- **Patró de reixeta** (és la gràcia de la CNC):
  - `pattern`: `slotsV` (ranures verticals), `slotsH` (ranures horitzontals) o `holes`
    (forats rodons al tresbolillo).
  - Paràmetres: amplada de ranura (8), separació (8), radi dels extrems, marge al
    contorn (60), Ø i pas dels forats.
  - Calcula i mostra el **% d'àrea oberta**. Avisa si baixa del 40%, perquè el
    radiador escalfaria malament.
  - Les ranures són **talls passants**. Al DXF van a una capa pròpia `CUT_THROUGH`,
    separada de `CONTOUR`. Al `UnifiedData`, representa-les com a `pockets` amb
    `depth = gruix`. Si això trenca alguna suposició del taller (p. ex. filtres de
    "travessa tot el gruix"), **atura't i pregunta'm** abans d'ampliar el contracte.
- **Material**: avisa a la UI que prop del radiador cal MDF lacat, o cantells amb cola
  PUR. Els cantells amb cola EVA es poden desenganxar amb la calor.

## 4. UI
- Editor: llista de mòduls de la composició (afegir, eliminar, reordenar, triar tipus)
  i el formulari del mòdul seleccionat.
- 3D: tota la composició junta. Clic a un mòdul per seleccionar-lo. El radiador es
  dibuixa com a caixa fantasma (translúcida) perquè es vegin els jocs.
- La càmera enquadra tota la composició (reaprofita el `CameraRig`).
- Llista de peces i exports (DXF, CSV, GLB, UnifiedData) de tota la composició.
- Previsualització 2D de la reixeta amb el % d'àrea oberta.

## 5. Tests
- Migració d'un projecte antic → composició d'un mòdul, amb peces idèntiques.
- Cobreradiador: mides resultants a partir d'un radiador de 800×600×100 amb els jocs
  per defecte.
- Reixeta: cap ranura surt del marge; l'àrea oberta calculada és correcta en un cas
  conegut.
- El DXF conté la capa `CUT_THROUGH`; el `UnifiedData` segueix validant i les `ref`
  són úniques a tota la composició.

## Com vull que treballis
- Primer, un pla curt amb els fitxers i decisions. Després, implementació per passos:
  model + migració → cobreradiador al `core` amb tests → reixeta → UI → exports.
- `pnpm typecheck && pnpm test && pnpm build` al final de cada pas.
- Si un detall de fusteria no és clar, pregunta'm.

# Export per al taller: decisions

Notes de la implementació de `core/export/step.ts`, `topsolidCsv.ts` i `labelPoint.ts`
(setembre 2026). El prompt és a `docs/prompt/PROMPT-export-taller.md`.

## Eixos i numeració de cantells
- El STEP es genera al marc del taller amb la rotació `(x, y, z) → (x, −z, y)`: X amplada,
  Y fondària (creix cap al darrere), Z amunt. És una rotació, no una reflexió: la
  topologia del B-rep no s'inverteix.
- El taller no llegeix els cantells del nostre model: deriva `u` (costat llarg) i `v`
  (curt) de la caixa de cada sòlid, i numera 4 = u mínim · 2 = u màxim · 1 = v mínim ·
  3 = v màxim. `tallerEdgeNumbers(panel)` reprodueix aquest càlcul per a cada peça, de
  manera que les columnes `CANTO_/_LAMINADO_-_EJE_n` del CSV i les espigues del STEP
  cauen al mateix costat al seu visor. Els `EDGE_NUMBER` del nostre model (1 = dalt,
  3 = baix en coordenades locals) només serveixen per al DXF i el JSON de depuració.

## Geometria del STEP
- Cada peça és un `MANIFOLD_SOLID_BREP` amb vèrtexs i arestes compartides: cada aresta
  la fan servir exactament dues cares en sentit oposat (`stepRead.ts` ho comprova als
  tests). Els cercles es parteixen en dos semicercles per evitar arestes de costura.
- Forats cecs: bucle interior a la cara d'entrada + dues semicares cilíndriques
  (`same_sense = .F.`, normal cap a l'eix) + fons pla. El parser del taller en treu
  `mach` (cara) o `edges` (cantell) segons la direcció de l'eix.
- Ranures: cara plana al fons (el taller la llegeix com a `pocket`), parets on no
  arriben al cantell i osca a la cara lateral on hi arriben (`region2d.ts` fa la resta
  rectilínia). Els talls passants es modelen de veritat però el taller els descarta a
  propòsit (els pren per radis de cantonada); només surten al DXF.
- Un mecanitzat que surt de la peça o toca un altre no es modela i surt com a avís:
  així es van trobar dos errors del motor (espigues fora de la tapa amb ranura d'aire i
  ranures de reixeta sobre els imants de la trapa).
- Pendent: obrir un fitxer generat amb FreeCAD per confirmar que el llegeix com a
  sòlids (no hi ha FreeCAD instal·lat en aquesta màquina).

## CSV de nesting
- UTF-16 LE amb BOM, `;`, CRLF, mateixes columnes i ordre que `ARM02_res.csv`. Fila de
  tauler `<material>:<L>x<A>x<gruix>` abans de les peces; nom de tauler
  `<material_amb_guions_baixos>_<gruix>#<nn>` numerat per material i gruix.
- `PosX/PosY_etiqueta` és el centre de l'etiqueta (99 × 68 per defecte, configurable a
  Preferències), dins de la peça col·locada al tauler i lluny de forats, ranures, talls i
  cantells a laminar (`labelPoint.ts`); si la peça és massa petita, al centre.
- `ÍNDICE_3D` = `A.<mòdul>.<tipus>.<n>` amb `n` consecutiu dins del mòdul (`refs.ts`),
  igual al JSON de depuració.
- Les peces que no caben al tauler surten en un tauler a mida perquè el CSV segueixi
  sent vàlid, i la UI ho avisa.

## Prova d'anada i tornada
`src/core/export/taller.roundtrip.test.ts` importa `assemble.ts` del repo del taller
(només lectura, fora del `tsc` del projecte perquè es compila amb altres opcions) i
comprova peces, taulers, material, lligam peça↔sòlid, rols, forats i ranures per al
mòdul de 600 × 720 × 560, el moble de TV amb cobreradiador i una calaixera.

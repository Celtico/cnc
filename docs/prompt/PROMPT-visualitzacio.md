# Prompt — Visualització del 3D (vistes, portes obertes, materials)

Copia-ho a Claude Code dins de `~/Desktop/cnc`, **després** de l'editor de compartiments.

---

Llegeix el `CLAUDE.md` abans de començar. Millores només del visor 3D. No toquis el
`core/`, excepte per llegir-ne les dades. **Res de decoració ni d'objectes decoratius.**

## 1. Vistes estàndard
- Barra de botons sobre el visor: **Davant · Darrere · Esquerra · Dreta · Dalt · 3D**,
  amb icones de `react-icons/lu` i `aria-label` en català. Al mòbil, un menú desplegable.
- Les vistes ortogonals fan servir **càmera ortogràfica**, enquadrant tota la
  composició (reaprofita el càlcul del `CameraRig`). La vista **3D** torna a la
  perspectiva 3/4 actual.
- A les vistes ortogonals, **cotes generals** (amplada, alçada, fondària) i, a la vista
  de Davant, les llums de cada zona.
- Transició suau entre vistes. L'usuari pot seguir fent zoom i desplaçar-se.

## 2. Portes i calaixos oberts
- Control lliscant **"Obertura" (0–100%)**: les portes giren sobre l'eix de les
  frontisses (fins a 95°), els abatibles giren cap avall o cap amunt, i els calaixos surten
  fins a la llargada de la guia.
- Opció per obrir només el compartiment seleccionat.
- **Avís de col·lisió** si, oberts, una porta o un calaix toca una altra peça, un mòdul
  veí o un objecte de referència (p. ex. una porta que topa amb la paret o amb el
  cobreradiador).

## 3. Materials
- Cada material del projecte té un **acabat visual**: color llis, lacat o fusta amb
  textura (roure, noguera, freixe), i blanc, gris i negre per a melamina.
- Textures lleugeres (≤ 512 px, tileables) a `public/textures/`, **amb llicència CC0**, i
  indica'n l'origen en un `public/textures/README.md`. Si no en pots descarregar,
  genera-les proceduralment (soroll de veta) en lloc de posar-hi imatges de procedència
  dubtosa.
- **La veta segueix la direcció de la peça** (el camp `veta` del model): una peça amb
  la veta en llarg la mostra en llarg. Així es veu si alguna peça surt amb la veta girada.
- Els cantells es pinten amb el seu material (p. ex. cantell de roure sobre melamina blanca).
- Commutador **"Veure com a fusta / Veure per tipus de peça"**: el segon mode pinta
  per rol (laterals, horitzontals, fronts, fons) amb colors del tema, com ara.

## 4. Imatge
- Botó **"Descarregar imatge"** (PNG, a 2× la resolució de la pantalla) de la vista
  actual, amb el fons net i ombres suaus. No cal cap motor de render realista.

## Com vull que treballis
Per aquest ordre: vistes → obertura → materials → imatge. Després de cada pas,
`pnpm typecheck && pnpm test && pnpm build`, i comprova que al mòbil (375 px d'amplada)
el visor segueix enquadrant el moble sencer.

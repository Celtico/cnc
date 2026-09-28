# Prompt — Foto del lloc: calibrar, mesurar i superposar el moble

Copia-ho a Claude Code dins de `~/Desktop/cnc`, **després** de l'editor de compartiments.

---

Llegeix el `CLAUDE.md` abans de començar. Lògica matemàtica a `core/photo/` (pura i
testejada), UI a `features/photo/`.

## Estat actual: AMPLIA, NO REFACIS
**La foto és una pestanya de l'Editor**, no una pantalla a part: el visor té les
pestanyes `3D` i `Foto` amb la mateixa disposició, i els controls de la foto
(canviar/esborrar, referència, origen, posició) es pinten al panell esquerre, sota
els paràmetres (portal a `controlsTarget`). Mantén-ho així.

Ja existeix una primera versió que funciona: `src/features/photo/PhotoScreen.tsx` i
`src/core/photo/camera.ts` (+ test). Té la foto, 4 punts de referència amb presets
(A4, rajoles, portes), mides a mà, pla paret/terra, homografia → càmera amb la focal de
l'EXIF, moble superposat i desplaçament X/Y. **Parteix d'aquí i afegeix el que falta**:
- preset de **pantalla de TV** i **distància de la referència a la paret** (§2);
- **qualitat del calibratge** (§2);
- **eines de mesura** amb els estats **relativa / estimada / real** i el recalibratge (§3);
- **línia del terra i mesura de fondària** (§3b);
- **aplicar mesures al moble** i avisos de "no tallis amb mides estimades" (§3);
- opacitat, commutador foto/moble i PNG (§4).
Les seccions de sota descriuen el resultat final; salta't el que ja hi és.

## Idea
L'usuari fa una foto del lloc on anirà el moble, marca un objecte de mides conegudes i,
a partir d'aquí, **mesura la resta sobre la foto** i **veu el moble superposat**. Les
mides de la foto són **relatives**: serveixen per decidir proporcions, no per fabricar.
Quan l'usuari entra una mida real, tot es recalibra.

## 1. Foto
- Captura amb la càmera o des de la galeria. Es desa amb el projecte (Dexie, blob
  comprimit a un màxim de 2.048 px pel costat llarg).
- Llegeix l'EXIF (distància focal, orientació) si hi és. Si iOS no el passa, continua
  sense.
- Avís si la foto sembla feta amb gran angular (focal equivalent < 20 mm): deforma les vores.

## 2. Referència (calibratge)
- L'usuari marca els **4 cantons d'un rectangle conegut**, amb lupa en arrossegar (al
  mòbil el dit tapa el punt).
- Mides de la referència = **mides conegudes** de l'objecte (grup "Mida coneguda" amb
  camps "Amplada" i "Alçada", mai "real", per no confondre-les amb l'estat "real (cinta)" de les
  mesures). Són les que donen l'escala; no tenen estat relatiu, estimat o real.
- Mides de la referència: predefinides (full A4 297×210, porta 2030×825, rajola a
  mida, **pantalla de TV**: model o polzades → amplada i alçada del panell sense peu)
  o a mà.
- **Distància de la referència a la paret** (per defecte 0). Si la referència no és al
  pla de la paret (p. ex. una tele posada sobre un moble, 200 mm per davant), es
  corregeix l'escala de la paret amb aquesta distància. Si no, les mesures de la paret
  surten petites.
- Amb els 4 punts → **homografia** del pla de la referència → escala en mm i pla de la
  paret. Si hi ha EXIF, estima també la pose de la càmera per al 3D.
- Mostra la **qualitat del calibratge**: si els costats marcats donen escales molt
  diferents (foto molt obliqua o punts mal posats), avisa.

## 2b. Origen (0,0) — JA FET
Botó "Marcar l'origen" (icona `LuLocateFixed`): l'usuari toca el racó de la paret a terra
i el moble (i les mesures) es posicionen des d'aquest punt (marcador taronja "0",
arrossegable). Sense origen, el (0,0) és la cantonada baix-esquerra de la referència.
Amb la línia del terra (§3b), proposa l'origen automàticament a l'extrem esquerre de la línia.

## 3. Mesurar sobre la foto
- Eina **distància** (2 punts) i eina **rectangle** (4 punts → amplada × alçada).
- Cada mesura té un nom (p. ex. "Paret", "Radiador", "Espai lliure") i va en una
  **llista de mesures separada del panell de la referència**: valor, estat i un camp
  "Mida amb cinta" per passar-la a real.
- **Cada mesura mostra sempre dues columnes:**

  Amb la referència sense mides (només marcada):

  | Mesura | Relativa | Total (mm) | Mida amb cinta |
  |---|---|---|---|
  | Paret | 2,19 | *(en blanc)* | |
  | Radiador | 0,53 | *(en blanc)* | |

  Quan se'n sap una (la referència o qualsevol mesura amb cinta), s'omplen totes:

  | Mesura | Relativa | Total (mm) | Mida amb cinta |
  |---|---|---|---|
  | Paret | 2,19 | 2.700 ±5% | |
  | Radiador | 0,53 | 648 ✓ | 648 |

  - **Relativa**: proporció respecte a la **referència** (amplada de la referència = 1,00).
    Surt sempre que la referència estigui marcada, encara que no se'n sàpiguen les mides.
  - **Total (mm)**: només si la referència té **mides conegudes**. Si no se saben (camps
    "Amplada/Alçada coneguda" **en blanc**, que ha de ser permès), la columna queda
    **en blanc**, no amb un zero ni un guió que sembli una dada.
  - **Mida amb cinta**: opcional. Quan s'hi escriu, aquella mesura passa a ser **real**
    (icona `LuCircleCheck`), la columna Total mostra aquest valor i **tota la foto es
    recalibra**: les altres totals s'actualitzen i, si la referència no tenia mides,
    ara les té (calculades a partir d'aquesta mesura).
  - Sense mides conegudes, la relativa es calcula amb la **forma** del rectangle de
    referència si se sap (p. ex. "és un A4", o proporció 16:9 per a una tele) o, si no,
    directament sobre la imatge, amb un avís que només és fiable si la foto és frontal.
- Estats, per als avisos i per aplicar-les al moble: **relativa** (només proporció),
  **estimada** (total a partir de la referència) o **real** (cinta).
- Una mesura es pot **aplicar** a un paràmetre del moble (amplada d'un mòdul, alçada
  d'un objecte de referència com el radiador...). La UI ha de mostrar sempre si el
  moble es basa en mides estimades o reals.
- Avís fix: **"No tallis amb mides estimades"** mentre alguna mida aplicada al moble
  sigui relativa o estimada. També als exports DXF, STEP i CSV: avís abans de descarregar.

## 3b. Fondària: línia del terra + punts a terra
Amb la referència a la paret es coneix el pla de la paret. Per mesurar **fondàries**
(distància a la paret) cal també el terra:
- **Línia del terra**: 2 punts verds més, on la paret toca el terra (el sòcol). Amb la
  paret calibrada i la focal, això fixa el **pla del terra** (perpendicular a la paret).
- Eina **fondària**: l'usuari toca un punt **a terra** (p. ex. el davant del radiador o
  el peu de la tele) → l'app calcula la distància a la paret, en mm.
  - Es pot aplicar a la **fondària d'un objecte de referència** o a la **distància a
    la paret** de la referència de calibratge (la tele), que recalcula l'escala.
- Marge d'error **més gran que en amplada i alçada**: en una foto frontal la fondària
  surt molt escurçada. Mostra'l (p. ex. ±15–20%) i calcula'l a partir de l'angle de
  visió del terra. Si és massa gran, recomana fer la foto una mica de biaix o una
  segona foto de costat.
- La línia del terra també serveix per **recolzar el moble a terra** a la superposició,
  sense ajustar l'alçada Y a mà.
- Test: escena sintètica amb càmera coneguda; un punt a terra a 300 mm de la paret es
  mesura dins del marge declarat.

## 4. Superposar el moble
- Renderitza la composició sobre la foto amb la càmera calibrada, alineada al pla de la
  paret i al terra.
- L'usuari pot moure el moble horitzontalment (arrossegant) i ajustar la línia del
  terra si no s'ha pogut deduir.
- Opacitat del moble (control lliscant) i commutador foto / moble / tots dos.
- Descarregar la imatge combinada en PNG.

## 5. Tests (`core/photo/`)
- Homografia: amb 4 punts sintètics d'un rectangle conegut i una càmera coneguda, les
  mesures d'altres punts del mateix pla surten dins d'un 0,5%.
- Correcció de profunditat de la referència: una referència 200 mm per davant de la
  paret dona l'escala de la paret correcta en un cas sintètic.
- Recalibratge: entrar una mida amb cinta ajusta l'escala i la resta de totals en proporció.
- Referència sense mides: la columna Total queda buida (`null`, no 0), la relativa és
  correcta, i entrar una mida amb cinta omple totes les totals.

## Com vull que treballis
Pla curt → matemàtica amb tests → marcatge de punts (mòbil primer) → mesures i estats →
aplicar al moble → superposició 3D. `pnpm typecheck && pnpm test && pnpm build` a cada
pas. Prova-ho amb una foto real feta amb l'iPhone a 1× (no 0,5×).

/**
 * Còpia literal del contracte `UnifiedData` de taller-cnc-nest
 * (~/Desktop/taller-cnc-nest/src/nesting/types.ts).
 *
 * NO modificar aquí. Si falta un camp, s'amplia primer allà (de manera additiva)
 * i després es torna a copiar.
 */

export type Role = "lateral" | "horizontal" | "front" | "back" | "hw"
export type Side = "d" | "e" | null

// Confiança del lligam peça↔sòlid del STEP (per mida, honestedat de dades):
//  exact          — mida única entre peces i sòlids: és AQUEST sòlid.
//  representative — una de N peces/sòlids de la mateixa mida: caixa correcta
//                   excepte per germanes intercanviables (lligam per mida, no posició).
//  none           — cap sòlid dins la tolerància de mida.
export type MatchConfidence = "exact" | "representative" | "none"

export interface Piece {
  ref: string // ÍNDICE_3D del CSV, p.ex. "A.2.H.8" (únic per peça)
  name: string // Nombre_pieza, p.ex. "calaixera_trassera"
  thick: number // Grueso_pieza (10|12|16|19|30)
  tab: number // nº de tauler (1..n)
  x: number // PosX_etiqueta (coord al tauler, centre de la peça)
  y: number // PosY_etiqueta
  angle: number // Angulo_etiqueta (graus)
  L: number // Longitud_Pieza
  W: number // Ancho_Pieza
  r3d: Role // rol per ressaltar al 3D (derivat del nom)
  side3d: Side // costat (laterals)
  dim: [number, number] | null // [L,W] del CSV (sempre conegut)
  solid: number // índex del sòlid del STEP lligat per mida; -1 si cap
  match: MatchConfidence // confiança del lligam (vegeu MatchConfidence)
  mec2?: string | null // SEGUNDO_NOMBRE_DE_FICHERO_DE_MECANIZADO (2a mecanització)
  // Cantons a laminar per eix (CANTO_/_LAMINADO_-_EJE_1..4). 4 posicions,
  // null = aquell eix no es lamina. Mapatge eix→costat del rectangle acordat
  // amb el taller: 1=dalt, 2=dreta, 3=baix, 4=esquerra (vegeu LaminateEdges).
  lam?: (string | null)[] | null
}

// Un tauler de nesting (Nombre_tablero_nesting) amb la seva mida real.
export interface Board {
  tab: number // nº de tauler (1..n), ordre d'aparició
  name: string // Nombre_tablero_nesting, p.ex. "W1000_blanc_premium_19#03"
  w: number // amplada del tauler (Longitud_Pieza de la fila del tauler)
  h: number // alçada del tauler (Ancho_Pieza de la fila del tauler)
  thick: number // gruix del tauler
}

export interface Solid {
  min: [number, number, number]
  size: [number, number, number]
  role: Role
  side: Side
  label?: string | null // nom de peça llegit del STEP, si n'hi ha (additiu)
  // Mecanitzats de la cara, en mm des de la cantonada de la peça: u sobre el
  // costat llarg, v sobre el curt. Surten dels cilindres del STEP (forats i
  // fresats); els cilindres que travessen tot el gruix s'exclouen perquè són
  // radis de cantonada del contorn, no mecanitzat.
  mach?: { u: number; v: number; r: number; depth: number; side: "a" | "b" | null; fit?: string }[]
  // Forats de CANTELL (espigues): l'eix va dins el pla de la cara, no el
  // travessa. (u,v) és el punt d'entrada al perímetre i 'edge' el cantell,
  // amb la mateixa numeració que el laminat: 1 dalt · 2 dreta · 3 baix · 4 esq.
  edges?: { u: number; v: number; r: number; depth: number; edge: 1 | 2 | 3 | 4; fit?: string }[]
  // Buidats (ranures, caixetins, rebaixos): el FONS de cada un és una cara
  // plana perpendicular al gruix a fondària intermèdia. 'pts' és el seu
  // perímetre en mm dins la peça (u,v); els arcs s'aproximen pels extrems.
  pockets?: { depth: number; side: "a" | "b"; pts: [number, number][] }[]
}

// Unió entre dues peces: quin ferratge les lliga i quants n'hi van. 'a' i 'b'
// són índexs de sòlid (i cada sòlid té la seva peça). Surt de mirar quins
// ferratges toquen DOS panells alhora.
export interface Join {
  a: number
  b: number
  fit: string
  n: number
}

export interface UnifiedData {
  mueble: string
  material: string
  boards: Board[] // taulers amb mida pròpia (poden diferir entre ells)
  tabs: number[] // [1..n] (ordre)
  pieces: Piece[]
  solids: Solid[]
  ctr: [number, number, number]
  joins?: Join[]
}

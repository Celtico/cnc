import { EDGE_SIDES, type Panel } from "../model"
import type { Nesting, Placement } from "../nesting/nest"
import { labelPoint, type LabelSize } from "./labelPoint"
import { tallerEdgeNumbers } from "./step"
import { pieceRefs } from "./refs"
import { csvField, workshopName } from "./text"
import { needsSecondFace, secondFaceProgram } from "../process/processes"

/**
 * CSV de nesting amb el format de TopSolid V6 (`<moble>_res.csv`), tal com el llegeix
 * `csv-nesting.ts` del taller: UTF-16 LE amb BOM, separador `;`, CRLF, decimals amb
 * punt. Per a cada tauler, una fila de tauler (`Nombre_pieza` = `<material>:<L>x<A>x<gruix>`)
 * i després les seves peces.
 *
 * El parser del taller no entén cometes: tots els camps de text passen per `csvField`
 * (`;` → `,`, `:` → `-`, sense salts de línia). L'únic `:` és el separador de la fila de
 * tauler, que és com el taller la distingeix d'una peça.
 */

export const TOPSOLID_CSV_HEADER = [
  "Nombre_tablero_nesting",
  "numero_de_piezas",
  "PÉRDIDA_NESTING",
  "Nombre_pieza",
  "Longitud_Pieza",
  "Ancho_Pieza",
  "Grueso_pieza",
  "Referencia",
  "PosX_etiqueta",
  "PosY_etiqueta",
  "Angulo_etiqueta",
  "Revestimiento",
  "ORIGINAL_ELEMENT_IDENTIFIER",
  "CANTO_/_LAMINADO_-_EJE_1",
  "RUTA_DEL_MODELO",
  "Nombre_trabajo",
  "CANTO_/_LAMINADO_-_EJE_2",
  "CANTO_/_LAMINADO_-_EJE_3",
  "CANTO_/_LAMINADO_-_EJE_4",
  "ÍNDICE_3D",
  "SEGUNDO_NOMBRE_DE_FICHERO_DE_MECANIZADO",
] as const

interface TopsolidCsvOptions {
  /** Nom del projecte (RUTA_DEL_MODELO). */
  project: string
  /** Mida de l'etiqueta per triar PosX/PosY. */
  label?: LabelSize
  /** Text del cantell laminat a les columnes CANTO. */
  edgeText?: string
}

interface CsvPieceRow {
  panelId: string
  board: string
  ref: string
  /** Punt de l'etiqueta al tauler (mm). */
  x: number
  y: number
  angle: number
  labelFits: boolean
}

interface TopsolidCsvResult {
  text: string
  rows: CsvPieceRow[]
  /** Peces que no cabien a cap tauler i s'han posat en un tauler a mida. */
  unplaced: string[]
}

const num1 = (v: number): string => (Math.round(v * 10) / 10).toFixed(1)
const num2 = (v: number): string => (Math.round(v * 100) / 100).toFixed(2)
const int = (v: number): string => String(Math.round(v))
/**
 * Gruix tal com surt al CSV: enter si ho és (`19`, com TopSolid) i, si no, amb els decimals que
 * calguin i punt (`18.6`, com la resta de números del CSV). Abans s'arrodonia i un tauler de 18,6
 * i un de 19 sortien amb el mateix nom.
 */
const thick = (v: number): string => String(Math.round(v * 100) / 100)

/** Nom de tauler del taller: `Melamina_blanca_19#01`. */
export function boardName(material: string, thickness: number, n: number): string {
  return `${boardBase(material, thickness)}#${String(n).padStart(2, "0")}`
}

/** El nom del tauler sense el número: també és la clau per numerar-los (dos taulers no es diuen igual). */
function boardBase(material: string, thickness: number): string {
  // ASCII com tot el que va al taller (també és el nom de la peça de treball del .xcs): «Roure massís / xapat» → Roure_massis_xapat.
  const base = workshopName(material).replace(/[^A-Za-z0-9.-]+/g, "_").replace(/^_+|_+$/g, "")
  return `${base || "Material"}_${thick(thickness)}`
}

/** Punt local (u, v) d'una peça → coordenades del tauler segons la col·locació. */
export function localToBoard(pl: Placement, u: number, v: number): { x: number; y: number } {
  if (pl.angle === 0) return { x: pl.x + u, y: pl.y + v }
  // 90°: el costat llarg va en Y; gir antihorari: (u, v) → (w − v, u).
  return { x: pl.x + (pl.w - v), y: pl.y + u }
}

export function toTopsolidCsv(panels: Panel[], nesting: Nesting, options: TopsolidCsvOptions): TopsolidCsvResult {
  const byId = new Map(panels.map((p) => [p.id, p]))
  const refs = pieceRefs(panels)
  const edgeText = csvField(options.edgeText ?? "canto 1mm")
  const lines: string[] = [TOPSOLID_CSV_HEADER.join(";")]
  const rows: CsvPieceRow[] = []
  let elementId = 1000

  interface BoardOut {
    name: string
    material: string
    thickness: number
    w: number
    h: number
    waste: number
    pieces: { panel: Panel; placement: Placement }[]
  }
  const boards: BoardOut[] = []
  const counters = new Map<string, number>()
  for (const b of nesting.boards) {
    const key = boardBase(b.material, b.thickness)
    const n = (counters.get(key) ?? 0) + 1
    counters.set(key, n)
    boards.push({
      name: boardName(b.material, b.thickness, n),
      material: b.material,
      thickness: b.thickness,
      w: b.w,
      h: b.h,
      waste: (1 - b.efficiency) * 100,
      pieces: b.placements.map((pl) => ({ panel: byId.get(pl.panelId)!, placement: pl })).filter((x) => x.panel),
    })
  }
  // Peces sense col·locar: un tauler a mida per a cadascuna, perquè el CSV segueixi sent vàlid.
  const unplaced: string[] = []
  for (const id of nesting.unplaced) {
    const p = byId.get(id)
    if (!p) continue
    unplaced.push(id)
    const key = boardBase(p.material, p.thickness)
    const n = (counters.get(key) ?? 0) + 1
    counters.set(key, n)
    boards.push({
      name: boardName(p.material, p.thickness, n),
      material: p.material,
      thickness: p.thickness,
      w: p.length,
      h: p.width,
      waste: 0,
      pieces: [{ panel: p, placement: { panelId: id, x: 0, y: 0, w: p.length, h: p.width, angle: 0, cx: p.length / 2, cy: p.width / 2 } }],
    })
  }

  const route = workshopName(options.project)
  for (const b of boards) {
    const common = [b.name, String(b.pieces.length), num2(b.waste)]
    const mat = workshopName(b.material)
    lines.push(
      [
        ...common,
        `${mat}:${int(b.w)}x${int(b.h)}x${thick(b.thickness)}`,
        num1(b.w),
        num1(b.h),
        thick(b.thickness),
        `${mat}${thick(b.thickness)}`,
        "0",
        "0",
        "0.00",
        "",
        String(elementId++),
        "",
        route,
        "Configurador",
        "",
        "",
        "",
        "",
        "",
      ].join(";"),
    )
    for (const { panel: p, placement: pl } of b.pieces) {
      const lp = labelPoint(p, { label: options.label })
      const pos = localToBoard(pl, lp.u, lp.v)
      const nums = tallerEdgeNumbers(p)
      const canto: Record<1 | 2 | 3 | 4, string> = { 1: "", 2: "", 3: "", 4: "" }
      for (const side of EDGE_SIDES) if (p.edges[side]) canto[nums[side]] = edgeText
      const ref = csvField(refs.get(p.id) ?? "")
      rows.push({ panelId: p.id, board: b.name, ref, x: pos.x, y: pos.y, angle: pl.angle, labelFits: lp.fits })
      lines.push(
        [
          ...common,
          workshopName(p.name),
          num1(p.length),
          num1(p.width),
          thick(p.thickness),
          "",
          int(pos.x),
          int(pos.y),
          num2(pl.angle),
          "",
          String(elementId++),
          canto[1],
          route,
          "Configurador",
          canto[2],
          canto[3],
          canto[4],
          ref,
          // 2a mecanització: la peça té forats o ranures a la cara B.
          needsSecondFace(p) && ref ? secondFaceProgram(ref) : "",
        ].join(";"),
      )
    }
  }
  return { text: lines.join("\r\n") + "\r\n", rows, unplaced }
}

/** Codifica text en UTF-16 LE amb BOM (FF FE), com el CSV de TopSolid. */
export function encodeUtf16le(text: string): Uint8Array<ArrayBuffer> {
  const out = new Uint8Array(new ArrayBuffer(2 + text.length * 2))
  out[0] = 0xff
  out[1] = 0xfe
  for (let i = 0; i < text.length; i++) {
    const c = text.charCodeAt(i)
    out[2 + i * 2] = c & 0xff
    out[3 + i * 2] = c >> 8
  }
  return out
}

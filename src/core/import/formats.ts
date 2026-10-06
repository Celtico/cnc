import type { HettichFileKind } from "./hettich"

/**
 * **Els formats que llegeix l'importador de ferratges** (Preferències › Ferratges › «Importar del fabricant»): una sola
 * taula per al classificador (`hettichFileKind` / `importFileKind`) i per al selector de fitxers (`IMPORT_ACCEPT`), així
 * no poden divergir (abans el selector del Mac deixava el `.dae` en gris). Els que es llisten però no es llegeixen
 * (DWG, SAT, MAX, CAM d'altres màquines) també hi són: entren al diàleg amb la nota de per què no. Pur.
 */
export interface ImportFormat {
  /** Extensions en minúscula, amb el punt. */
  ext: readonly string[]
  /**
   * El tipus del classificador. `dxf` i `pdf` depenen del nom i la carpeta (vistes, plànols de muntatge, DXF del taller):
   * els decideix `hettichFileKind`. `zip` és un contenidor (es llegeixen els fitxers de dins).
   */
  kind: HettichFileKind | "dxf" | "zip"
  /**
   * Tipus MIME que també es posen a l'`accept` del selector: alguns navegadors (Safari, el diàleg del Mac) tradueixen
   * les extensions a tipus del sistema i, si no en coneixen la d'un fitxer, el deixen en gris; amb el MIME, no.
   */
  mime?: readonly string[]
}

export const IMPORT_FORMATS: readonly ImportFormat[] = [
  { ext: [".zip"], kind: "zip", mime: ["application/zip", "application/x-zip-compressed"] },
  { ext: [".step", ".stp"], kind: "step", mime: ["model/step", "application/step"] },
  { ext: [".igs", ".iges"], kind: "iges", mime: ["model/iges", "application/iges"] },
  { ext: [".3ds"], kind: "3ds", mime: ["application/x-3ds", "image/x-3ds"] },
  { ext: [".dae"], kind: "dae", mime: ["model/vnd.collada+xml"] },
  { ext: [".glb", ".gltf"], kind: "glb", mime: ["model/gltf-binary", "model/gltf+json"] },
  { ext: [".pgm"], kind: "pgm" },
  { ext: [".dxf"], kind: "dxf", mime: ["image/vnd.dxf", "application/dxf"] },
  { ext: [".pdf"], kind: "pdf", mime: ["application/pdf"] },
  // Es llisten (amb la nota de per què no es llegeixen).
  { ext: [".dwg"], kind: "dwg", mime: ["image/vnd.dwg"] },
  { ext: [".mpr"], kind: "mpr" },
  { ext: [".fmc", ".hop", ".tcn"], kind: "cam" },
  { ext: [".sat"], kind: "sat" },
  { ext: [".max"], kind: "max" },
]

/** L'extensió d'un camí (minúscula, amb el punt; buida si no en té). */
export function extOf(path: string): string {
  const name = path.split("/").pop()!.toLowerCase()
  const i = name.lastIndexOf(".")
  return i > 0 ? name.slice(i) : ""
}

const BY_EXT = new Map(IMPORT_FORMATS.flatMap((f) => f.ext.map((e) => [e, f] as const)))

/** El format d'un fitxer per l'extensió (o `null` si l'importador no el coneix). */
export const importFormatOf = (path: string): ImportFormat | null => BY_EXT.get(extOf(path)) ?? null

/** L'`accept` del selector «Triar fitxers…»: totes les extensions de la taula i els seus MIME. */
export const IMPORT_ACCEPT: string = [...new Set(IMPORT_FORMATS.flatMap((f) => [...f.ext, ...(f.mime ?? [])]))].join(",")

/** Els tipus que donen el 3D d'un article (per ordre de preferència: STEP, IGES, 3DS, Collada, glTF). */
export const MODEL_3D_KINDS = ["step", "iges", "3ds", "dae", "glb"] as const satisfies readonly HettichFileKind[]

/** Les extensions que l'importador llegeix o llista, per a l'explicació de la zona d'importar («.zip, .step/.stp, …»). */
export const importFormatsText = (): string => IMPORT_FORMATS.map((f) => f.ext.join("/")).join(", ")

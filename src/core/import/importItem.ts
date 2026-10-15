import { cupRel, DEFAULT_HARDWARE_LIBRARY, IMPORT_BOX_VERSION, pairPlate, roleOf, type HardwareEngine, type HardwareItem, type HardwareTarget, type MachiningOp } from "../model"
import type { HettichArticle } from "./hettich"
import { makerOf } from "./makers"
import { modelProposal, partialProposal, proposeHandle, proposeHinge, proposeLeg, proposePlate, type HardwareProposal, type LocalFrame } from "./proposal"
import type { StepFeatures } from "./stepGeometry"

/**
 * D'una proposta (`proposal.ts`) a un item de la biblioteca (`HardwareItem`), **sense confirmar**: una frontissa fa servir
 * el motor de cassoleta de sempre (`cup`: quantitat per alçada, a la filera System 32, `cupOffset` del cantell) amb els
 * forats del fitxer al voltant de la cassoleta; una placa, el motor `plate` (forats al lateral des de la seva referència).
 * Pur.
 */

const num = (x: number) => Math.round(x * 100) / 100

interface ImportedExtras {
  id: string
  asset?: string
  points?: [number, number, number][]
  files: string[]
}

/** Una caixa buida (sense STEP: només les vistes DXF) no es desa. */
const emptyBox = (b: HardwareProposal["bbox"]) => [...b.min, ...b.max].every((v) => v === 0)

function source(art: HettichArticle, p: HardwareProposal, targets: HardwareTarget[], x: ImportedExtras): NonNullable<HardwareItem["imported"]> {
  return {
    maker: makerOf(art),
    article: art.article,
    folders: art.folders,
    files: x.files,
    ...(x.asset ? { asset: x.asset } : {}),
    ...(emptyBox(p.bbox) ? {} : { bbox: p.bbox, ...(p.boxFromMesh ? { boxVersion: IMPORT_BOX_VERSION } : {}) }),
    ...(x.points?.length ? { points: x.points } : {}),
    ...(p.kind !== "model" ? { mountFrame: cleanFrame(p.frame), frameFrom: p.frameFrom ?? "step" } : {}),
    proposed: structuredClone(targets),
    notes: p.notes,
    confirmed: false,
  }
}

const r3 = (x: number) => Math.round(x * 1000) / 1000 || 0
/** El marc arrodonit (0,001 mm), sense zeros negatius: el que es desa a l'item. */
const cleanFrame = (f: LocalFrame): LocalFrame => ({ origin: f.origin.map(r3) as LocalFrame["origin"], u: f.u.map(r3) as LocalFrame["u"], v: f.v.map(r3) as LocalFrame["v"], n: f.n.map(r3) as LocalFrame["n"] })

/** Frontissa importada: parteix de la frontissa per defecte (quantitat per alçada, extrems, separació, `cupOffset`). */
export function hingeItem(p: HardwareProposal, art: HettichArticle, base: HardwareItem, x: ImportedExtras): HardwareItem {
  const [cup, ...rest] = p.holes
  const ops: MachiningOp[] = [
    { kind: "drill", face: "A", u: 0, v: "cupOffset", d: "cupDiameter", depth: "cupDepth", tag: "hinge" },
    ...rest.map((h): MachiningOp => ({ kind: "drill", face: "A", u: h.u, v: cupRel(h.v), d: h.d, depth: h.depth, tag: h.role === "dowel" ? "hinge-dowel" : "hinge-screw" })),
  ]
  const targets: HardwareTarget[] = [{ key: "door", label: "Porta", ops }]
  return {
    id: x.id,
    name: art.label,
    category: "hinge",
    engine: "cup",
    ...(art.tags.length ? { tags: [...art.tags] } : {}),
    maker: makerOf(art),
    ref: art.article,
    params: { ...base.params, cupDiameter: cup?.d ?? base.params.cupDiameter ?? 35, cupDepth: cup?.depth ?? base.params.cupDepth ?? 13 },
    ...(base.count ? { count: structuredClone(base.count) } : {}),
    targets,
    version: 1,
    imported: source(art, p, targets, x),
  }
}

/** Placa de muntatge importada (37 mm del davant, a l'alçada de la cassoleta). */
export function plateItem(p: HardwareProposal, art: HettichArticle, x: ImportedExtras): HardwareItem {
  const ops: MachiningOp[] = p.holes.map((h) => ({ kind: "drill", face: "A", u: h.u, v: h.v, d: h.d, depth: h.depth, tag: "plate" }))
  const targets: HardwareTarget[] = [{ key: "side", label: "Lateral", ops }]
  return {
    id: x.id,
    name: art.label,
    category: "plate",
    engine: "plate",
    ...(art.tags.length ? { tags: [...art.tags] } : {}),
    maker: makerOf(art),
    ref: art.article,
    params: { setback: 37, offset: 0 },
    targets,
    version: 1,
    imported: source(art, p, targets, x),
  }
}

/**
 * Tirador importat: el motor del tirador de sempre (`barHandle`: centrat als calaixos, a `inset` del cantell que obre a
 * les portes i abatibles, avís si no hi cap) amb la **distància del fitxer** (`pitch` sense graons: la mateixa a tots els
 * fronts) i el Ø del forat passant (`diameter`). Un pom (un sol forat): un forat al centre, `pitch` 0. El marge i el
 * cantell, del tirador de l'app (`base`).
 */
export function handleItem(p: HardwareProposal, art: HettichArticle, base: HardwareItem, x: ImportedExtras): HardwareItem {
  const two = p.holes.length === 2
  const dist = two ? Math.abs(p.holes[1]!.u - p.holes[0]!.u) : 0
  const ops: MachiningOp[] = two
    ? [
        { kind: "through", u: "-pitch/2", v: 0, d: "diameter", tag: "handle" },
        { kind: "through", u: "pitch/2", v: 0, d: "diameter", tag: "handle" },
      ]
    : [{ kind: "through", u: 0, v: 0, d: "diameter", tag: "handle" }]
  // Sense patró al fitxer (proposta parcial): el tirador de l'app tal qual (dos forats a la distància per regla).
  if (!p.holes.length) {
    const targets = structuredClone(base.targets)
    return {
      id: x.id,
      name: art.label,
      category: "handle",
      engine: "barHandle",
      ...(art.tags.length ? { tags: [...art.tags] } : {}),
      maker: makerOf(art),
      ref: art.article,
      params: { ...base.params },
      ...(base.pitch ? { pitch: structuredClone(base.pitch) } : {}),
      targets,
      version: 1,
      imported: source(art, p, targets, x),
    }
  }
  const targets: HardwareTarget[] = [{ key: "front", label: "Front", ops }]
  return {
    id: x.id,
    name: art.label,
    category: "handle",
    engine: "barHandle",
    ...(art.tags.length ? { tags: [...art.tags] } : {}),
    maker: makerOf(art),
    ref: art.article,
    params: { margin: base.params.margin ?? 3, inset: base.params.inset ?? 40, diameter: p.holes[0]?.d ?? base.params.diameter ?? 5 },
    pitch: { steps: [], else: num(dist) },
    targets,
    version: 1,
    imported: source(art, p, targets, x),
  }
}

/** Pota importada: els forats de la placa a la cara de sota de la base, a 50 mm dels cantells del mòdul. */
export function legItem(p: HardwareProposal, art: HettichArticle, x: ImportedExtras): HardwareItem {
  const ops: MachiningOp[] = p.holes.map((h) => ({ kind: "drill", face: "A", u: h.u, v: h.v, d: h.d, depth: h.depth, tag: "leg" }))
  const targets: HardwareTarget[] = [{ key: "base", label: "Base (cara de sota)", ops }]
  return {
    id: x.id,
    name: art.label,
    category: "leg",
    engine: "leg",
    ...(art.tags.length ? { tags: [...art.tags] } : {}),
    maker: makerOf(art),
    ref: art.article,
    params: { inset: 50 },
    targets,
    version: 1,
    imported: source(art, p, targets, x),
  }
}

/**
 * «Només 3D» (motor `model`): el model i el volum del fitxer, **cap forat** (no hi ha cap regla de mecanitzat per a
 * aquesta família, o no s'ha trobat el patró): es veu a l'editor i se'n pot baixar el GLB. No es confirma mai (no hi ha
 * res a revisar: no fa cap forat ni es pot triar a cap lloc del moble).
 */
export function modelItem(p: HardwareProposal, art: HettichArticle, x: ImportedExtras): HardwareItem {
  const targets: HardwareTarget[] = [{ key: "model", label: "Només 3D", ops: [] }]
  return {
    id: x.id,
    name: art.label,
    category: art.category,
    engine: "model",
    ...(art.tags.length ? { tags: [...art.tags] } : {}),
    maker: makerOf(art),
    ref: art.article,
    params: {},
    targets,
    version: 1,
    imported: source(art, p, targets, x),
  }
}

/**
 * **Canvia què és** un ferratge importat (el seu lloc, `engine`; «Què és» a l'editor): l'item passa al motor triat amb
 * els números i els mecanitzats per defecte d'aquell tipus (el ferratge d'inici de l'app del mateix motor; la placa i
 * la pota, els seus), **sense confirmar** i amb la proposta = aquests mecanitzats (res d'editat). Es queden l'identitat
 * (id, nom, fabricant, referència), el model i les dades de la importació (fitxers, caixa, marc, notes) i els
 * mecanitzats del generador. Una frontissa que deixa de ser-ho perd la placa aparellada. Si ja és d'aquest motor, el
 * mateix item. Pur; el marc del model 3D (si cal refer-lo de la malla) el fa `features/settings/hardwareReframe.ts`.
 */
export function retargetImported(item: HardwareItem, engine: HardwareEngine, library: readonly HardwareItem[] = []): HardwareItem {
  if (!item.imported || item.engine === engine) return item
  const role = roleOf(engine)
  const base = library.find((x) => x.engine === engine && !x.imported) ?? DEFAULT_HARDWARE_LIBRARY.find((x) => x.engine === engine)
  const { plate: _plate, count: _c, pitch: _p, lengths: _l, ...rest } = item
  const targets: HardwareTarget[] =
    engine === "plate" ? [{ key: "side", label: "Lateral", ops: [] }]
    : engine === "leg" ? [{ key: "base", label: "Base (cara de sota)", ops: [] }]
    : engine === "model" ? [{ key: "model", label: "Només 3D", ops: [] }]
    : structuredClone(base?.targets ?? [])
  const params: Record<string, number> = engine === "plate" ? { setback: 37, offset: 0 } : engine === "leg" ? { inset: 50 } : engine === "model" ? {} : { ...(base?.params ?? {}) }
  const { update: _u, proposedParams: _pp, ...imported } = item.imported
  const next: HardwareItem = {
    ...rest,
    category: role.category,
    engine,
    params,
    ...(base?.count && engine !== "model" ? { count: structuredClone(base.count) } : {}),
    ...(base?.pitch && engine !== "model" ? { pitch: structuredClone(base.pitch) } : {}),
    ...(base?.lengths && engine !== "model" ? { lengths: [...base.lengths] } : {}),
    targets,
    imported: { ...imported, proposed: structuredClone(targets), confirmed: false },
  }
  const hp = holeParams(next)
  return Object.keys(hp).length ? { ...next, imported: { ...next.imported!, proposedParams: hp } } : next
}

/**
 * Aplica a un importat una proposta **del seu mateix tipus** feta després d'importar-lo (el marc estimat de la malla en
 * canviar «què és», `hardwareReframe.ts`): els mecanitzats i els números de la proposta (com `articleItem`), la caixa, el
 * marc i les notes, **sense confirmar**. Una frontissa es queda la placa aparellada (target `side`). Pur.
 */
export function applyProposal(item: HardwareItem, p: HardwareProposal, base: { hinge: HardwareItem; handle: HardwareItem }, frame?: LocalFrame): HardwareItem {
  if (!item.imported) return item
  const art: HettichArticle = { maker: item.imported.maker, article: item.imported.article, folders: item.imported.folders, category: item.category, tags: item.tags ?? [], label: item.name, group: "", kind: p.kind, files: [] }
  const x: ImportedExtras = { id: item.id, files: item.imported.files, ...(item.imported.asset ? { asset: item.imported.asset } : {}), ...(item.imported.points ? { points: item.imported.points } : {}) }
  const fresh = articleItem(p, art, base, x)
  if (fresh.engine !== item.engine) return item
  const side = item.engine === "cup" && item.plate ? item.targets.filter((t) => t.key === "side") : []
  const { update: _u, ...imported } = item.imported
  const { mountFrame: _mf, frameFrom: _ff, ...rest } = imported
  return {
    ...item,
    params: { ...fresh.params, ...(item.plate ? { plateSetback: item.params.plateSetback ?? 37, plateOffset: item.params.plateOffset ?? 0 } : {}) },
    ...(fresh.pitch ? { pitch: fresh.pitch } : {}),
    ...(fresh.count ? { count: fresh.count } : {}),
    targets: [...fresh.targets, ...side],
    imported: {
      ...rest,
      proposed: structuredClone(fresh.targets),
      ...(fresh.imported?.proposedParams ? { proposedParams: fresh.imported.proposedParams } : {}),
      ...(fresh.imported?.bbox ? { bbox: fresh.imported.bbox, ...(fresh.imported.boxVersion !== undefined ? { boxVersion: fresh.imported.boxVersion } : {}) } : {}),
      ...(frame ? { mountFrame: cleanFrame(frame) } : {}),
      ...(p.frameFrom ? { frameFrom: p.frameFrom } : {}),
      notes: p.notes,
      confirmed: false,
    },
  }
}

/**
 * Frontisses i plaques importades al mateix lot: si hi ha **una sola** placa, totes les frontisses s'hi aparellen; amb
 * més d'una no se'n tria cap (quina va amb quina ho decideix l'usuari a l'editor) i `plates` ho diu.
 */
export function pairImportedBatch(items: readonly HardwareItem[]): { items: HardwareItem[]; paired: number; plates: number } {
  const plates = items.filter((x) => x.engine === "plate")
  const plate = plates.length === 1 ? plates[0]! : null
  let paired = 0
  const out = items.map((x) => {
    if (x.engine !== "cup" || !plate) return x
    paired++
    return pairPlate(x, plate)
  })
  return { items: out, paired, plates: plates.length }
}



/**
 * La proposta d'un article segons què és (`HettichArticle.kind`): frontissa, placa, tirador o pota; si no s'hi troba el
 * patró (o la família no té regla), **només 3D** (`kind: "model"`) amb el perquè a les notes. Pur.
 */
export function proposeArticle(a: Pick<HettichArticle, "kind" | "plan">, f: StepFeatures, opts: { throughDiameter?: number } = {}): HardwareProposal {
  const p =
    a.kind === "hinge" ? proposeHinge(f)
    : a.kind === "plate" ? proposePlate(f)
    : a.kind === "handle" ? proposeHandle(f, opts)
    : a.kind === "leg" ? proposeLeg(f)
    : null
  if (!p) return modelProposal(f, [a.plan ?? "Només 3D: sense forats."])
  // El tipus se sap (frontissa, placa, tirador, pota) però no el patró: parcial, mai «només 3D» (es completa a l'editor,
  // o la malla en dona el marc, `meshFrame.ts`).
  if ("error" in p) return partialProposal(a.kind as Exclude<HardwareProposal["kind"], "model">, f, p.error)
  return { ...p, frameFrom: "step" }
}

/**
 * Els números que fan els forats de la proposta i no són als mecanitzats (que en diuen el nom): Ø i fondària de la
 * cassoleta, Ø i distància (`pitch`) del tirador. On va la placa o la pota (`plateSetback`, `inset`) no surten del fitxer.
 */
export function holeParams(item: HardwareItem): Record<string, number> {
  const pick = (keys: string[]) => Object.fromEntries(keys.filter((k) => item.params[k] !== undefined).map((k) => [k, item.params[k]!]))
  if (item.engine === "cup") return pick(["cupDiameter", "cupDepth"])
  if (item.engine === "barHandle") return { ...pick(["diameter"]), pitch: item.pitch?.else ?? 0 }
  return {}
}

/** L'item de la biblioteca d'una proposta (`proposeArticle`), sense confirmar. */
export function articleItem(p: HardwareProposal, a: HettichArticle, base: { hinge: HardwareItem; handle: HardwareItem }, x: ImportedExtras): HardwareItem {
  const item =
    p.kind === "hinge" ? hingeItem(p, a, base.hinge, x)
    : p.kind === "plate" ? plateItem(p, a, x)
    : p.kind === "handle" ? handleItem(p, a, base.handle, x)
    : p.kind === "leg" ? legItem(p, a, x)
    : modelItem(p, a, x)
  const params = holeParams(item)
  return Object.keys(params).length && item.imported ? { ...item, imported: { ...item.imported, proposedParams: params } } : item
}

/** La nota de la fila del diàleg d'importar un cop llegit el STEP: què farà de debò («Tirador · 128 mm»). */
export function proposalPlan(p: HardwareProposal): string {
  const n = (x: number) => String(Math.round(x * 100) / 100).replace(".", ",")
  const holes = (k: number) => `${k} forat${k === 1 ? "" : "s"}`
  if (p.partial) return `${{ hinge: "Frontissa", plate: "Placa", handle: "Tirador", leg: "Pota", model: "Només 3D" }[p.kind]} · sense patró al fitxer: mides per omplir`
  switch (p.kind) {
    case "hinge":
      return `Frontissa · cassoleta Ø${n(p.holes[0]?.d ?? 0)}${p.holes.length > 1 ? ` i ${holes(p.holes.length - 1)}` : ""}`
    case "plate":
      return p.holes.length ? `Placa · ${holes(p.holes.length)}` : "Placa ambigua: sense forats (entra'ls a mà)"
    case "handle":
      return p.holes.length === 2 ? `Tirador · ${n(Math.abs(p.holes[1]!.u - p.holes[0]!.u))} mm` : "Pom · 1 forat"
    case "leg":
      return `Pota · ${holes(p.holes.length)} a cada pota`
    case "model":
      if (p.notes[0] && /^Només 3D/.test(p.notes[0])) return p.notes[0]
      return `Només 3D: sense forats${p.notes[0] ? ` (${p.notes[0].replace(/ S'importa només.*$/, "").replace(/\.$/, "")})` : ""}`
  }
}

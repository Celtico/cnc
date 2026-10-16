import type { Range } from "./appliance"
import { applianceDefaults, isFloorNiche } from "./applianceCarcass"
import { moduleElevation } from "./composition"
import { setModuleMount } from "./editOps"
import { isAppliance } from "./hardwareLibrary"
import { moduleApplianceCarcass } from "./moduleVisible"
import type { HardwareItem } from "./hardwareSchema"
import type { Module } from "./moduleSchema"
import type { Composition } from "./compositionSchema"

/**
 * El **tipus** del mòdul (per decisió de l'usuari, 2026-10-15: «canviem Posició per tipus de moble, i allà seleccionem
 * electrodomèstic, i a dins la Caixa les opcions de l'electrodomèstic»): Baix · Penjat · Columna · Electrodomèstic. És el
 * primer que es tria del mòdul: decideix on va (a terra o penjat), les mides per defecte i, l'electrodomèstic, la caixa que
 * demana l'aparell (`applianceCarcass`). Pur.
 */
type ModuleType = "base" | "wall" | "tall" | "appliance"

/** Alçada a partir de la qual un mòdul de terra sense tipus és una columna. */
const TALL_FROM = 1200

/** Alçades per defecte en canviar de Baix a Columna o al revés (si l'alçada que té no hi escau). */
const DEFAULT_HEIGHT = { base: 770, tall: 2100 }

/**
 * El tipus d'un mòdul: Electrodomèstic si ho és (o s'ha triat i encara no té l'aparell), Penjat si penja de la paret, i
 * Baix o Columna (el triat o, sense, per l'alçada).
 */
export function moduleType(m: Module): ModuleType {
  if (m.type === "appliance" || moduleAppliance(m)) return "appliance"
  if (m.carcass.base.kind === "wall") return "wall"
  if (m.type === "tall") return "tall"
  if (m.type === "base") return "base"
  return m.carcass.height >= TALL_FROM ? "tall" : "base"
}

/**
 * L'electrodomèstic del mòdul sense dividir (el de l'arrel): el que **és** el mòdul (rentaplats, frigorífic, forn…) o el que
 * hi va sense ser-ne (la placa del baix, la campana del penjat: l'Interior conserva el seu contingut).
 */
const moduleAppliance = (m: Module) => (m.root.split ? undefined : m.root.appliance)

const withType = (m: Module, type: Module["type"]): Module => {
  const { type: _t, ...rest } = m
  return type ? { ...rest, type } : rest
}

/** Treu l'aparell del mòdul (el de l'arrel d'un mòdul sense dividir). */
function withoutModuleAppliance(m: Module): Module {
  if (!moduleAppliance(m)) return m
  const { appliance: _a, ...root } = m.root
  return { ...m, root }
}

/**
 * Canvia el tipus d'un mòdul. Penjat: a la paret (`setModuleMount`); de Penjat a un altre, arrambat a la paret. Baix i
 * Columna posen l'alçada per defecte si la que té no hi escau. Deixar de ser Electrodomèstic treu l'aparell; passar-hi
 * només el marca (l'aparell es tria a sota, `setModuleAppliance`). `here`: la X d'ara (per si passa a lliure al terra).
 */
export function setModuleType(m: Module, type: ModuleType, here: number): Module {
  const cur = moduleType(m)
  if (cur === type) return m
  let out = cur === "appliance" ? withoutModuleAppliance(m) : m
  if (type === "wall") return withType(setModuleMount(out, "hung", here), undefined)
  if (out.carcass.base.kind === "wall") out = setModuleMount(out, "wall", here)
  if (type === "appliance") return withType(out, "appliance")
  const h = out.carcass.height
  const height = type === "tall" ? (h < TALL_FROM ? DEFAULT_HEIGHT.tall : h) : h >= TALL_FROM ? DEFAULT_HEIGHT.base : h
  return withType({ ...out, carcass: { ...out.carcass, height } }, type)
}

/**
 * El Tipus de l'inspector (per decisió de l'usuari, 2026-10-16: «primer Tipus, on només es pot triar si és moble o
 * electrodomèstic»; on va, a Posició): Moble treu l'aparell i deixa el mòdul on és (Baix o Columna per l'alçada, Penjat si
 * penja); Electrodomèstic el marca (l'aparell es tria a sota).
 */
export function setModuleKind(m: Module, kind: "moble" | "appliance", here: number): Module {
  if (kind === "appliance") return setModuleType(m, "appliance", here)
  if (moduleType(m) !== "appliance") return m
  return withType(withoutModuleAppliance(m), undefined)
}

/**
 * Tria l'aparell del mòdul Electrodomèstic (o el treu, `undefined`: continua sent Electrodomèstic, sense aparell): qualsevol
 * de la biblioteca (per decisió de l'usuari, 2026-10-15: «quan és baix o penjat no poden sortir electrodomèstics»; la placa
 * i la campana també es trien aquí). El
 * nínxol de terra es queda sense laterals (`applianceDefaults`) i arriba de terra fins on arribava el mòdul; un aparell
 * penjat (microones) penja el mòdul i un de terra el baixa; l'amplada, la del nínxol si la que té no hi entra.
 */
export function setModuleAppliance(m: Module, item: HardwareItem | undefined, here: number): Module {
  // On arriba ara el mòdul (de terra a dalt): un nínxol de terra ja va directe a terra (les potes del suport no compten).
  const top = (moduleApplianceCarcass(m)?.rule.support === false ? 0 : moduleElevation(m.carcass)) + m.carcass.height
  const base = withType(withoutModuleAppliance(m), "appliance")
  if (!item || !isAppliance(item)) return base
  const a = item.appliance
  let out: Module = { ...base, root: { ...base.root, appliance: { hardware: item } } }
  const hung = out.carcass.base.kind === "wall"
  if (a.mount === "wall" && !hung) out = setModuleMount(out, "hung", here)
  if (a.mount !== "wall" && hung) out = setModuleMount(out, "wall", here)
  const fit = (v: number, r: Range | undefined) => (r?.min !== undefined && v < r.min ? r.min : r?.max !== undefined && v > r.max ? r.max : v)
  const width = fit(out.carcass.width, a.niche?.w)
  // El nínxol de terra (rentaplats, rentadora, frigorífic sota taulell) va de terra fins a sota el taulell: l'alçada, la
  // de dalt del mòdul d'ara (el suport més la caixa: un buc de 720 sobre potes de 100 fa 820), enrasat amb els del costat.
  // Si l'aparell en demana una altra (un XXL de 865), ho diu l'avís del nínxol: no s'aixeca per sobre del taulell.
  const height = isFloorNiche(a) && out.carcass.base.kind !== "wall" ? top : out.carcass.height
  return withType({ ...out, carcass: applianceDefaults(a, { ...out.carcass, width, height }) }, "appliance")
}

/**
 * Un mòdul nou amb els materials del moble (per decisió de l'usuari, 2026-10-16: «el color no entra bé»): el cos, el
 * gruix, els fronts, el fons i el fons dels calaixos del darrer mòdul de terra (o del darrer, si no n'hi ha), no els per
 * defecte de Preferències. Sense cap mòdul, tal qual.
 */
export function withMobleMaterials(m: Module, modules: readonly Module[]): Module {
  const from = [...modules].reverse().find((x) => x.carcass.base.kind !== "wall") ?? modules[modules.length - 1]
  if (!from) return m
  const f = from.carcass
  const carcass = { ...m.carcass, material: f.material, thickness: f.thickness, backMaterial: f.backMaterial, backThickness: f.backThickness }
  if (f.frontMaterial) carcass.frontMaterial = f.frontMaterial
  else delete carcass.frontMaterial
  if (f.drawerBottomMaterial) carcass.drawerBottomMaterial = f.drawerBottomMaterial
  else delete carcass.drawerBottomMaterial
  return { ...m, carcass }
}

/** El cos del moble: el material i el gruix més repetits dels seus mòduls (el «Com el moble» del mòdul). */
export function mobleBody(comp: Pick<Composition, "modules">): { material: string; thickness: number } | undefined {
  const count = new Map<string, { n: number; material: string; thickness: number }>()
  for (const m of comp.modules) {
    const k = `${m.carcass.material}|${m.carcass.thickness}`
    const c = count.get(k)
    count.set(k, { n: (c?.n ?? 0) + 1, material: m.carcass.material, thickness: m.carcass.thickness })
  }
  const top = [...count.values()].sort((a, b) => b.n - a.n)[0]
  return top && { material: top.material, thickness: top.thickness }
}

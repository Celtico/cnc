import { applianceDefaults } from "./applianceCarcass"
import { setModuleMount } from "./editOps"
import { isAppliance } from "./hardwareLibrary"
import type { HardwareItem } from "./hardwareSchema"
import type { Module } from "./moduleSchema"

/**
 * El **tipus** del mòdul (per decisió de l'usuari, 2026-10-15: «canviem Posició per tipus de moble, i allà seleccionem
 * electrodomèstic, i a dins la Caixa les opcions de l'electrodomèstic»): Baix · Penjat · Columna · Electrodomèstic. És el
 * primer que es tria del mòdul: decideix on va (a terra o penjat), les mides per defecte i, l'electrodomèstic, la caixa que
 * demana l'aparell (`applianceCarcass`). Pur.
 */
export type ModuleType = "base" | "wall" | "tall" | "appliance"

export const MODULE_TYPE_LABELS: Record<ModuleType, string> = { base: "Baix", wall: "Penjat", tall: "Columna", appliance: "Electrodomèstic" }

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
 * Tria l'aparell del mòdul Electrodomèstic (o el treu, `undefined`: continua sent Electrodomèstic, sense aparell): qualsevol
 * de la biblioteca (per decisió de l'usuari, 2026-10-15: «quan és baix o penjat no poden sortir electrodomèstics»; la placa
 * i la campana també es trien aquí). El
 * nínxol de terra es queda sense laterals (`applianceDefaults`); un aparell penjat (microones) penja el mòdul i un de terra
 * el baixa; l'amplada, la del nínxol si la que té no hi entra.
 */
export function setModuleAppliance(m: Module, item: HardwareItem | undefined, here: number): Module {
  const base = withType(withoutModuleAppliance(m), "appliance")
  if (!item || !isAppliance(item)) return base
  const a = item.appliance
  let out: Module = { ...base, root: { ...base.root, appliance: { hardware: item } } }
  const hung = out.carcass.base.kind === "wall"
  if (a.mount === "wall" && !hung) out = setModuleMount(out, "hung", here)
  if (a.mount !== "wall" && hung) out = setModuleMount(out, "wall", here)
  const w = a.niche?.w
  const width = w && ((w.min !== undefined && out.carcass.width < w.min) || (w.max !== undefined && out.carcass.width > w.max)) ? (w.min ?? w.max!) : out.carcass.width
  return withType({ ...out, carcass: applianceDefaults(a, { ...out.carcass, width }) }, "appliance")
}

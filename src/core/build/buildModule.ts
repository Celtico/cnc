import { type Module, visibleModule } from "../model"
import { normalizePanel } from "./buildCabinet"
import type { ModuleBuild, RearLimit } from "./module/types"
import { Builder } from "./module/zones"
export type { BuildWarning, FixPlaceKey, KitOrder, ModuleBuild, Wiring } from "./module/types"
export { drawerBottomMaterial, frontMaterialOf, shapeOutline } from "./module/helpers"

/** Construeix totes les peces d'un mòdul en coordenades del mòdul (base a Y = 0). */
export function buildModule(input: Module, opts: { rearLimits?: RearLimit[]; /** Sense el recorregut dels cables dels llums (el muntatge de Preferències ensenya només el ferratge). */ wiring?: boolean; /** Trams de x (del mòdul) on hi ha una columna que travessa la base: ni l'alimentador ni potes al costat. */ keepOut?: [number, number][]; /** El sòcol per defecte dels electrodomèstics de terra: l'alçada de les potes del moble (`Composition.support`). */ appliancePlinth?: number } = {}): ModuleBuild {
  // Res amagat compta: només el que es veu a l'inspector (els camps de les opcions apagades no hi entren).
  const b = new Builder(visibleModule(input))
  b.rearLimits = opts.rearLimits ?? []
  b.keepOut = opts.keepOut ?? []
  if (opts.appliancePlinth !== undefined) b.appliancePlinth = opts.appliancePlinth

  b.buildCarcass()
  const layout = b.buildZones()
  b.buildHangers()
  b.buildLegs()
  b.buildUnderLight()
  if (opts.wiring !== false) b.buildWiring()
  const panels = b.panels.map((p) => normalizePanel(p.cutouts && p.cutouts.length === 0 ? { ...p, cutouts: undefined } : p))
  return { panels, extras: b.extras, hardwareKits: b.hardwareKits, lightKits: b.lightKits, fittingOrders: b.fittingOrders, ventInlets: b.ventInlets, linear: b.linear, ...(b.wiring ? { wiring: b.wiring } : {}), warnings: b.warnings, layout, openRatios: b.openRatios, drawerHeights: b.drawerHeights }
}

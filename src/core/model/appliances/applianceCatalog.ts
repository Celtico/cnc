import { KIT_PILOT_PARAMS } from "../hardwareKit"
import type { HardwareItem, HardwareTarget } from "../hardwareSchema"
import { APPLIANCE_ROWS, type ApplianceRow } from "./applianceRows"

/**
 * Els electrodomèstics com a **ferratges** de la biblioteca (v46, categoria «Electrodomèstics», motor `appliance`): un
 * item per model, amb les dades del catàleg (`HardwareItem.appliance`) i el que l'app mecanitza al front de moble, **com
 * es fa de manera estàndard** (per decisió de l'usuari, 2026-10-15; fonts a `docs/electrodomestic/README.md` › Decisions):
 * - **porta fixa, porta sobre porta i rentaplats de porta lliscant** (el front es cargola a la porta de l'aparell): els
 *   cargols van on diu la **plantilla de paper que porta l'aparell** (BSH, Teka: no es publica). Per defecte **cap
 *   prebroca** (`pilotHoles` 0: es foraden amb la plantilla); amb `pilotHoles` 1, 4 prebroques per front a `fixInset` dels
 *   costats de l'aparell, `fixTop` de dalt i `fixBottom` de baix (Ø i fondària de la prebroca dels jocs, 2 × 10);
 * - **frigorífic de porta lliscant**: les frontisses de moble (les del mòdul, tantes com demana l'alçada del front) i la
 *   guia lliscant, que també es cargola amb la plantilla de l'aparell (prebroques només amb `pilotHoles` 1: 3 a
 *   `guidePitch`, a `guideEdge` del cantell que obre);
 * - **rentadora**: les cassoletes de les frontisses de l'aparell, les de la fitxa del fabricant (Ø × fondària, a
 *   `cupOffset` del cantell del panell frontal de l'aparell de `panelWidth`, la primera a `firstHinge` del cantell de dalt
 *   de l'aparell i la segona a `hingePitch` més avall).
 * Els paràmetres s'editen com els de tots els ferratges (Preferències › Ferratges); les dades del catàleg, no.
 */

const pilotOp = { kind: "drill" as const, face: "A" as const, u: 0, v: 0, d: "pilotDiameter", depth: "pilotDepth", tag: "appliance" }

const FIX_PARAMS = { ...KIT_PILOT_PARAMS, pilotHoles: 0, fixInset: 50, fixTop: 40, fixBottom: 60 }
const GUIDE_PARAMS = { ...KIT_PILOT_PARAMS, pilotHoles: 0, guideEdge: 40, guidePitch: 32 }

function machining(row: ApplianceRow): { params: Record<string, number>; targets: HardwareTarget[] } {
  const a = row.appliance
  if (a.door === "hinges" && row.hinges) {
    const h = row.hinges
    return {
      params: { cupDiameter: h.d, cupDepth: h.depth, cupOffset: h.edge, firstHinge: h.first, hingePitch: h.pitch ?? 338.6, ...(h.panel ? { panelWidth: h.panel } : {}) },
      targets: [{ key: "front", label: "Darrere del front (cassoletes de les frontisses de l'aparell)", ops: [{ kind: "drill", face: "A", u: 0, v: "cupOffset", d: "cupDiameter", depth: "cupDepth", tag: "hinge" }] }],
    }
  }
  if (a.kind === "fridge" && a.door === "sliding")
    return { params: { ...GUIDE_PARAMS }, targets: [{ key: "front", label: "Darrere del front (guia lliscant: amb la plantilla de l'aparell; prebroques opcionals)", ops: [pilotOp] }] }
  if (a.door) return { params: { ...FIX_PARAMS }, targets: [{ key: "front", label: "Darrere del front (fixació a la porta de l'aparell: amb la plantilla de l'aparell; prebroques opcionals)", ops: [pilotOp] }] }
  return { params: {}, targets: [{ key: "niche", label: "Nínxol (cap mecanitzat al front: es comprova la mida)", ops: [] }] }
}

const slug = (s: string) => s.toLowerCase().replace(/[^a-z0-9]+/g, "")

/** Un model del catàleg com a item de la biblioteca. */
function applianceItem(row: ApplianceRow): HardwareItem {
  const { params, targets } = machining(row)
  return {
    id: `appliance-${slug(row.maker)}-${slug(row.ref)}`,
    name: `${row.maker} ${row.ref} · ${row.name}`,
    category: "appliance",
    engine: "appliance",
    maker: row.maker,
    ref: row.ref,
    tags: [row.appliance.family],
    params,
    targets,
    appliance: structuredClone(row.appliance),
    material: "Acer inox",
    version: 2,
    builtin: true,
  }
}

/** Tots els electrodomèstics del catàleg (v46, additiu). */
export const APPLIANCE_ITEMS: HardwareItem[] = APPLIANCE_ROWS.map(applianceItem)

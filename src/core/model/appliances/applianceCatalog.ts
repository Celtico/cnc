import { KIT_PILOT_PARAMS } from "../hardwareKit"
import type { HardwareItem, HardwareTarget } from "../hardwareSchema"
import { APPLIANCE_ROWS, type ApplianceRow } from "./applianceRows"

/**
 * Els electrodomèstics com a **ferratges** de la biblioteca (v46, categoria «Electrodomèstics», motor `appliance`): un
 * item per model, amb les dades del catàleg (`HardwareItem.appliance`) i el que l'app mecanitza al front de moble:
 * - **porta fixa, porta sobre porta i rentaplats de porta lliscant** (el front es cargola a la porta de l'aparell): les
 *   prebroques dels cargols al darrere del front, 4 per front. **Hipòtesi** (el catàleg no dona la plantilla, pregunta
 *   oberta 1 de `docs/electrodomestic/README.md`): a `fixInset` dels costats de l'aparell (centrat al front), a `fixTop`
 *   del cantell de dalt del front i a `fixBottom` del de baix; Ø i fondària de la prebroca dels jocs (2 × 10). Cada front
 *   avisa que s'ha de comprovar amb la plantilla de l'aparell;
 * - **frigorífic de porta lliscant**: les frontisses de moble (les del mòdul) i, al darrere del front, la guia lliscant:
 *   **hipòtesi** (pregunta oberta 2), una guia per front a `guideEdge` del cantell que obre, centrada, amb 3 prebroques a
 *   `guidePitch`;
 * - **rentadora**: les cassoletes de les frontisses de l'aparell, les del catàleg (Ø35 × 12 a 21 del cantell; la primera a
 *   202 del cantell de dalt de l'aparell, la segona a +338,6).
 * Els paràmetres s'editen com els de tots els ferratges (Preferències › Ferratges); les dades del catàleg, no.
 */

const pilotOp = { kind: "drill" as const, face: "A" as const, u: 0, v: 0, d: "pilotDiameter", depth: "pilotDepth", tag: "appliance" }

const FIX_PARAMS = { ...KIT_PILOT_PARAMS, fixInset: 50, fixTop: 40, fixBottom: 60 }
const GUIDE_PARAMS = { ...KIT_PILOT_PARAMS, guideEdge: 40, guidePitch: 32 }

function machining(row: ApplianceRow): { params: Record<string, number>; targets: HardwareTarget[] } {
  const a = row.appliance
  if (a.door === "hinges" && row.hinges) {
    const h = row.hinges
    return {
      params: { cupDiameter: h.d, cupDepth: h.depth, cupOffset: h.edge, firstHinge: h.first, hingePitch: h.pitch ?? 338.6 },
      targets: [{ key: "front", label: "Darrere del front (cassoletes de les frontisses de l'aparell)", ops: [{ kind: "drill", face: "A", u: 0, v: "cupOffset", d: "cupDiameter", depth: "cupDepth", tag: "hinge" }] }],
    }
  }
  if (a.kind === "fridge" && a.door === "sliding")
    return { params: { ...GUIDE_PARAMS }, targets: [{ key: "front", label: "Darrere del front (guia lliscant: hipòtesi, comprova-la amb la plantilla de l'aparell)", ops: [pilotOp] }] }
  if (a.door) return { params: { ...FIX_PARAMS }, targets: [{ key: "front", label: "Darrere del front (fixació a la porta de l'aparell: hipòtesi, comprova-la amb la plantilla)", ops: [pilotOp] }] }
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
    version: 1,
    builtin: true,
  }
}

/** Tots els electrodomèstics del catàleg (v46, additiu). */
export const APPLIANCE_ITEMS: HardwareItem[] = APPLIANCE_ROWS.map(applianceItem)

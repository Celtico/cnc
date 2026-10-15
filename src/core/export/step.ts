import type { Panel } from "../model"
import { outlineSolid } from "./step/outlineSolid"
import { panelSolid } from "./step/panelSolid"
import { tallerFrame } from "./step/tallerFrame"
import { identityAxis, product, SolidWriter, stepContext, stepReal, stepString, stepText, type StepContext } from "./step/writer"
import { workshopName } from "./text"

// Les peces (vectors, mecanitzats, sòlids, escriptor) són a `./step/`: aquí, l'API de sempre.
export { tallerEdgeNumbers } from "./step/tallerFrame"
export { stepReal, stepString } from "./step/writer"

/**
 * Escriptor STEP AP214 (text, sense motor CAD) amb el format que llegeixen els parsers
 * de `taller-cnc-nest` (`step-solids.ts`, `step-names.ts`):
 *
 *  - Eixos del taller: X = amplada, Y = fondària, Z = amunt. El nostre model és Y-amunt
 *    (Z = 0 al darrere): es converteix amb (x, y, z) → (x, −z, y), que és una rotació.
 *  - Un `MANIFOLD_SOLID_BREP` per peça dins d'un
 *    `ADVANCED_BREP_SHAPE_REPRESENTATION('<nom de peça>', ...)`, d'on el taller llegeix
 *    el nom, i un `PRODUCT` per peça perquè FreeCAD hi vegi l'arbre.
 *  - Forats cecs de cara i de cantell: bucle circular a la cara d'entrada, dues
 *    semicares cilíndriques i un fons pla. El taller en treu `mach` i `edges`.
 *  - Ranures: cara plana al fons (el taller la llegeix com a `pocket`), parets i, si
 *    la ranura arriba al cantell, osca a la cara lateral.
 *  - Talls passants (passacables, ranures de reixeta, trapa): geometria real, que el
 *    taller descarta a propòsit (només surten al DXF).
 *
 * Topologia: vèrtexs i arestes compartides entre cares (cada aresta la fan servir
 * exactament dues cares en sentit oposat), de manera que el `CLOSED_SHELL` és tancat.
 */

interface StepOptions {
  /** Nom del moble (FILE_NAME i PRODUCT arrel). */
  name: string
  /** Data ISO per a la capçalera. Per defecte, ara. */
  date?: string
}

interface StepResult {
  text: string
  /** Mecanitzats que no s'han pogut modelar (se solapen amb un altre o surten de la peça). */
  warnings: string[]
  solids: number
}

/** Sòlid B-rep d'una peça (coordenades del moble muntat, marc del taller). */
function writeBrep(c: StepContext, p: Panel, cad: boolean): { brep: number; warnings: string[] } {
  const sw = new SolidWriter(c.w, tallerFrame(p))
  const solid = p.outline ? outlineSolid(p, cad) : panelSolid(p, cad)
  const faceIds = solid.faces.map((f) => sw.face(f))
  const shell = c.w.add(`CLOSED_SHELL('',(${faceIds.map((f) => `#${f}`).join(",")}))`)
  const brep = c.w.add(`MANIFOLD_SOLID_BREP('${stepString(workshopName(p.name))}',#${shell})`)
  return { brep, warnings: solid.warnings }
}

/** Genera el STEP de totes les peces (coordenades del moble muntat, marc del taller). */
export function toStep(panels: Panel[], options: StepOptions): StepResult {
  const c = stepContext()
  const { w, ctx } = c
  const warnings: string[] = []
  const date = options.date ?? new Date().toISOString().slice(0, 19)
  const products: number[] = []

  panels.forEach((p, i) => {
    // El taller llegeix el nom d'aquí, en text pla: el mateix que la columna Nombre_pieza del CSV.
    const name = stepString(workshopName(p.name))
    const { brep, warnings: ws } = writeBrep(c, p, false)
    warnings.push(...ws)
    const axis = identityAxis(w)
    const rep = w.add(`ADVANCED_BREP_SHAPE_REPRESENTATION('${name}',(#${brep},#${axis}),#${ctx})`)
    const pr = product(c, p.name, p.name, `${p.id} (${i + 1})`)
    products.push(pr.product)
    w.add(`SHAPE_DEFINITION_REPRESENTATION(#${pr.pds},#${rep})`)
  })
  if (products.length) w.add(`PRODUCT_RELATED_PRODUCT_CATEGORY('part','',(${products.map((p) => `#${p}`).join(",")}))`)
  return { text: stepText(c, options.name, date), warnings, solids: panels.length }
}

export interface StepCadGroup {
  /** Nom del conjunt (mòdul, peces lliures…). */
  name: string
  panels: Panel[]
}

interface StepCadOptions extends StepOptions {
  /** Color RGB (0–1) de cada peça: el del seu material. */
  color?: (p: Panel) => [number, number, number]
}

/**
 * STEP per obrir el moble a TopSolid (o qualsevol CAD) i continuar-lo treballant: un conjunt
 * (el moble) amb un subconjunt per mòdul i una peça per tauler, amb el nom i el material, el
 * color del material, els ingletes de debò i els booleans 3D. Les peces van ja col·locades
 * (transformacions identitat), en mm, amb Z amunt com el STEP del taller.
 */
export function toStepCad(groups: StepCadGroup[], options: StepCadOptions): StepResult {
  const c = stepContext()
  const { w, ctx } = c
  const warnings: string[] = []
  const date = options.date ?? new Date().toISOString().slice(0, 19)
  const styled: number[] = []
  const colours = new Map<string, number>()
  const colourStyle = (rgb: [number, number, number]): number => {
    const key = rgb.map((v) => v.toFixed(3)).join(",")
    const hit = colours.get(key)
    if (hit) return hit
    const col = w.add(`COLOUR_RGB('',${rgb.map(stepReal).join(",")})`)
    const fasc = w.add(`FILL_AREA_STYLE_COLOUR('',#${col})`)
    const fas = w.add(`FILL_AREA_STYLE('',(#${fasc}))`)
    const ssfa = w.add(`SURFACE_STYLE_FILL_AREA(#${fas})`)
    const sss = w.add(`SURFACE_SIDE_STYLE('',(#${ssfa}))`)
    const ssu = w.add(`SURFACE_STYLE_USAGE(.BOTH.,#${sss})`)
    const psa = w.add(`PRESENTATION_STYLE_ASSIGNMENT((#${ssu}))`)
    colours.set(key, psa)
    return psa
  }

  // Arrel: el moble.
  const root = product(c, options.name, options.name, "Moble")
  const rootAxis = identityAxis(w)
  const rootRep = w.add(`SHAPE_REPRESENTATION('${stepString(options.name)}',(#${rootAxis}),#${ctx})`)
  w.add(`SHAPE_DEFINITION_REPRESENTATION(#${root.pds},#${rootRep})`)
  const assemblies = [root.product]
  const parts: number[] = []
  let solids = 0
  let occ = 0

  /** Posa `child` dins de `parent` (transformació identitat entre els seus eixos). */
  const place = (parentPd: number, parentRep: number, parentAxis: number, childPd: number, childRep: number, childAxis: number, name: string) => {
    occ += 1
    const nauo = w.add(`NEXT_ASSEMBLY_USAGE_OCCURRENCE('${occ}','${stepString(name)}','',#${parentPd},#${childPd},$)`)
    const pds = w.add(`PRODUCT_DEFINITION_SHAPE('','',#${nauo})`)
    const idt = w.add(`ITEM_DEFINED_TRANSFORMATION('','',#${parentAxis},#${childAxis})`)
    const rel = w.add(`(REPRESENTATION_RELATIONSHIP('','',#${childRep},#${parentRep})REPRESENTATION_RELATIONSHIP_WITH_TRANSFORMATION(#${idt})SHAPE_REPRESENTATION_RELATIONSHIP())`)
    w.add(`CONTEXT_DEPENDENT_SHAPE_REPRESENTATION(#${rel},#${pds})`)
  }

  for (const g of groups) {
    if (!g.panels.length) continue
    const sub = product(c, g.name, g.name, "Conjunt")
    assemblies.push(sub.product)
    const subAxis = identityAxis(w)
    const subRep = w.add(`SHAPE_REPRESENTATION('${stepString(g.name)}',(#${subAxis}),#${ctx})`)
    w.add(`SHAPE_DEFINITION_REPRESENTATION(#${sub.pds},#${subRep})`)
    place(root.pd, rootRep, rootAxis, sub.pd, subRep, subAxis, g.name)
    for (const p of g.panels) {
      const { brep, warnings: ws } = writeBrep(c, p, true)
      warnings.push(...ws)
      solids += 1
      const axis = identityAxis(w)
      // El taller llegeix el nom de la representació (sense descodificar \X2\): el de taller en
      // ASCII, igual que al CSV. El PRODUCT porta el nom llegible per a l'arbre del CAD.
      const label = p.label || p.name
      const rep = w.add(`ADVANCED_BREP_SHAPE_REPRESENTATION('${stepString(workshopName(p.name))}',(#${brep},#${axis}),#${ctx})`)
      const pr = product(c, label, label, `${p.material} · ${p.length} × ${p.width} × ${p.thickness} mm`)
      parts.push(pr.product)
      w.add(`SHAPE_DEFINITION_REPRESENTATION(#${pr.pds},#${rep})`)
      place(sub.pd, subRep, subAxis, pr.pd, rep, axis, label)
      if (options.color) styled.push(w.add(`STYLED_ITEM('color',(#${colourStyle(options.color(p))}),#${brep})`))
    }
  }
  if (styled.length) w.add(`MECHANICAL_DESIGN_GEOMETRIC_PRESENTATION_REPRESENTATION('',(${styled.map((s) => `#${s}`).join(",")}),#${ctx})`)
  w.add(`PRODUCT_RELATED_PRODUCT_CATEGORY('assembly','',(${assemblies.map((a) => `#${a}`).join(",")}))`)
  if (parts.length) w.add(`PRODUCT_RELATED_PRODUCT_CATEGORY('part','',(${parts.map((p) => `#${p}`).join(",")}))`)
  return { text: stepText(c, options.name, date), warnings, solids }
}

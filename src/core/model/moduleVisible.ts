import { DEFAULT_CABINET } from "./cabinet"
import { isAppliance, isLegacyHardware, type ModuleHardware } from "./hardware"
import { doorLikeFront, fillsNiche, standsOnFloor, takesFront, type Appliance } from "./appliance"
import { canHoldFront, canHoldShelves, carcassBounds, childBounds, hasBottom, type ZoneBounds } from "./zoneSupport"
import { applianceCarcass, applyApplianceCarcass, type ApplianceCarcass } from "./applianceCarcass"
import { DEFAULT_GRILLE, type Carcass, type Module, type Zone, type ZoneAppliance } from "./moduleSchema"

// --- «Res amagat compta» -------------------------------------------------------------

/**
 * Cantonades (Normals / A inglet) es poden triar: hi ha algun lateral, les parets no són buides (amb parets buides
 * són sempre a inglet) i hi ha una tapa o una base a baix de tot dels laterals per unir-hi (amb sòcol la base queda
 * entre els laterals). És la mateixa condició que fa sortir el control a l'inspector: si no surt, `joint` no compta.
 */
export function jointApplies(c: Pick<Carcass, "sides" | "hollow" | "top" | "base" | "noBottom">): boolean {
  if (!(c.sides.left || c.sides.right) || c.hollow) return false
  return c.top.kind !== "none" || (hasBottom(c) && c.base.kind !== "plinth")
}

/**
 * El mòdul tal com el veu l'usuari: cada camp que la UI amaga perquè la seva opció és apagada es posa a un valor fix
 * (o es treu). Els camps amagats es **conserven** a la composició (tornar a encendre l'opció recupera els valors
 * d'abans), però `buildModule` construeix sempre a partir d'aquest mòdul: dos mòduls que es veuen iguals a l'inspector
 * fan les mateixes peces i els mateixos avisos, vingui d'on vingui l'estat (regla «res amagat compta»,
 * `build/hiddenState.test.ts`). Si una opció nova amaga camps, s'han d'afegir aquí.
 */
/**
 * Si surt la guia de cada calaix (`Front.drawerSlides`, per decisió de l'usuari, 2026-10-14): amb un joc de calaix, més
 * d'un calaix i alguna alçada a mida; amb totes les alçades «Auto», una sola guia per a tots.
 */
export function perDrawerSlides(front: { n: number; heights: readonly (number | "auto")[] }, slide: { engine: string } | undefined): boolean {
  return !!slide && slide.engine === "drawerKit" && front.n > 1 && front.heights.slice(0, front.n - 1).some((h) => h !== "auto")
}

export function visibleModule(m: Module): Module {
  // L'electrodomèstic que és el mòdul fixa parts de la caixa (`applianceCarcass`); les de l'usuari es conserven.
  const rule = moduleApplianceCarcass(m)
  const c = rule ? applyApplianceCarcass(m.carcass, rule.rule) : m.carcass
  const carcass: Carcass = { ...c }
  // Base: «Sense base» és `noBottom` (el `open` d'abans, la mateixa caixa, passa a aquesta forma); amb potes no compta.
  if (c.base.kind === "open") {
    carcass.base = { kind: "none" }
    carcass.noBottom = true
  } else if (!hasBottom(c)) carcass.noBottom = true
  else delete carcass.noBottom
  // Fons: sense fons, ni material ni gruix (els fons dels calaixos agafen el del cos); la ranura (posició i joc) només
  // compta en ranura i la retirada només encastat.
  if (c.back === "none") {
    carcass.backMaterial = c.material
    carcass.backThickness = c.thickness
  }
  if (c.back !== "groove") {
    carcass.backSetback = DEFAULT_CABINET.backSetback
    carcass.backClearance = DEFAULT_CABINET.backClearance
  }
  // Joc de la ranura: només en ranura; 0 és l'absència.
  if (c.back !== "groove" || !c.grooveClearance) delete carcass.grooveClearance
  if (c.back !== "inset") delete carcass.backInsetSetback
  // La llum a sota només amb la base a l'aire (penjat o amb potes) i si hi ha base (va a la seva cara de sota).
  if ((c.base.kind !== "wall" && c.base.kind !== "legs") || !hasBottom(c)) delete carcass.underLight
  // Cantonades: només si el control surt (`jointApplies`); «Normals» és l'absència.
  if (c.joint !== "mitre" || !jointApplies(carcass)) delete carcass.joint
  // Tauler de taula: només amb la tapa sencera.
  if (c.top.kind !== "full") delete carcass.tableTop
  const root = visibleZone(m.root, kitDefaultOf(m), false, carcassBounds(carcass), false, true)
  // Fons del calaix: només amb calaixos que es fan (la fila de Materials no surt sense).
  if (!hasDrawers(root) || !c.drawerBottomMaterial) delete carcass.drawerBottomMaterial
  // Folgança de les peces de dins: només amb l'arrel dividida (la fila no surt sense); 0 és l'absència.
  if (!carcass.innerClearance || !hasInnerPieces(root)) delete carcass.innerClearance
  const fronts = { ...m.fronts }
  // L'estil (recobrents / encastats) només compta si hi ha algun front que es construeix (la fila «Estil» no surt sense).
  // El front de moble del nínxol de terra va per davant, com els del costat (`ApplianceCarcass.niche`).
  if (fronts.style === "overlay" || !hasBuiltFronts(root) || rule?.rule.niche) delete fronts.style
  if (fronts.handles === "bar") delete fronts.handles
  return { ...m, carcass, fronts, root }
}

/** La guia del mòdul pot ser un joc de calaix (`drawerKit`): els calaixos sense guia pròpia hi llegeixen les opcions. */
function kitDefaultOf(m: Module): boolean {
  const hw = m.hardware as Partial<ModuleHardware> | undefined
  return !isLegacyHardware(hw) && hw?.slide?.engine === "drawerKit"
}

/**
 * El mòdul (tal com es construeix: passa-li `visibleModule(m).root`, o fa servir `moduleHasInnerPieces`) té alguna peça
 * que porta la folgança de les peces de dins (per decisió de l'usuari: «no ha de comptar el nivell de divisió, ja sigui
 * horitzontal o vertical»): l'arrel és dividida, i llavors tots els divisors (també els de l'arrel) i els prestatges
 * fixos dels compartiments la porten. Un mòdul sense dividir no en té (els seus prestatges fixos van sencers).
 */
export function hasInnerPieces(root: Zone): boolean {
  return !!root.split && root.split.children.length > 1
}

/** `hasInnerPieces` del mòdul tal com es construeix (`visibleModule`): la fila «Peces de dins» de l'Interior. */
export const moduleHasInnerPieces = (m: Module): boolean => hasInnerPieces(visibleZone(m.root, kitDefaultOf(m), false, carcassBounds(m.carcass), false, true))

/**
 * Plantilla instanciada a partir d'ara (catàleg, col·leccions, escenes): els mòduls que no diuen res de la folgança de
 * les peces de dins prenen la de Preferències (com un mòdul nou, `applySettingsToModule`). Els que ja en diuen alguna
 * cosa no es toquen. El mateix amb el joc de l'ample de la ranura del fons (`grooveClearance`, si se'n dona un).
 */
export function withInnerClearance<T extends { modules: Module[] }>(comp: T, innerClearance: number, grooveClearance?: number): T {
  const groove = grooveClearance ? grooveClearance : undefined
  if (!comp.modules.some((m) => m.carcass.innerClearance === undefined || (groove !== undefined && m.carcass.grooveClearance === undefined))) return comp
  return {
    ...comp,
    modules: comp.modules.map((m) => {
      const carcass = { ...m.carcass }
      if (carcass.innerClearance === undefined) carcass.innerClearance = innerClearance
      if (groove !== undefined && carcass.grooveClearance === undefined) carcass.grooveClearance = groove
      return { ...m, carcass }
    }),
  }
}

/** El mòdul té algun compartiment de calaixos (la fila «Fons del calaix» de Materials). */
export function hasDrawers(root: Zone): boolean {
  let hit = false
  // Els calaixos d'un compartiment tapat pel front d'una zona de més amunt no es fan.
  walkBuiltZones(root, (z, { covered }) => {
    if (z.front?.kind === "drawers" && !covered) hit = true
  })
  return hit
}

/**
 * Recorre els compartiments com els construeix `buildModule`: `covered` = un compartiment de més amunt porta un front que
 * el tapa (portes d'armari de dalt a baix), i el seu propi front **no es fa** (es conserva, no compta); els prestatges,
 * la barra i la llum de dins sí. `isRoot`: l'«Interior» (l'arrel del mòdul).
 */
export function walkBuiltZones(root: Zone, fn: (z: Zone, info: { covered: boolean; isRoot: boolean }) => void): void {
  const walk = (z: Zone, covered: boolean) => {
    fn(z, { covered, isRoot: z === root })
    z.split?.children.forEach((c) => walk(c, covered || !!z.front))
  }
  walk(root, false)
}

/** La zona de més amunt el front de la qual tapa `id` (portes de tota la zona); cap si no n'hi ha. */
export function coveringZone(root: Zone, id: string): Zone | undefined {
  const find = (z: Zone, cover: Zone | undefined): Zone | undefined | null => {
    if (z.id === id) return cover
    for (const c of z.split?.children ?? []) {
      const r = find(c, cover ?? (z.front ? z : undefined))
      if (r !== null) return r
    }
    return null
  }
  return find(root, undefined) ?? undefined
}

/**
 * El mòdul té algun front que es construeix (porta, calaixos, abatible, reixeta o front fix, o el front de moble d'un
 * electrodomèstic; els tapats no compten).
 */
function hasBuiltFronts(root: Zone): boolean {
  let hit = false
  walkBuiltZones(root, (z, { covered }) => {
    if (z.front && !covered) hit = true
    if (!covered && !z.split && z.appliance && applianceFront(z.appliance)) hit = true
  })
  return hit
}

/** L'electrodomèstic que allotja un compartiment sense dividir (`Zone.appliance` amb un item del motor `appliance`). */
export function zoneAppliance(z: Zone): Appliance | undefined {
  const za = z.split ? undefined : z.appliance
  return za && isAppliance(za.hardware) ? za.hardware.appliance : undefined
}

/** L'electrodomèstic del compartiment l'ocupa sencer (el nínxol: `fillsNiche`; no la placa ni la campana). */
export function nicheAppliance(z: Zone): Appliance | undefined {
  const a = zoneAppliance(z)
  return a && fillsNiche(a) ? a : undefined
}

/**
 * Les parts de la caixa que fixa l'electrodomèstic que és el mòdul (`isApplianceModule`; `applianceCarcass`): la Caixa
 * les ensenya fixes i `visibleModule` les construeix així. Sense aparell (o amb la placa o la campana), cap.
 */
export function moduleApplianceCarcass(m: Pick<Module, "root" | "carcass">): { appliance: Appliance; rule: ApplianceCarcass } | undefined {
  const a = nicheAppliance(m.root)
  return a ? { appliance: a, rule: applianceCarcass(a, m.carcass.base.kind === "wall") } : undefined
}

/**
 * El mòdul **és** l'electrodomèstic (**un sol lloc per decisió**; per decisió de l'usuari, 2026-10-15: «els electrodomèstics
 * no haurien de sortir al mòdul principal i desaparèixer l'Interior, perquè ja és l'electrodomèstic?»): l'electrodomèstic
 * d'un mòdul **sense dividir** és el de l'arrel (`root.appliance`, sense migració) i es tria a Mòdul › Electrodomèstic; el
 * d'un compartiment d'un mòdul dividit, al compartiment. Si l'ocupa (`nicheAppliance`), l'arbre no ensenya l'«Interior».
 */
export const isApplianceModule = (m: Pick<Module, "root">): boolean => !!nicheAppliance(m.root)

/** L'electrodomèstic d'un compartiment porta front de moble (en porta i no s'ha tret). */
export const applianceFront = (a: ZoneAppliance): boolean => !!a.hardware.appliance && takesFront(a.hardware.appliance) && a.front !== false

/**
 * L'electrodomèstic tal com es veu: sense front de moble, ni el costat, ni el sòcol, ni el tirador, ni el material del
 * front (`panelMaterial`); el costat, només als
 * que obren com una porta (frigorífic, rentadora); el sòcol, només als de terra sense peça a sota del compartiment.
 */
function visibleAppliance(a: ZoneAppliance, bounds: ZoneBounds): ZoneAppliance {
  const ap = a.hardware.appliance!
  if (!takesFront(ap)) return { hardware: a.hardware }
  if (a.front === false) return { hardware: a.hardware, front: false }
  return {
    hardware: a.hardware,
    ...(doorLikeFront(ap) && a.hinge ? { hinge: a.hinge } : {}),
    ...(standsOnFloor(ap) && !bounds.bottom && a.plinth !== undefined ? { plinth: a.plinth } : {}),
    ...(a.handle ? { handle: a.handle } : {}),
    ...(a.panelMaterial ? { panelMaterial: a.panelMaterial } : {}),
  }
}

/**
 * Un compartiment tal com es veu (vegeu `visibleModule`). `kitDefault`: la guia del mòdul és un joc de calaix (els
 * calaixos sense guia pròpia el fan servir). El «Tirador» de cada front compta sempre (també «Cap (push)»): el del mòdul
 * només és el per defecte.
 */
function visibleZone(z: Zone, kitDefault: boolean, covered: boolean, bounds: ZoneBounds, fixedCover = false, isRoot = false): Zone {
  const out: Zone = { ...z }
  // Els fronts recordats dels altres tipus (`fronts`) són només per tornar-hi: no construeixen res.
  delete out.fronts
  // Tapat pel front d'una zona de més amunt (`walkBuiltZones`): el seu front no es fa (es conserva a la composició) i el
  // compartiment és com si fos obert (els prestatges, la barra i la llum de dins sí que es fan).
  if (covered) delete out.front
  // Un front d'un compartiment que no és aguantat pels quatre costats (`canHoldFront`, `zoneSupport.ts`) no es fa: el
  // compartiment és com obert (es conserva i torna amb la peça que hi falta). Tampoc no tapa els de dins.
  if (out.front && !canHoldFront(bounds, out.front.kind)) delete out.front
  // El front d'una zona dividida només es fa a l'arrel i amb portes (Mòdul › Portes; per decisió de l'usuari: l'armari
  // amb portes de dalt a baix). El front fix de tota la zona i qualsevol front d'una divisió de dins ja no es poden
  // triar: no es fan (es conserven) i no tapen els de dins (res amagat compta).
  if (out.front && z.split && !(isRoot && out.front.kind === "door")) delete out.front
  // Electrodomèstic (v46): només en un compartiment sense dividir i que no tapa cap front de més amunt (l'inspector no
  // l'ensenya en cap altre). Si ocupa el compartiment (el nínxol), ni Front ni prestatges ni accessoris (es conserven).
  if (out.appliance && (covered || z.split || !isAppliance(out.appliance.hardware))) delete out.appliance
  if (out.appliance) {
    out.appliance = visibleAppliance(out.appliance, bounds)
    if (fillsNiche(out.appliance.hardware.appliance!)) delete out.front
  }
  const childCovered = covered || !!out.front
  // Tapat per un front fix de tota la zona (`buildParentFront`; el d'una zona de més amunt que es fa, no el que no
  // s'aguanta): com el front fix propi, darrere no hi ha res a fer servir (per decisió de l'usuari). Les portes, no.
  const childFixed = fixedCover || out.front?.kind === "panel"
  if (z.split) {
    // Un compartiment dividit no té prestatges ni barra (l'inspector no els ensenya).
    delete out.shelves
    delete out.rail
    delete out.led
    const n = z.split.children.length
    const dir = z.split.dir
    out.split = {
      ...z.split,
      children: z.split.children.map((c, i) =>
        visibleZone(c, kitDefault, childCovered, childBounds(bounds, dir, i === 0, i === n - 1), childFixed),
      ),
    }
  } else if (!canHoldShelves(bounds)) {
    // Sense una peça a cada costat (laterals o divisors; `zoneBoundsMap`) no hi ha on aguantar prestatges, fileres System
    // 32, barra ni llum: no surten a l'inspector i no es fan (es conserven per quan hi hagi laterals).
    delete out.shelves
    delete out.rail
    delete out.led
  } else {
    // Sense prestatges (0): gruix i «a ras» no compten; «Regulables» sí (les fileres System 32 per posar-n'hi després),
    // i sense `shelves` és com no regulables.
    if (z.shelves && z.shelves.n <= 0) {
      if (z.shelves.adjustable) out.shelves = { n: 0, adjustable: true }
      else delete out.shelves
    } else if (z.shelves) {
      const s = { ...z.shelves }
      if (!s.flush) delete s.flush
      if (!s.thickness) delete s.thickness
      out.shelves = s
    }
    if (!z.rail) delete out.rail
    if (!z.led) delete out.led
  }
  const f = out.front
  if (f?.kind === "panel" || fixedCover) {
    // Front fix, el seu o el de tota una zona de més amunt que el tapa (per decisió de l'usuari): darrere no hi ha res a
    // fer servir; ni Prestatges ni Accessoris (es conserven i tornen si canvia el contingut o el front de més amunt).
    delete out.shelves
    delete out.rail
    delete out.led
  } else if (f?.kind === "drawers") {
    // Els calaixos ocupen el compartiment: la secció Prestatges (prestatges, barra i llum) no surt.
    delete out.shelves
    delete out.rail
    delete out.led
    const heights = f.heights.slice(0, f.n)
    while (heights.length < f.n) heights.push("auto")
    const drawers = { ...f, heights }
    // Les opcions del joc només compten amb un joc de calaix (el triat al calaix o, sense guia pròpia, el del mòdul);
    // amb la guia normal, el camp no es veu.
    const kit = f.hardware ? f.hardware.engine === "drawerKit" : kitDefault
    if (!kit || !f.kit || !Object.keys(f.kit).length) delete drawers.kit
    // La guia de cada calaix: només amb un joc, alçades a mida i dels calaixos que hi ha (el primer és la «Guia de
    // calaix»); cap = cap.
    const own = (f.drawerSlides ?? []).slice(0, f.n).map((h, i) => (i > 0 && h && h.engine === "drawerKit" ? h : null))
    if (!kit || !perDrawerSlides(f, kit ? { engine: "drawerKit" } : undefined) || !own.some((h) => h)) delete drawers.drawerSlides
    else drawers.drawerSlides = own
    out.front = drawers
  } else if (f?.kind === "door") {
    const door = { ...f }
    // Sense vidre, el marc triat no compta; de vidre: frontisses del perfil, cap cassoleta ni tirador (la frontissa i el
    // tirador triats no compten).
    // Sense vidre, el marc triat no compta (de vidre, la frontissa i el tirador es trien com a les de fusta).
    if (!door.glass) {
      delete door.glass
      delete door.frame
    }
    if (door.mode === "double") door.hinge = "left"
    out.front = door
  }
  else if (f?.kind === "flap") {
    // Com la porta: sense vidre, el marc no compta (de vidre, el braç i el tirador es trien igual; cap forat al tauler).
    const flap = { ...f }
    if (!flap.glass) {
      delete flap.glass
      delete flap.frame
    } else delete flap.handleInset
    out.front = flap
  }
  else if (f?.kind === "grille") {
    // Patró: de ranures (amplada i separació) o de forats (Ø i pas); el de l'altre tipus no surt. Amb imants, sense frontisses.
    const p = f.pattern
    const pattern = p.kind === "holes" ? { ...p, slotWidth: DEFAULT_GRILLE.slotWidth, slotGap: DEFAULT_GRILLE.slotGap } : { ...p, holeDiameter: DEFAULT_GRILLE.holeDiameter, holePitch: DEFAULT_GRILLE.holePitch }
    const grille = { ...f, pattern, ...(f.mount === "removable" ? { hinge: "left" as const } : {}) }
    // L'imant triat només compta si hi ha imants (reixeta desmuntable o trapa).
    if (f.mount !== "removable" && !f.hatch) delete grille.hardware
    out.front = grille
  }
  // L'electrodomèstic que ocupa el compartiment (el nínxol): ni prestatges ni accessoris (es conserven).
  if (out.appliance && fillsNiche(out.appliance.hardware.appliance!)) {
    delete out.shelves
    delete out.rail
    delete out.led
  }
  return out
}

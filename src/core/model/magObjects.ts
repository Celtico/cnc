import type { Template } from "./templates"
import { blob, cyl, ellipse, flat, front, leaf, objectComposition as obj, roundRect, side, tube, wave } from "./objectShapes"

/**
 * Objectes «de revista» per a les escenes del catàleg d'ambients: sofàs amb coixins, daybeds,
 * quadres, miralls, plantes (tropical, olivera, pi), cortines amb plecs, catifes, làmpades…
 * Tot són peces lliures amb forma (perfils extrudits) i materials de simulació: es veuen igual
 * al visor i al render per CPU, sense motor de física.
 */
type Q = ReturnType<typeof flat>

/** Sofà amb base, respatller, braços i coixins de seient i d'esquena (+ dos coixins decoratius). */
function sofaParts(w: number, d: number, mat: string, pillow: string, pillow2 = pillow, arms: "both" | "left" | "none" = "both"): Q[] {
  const arm = 180, back = 220, seatY = 380
  const x0 = arms === "none" ? 0 : arm
  const x1 = arms === "both" ? w - arm : w
  const n = Math.max(1, Math.round((x1 - x0) / 800))
  const cw = (x1 - x0) / n
  const parts: Q[] = [
    flat("Sòcol", "Pintura negra", 60, 0, 60, w - 120, d - 120, 60),
    flat("Base", mat, 0, 60, 0, w, d, seatY - 60),
    front("Respatller", mat, 0, 60, 0, w, 700, back),
  ]
  if (arms !== "none") parts.push(side("Braç", mat, 0, 60, back, d - back, 560, arm, roundRect(d - back, 560, 60)))
  if (arms === "both") parts.push(side("Braç", mat, w - arm, 60, back, d - back, 560, arm, roundRect(d - back, 560, 60)))
  for (let i = 0; i < n; i++) {
    parts.push(flat("Coixí de seient", mat, x0 + i * cw + 5, seatY, back, cw - 10, d - back - 10, 170, roundRect(cw - 10, d - back - 10, 70)))
    parts.push(front("Coixí d'esquena", mat, x0 + i * cw + 5, seatY + 150, back, cw - 10, 470, 200, roundRect(cw - 10, 470, 110)))
  }
  parts.push(front("Coixí", pillow, x0 + 60, seatY + 170, back + 200, 460, 460, 140, roundRect(460, 460, 150)))
  parts.push(front("Coixí", pillow2, x1 - 520, seatY + 170, back + 200, 460, 460, 140, roundRect(460, 460, 150)))
  return parts
}

/** Planta de fulles grans (tipus strelitzia): test, tiges i fulles en creu. */
function tropicalParts(pot: string, big = true): Q[] {
  const s = big ? 1 : 0.65
  const c = 450
  const potD = 460 * s, potH = 480 * s
  const leaves: [number, number, number, "f" | "s", number, number][] = [
    [0, 0, 1000, "f", 300, 900],
    [-120, -80, 850, "s", 280, 850],
    [140, 60, 900, "s", 260, 800],
    [-80, 120, 1050, "f", 250, 760],
    [100, -120, 780, "f", 240, 700],
    [20, 20, 1250, "s", 230, 650],
    [-160, 40, 700, "f", 220, 620],
  ]
  const parts: Q[] = [cyl("Test", pot, c, 0, c, potD, potH), cyl("Terra", "Terra de test", c, potH - 20, c, potD - 40, 30)]
  for (const [dx, dz, y, o, lw, lh] of leaves) {
    const x = c + dx * s, z = c + dz * s, yy = potH + (y - 480) * s, w = lw * s, h = lh * s
    parts.push(cyl("Tija", "Fulles clares", x, potH, z, 22 * s, Math.max(20, yy - potH + 40)))
    parts.push(o === "f" ? front("Fulla", "Fulles", x - w / 2, yy, z - 6, w, h, 12, leaf(w, h)) : side("Fulla", "Fulles", x - 6, yy, z - w / 2, w, h, 12, leaf(w, h)))
  }
  return parts
}

/** Ampolla: cos cilíndric, espatlla arrodonida i coll (discs, com les capçades). */
function bottle(name: string, mat: string, cx: number, cz: number, dia: number, h: number): Q[] {
  const body = h * 0.62, shoulder = h * 0.14
  return [
    cyl(name, mat, cx, 0, cz, dia, body),
    ...Array.from({ length: 4 }, (_, k) => cyl(name, mat, cx, body + (shoulder * k) / 4, cz, dia * (1 - 0.17 * (k + 1)), shoulder / 4)),
    cyl(name, mat, cx, body + shoulder, cz, dia * 0.3, h - body - shoulder),
  ]
}

/** Gerro: panxa arrodonida (discs) i coll; `neck` = el coll respecte de l'amplada. */
function vase(name: string, mat: string, cx: number, cz: number, dia: number, h: number, neck: number): Q[] {
  const n = 9, bodyH = h * 0.82
  const parts = Array.from({ length: n }, (_, k) => {
    const t = (k + 0.5) / n
    const f = Math.max(neck, Math.sin(Math.PI * (0.15 + 0.8 * t)))
    return cyl(name, mat, cx, (bodyH * k) / n, cz, dia * f, bodyH / n)
  })
  parts.push(cyl(name, mat, cx, bodyH, cz, dia * neck, h - bodyH))
  return parts
}

const t = (id: string, name: string, description: string, make: () => Q[]): Template => ({ id: `object-${id}`, kind: "objecte", name, description, make: () => obj(make()) })

export const MAG_OBJECTS: Template[] = [
  // --- Seients ---
  t("sofa-linen", "Sofà de lli amb coixins", "2400 × 820 × 1000 mm · coixins de seient i d'esquena i dos decoratius.", () => sofaParts(2400, 1000, "Teixit sorra", "Teixit ocre", "Lli blanc")),
  t("sofa-l", "Sofà en L", "2900 × 820 × 1700 mm · chaise longue a la dreta, bouclé.", () => {
    const p = sofaParts(2900, 950, "Bouclé blanc", "Teixit ocre", "Lli blanc", "left")
    return [
      ...p,
      flat("Base chaise", "Bouclé blanc", 2000, 60, 950, 900, 750, 320),
      flat("Sòcol", "Pintura negra", 2060, 0, 950, 780, 690, 60),
      flat("Coixí chaise", "Bouclé blanc", 2005, 380, 900, 890, 790, 170, roundRect(890, 790, 70)),
    ]
  }),
  t("sofa-olive", "Sofà de vellut oliva en L", "3000 × 800 × 1800 mm · vellut verd oliva.", () => {
    const p = sofaParts(3000, 950, "Vellut verd oliva", "Teixit ocre", "Teixit sorra", "left")
    return [...p, flat("Base chaise", "Vellut verd oliva", 2100, 60, 950, 900, 850, 320), flat("Coixí chaise", "Vellut verd oliva", 2105, 380, 900, 890, 890, 170, roundRect(890, 890, 70))]
  }),
  t("daybed", "Daybed amb coixins rodons", "2000 × 470 × 850 mm · base de noguera, matalàs i dos coixins rodons.", () => [
    flat("Base", "Noguera xapada", 0, 0, 0, 2000, 850, 300),
    flat("Matalàs", "Lli blanc", 25, 300, 25, 1950, 800, 150, roundRect(1950, 800, 60)),
    front("Coixí rodó", "Teixit blau marí", 60, 450, 90, 220, 220, 670, ellipse(220, 220)),
    front("Coixí rodó", "Teixit blau marí", 1720, 450, 90, 220, 220, 670, ellipse(220, 220)),
    front("Coixí", "Teixit ocre", 800, 450, 60, 420, 420, 130, roundRect(420, 420, 140)),
  ]),
  t("lounge-chair", "Butaca lounge", "800 × 800 × 820 mm · bastidor de roure i coixins de teixit.", () => [
    side("Lateral", "Roure massís / xapat", 0, 0, 0, 820, 600, 40, roundRect(820, 600, 60)),
    side("Lateral", "Roure massís / xapat", 760, 0, 0, 820, 600, 40, roundRect(820, 600, 60)),
    flat("Seient", "Roure massís / xapat", 40, 220, 40, 720, 740, 50),
    flat("Coixí de seient", "Teixit sorra", 40, 270, 90, 720, 700, 150, roundRect(720, 700, 70)),
    front("Coixí d'esquena", "Teixit sorra", 40, 400, 40, 720, 400, 170, roundRect(720, 400, 110)),
  ]),
  t("armchair-grey", "Butaca de teixit gris", "850 × 780 × 850 mm · tapissada, coixí de seient.", () => [
    flat("Base", "Teixit gris", 0, 80, 0, 850, 850, 320, roundRect(850, 850, 80)),
    front("Respatller", "Teixit gris", 0, 80, 0, 850, 700, 200, roundRect(850, 700, 90)),
    side("Braç", "Teixit gris", 0, 80, 200, 650, 520, 160, roundRect(650, 520, 70)),
    side("Braç", "Teixit gris", 690, 80, 200, 650, 520, 160, roundRect(650, 520, 70)),
    flat("Coixí", "Teixit gris", 160, 400, 200, 530, 640, 140, roundRect(530, 640, 70)),
    ...[
      [80, 80],
      [730, 80],
      [80, 730],
      [730, 730],
    ].map(([x, z]) => cyl("Pota", "Noguera xapada", x! + 20, 0, z! + 20, 40, 80)),
  ]),
  t("chair-leather", "Cadira de cuir verd", "500 × 820 × 560 mm · entapissada, potes de ferro.", () => [
    ...[
      [30, 60],
      [470, 60],
      [30, 520],
      [470, 520],
    ].map(([x, z]) => cyl("Pota", "Ferro negre", x!, 0, z!, 24, 440)),
    flat("Seient", "Cuir verd", 0, 440, 40, 500, 520, 80, roundRect(500, 520, 60)),
    front("Respatller", "Cuir verd", 0, 470, 0, 500, 350, 60, roundRect(500, 350, 80)),
  ]),
  t("chair-oak", "Cadira de roure amb seient de corda", "540 × 780 × 520 mm · respatller corbat.", () => [
    flat("Pota", "Roure massís / xapat", 20, 0, 440, 35, 35, 440),
    flat("Pota", "Roure massís / xapat", 485, 0, 440, 35, 35, 440),
    flat("Pota", "Roure massís / xapat", 30, 0, 20, 35, 35, 700),
    flat("Pota", "Roure massís / xapat", 475, 0, 20, 35, 35, 700),
    flat("Seient", "Jute", 20, 440, 20, 500, 480, 30),
    front("Respatller", "Roure massís / xapat", 0, 680, 10, 540, 100, 45, roundRect(540, 100, 45)),
  ]),
  t("stool", "Tamboret", "Ø 360 × 650 mm · roure.", () => [
    cyl("Seient", "Roure massís / xapat", 180, 610, 180, 360, 40),
    ...[0, 120, 240].map((a) => cyl("Pota", "Roure massís / xapat", 180 + 110 * Math.cos((a * Math.PI) / 180), 0, 180 + 110 * Math.sin((a * Math.PI) / 180), 35, 610)),
    cyl("Anella", "Roure massís / xapat", 180, 250, 180, 250, 20),
  ]),
  t("pouf", "Puf", "Ø 800 × 450 mm · teixit.", () => blob("Puf", "Teixit sorra", 400, 0, 400, 800, 800, 450)),
  t("pouf-bean", "Puf de lona", "Ø 900 × 600 mm · bean bag.", () => blob("Puf", "Teixit ocre", 450, 0, 450, 900, 850, 600)),
  t("bench-builtin", "Banc d'obra amb coixins", "2400 × 450 × 600 mm · formigó clar, coixins de seient i d'esquena.", () => [
    flat("Banc", "Formigó clar", 0, 0, 0, 2400, 600, 400),
    ...[0, 1, 2].map((i) => flat("Coixí de seient", "Teixit sorra", 10 + i * 795, 400, 20, 785, 570, 110, roundRect(785, 570, 50))),
    ...[0, 1, 2].map((i) => front("Coixí d'esquena", "Lli blanc", 10 + i * 795, 490, 0, 785, 420, 150, roundRect(785, 420, 110))),
    front("Coixí", "Teixit blau marí", 140, 520, 150, 420, 420, 120, roundRect(420, 420, 140)),
    front("Coixí", "Teixit blau marí", 1850, 520, 150, 420, 420, 120, roundRect(420, 420, 140)),
  ]),
  // --- Taules ---
  t("coffee-brass", "Taula de centre de llautó", "Ø 900 × 380 mm · tauler de pedra i estructura de llautó.", () => [
    cyl("Tauler", "Pedra calcària", 450, 350, 450, 900, 30),
    cyl("Anella", "Llautó", 450, 320, 450, 860, 30),
    ...[90, 210, 330].map((a) => cyl("Pota", "Llautó", 450 + 380 * Math.cos((a * Math.PI) / 180), 0, 450 + 380 * Math.sin((a * Math.PI) / 180), 30, 320)),
  ]),
  t("cube-walnut", "Taula de centre cub", "900 × 400 × 900 mm · noguera massissa.", () => [flat("Cub", "Noguera xapada", 0, 0, 0, 900, 900, 400)]),
  t("low-table-black", "Taula baixa negra", "1300 × 320 × 700 mm · exterior.", () => [
    flat("Tauler", "Pintura negra", 0, 280, 0, 1300, 700, 40),
    side("Lateral", "Pintura negra", 60, 0, 40, 620, 280, 40),
    side("Lateral", "Pintura negra", 1200, 0, 40, 620, 280, 40),
  ]),
  t("table-cloth", "Taula amb estovalles", "2040 × 760 × 990 mm · estovalles de lli fins a mitja pota.", () => [
    ...[
      [80, 80],
      [1900, 80],
      [80, 850],
      [1900, 850],
    ].map(([x, z]) => flat("Pota", "Roure massís / xapat", x!, 0, z!, 60, 60, 720)),
    flat("Tauler", "Roure massís / xapat", 20, 720, 20, 2000, 950, 36),
    flat("Estovalles", "Lli blanc", 0, 756, 0, 2040, 990, 6),
    front("Caiguda", "Lli blanc", 0, 480, 0, 2040, 282, 6),
    front("Caiguda", "Lli blanc", 0, 480, 984, 2040, 282, 6),
    side("Caiguda", "Lli blanc", 0, 480, 6, 978, 282, 6),
    side("Caiguda", "Lli blanc", 2034, 480, 6, 978, 282, 6),
  ]),
  t("oval-white", "Taula oval blanca", "2400 × 750 × 1100 mm · dos peus cilíndrics.", () => [
    flat("Tauler", "Ceràmica blanca", 0, 720, 0, 2400, 1100, 30, ellipse(2400, 1100)),
    cyl("Peu", "Ceràmica blanca", 700, 0, 550, 380, 720),
    cyl("Peu", "Ceràmica blanca", 1700, 0, 550, 380, 720),
  ]),
  t("stone-table", "Taula de pedra", "2600 × 750 × 1000 mm · tauler i peus de pedra calcària.", () => [
    flat("Tauler", "Pedra calcària", 0, 700, 0, 2600, 1000, 50),
    side("Peu", "Pedra calcària", 420, 0, 200, 600, 700, 70),
    side("Peu", "Pedra calcària", 2110, 0, 200, 600, 700, 70),
  ]),
  t("concrete-cart", "Taula baixa de formigó amb rodes", "900 × 320 × 600 mm.", () => [
    flat("Bloc", "Formigó clar", 0, 70, 0, 900, 600, 250, roundRect(900, 600, 20)),
    ...[
      [70, 70],
      [830, 70],
      [70, 530],
      [830, 530],
    ].map(([x, z]) => cyl("Roda", "Pintura negra", x!, 0, z!, 60, 70)),
  ]),
  // --- Parets ---
  t("art-abstract", "Quadre abstracte", "1000 × 1300 × 45 mm · llenç sobre bastidor.", () => [
    front("Marc", "Roure massís / xapat", 0, 0, 0, 1000, 1300, 30),
    front("Llenç", "Lli blanc", 25, 25, 10, 950, 1250, 35),
    front("Forma", "Teixit ocre", 140, 520, 45, 560, 560, 4, ellipse(560, 560)),
    front("Forma", "Pintura negra", 520, 160, 46, 330, 720, 4, roundRect(330, 720, 165)),
    front("Forma", "Teixit sorra", 110, 980, 45, 640, 200, 4, roundRect(640, 200, 100)),
  ]),
  t("art-dark", "Quadre fosc", "1400 × 1000 × 45 mm · marc negre.", () => [front("Marc", "Pintura negra", 0, 0, 0, 1400, 1000, 30), front("Llenç", "Llenç fosc", 30, 30, 10, 1340, 940, 35)]),
  t("mirror-rect", "Mirall rectangular", "800 × 1800 mm · marc de noguera.", () => [front("Marc", "Noguera xapada", 0, 0, 0, 800, 1800, 30), front("Mirall", "Mirall", 40, 40, 8, 720, 1720, 30)]),
  t("mirror-arch", "Mirall d'arc", "900 × 1400 mm · per a rebedors i consoles.", () => {
    const w = 900, h = 1400, r = w / 2
    const shape = [
      { x: 0, y: 0 },
      { x: w, y: 0 },
      { x: w, y: h - r, out: [0, 0.5523 * r] as [number, number] },
      { x: r, y: h, in: [0.5523 * r, 0] as [number, number], out: [-0.5523 * r, 0] as [number, number] },
      { x: 0, y: h - r, in: [0, 0.5523 * r] as [number, number] },
    ]
    return [front("Marc", "Llautó", 0, 0, 0, w, h, 20, shape), front("Mirall", "Mirall", 25, 25, 6, w - 50, h - 50, 20, shape)]
  }),
  t("tv-65", "Televisió 65\"", "1450 × 830 × 35 mm · per penjar.", () => [front("Marc", "Alumini negre", 0, 0, 0, 1450, 830, 25), front("Pantalla", "Pantalla negra", 8, 8, 25, 1434, 814, 8)]),
  t("curtain-linen", "Cortina de lli", "1500 × 2600 mm · plecs fins a terra.", () => [flat("Cortina", "Lli blanc", 0, 0, 0, 1500, 160, 2580, wave(1500, 160, 10))]),
  t("curtain-tulle", "Cortina de tul", "1500 × 2600 mm · tul blanc amb plecs.", () => [flat("Cortina", "Tul blanc", 0, 0, 0, 1500, 140, 2580, wave(1500, 140, 12, 10))]),
  // --- Llums ---
  // Les bombetes fan llum al render (material «Bombeta»). Les pantalles de lli són un tub obert de «Lli blanc», que
  // deixa passar una part de la llum (per decisió de l'usuari, com una làmpada de debò: la llum surt per dalt i per baix
  // i la tela brilla). «Pantalla de lli» (la tela que fa llum ella sola) es queda per als objectes d'abans.
  t("pendant-dome", "Llum de sostre (cúpula)", "Ø 450 × 1100 mm · penja del sostre (posa'l a 1500 del terra).", () => [
    cyl("Bombeta", "Bombeta", 225, 0, 225, 110, 60),
    flat("Pantalla", "Pintura verd sàlvia", 0, 40, 0, 450, 450, 110, ellipse(450, 450)),
    flat("Pantalla", "Pintura verd sàlvia", 55, 150, 55, 340, 340, 90, ellipse(340, 340)),
    flat("Pantalla", "Pintura verd sàlvia", 130, 240, 130, 190, 190, 60, ellipse(190, 190)),
    cyl("Cable", "Pintura negra", 225, 300, 225, 8, 800),
  ]),
  t("pendant-black", "Llum de sostre negre", "Ø 300 × 1100 mm · metall negre.", () => [
    cyl("Bombeta", "Bombeta", 150, 0, 150, 90, 50),
    flat("Pantalla", "Ferro negre", 0, 30, 0, 300, 300, 180, ellipse(300, 300)),
    flat("Pantalla", "Ferro negre", 75, 210, 75, 150, 150, 60, ellipse(150, 150)),
    cyl("Cable", "Pintura negra", 150, 270, 150, 8, 830),
  ]),
  t("pendant-drum", "Llum de sostre de lli", "Ø 600 × 1000 mm · tambor de lli obert amb la bombeta a dins.", () => [
    ...tube("Pantalla", "Lli blanc", 300, 0, 300, 600, 280),
    cyl("Bombeta", "Bombeta", 300, 90, 300, 70, 100),
    cyl("Portalàmpades", "Pintura negra", 300, 190, 300, 30, 50),
    cyl("Cable", "Pintura negra", 300, 240, 300, 8, 760),
  ]),
  t("table-lamp", "Làmpada de taula", "Ø 350 × 600 mm · peu de ceràmica i pantalla de lli oberta amb la bombeta a dins.", () => [
    cyl("Peu", "Ceràmica blanca", 175, 0, 175, 160, 320),
    cyl("Portalàmpades", "Llautó", 175, 320, 175, 24, 60),
    cyl("Bombeta", "Bombeta", 175, 380, 175, 55, 85),
    ...tube("Pantalla", "Lli blanc", 175, 340, 175, 350, 260),
  ]),
  t("floor-lamp-arc", "Làmpada de peu de llautó", "Ø 450 × 1650 mm · pantalla de lli oberta amb la bombeta a dins.", () => [
    cyl("Base", "Pedra calcària", 225, 0, 225, 300, 40),
    cyl("Pal", "Llautó", 225, 40, 225, 22, 1400),
    cyl("Portalàmpades", "Llautó", 225, 1440, 225, 30, 50),
    cyl("Bombeta", "Bombeta", 225, 1490, 225, 65, 100),
    ...tube("Pantalla", "Lli blanc", 225, 1390, 225, 450, 260),
  ]),
  // --- Plantes ---
  t("plant-tropical", "Planta tropical", "900 × 1900 mm · fulles grans en test blanc.", () => tropicalParts("Ceràmica blanca")),
  t("plant-tropical-small", "Planta tropical petita", "600 × 1300 mm · test de terracota.", () => tropicalParts("Pintura terracota", false)),
  t("olive", "Olivera en test", "Ø 900 × 1750 mm · test de terracota.", () => [
    cyl("Test", "Pintura terracota", 450, 0, 450, 520, 460),
    cyl("Terra", "Terra de test", 450, 440, 450, 480, 30),
    cyl("Tronc", "Escorça", 450, 460, 450, 80, 750),
    ...blob("Capçada", "Fulles clares", 450, 1000, 450, 900, 820, 620),
    ...blob("Capçada", "Fulles clares", 560, 1350, 380, 520, 480, 400),
  ]),
  t("pine", "Pi pinyoner", "Ø 3000 × 3800 mm · per a terrasses i jardins.", () => [
    cyl("Tronc", "Escorça", 1500, 0, 1500, 240, 2700),
    cyl("Branca", "Escorça", 1150, 2200, 1700, 110, 600),
    cyl("Branca", "Escorça", 1900, 2300, 1300, 110, 600),
    ...blob("Capçada", "Fulles de pi", 1500, 2550, 1500, 2000, 1800, 900, 6),
    ...blob("Capçada", "Fulles de pi", 800, 2450, 1700, 1500, 1300, 750, 5),
    ...blob("Capçada", "Fulles de pi", 2200, 2500, 1250, 1500, 1400, 800, 5),
    ...blob("Capçada", "Fulles de pi", 1600, 2900, 900, 1300, 1100, 700, 5),
    ...blob("Capçada", "Fulles de pi", 1400, 2800, 2100, 1300, 1100, 650, 5),
  ]),
  t("plant-small", "Planta petita", "Ø 320 × 460 mm · per a taules i prestatges.", () => [cyl("Test", "Ceràmica blanca", 160, 0, 160, 220, 180), ...blob("Fulles", "Fulles", 160, 160, 160, 320, 300, 300)]),
  t("planter", "Jardinera amb plantes", "1200 × 800 × 550 mm · formigó clar.", () => [
    flat("Jardinera", "Formigó clar", 0, 0, 0, 1200, 500, 420),
    ...blob("Plantes", "Fulles clares", 260, 380, 250, 520, 460, 420),
    ...blob("Plantes", "Fulles", 620, 380, 250, 480, 440, 500),
    ...blob("Plantes", "Fulles clares", 960, 380, 250, 440, 440, 380),
  ]),
  t("branches-vase", "Gerro amb branques", "Ø 300 × 900 mm · ceràmica negra.", () => [
    cyl("Gerro", "Ceràmica negra", 150, 0, 150, 260, 380),
    cyl("Branca", "Escorça", 120, 380, 150, 12, 480),
    cyl("Branca", "Escorça", 180, 380, 140, 12, 420),
    ...blob("Fulles", "Fulles clares", 150, 700, 150, 300, 220, 200),
  ]),
  // --- Tèxtils i complements ---
  t("cushion", "Coixí", "500 × 500 × 150 mm · lli.", () => [front("Coixí", "Teixit sorra", 0, 0, 0, 500, 500, 150, roundRect(500, 500, 160))]),
  t("throw", "Manta plegada", "500 × 60 × 350 mm.", () => [flat("Manta", "Teixit ocre", 0, 0, 0, 500, 350, 60, roundRect(500, 350, 25))]),
  // Roba de llit per posar sobre una plataforma (z = 0 al capçal; el matalàs comença a x = 50).
  t("bed-linen-160", "Roba de llit de 160", "1700 × 300 × 2030 mm · matalàs de 1600 × 2000, nòrdic de lli amb el plec, plaid de llana als peus i tres coixins.", () => [
    flat("Matalàs", "Bouclé blanc", 50, 0, 0, 1600, 2000, 200, roundRect(1600, 2000, 40)),
    // El nòrdic embolica la part de dalt del matalàs i cau una mica pels costats i els peus.
    flat("Nòrdic", "Lli blanc", 20, 70, 430, 1660, 1600, 205, roundRect(1660, 1600, 70)),
    flat("Plec del nòrdic", "Lli blanc", 25, 275, 430, 1650, 300, 35, roundRect(1650, 300, 30)),
    flat("Plaid", "Teixit gris", 0, 275, 1480, 1700, 480, 28, roundRect(1700, 480, 20)),
    front("Coixí", "Lli blanc", 110, 200, 40, 700, 460, 170, roundRect(700, 460, 130)),
    front("Coixí", "Lli blanc", 890, 200, 40, 700, 460, 170, roundRect(700, 460, 130)),
    front("Coixí", "Teixit sorra", 600, 200, 230, 500, 340, 130, roundRect(500, 340, 110)),
  ]),
  t("books", "Pila de llibres", "500 × 240 × 220 mm.", () => [flat("Llibres", "Llibres", 0, 0, 0, 500, 220, 240)]),
  // --- Decoració de prestatge i de taula (per als renders: les fotos de catàleg sempre en porten) ---
  t("books-standing", "Llibres drets", "420 × 260 × 220 mm · una filera de llibres de diverses alçades i gruixos.", () => {
    const books: [number, number, string][] = [[28, 250, "Llibres"], [36, 235, "Teixit sorra"], [22, 255, "Llibres"], [44, 225, "Teixit blau marí"], [30, 245, "Llibres"], [26, 215, "Teixit ocre"], [40, 240, "Llibres"], [34, 230, "Cuir negre"]]
    let x = 0
    return books.map(([w, h, m], i) => {
      const q = front(`Llibre ${i + 1}`, m, x, 0, 0, w, h, 200)
      x += w + 2
      return q
    })
  }),
  t("bottles-amber", "Ampolles d'ambre", "360 × 300 × 120 mm · tres ampolles de vidre ambre (caben en un prestatge de 32 cm).", () =>
    ([[60, 300, 110], [180, 250, 95], [290, 205, 80]] as const).flatMap(([cx, h, dia], i) => bottle(`Ampolla ${i + 1}`, "Vidre ambre", cx, 60, dia, h)),
  ),
  t("vases-ceramic", "Gerros de ceràmica", "420 × 300 × 220 mm · un gerro alt sorra i un de rodó negre.", () => [
    ...vase("Gerro alt", "Ceràmica sorra", 100, 110, 170, 300, 0.55),
    ...vase("Gerro rodó", "Ceràmica negra", 300, 110, 210, 210, 0.35),
  ]),
  t("bowl-wood", "Bol de fusta", "Ø 320 × 120 mm · noguera.", () => blob("Bol", "Noguera xapada", 160, 0, 160, 320, 320, 120, 5)),
  t("wine-glasses", "Copes", "260 × 220 × 90 mm · tres copes de vidre.", () =>
    ([45, 130, 215] as const).flatMap((cx, i) => [
      cyl(`Peu de copa ${i + 1}`, "Vidre", cx, 0, 45, 70, 6),
      cyl(`Tija ${i + 1}`, "Vidre", cx, 6, 45, 8, 100),
      ...blob(`Copa ${i + 1}`, "Vidre", cx, 106, 45, 82, 82, 110, 6),
    ]),
  ),
  t("rug-jute", "Catifa de jute", "2400 × 1700 mm.", () => [flat("Catifa", "Jute", 0, 0, 0, 2400, 1700, 12, roundRect(2400, 1700, 30))]),
  t("rug-kilim", "Catifa kilim", "2000 × 3000 mm.", () => [flat("Catifa", "Catifa kilim", 0, 0, 0, 2000, 3000, 10)]),
  t("rug-grey", "Catifa gris gran", "3000 × 2400 mm.", () => [flat("Catifa", "Catifa gris", 0, 0, 0, 3000, 2400, 14)]),
  t("rug-round", "Catifa rodona", "Ø 2200 mm.", () => [flat("Catifa", "Catifa beix", 0, 0, 0, 2200, 2200, 12, ellipse(2200, 2200))]),
  t("rug-white", "Catifa blanca", "1600 × 2300 mm.", () => [flat("Catifa", "Bouclé blanc", 0, 0, 0, 1600, 2300, 14, roundRect(1600, 2300, 30))]),
]
